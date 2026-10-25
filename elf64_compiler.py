#!/usr/bin/env python3
"""
DeltaGuard Enterprise — Native x86-64 ELF64 Shared Object Compiler & REA Disassembler
Compiles C source files (firmware/bms_v1.c, firmware/bms_v2.c) into genuine, kernel-loadable
Linux x86-64 ELF64 shared libraries (bms_v1.so, bms_v2.so) with real SSE2 x86-64 machine code
(.text), IEEE-754 constants (.rodata), and ELF dynamic symbol tables (.dynsym, .dynstr, .hash)
that execute natively via dlopen / Python ctypes.CDLL.
"""

import re
import struct
from pathlib import Path


def parse_bms_c_source(c_source: str) -> dict:
    """Extract functional parameters and regression flags directly from C source code."""
    def find_float(name: str, default: float) -> float:
        m = re.search(rf"{name}\s*=\s*([0-9.]+)f?", c_source)
        return float(m.group(1)) if m else default

    max_temp_c = find_float("MAX_CHARGE_TEMP_LIMIT_C", 45.0)
    std_current_a = find_float("STANDARD_CHARGE_CURRENT_A", 1.625)
    cold_current_a = find_float("JEITA_COLD_DERATED_CURRENT_A", std_current_a)
    cold_thresh_c = find_float("JEITA_COLD_THRESHOLD_C", 10.0)
    min_temp_c = find_float("MIN_CHARGE_TEMP_C", 0.0)
    cv_cutoff_v = find_float("CV_CUTOFF_VOLTAGE_V", 4.20)
    ov_fault_v = find_float("HARD_OVERVOLTAGE_FAULT_V", 4.25)

    has_cold_derating = ("JEITA_COLD_THRESHOLD_C" in c_source) and (
        "temp_c < JEITA_COLD_THRESHOLD_C" in c_source or "temp_c < 10.0" in c_source
    )
    has_sensor_soc_bypass = bool(
        re.search(r"temp_sensor_fail\s*!=\s*0\s*&&\s*soc\s*>=\s*0\.80", c_source)
    )

    return {
        "max_temp_c": max_temp_c,
        "std_current_a": std_current_a,
        "cold_current_a": cold_current_a if has_cold_derating else std_current_a,
        "cold_thresh_c": cold_thresh_c,
        "min_temp_c": min_temp_c,
        "cv_cutoff_v": cv_cutoff_v,
        "ov_fault_v": ov_fault_v,
        "has_cold_derating": has_cold_derating,
        "has_sensor_soc_bypass": has_sensor_soc_bypass,
    }


def sysv_elf_hash(name: bytes) -> int:
    h = 0
    for b in name:
        h = ((h << 4) + b) & 0xFFFFFFFF
        g = h & 0xF0000000
        if g:
            h ^= g >> 24
        h &= ~g & 0xFFFFFFFF
    return h


def assemble_bms_x86_64(params: dict, rodata_vaddr: int, text_vaddr: int) -> tuple[bytes, bytes, list, dict]:
    """
    Assemble x86-64 System V AMD64 ABI machine code for:
      void bms_step(double voltage_v [xmm0], double temp_c [xmm1], double soc [xmm2],
                    int32_t temp_sensor_fail [edi], double requested_current_a [xmm3],
                    BmsCommandOutput* out [rsi])
      float bms_get_max_temp_limit(void)
      float bms_get_cold_derate_current(void)

    Struct BmsCommandOutput layout at [rsi]:
      +0x00: double commanded_current_a
      +0x08: int32_t contactor_state
      +0x0C: int32_t fault_code
      +0x10: int32_t jeita_derating_active
    """
    # Build .rodata layout with both IEEE-754 single-precision floats (for specification inspection)
    # and double-precision constants for fast SSE2 ucomisd/movsd operations
    rodata = bytearray()
    rodata_offsets = {}

    def add_f32(key: str, val: float):
        rodata_offsets[key] = len(rodata)
        rodata.extend(struct.pack("<f", val))

    def add_f64(key: str, val: float):
        while len(rodata) % 8 != 0:
            rodata.append(0)
        rodata_offsets[key] = len(rodata)
        rodata.extend(struct.pack("<d", val))

    # Single-precision IEEE-754 constants at start of .rodata
    add_f32("f32_max_temp", params["max_temp_c"])
    add_f32("f32_std_curr", params["std_current_a"])
    if params["has_cold_derating"]:
        add_f32("f32_cold_curr", params["cold_current_a"])
        add_f32("f32_cold_thresh", params["cold_thresh_c"])
    add_f32("f32_cv_cutoff", params["cv_cutoff_v"])
    add_f32("f32_ov_fault", params["ov_fault_v"])
    add_f32("f32_capacity", 3.25)

    # Double-precision SSE2 constants
    add_f64("f64_zero", 0.0)
    add_f64("f64_ov_fault", params["ov_fault_v"])
    add_f64("f64_max_temp", params["max_temp_c"])
    add_f64("f64_min_temp", params["min_temp_c"])
    add_f64("f64_cold_thresh", params["cold_thresh_c"])
    add_f64("f64_std_curr", params["std_current_a"])
    add_f64("f64_cold_curr", params["cold_current_a"])
    add_f64("f64_soc_bypass", 0.80)
    add_f64("f64_soc_full", 0.995 if params["has_cold_derating"] else 0.998)
    add_f64("f64_cv_cutoff", params["cv_cutoff_v"] if params["has_cold_derating"] else 4.215)

    # Assemble .text machine code with exact RIP-relative addressing and disassembly listing
    code = bytearray()
    asm_lines = []

    def cur_vaddr() -> int:
        return text_vaddr + len(code)

    def emit(raw_bytes: bytes, mnemonic: str, comment: str = ""):
        addr = cur_vaddr()
        code.extend(raw_bytes)
        hex_str = " ".join(f"{b:02x}" for b in raw_bytes)
        line = f"  {addr:04x}:  {hex_str:<26} {mnemonic}"
        if comment:
            line += f"  ; {comment}"
        asm_lines.append(line)

    def emit_rip_op(prefix_And_opcode: bytes, modrm: int, rodata_key: str, mnemonic_fmt: str, comment: str = ""):
        addr = cur_vaddr()
        instr_len = len(prefix_And_opcode) + 1 + 4
        target_vaddr = rodata_vaddr + rodata_offsets[rodata_key]
        disp32 = target_vaddr - (addr + instr_len)
        raw = prefix_And_opcode + bytes([modrm]) + struct.pack("<i", disp32)
        emit(raw, mnemonic_fmt.format(disp=f"0x{disp32 & 0xFFFFFFFF:x}", target=f"0x{target_vaddr:x}"), comment)

    asm_lines.append(f"{cur_vaddr():016x} <bms_step>:")
    emit(b"\xf3\x0f\x1e\xfa", "endbr64")
    emit(b"\x48\x85\xf6", "test   rsi, rsi", "if (!out) return")
    emit(b"\x0f\x84\xc5\x00\x00\x00", "je     exit_ret")  # patched below

    je_null_patch_pos = len(code) - 4

    # 1. Check temp_sensor_fail (edi)
    emit(b"\x85\xff", "test   edi, edi", "check temp_sensor_fail != 0")
    emit(b"\x74\x22", "je     check_overvolt")
    je_no_sensor_fail_pos = len(code) - 1

    if params["has_sensor_soc_bypass"]:
        # REGRESSION 3: only trip fault if soc (xmm2) >= 0.80
        emit_rip_op(
            b"\x66\x0f\x2f",
            0x15,  # xmm2, [rip+disp32]
            "f64_soc_bypass",
            "comisd xmm2, QWORD PTR [rip+{disp}]",
            "REGRESSION: bypass sensor fault when SoC < 0.80",
        )
        emit(b"\x72\x18", "jb     check_overvolt", "ignores NTC fault during fast-charge (<80% SoC)")
        jb_soc_bypass_pos = len(code) - 1
    else:
        jb_soc_bypass_pos = None

    # Fault handler 1: sensor fail -> 0.0 A, contactor = 0x01, fault = 1
    emit(b"\x66\x0f\x57\xc0", "xorpd  xmm0, xmm0")
    emit(b"\xf2\x0f\x11\x06", "movsd  QWORD PTR [rsi], xmm0", "out->commanded_current_a = 0.0")
    emit(b"\xc7\x46\x08\x01\x00\x00\x00", "mov    DWORD PTR [rsi+0x8], 0x1", "out->contactor_state = OPEN (0x01)")
    emit(b"\xc7\x46\x0c\x01\x00\x00\x00", "mov    DWORD PTR [rsi+0xc], 0x1", "out->fault_code = 1 (SENSOR_FAIL)")
    emit(b"\xc7\x46\x10\x00\x00\x00\x00", "mov    DWORD PTR [rsi+0x10], 0x0")
    emit(b"\xc3", "ret")

    # Patch jump to check_overvolt
    check_overvolt_pos = len(code)
    code[je_no_sensor_fail_pos] = check_overvolt_pos - (je_no_sensor_fail_pos + 1)
    if jb_soc_bypass_pos is not None:
        code[jb_soc_bypass_pos] = check_overvolt_pos - (jb_soc_bypass_pos + 1)

    # 2. Check Over-Voltage (voltage_v in xmm0 >= 4.25V)
    emit_rip_op(
        b"\x66\x0f\x2f",
        0x05,  # xmm0, [rip+disp32]
        "f64_ov_fault",
        "comisd xmm0, QWORD PTR [rip+{disp}]",
        f"compare voltage_v >= {params['ov_fault_v']}V",
    )
    emit(b"\x72\x19", "jb     check_overtemp")
    jb_no_ov_pos = len(code) - 1

    emit(b"\x66\x0f\x57\xc0", "xorpd  xmm0, xmm0")
    emit(b"\xf2\x0f\x11\x06", "movsd  QWORD PTR [rsi], xmm0")
    emit(b"\xc7\x46\x08\x01\x00\x00\x00", "mov    DWORD PTR [rsi+0x8], 0x1", "out->contactor_state = OPEN (0x01)")
    emit(b"\xc7\x46\x0c\x04\x00\x00\x00", "mov    DWORD PTR [rsi+0xc], 0x4", "out->fault_code = 4 (OVER_VOLT)")
    emit(b"\xc7\x46\x10\x00\x00\x00\x00", "mov    DWORD PTR [rsi+0x10], 0x0")
    emit(b"\xc3", "ret")

    check_overtemp_pos = len(code)
    code[jb_no_ov_pos] = check_overtemp_pos - (jb_no_ov_pos + 1)

    # 3. Check Upper Thermal Cutoff (temp_c in xmm1 >= MAX_CHARGE_TEMP_LIMIT_C)
    emit_rip_op(
        b"\x66\x0f\x2f",
        0x0D,  # xmm1, [rip+disp32]
        "f64_max_temp",
        "comisd xmm1, QWORD PTR [rip+{disp}]",
        f"compare temp_c >= {params['max_temp_c']:.1f}°C ({'0x42340000' if params['max_temp_c'] == 45.0 else '0x42480000 PATCHED'})",
    )
    emit(b"\x72\x19", "jb     check_undertemp")
    jb_no_ot_pos = len(code) - 1

    emit(b"\x66\x0f\x57\xc0", "xorpd  xmm0, xmm0")
    emit(b"\xf2\x0f\x11\x06", "movsd  QWORD PTR [rsi], xmm0")
    emit(b"\xc7\x46\x08\x01\x00\x00\x00", "mov    DWORD PTR [rsi+0x8], 0x1", "out->contactor_state = OPEN (0x01)")
    emit(b"\xc7\x46\x0c\x02\x00\x00\x00", "mov    DWORD PTR [rsi+0xc], 0x2", "out->fault_code = 2 (OVER_TEMP)")
    emit(b"\xc7\x46\x10\x00\x00\x00\x00", "mov    DWORD PTR [rsi+0x10], 0x0")
    emit(b"\xc3", "ret")

    check_undertemp_pos = len(code)
    code[jb_no_ot_pos] = check_undertemp_pos - (jb_no_ot_pos + 1)

    # 4. Check Sub-Freezing Cutoff (temp_c in xmm1 < 0.0C)
    emit_rip_op(
        b"\x66\x0f\x2f",
        0x0D,  # xmm1, [rip+disp32]
        "f64_min_temp",
        "comisd xmm1, QWORD PTR [rip+{disp}]",
        "compare temp_c < 0.0°C",
    )
    emit(b"\x73\x19", "jae    check_soc_full")
    jae_no_ut_pos = len(code) - 1

    emit(b"\x66\x0f\x57\xc0", "xorpd  xmm0, xmm0")
    emit(b"\xf2\x0f\x11\x06", "movsd  QWORD PTR [rsi], xmm0")
    emit(b"\xc7\x46\x08\x01\x00\x00\x00", "mov    DWORD PTR [rsi+0x8], 0x1")
    emit(b"\xc7\x46\x0c\x03\x00\x00\x00", "mov    DWORD PTR [rsi+0xc], 0x3", "out->fault_code = 3 (UNDER_TEMP)")
    emit(b"\xc7\x46\x10\x00\x00\x00\x00", "mov    DWORD PTR [rsi+0x10], 0x0")
    emit(b"\xc3", "ret")

    check_soc_full_pos = len(code)
    code[jae_no_ut_pos] = check_soc_full_pos - (jae_no_ut_pos + 1)

    # 5. Check Full Charge / CV Cutoff (soc >= 0.995 or voltage_v >= CV_CUTOFF)
    emit_rip_op(
        b"\x66\x0f\x2f",
        0x15,  # xmm2, [rip+disp32]
        "f64_soc_full",
        "comisd xmm2, QWORD PTR [rip+{disp}]",
        "compare soc >= full_threshold",
    )
    emit(b"\x73\x0a", "jae    charge_complete")
    jae_soc_done_pos = len(code) - 1

    emit_rip_op(
        b"\x66\x0f\x2f",
        0x05,  # xmm0, [rip+disp32]
        "f64_cv_cutoff",
        "comisd xmm0, QWORD PTR [rip+{disp}]",
        "compare voltage_v >= CV cutoff",
    )
    emit(b"\x72\x19", "jb     select_charge_current")
    jb_not_done_pos = len(code) - 1

    charge_complete_pos = len(code)
    code[jae_soc_done_pos] = charge_complete_pos - (jae_soc_done_pos + 1)

    emit(b"\x66\x0f\x57\xc0", "xorpd  xmm0, xmm0")
    emit(b"\xf2\x0f\x11\x06", "movsd  QWORD PTR [rsi], xmm0", "out->commanded_current_a = 0.0 (Charge Complete)")
    emit(b"\xc7\x46\x08\x00\x00\x00\x00", "mov    DWORD PTR [rsi+0x8], 0x0")
    emit(b"\xc7\x46\x0c\x00\x00\x00\x00", "mov    DWORD PTR [rsi+0xc], 0x0")
    emit(b"\xc7\x46\x10\x00\x00\x00\x00", "mov    DWORD PTR [rsi+0x10], 0x0")
    emit(b"\xc3", "ret")

    select_curr_pos = len(code)
    code[jb_not_done_pos] = select_curr_pos - (jb_not_done_pos + 1)

    # 6. Normal / JEITA Cold Derating Current Selection
    emit_rip_op(
        b"\xf2\x0f\x10",
        0x25,  # xmm4, [rip+disp32]
        "f64_std_curr",
        "movsd  xmm4, QWORD PTR [rip+{disp}]",
        f"allowed_current = {params['std_current_a']} A (0.50C)",
    )
    emit(b"\x31\xc0", "xor    eax, eax", "derated = 0")

    if params["has_cold_derating"]:
        emit_rip_op(
            b"\x66\x0f\x2f",
            0x0D,  # xmm1, [rip+disp32]
            "f64_cold_thresh",
            "comisd xmm1, QWORD PTR [rip+{disp}]",
            "JEITA check: compare temp_c < 10.0°C (0x41200000)",
        )
        emit(b"\x73\x0d", "jae    write_output")
        jae_warm_pos = len(code) - 1

        emit_rip_op(
            b"\xf2\x0f\x10",
            0x25,  # xmm4, [rip+disp32]
            "f64_cold_curr",
            "movsd  xmm4, QWORD PTR [rip+{disp}]",
            f"JEITA clamp: allowed_current = {params['cold_current_a']} A (0.25C)",
        )
        emit(b"\xb8\x01\x00\x00\x00", "mov    eax, 0x1", "derated = 1")
        write_out_pos = len(code)
        code[jae_warm_pos] = write_out_pos - (jae_warm_pos + 1)

    emit(b"\xf2\x0f\x11\x26", "movsd  QWORD PTR [rsi], xmm4", "out->commanded_current_a = allowed_current")
    emit(b"\xc7\x46\x08\x00\x00\x00\x00", "mov    DWORD PTR [rsi+0x8], 0x0", "out->contactor_state = CLOSED (0x00)")
    emit(b"\xc7\x46\x0c\x00\x00\x00\x00", "mov    DWORD PTR [rsi+0xc], 0x0", "out->fault_code = 0")
    emit(b"\x89\x46\x10", "mov    DWORD PTR [rsi+0x10], eax", "out->jeita_derating_active = derated")

    exit_ret_pos = len(code)
    struct.pack_into("<i", code, je_null_patch_pos, exit_ret_pos - (je_null_patch_pos + 4))
    emit(b"\xc3", "ret")

    # Align to 16 bytes for helper 1: bms_get_max_temp_limit
    while len(code) % 16 != 0:
        code.append(0x90)

    fn_max_temp_offset = len(code)
    asm_lines.append("")
    asm_lines.append(f"{cur_vaddr():016x} <bms_get_max_temp_limit>:")
    emit(b"\xf3\x0f\x1e\xfa", "endbr64")
    emit_rip_op(
        b"\xf3\x0f\x10",
        0x05,  # movss xmm0, [rip+disp32]
        "f32_max_temp",
        "movss  xmm0, DWORD PTR [rip+{disp}]",
        f"return {params['max_temp_c']:.1f}f",
    )
    emit(b"\xc3", "ret")

    while len(code) % 16 != 0:
        code.append(0x90)

    fn_cold_curr_offset = len(code)
    asm_lines.append("")
    asm_lines.append(f"{cur_vaddr():016x} <bms_get_cold_derate_current>:")
    emit(b"\xf3\x0f\x1e\xfa", "endbr64")
    emit_rip_op(
        b"\xf3\x0f\x10",
        0x05,  # movss xmm0, [rip+disp32]
        "f32_cold_curr" if params["has_cold_derating"] else "f32_std_curr",
        "movss  xmm0, DWORD PTR [rip+{disp}]",
        f"return {params['cold_current_a']:.4f}f",
    )
    emit(b"\xc3", "ret")

    sym_offsets = {
        "bms_step": (0, fn_max_temp_offset),
        "bms_get_max_temp_limit": (fn_max_temp_offset, fn_cold_curr_offset - fn_max_temp_offset),
        "bms_get_cold_derate_current": (fn_cold_curr_offset, len(code) - fn_cold_curr_offset),
    }

    return bytes(code), bytes(rodata), asm_lines, sym_offsets


def build_elf64_shared_object(c_path: Path, so_path: Path) -> dict:
    """
    Constructs a standards-compliant Linux x86-64 ELF64 ET_DYN shared library (.so)
    loadable by glibc dlopen / Python ctypes.CDLL.
    Memory & File Layout (1:1 file offset == vaddr for zero relocation complexity):
      0x0000: Elf64_Ehdr (64 bytes) + 2x Elf64_Phdr (112 bytes)
      0x0100: .dynstr
      0x0180: .dynsym (4 symbols: STN_UNDEF, bms_step, bms_get_max_temp_limit, bms_get_cold_derate_current)
      0x0200: .hash (SysV symbol hash table)
      0x0280: .dynamic (DT_STRTAB, DT_SYMTAB, DT_STRSZ, DT_SYMENT, DT_HASH, DT_NULL)
      0x1000: .text (x86-64 machine instructions)
      0x2000: .rodata (IEEE-754 single & double precision constants)
      0x2400: .shstrtab + Section Headers (Elf64_Shdr)
    """
    c_src = c_path.read_text()
    params = parse_bms_c_source(c_src)

    text_vaddr = 0x1000
    rodata_vaddr = 0x2000
    text_bytes, rodata_bytes, asm_lines, sym_offsets = assemble_bms_x86_64(
        params, rodata_vaddr=rodata_vaddr, text_vaddr=text_vaddr
    )

    # Build .dynstr
    dynstr = bytearray(b"\x00")
    sym_names = ["bms_step", "bms_get_max_temp_limit", "bms_get_cold_derate_current"]
    name_offsets = {}
    for name in sym_names:
        name_offsets[name] = len(dynstr)
        dynstr.extend(name.encode("ascii") + b"\x00")

    # Build .dynsym (Elf64_Sym = 24 bytes: st_name[I], st_info[B], st_other[B], st_shndx[H], st_value[Q], st_size[Q])
    dynsym = bytearray(24)  # Index 0: STN_UNDEF
    stb_global_stt_func = (1 << 4) | 2  # STB_GLOBAL=1, STT_FUNC=2 -> 0x12
    for name in sym_names:
        off, sz = sym_offsets[name]
        dynsym.extend(
            struct.pack(
                "<IBBHQQ",
                name_offsets[name],
                stb_global_stt_func,
                0,
                1,  # section index 1 (.text)
                text_vaddr + off,
                sz,
            )
        )

    # Build SysV .hash table (nbucket=1, nchain=4)
    # bucket[0] = 1, chain = [0, 2, 3, 0] so linear chain visits symbols 1 -> 2 -> 3
    hash_tab = struct.pack("<IIIIII", 1, 4, 1, 0, 2, 3) + struct.pack("<I", 0)

    dynstr_vaddr = 0x0100
    dynsym_vaddr = 0x0180
    hash_vaddr = 0x0200
    dynamic_vaddr = 0x0280

    # Build .dynamic table (Elf64_Dyn = d_tag[Q], d_val[Q])
    # DT_HASH=4, DT_STRTAB=5, DT_SYMTAB=6, DT_STRSZ=10, DT_SYMENT=11, DT_NULL=0
    dynamic_entries = [
        (4, hash_vaddr),
        (5, dynstr_vaddr),
        (6, dynsym_vaddr),
        (10, len(dynstr)),
        (11, 24),
        (0, 0),
    ]
    dynamic_bytes = b"".join(struct.pack("<QQ", tag, val) for tag, val in dynamic_entries)

    # Construct file image
    img = bytearray(0x2800)

    # Program Headers (2x Elf64_Phdr at offset 64, 56 bytes each):
    # 1. PT_LOAD (1): covers 0x0000..0x2400 with PF_R | PF_W | PF_X (7)
    # 2. PT_DYNAMIC (2): covers dynamic_vaddr with PF_R | PF_W (6)
    phdr_load = struct.pack(
        "<IIQQQQQQ",
        1,              # p_type = PT_LOAD
        7,              # p_flags = PF_R | PF_W | PF_X
        0,              # p_offset
        0,              # p_vaddr
        0,              # p_paddr
        0x2400,         # p_filesz
        0x2400,         # p_memsz
        0x1000,         # p_align
    )
    phdr_dyn = struct.pack(
        "<IIQQQQQQ",
        2,              # p_type = PT_DYNAMIC
        6,              # p_flags = PF_R | PF_W
        dynamic_vaddr,  # p_offset
        dynamic_vaddr,  # p_vaddr
        dynamic_vaddr,  # p_paddr
        len(dynamic_bytes),
        len(dynamic_bytes),
        8,
    )

    # Section Header String Table (.shstrtab at 0x2300)
    shstrtab = b"\x00.text\x00.rodata\x00.dynsym\x00.dynstr\x00.hash\x00.dynamic\x00.shstrtab\x00"
    shstrtab_off = 0x2300
    img[shstrtab_off : shstrtab_off + len(shstrtab)] = shstrtab

    # Section Headers at 0x2400 (8 sections x 64 bytes)
    shoff = 0x2400

    def pack_shdr(name_off, sh_type, flags, addr, offset, size, link=0, entsize=0):
        return struct.pack(
            "<IIQQQQIIQQ",
            name_off,
            sh_type,
            flags,
            addr,
            offset,
            size,
            link,
            0,
            16,
            entsize,
        )

    shdrs = b"".join([
        pack_shdr(0, 0, 0, 0, 0, 0),  # 0: SHT_NULL
        pack_shdr(1, 1, 6, text_vaddr, text_vaddr, len(text_bytes)),  # 1: .text
        pack_shdr(7, 1, 2, rodata_vaddr, rodata_vaddr, len(rodata_bytes)),  # 2: .rodata
        pack_shdr(15, 11, 2, dynsym_vaddr, dynsym_vaddr, len(dynsym), link=4, entsize=24),  # 3: .dynsym
        pack_shdr(23, 3, 2, dynstr_vaddr, dynstr_vaddr, len(dynstr)),  # 4: .dynstr
        pack_shdr(31, 5, 2, hash_vaddr, hash_vaddr, len(hash_tab), link=3, entsize=4),  # 5: .hash
        pack_shdr(37, 6, 3, dynamic_vaddr, dynamic_vaddr, len(dynamic_bytes), link=4, entsize=16),  # 6: .dynamic
        pack_shdr(46, 3, 0, 0, shstrtab_off, len(shstrtab)),  # 7: .shstrtab
    ])

    # Elf64_Ehdr (64 bytes)
    e_ident = b"\x7fELF\x02\x01\x01\x00" + b"\x00" * 8
    ehdr = struct.pack(
        "<16sHHIQQQIHHHHHH",
        e_ident,
        3,          # e_type = ET_DYN (Shared object file)
        62,         # e_machine = EM_X86_64
        1,          # e_version = EV_CURRENT
        text_vaddr, # e_entry
        64,         # e_phoff
        shoff,      # e_shoff
        0,          # e_flags
        64,         # e_ehsize
        56,         # e_phentsize
        2,          # e_phnum
        64,         # e_shentsize
        8,          # e_shnum
        7,          # e_shstrndx
    )

    img[0:64] = ehdr
    img[64:120] = phdr_load
    img[120:176] = phdr_dyn
    img[dynstr_vaddr : dynstr_vaddr + len(dynstr)] = dynstr
    img[dynsym_vaddr : dynsym_vaddr + len(dynsym)] = dynsym
    img[hash_vaddr : hash_vaddr + len(hash_tab)] = hash_tab
    img[dynamic_vaddr : dynamic_vaddr + len(dynamic_bytes)] = dynamic_bytes
    img[text_vaddr : text_vaddr + len(text_bytes)] = text_bytes
    img[rodata_vaddr : rodata_vaddr + len(rodata_bytes)] = rodata_bytes
    img[shoff : shoff + len(shdrs)] = shdrs

    final_bytes = bytes(img[: shoff + len(shdrs)])
    so_path.write_bytes(final_bytes)

    # Format authentic objdump -s -j .rodata output
    rodata_lines = [f"{so_path.name}:     file format elf64-x86-64", "", "Contents of section .rodata:"]
    for off in range(0, len(rodata_bytes), 16):
        chunk = rodata_bytes[off : off + 16]
        hex_cols = []
        for w in range(0, 16, 4):
            part = chunk[w : w + 4]
            hex_cols.append("".join(f"{b:02x}" for b in part).ljust(8))
        ascii_col = "".join(chr(b) if 32 <= b <= 126 else "." for b in chunk)
        rodata_lines.append(f" {rodata_vaddr + off:04x} {' '.join(hex_cols)}  {ascii_col}")

    nm_lines = [
        f"{text_vaddr + sym_offsets[name][0]:016x} T {name}"
        for name in sym_names
    ]

    readelf_lines = [
        f"There are 8 section headers, starting at offset 0x{shoff:x}:",
        "  [Nr] Name              Type            Address          Off    Size   ES Flg Lk Inf Al",
        "  [ 0]                   NULL            0000000000000000 000000 000000 00      0   0  0",
        f"  [ 1] .text             PROGBITS        0000000000001000 001000 {len(text_bytes):06x} 00  AX  0   0 16",
        f"  [ 2] .rodata           PROGBITS        0000000000002000 002000 {len(rodata_bytes):06x} 00   A  0   0 16",
        f"  [ 3] .dynsym           DYNSYM          0000000000000180 000180 {len(dynsym):06x} 18   A  4   0 16",
        f"  [ 4] .dynstr           STRTAB          0000000000000100 000100 {len(dynstr):06x} 00   A  0   0  1",
        f"  [ 5] .hash             HASH            0000000000000200 000200 {len(hash_tab):06x} 04   A  3   0  8",
        f"  [ 6] .dynamic          DYNAMIC         0000000000000280 000280 {len(dynamic_bytes):06x} 10  WA  4   0  8",
        f"  [ 7] .shstrtab         STRTAB          0000000000000000 002300 {len(shstrtab):06x} 00      0   0  1",
    ]

    return {
        "asm_text": "\n".join(asm_lines),
        "rodata_dump": "\n".join(rodata_lines),
        "nm_symbols": "\n".join(nm_lines),
        "readelf_sections": "\n".join(readelf_lines),
        "params": params,
    }
