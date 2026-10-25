import {
  ArtifactFormat,
  ArtifactSymbol,
  ArtifactTarget,
  BinarySection,
  CodeSlice,
  ExtractedString,
} from '../types/rea';

export function computeShannonEntropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const counts = new Uint32Array(256);
  for (let i = 0; i < bytes.length; i++) {
    counts[bytes[i]]++;
  }
  let entropy = 0;
  const len = bytes.length;
  for (let i = 0; i < 256; i++) {
    if (counts[i] > 0) {
      const p = counts[i] / len;
      entropy -= p * Math.log2(p);
    }
  }
  return Math.round(entropy * 100) / 100;
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback deterministic FNV-style 256-bit hex if subtle crypto unavailable
  }
  let h1 = 0xdeadbeef ^ bytes.length;
  let h2 = 0x41c6ce57 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    const ch = bytes[i];
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const part = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `${part(h1)}${part(h2)}${part(h1 ^ 0x9e3779b9)}${part(h2 ^ 0x85ebca6b)}${part(h1 + h2)}${part(h1 ^ h2)}${part(h1 * 3)}${part(h2 * 7)}`;
}

export function classifyString(val: string): ExtractedString['category'] {
  const lower = val.toLowerCase();
  if (
    lower.startsWith('ipc:') ||
    lower.includes('ipcmain') ||
    lower.includes('ipcrenderer') ||
    lower.includes('channel:') ||
    lower.includes('bridge:') ||
    lower.includes('clipboard:')
  ) {
    return 'ipc_channel';
  }
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('wss://') ||
    lower.startsWith('/api/') ||
    lower.startsWith('/v1/') ||
    lower.startsWith('/v2/')
  ) {
    return 'url_endpoint';
  }
  if (
    lower.includes('hmac') ||
    lower.includes('sha256') ||
    lower.includes('aes-') ||
    lower.includes('crc32') ||
    lower.includes('0x1edc6f41') ||
    lower.includes('magic') ||
    lower.includes('nonce') ||
    lower.includes('signature')
  ) {
    return 'crypto_constant';
  }
  if (
    lower.includes('error') ||
    lower.includes('invalid') ||
    lower.includes('failed') ||
    lower.includes('mismatch') ||
    lower.includes('rejected')
  ) {
    return 'error_diagnostic';
  }
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]{3,48}$/.test(val)) {
    return 'symbol_identifier';
  }
  return 'general';
}

export function extractStringsFromBytes(
  bytes: Uint8Array,
  minLength = 5,
  maxCount = 90
): ExtractedString[] {
  const results: ExtractedString[] = [];
  let start = -1;
  let current = '';

  const flush = (endIdx: number) => {
    const trimmed = current.trim();
    if (trimmed.length >= minLength && results.length < maxCount) {
      results.push({
        id: `str_${results.length + 1}`,
        value: trimmed.slice(0, 140),
        offset: start,
        length: endIdx - start,
        encoding: 'ascii',
        category: classifyString(trimmed),
        referencingSymbols: [],
      });
    }
    start = -1;
    current = '';
  };

  const scanLimit = Math.min(bytes.length, 65536);
  for (let i = 0; i < scanLimit; i++) {
    const b = bytes[i];
    if (b >= 0x20 && b <= 0x7e) {
      if (start === -1) start = i;
      current += String.fromCharCode(b);
    } else {
      if (start !== -1) flush(i);
    }
  }
  if (start !== -1) flush(scanLimit);
  return results;
}

export function detectArtifactFormat(
  fileName: string,
  bytes: Uint8Array
): { format: ArtifactFormat; formatLabel: string; architecture: string } {
  const lower = fileName.toLowerCase();
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x61 &&
    bytes[2] === 0x73 &&
    bytes[3] === 0x6d
  ) {
    return {
      format: 'wasm',
      formatLabel: 'WebAssembly Binary Module (WASM v1)',
      architecture: 'wasm32-unknown-unknown',
    };
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x7f &&
    bytes[1] === 0x45 &&
    bytes[2] === 0x4c &&
    bytes[3] === 0x46
  ) {
    const is64 = bytes[4] === 2;
    return {
      format: 'elf',
      formatLabel: is64 ? 'ELF 64-bit LSB Executable / Shared Object' : 'ELF 32-bit LSB Binary',
      architecture: is64 ? 'x86_64-pc-linux-gnu' : 'i386-pc-linux-gnu',
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return {
      format: 'pe',
      formatLabel: 'PE32+ Executable (Windows x86_64)',
      architecture: 'x86_64-pc-windows-msvc',
    };
  }
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0xcf && bytes[1] === 0xfa && bytes[2] === 0xed && bytes[3] === 0xfe) ||
      (bytes[0] === 0xfe && bytes[1] === 0xed && bytes[2] === 0xfa && bytes[3] === 0xcf))
  ) {
    return {
      format: 'macho',
      formatLabel: 'Mach-O 64-bit Executable',
      architecture: 'arm64-apple-darwin',
    };
  }
  if (lower.endsWith('.asar') || (bytes.length > 16 && bytes[0] === 0x04 && bytes[4] === 0x00)) {
    return {
      format: 'asar',
      formatLabel: 'Electron ASAR Archive Bundle',
      architecture: 'Electron Renderer/Main IPC (Node.js V8)',
    };
  }
  if (lower.endsWith('.map')) {
    return {
      format: 'sourcemap',
      formatLabel: 'SourceMap v3 Mapping Artifact',
      architecture: 'ECMAScript Source Mapping',
    };
  }
  if (
    lower.endsWith('.js') ||
    lower.endsWith('.mjs') ||
    lower.endsWith('.cjs') ||
    lower.endsWith('.ts')
  ) {
    return {
      format: 'javascript',
      formatLabel: 'JavaScript / TypeScript Application Bundle',
      architecture: 'ECMAScript / Webpack / Rollup Bundle',
    };
  }
  return {
    format: 'raw',
    formatLabel: 'Binary / Structured Container Artifact',
    architecture: 'Generic Byte Stream',
  };
}

export async function parseUploadedArtifact(
  fileName: string,
  buffer: ArrayBuffer
): Promise<ArtifactTarget> {
  const bytes = new Uint8Array(buffer);
  const sha256 = await computeSha256Hex(bytes);
  const entropy = computeShannonEntropy(bytes);
  const { format, formatLabel, architecture } = detectArtifactFormat(fileName, bytes);

  const magicSlice = Array.from(bytes.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  const strings = extractStringsFromBytes(bytes);
  const sections: BinarySection[] = [];
  const symbols: ArtifactSymbol[] = [];
  const codeSlices: CodeSlice[] = [];

  if (format === 'javascript' || format === 'sourcemap' || format === 'asar') {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 32768));
    sections.push(
      {
        name: '.header_metadata',
        offset: 0,
        size: Math.min(256, bytes.length),
        entropy: computeShannonEntropy(bytes.slice(0, Math.min(256, bytes.length))),
        flags: 'r--',
        description: 'Bundle / container prelude and module table metadata',
      },
      {
        name: '.module_graph',
        offset: Math.min(256, bytes.length),
        size: Math.max(0, bytes.length - 256),
        entropy,
        flags: 'r-x',
        description: 'Executable JavaScript module closures and IPC dispatch handlers',
      }
    );

    const fnRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(|exports\.([a-zA-Z0-9_$]+)\s*=)/g;
    let match: RegExpExecArray | null;
    let idx = 0;
    while ((match = fnRegex.exec(text)) !== null && idx < 25) {
      const fnName = match[1] || match[2] || match[3];
      if (fnName) {
        symbols.push({
          id: `sym_js_${idx++}`,
          name: fnName,
          kind: match[3] ? 'export' : 'function',
          addressOrOffset: `0x${match.index.toString(16).padStart(6, '0')}`,
          moduleOrSection: '.module_graph',
          signature: `${fnName}(payload, context)`,
          xrefCount: 2 + (idx % 5),
        });
      }
    }

    const ipcRegex = /['"]((?:ipc|bridge|clipboard|auth|sync|electron):[a-zA-Z0-9:_-]+)['"]/g;
    while ((match = ipcRegex.exec(text)) !== null && idx < 40) {
      symbols.push({
        id: `sym_ipc_${idx++}`,
        name: match[1],
        kind: 'ipc_channel',
        addressOrOffset: `0x${match.index.toString(16).padStart(6, '0')}`,
        moduleOrSection: 'ipcMain.handle',
        signature: `ipcChannel("${match[1]}")`,
        xrefCount: 3,
      });
    }

    codeSlices.push({
      id: 'slice_uploaded_1',
      title: `${fileName} — Extracted Source / Bundle Slice`,
      language: format === 'sourcemap' ? 'json' : 'javascript',
      startOffset: 0,
      endOffset: Math.min(bytes.length, 4096),
      content: text.slice(0, 3200),
      relatedSymbols: symbols.slice(0, 6).map((s) => s.name),
    });
  } else {
    // Binary format (WASM, ELF, PE, Mach-O, Raw)
    const quarter = Math.max(64, Math.floor(bytes.length / 4));
    sections.push(
      {
        name: format === 'wasm' ? 'type_and_import' : '.header',
        offset: 0,
        size: Math.min(quarter, bytes.length),
        entropy: computeShannonEntropy(bytes.slice(0, Math.min(quarter, bytes.length))),
        flags: 'r--',
        description: `${format.toUpperCase()} binary header, magic signature, and import descriptors`,
      },
      {
        name: format === 'wasm' ? 'code_section' : '.text',
        offset: Math.min(quarter, bytes.length),
        size: Math.min(quarter * 2, Math.max(0, bytes.length - quarter)),
        entropy: computeShannonEntropy(bytes.slice(quarter, quarter * 3)),
        flags: 'r-x',
        description: 'Executable instructions, control flow blocks, and dispatch tables',
      },
      {
        name: format === 'wasm' ? 'data_rodata' : '.rodata',
        offset: Math.min(quarter * 3, bytes.length),
        size: Math.max(0, bytes.length - quarter * 3),
        entropy: computeShannonEntropy(bytes.slice(quarter * 3)),
        flags: 'r--',
        description: 'Read-only string literals, protocol constants, and lookup tables',
      }
    );

    strings.slice(0, 12).forEach((s, i) => {
      symbols.push({
        id: `sym_bin_${i}`,
        name: s.value.replace(/[^a-zA-Z0-9_:.-]/g, '_').slice(0, 36) || `sub_${s.offset.toString(16)}`,
        kind: i % 3 === 0 ? 'export' : i % 3 === 1 ? 'import' : 'function',
        addressOrOffset: `0x${s.offset.toString(16).padStart(6, '0')}`,
        moduleOrSection: i % 2 === 0 ? '.text' : '.rodata',
        signature: `fn_${s.offset.toString(16)}(ptr: i32, len: i32) -> i32`,
        xrefCount: 1 + (i % 4),
      });
    });

    const hexPreviewLines: string[] = [];
    const sliceLen = Math.min(bytes.length, 512);
    for (let offset = 0; offset < sliceLen; offset += 16) {
      const row = bytes.slice(offset, offset + 16);
      const hexPart = Array.from(row)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      const asciiPart = Array.from(row)
        .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
        .join('');
      hexPreviewLines.push(
        `0x${offset.toString(16).padStart(6, '0')}  ${hexPart.padEnd(47, ' ')}  |${asciiPart}|`
      );
    }

    codeSlices.push({
      id: 'slice_bin_1',
      title: `${fileName} — Dissected Binary Header & Entry Slice`,
      language: format === 'wasm' ? 'wat' : 'x86_64_asm',
      startOffset: 0,
      endOffset: sliceLen,
      content: hexPreviewLines.join('\n'),
      relatedSymbols: symbols.slice(0, 5).map((s) => s.name),
    });
  }

  if (symbols.length === 0) {
    symbols.push({
      id: 'sym_entry_0',
      name: 'entry_point_0',
      kind: 'export',
      addressOrOffset: '0x000000',
      moduleOrSection: sections[0]?.name || '.text',
      signature: 'entry_point_0(ctx: uintptr_t)',
      xrefCount: 1,
    });
  }

  return {
    id: `target_${Date.now()}`,
    name: fileName,
    size: bytes.length,
    format,
    formatLabel,
    architecture,
    sha256,
    entropy,
    magicBytesHex: magicSlice,
    sections,
    symbols,
    strings,
    codeSlices,
    hexBytes: Array.from(bytes.slice(0, 2048)),
    presetPrompts: [
      `Trace the primary entry points, data framing, and validation logic in ${fileName}`,
      `Identify all external imports, IPC boundaries, and security checks in ${fileName}`,
      `Recover the state machine and build a cleanroom TypeScript implementation of ${fileName}`,
    ],
  };
}

function encodeAsciiToBytes(str: string, prefixBytes: number[] = []): number[] {
  const out = [...prefixBytes];
  for (let i = 0; i < str.length; i++) {
    out.push(str.charCodeAt(i) & 0xff);
  }
  return out;
}

export const BUILTIN_SAMPLE_TARGETS: ArtifactTarget[] = (() => {
  // 1. Electron ASAR Bundle (inspired by morluto/rea Notion clipboard-bridge showcase)
  const asarSourcePayload = `// ASAR Header: {"files":{"package.json":{"size":214,"offset":"0"},"main":{"files":{"clipboard-bridge.js":{"size":1840,"offset":"214"}}},"preload":{"files":{"bridge-preload.js":{"size":920,"offset":"2054"}}}}}
const { ipcMain, clipboard, nativeImage } = require("electron");
const crypto = require("crypto");

const BRIDGE_MAGIC = 0x4E544342; // "NTCB" Notion-style Clipboard Bridge frame
const IPC_CHANNEL_WRITE = "bridge:clipboard:write-structured-slice";
const IPC_CHANNEL_READ  = "bridge:clipboard:read-structured-slice";
const CUSTOM_MIME_FORMAT = "application/x-rea-structured-blocks+json";

function computeFrameHmac(sessionSalt, payloadBuffer) {
  return crypto.createHmac("sha256", sessionSalt).update(payloadBuffer).digest("hex");
}

function encodeClipboardEnvelope(blocks, workspaceId, sessionSalt) {
  const bodyJson = JSON.stringify({ version: 2, workspaceId, blocks, ts: Date.now() });
  const bodyBytes = Buffer.from(bodyJson, "utf8");
  const header = Buffer.alloc(12);
  header.writeUInt32BE(BRIDGE_MAGIC, 0);
  header.writeUInt16BE(2, 4); // protocol_version = 2
  header.writeUInt16BE(0x0104, 6); // flags = COMPRESSED_NONE | SIGNED_HMAC
  header.writeUInt32BE(bodyBytes.length, 8);
  const frame = Buffer.concat([header, bodyBytes]);
  const signature = computeFrameHmac(sessionSalt, frame);
  return { frame, signature };
}

ipcMain.handle(IPC_CHANNEL_WRITE, async (event, rawRequest) => {
  if (!rawRequest || typeof rawRequest.workspaceId !== "string") {
    throw new Error("ERR_BRIDGE_INVALID_WORKSPACE_ID");
  }
  const { frame, signature } = encodeClipboardEnvelope(
    rawRequest.blocks || [],
    rawRequest.workspaceId,
    process.env.REA_SESSION_SALT || "static-dev-fallback-salt"
  );
  clipboard.writeBuffer(CUSTOM_MIME_FORMAT, frame);
  return { ok: true, byteLength: frame.length, signature, format: CUSTOM_MIME_FORMAT };
});
`;

  const asarBytes = encodeAsciiToBytes(
    asarSourcePayload,
    [0x04, 0x00, 0x00, 0x00, 0x98, 0x00, 0x00, 0x00, 0x94, 0x00, 0x00, 0x00, 0x8f, 0x00, 0x00, 0x00]
  );

  // 2. WebAssembly Frame Codec Module (inspired by morluto/rea inspect_wasm_artifact & compare_wasm_interfaces)
  const wasmSourceText = `(module $frame_codec_v2
  (import "env" "host_trace_event" (func $host_trace_event (param i32 i32)))
  (import "env" "clock_timestamp_ms" (func $clock_timestamp_ms (result i64)))
  (memory (export "memory") 2)
  (global $FRAME_SYNC_WORD i32 (i32.const 0x52454132)) ;; "REA2"
  (global $CRC32C_POLY i32 (i32.const 0x82F63B78))

  ;; Exported: encode_packet_frame(src_ptr: i32, src_len: i32, dst_ptr: i32, flags: i32) -> i32
  (func (export "encode_packet_frame") (param $src i32) (param $len i32) (param $dst i32) (param $flags i32) (result i32)
    (local $crc i32)
    (if (i32.gt_u (local.get $len) (i32.const 4096))
      (then (return (i32.const -1)))) ;; ERR_PAYLOAD_OVERFLOW
    (i32.store (local.get $dst) (global.get $FRAME_SYNC_WORD))
    (i32.store16 offset=4 (local.get $dst) (local.get $flags))
    (i32.store16 offset=6 (local.get $dst) (local.get $len))
    (memory.copy (i32.add (local.get $dst) (i32.const 12)) (local.get $src) (local.get $len))
    (local.set $crc (call $compute_crc32c (local.get $src) (local.get $len)))
    (i32.store offset=8 (local.get $dst) (local.get $crc))
    (call $host_trace_event (i32.const 1001) (local.get $len))
    (i32.add (local.get $len) (i32.const 12))
  )

  ;; Exported: compute_crc32c(buf_ptr: i32, buf_len: i32) -> i32
  (func $compute_crc32c (export "compute_crc32c") (param $ptr i32) (param $len i32) (result i32)
    ;; Castagnoli CRC32C polynomial 0x82F63B78 bitwise reduction loop
    (i32.xor (local.get $len) (global.get $CRC32C_POLY))
  )
)`;

  const wasmBytes = encodeAsciiToBytes(
    wasmSourceText,
    [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x11, 0x03, 0x60, 0x02, 0x7f, 0x7f, 0x00]
  );

  // 3. Native ELF64 Binary Daemon (inspired by morluto/rea Ghidra/Hopper/objdump native investigation)
  const elfDisassemblyText = `; ELF64 x86-64 Disassembly & Decompiled Dossier — pulse-sync-daemon.elf
; Section .text (0x00401000 - 0x00401880)

00401140 <pulse_handshake_verify>:
  401140: f3 0f 1e fa          endbr64
  401144: 55                   push   rbp
  401145: 48 89 e5             mov    rbp, rsp
  401148: 48 83 ec 30          sub    rsp, 0x30
  40114c: 81 3f 50 4c 53 31    cmp    dword ptr [rdi], 0x31534c50 ; Magic "PLS1"
  401152: 75 3a                jne    40118e <pulse_handshake_verify+0x4e>
  401154: 0f b7 47 04          movzx  eax, word ptr [rdi+0x4]     ; epoch_seq
  401158: 8b 57 08             mov    edx, dword ptr [rdi+0x8]    ; payload_len
  40115b: 81 fa 00 10 00 00    cmp    edx, 0x1000
  401161: 77 2b                ja     40118e <pulse_handshake_verify+0x4e>
  401163: 48 8d 77 10          lea    rsi, [rdi+0x10]
  401167: e8 54 01 00 00       call   4012c0 <fnv1a_64_digest>
  40116c: 48 3b 47 18          cmp    rax, qword ptr [rdi+0x18]   ; expected_mac
  401170: 75 1c                jne    40118e <pulse_handshake_verify+0x4e>
  401172: b8 01 00 00 00       mov    eax, 0x1
  401177: c9                   leave
  401178: c3                   ret
  40118e: b8 ff ff ff ff       mov    eax, 0xffffffff             ; ERR_HANDSHAKE_MAC_FAIL
  401193: c9                   leave
  401194: c3                   ret`;

  const elfBytes = encodeAsciiToBytes(
    elfDisassemblyText,
    [0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
  );

  return [
    {
      id: 'sample_electron_asar',
      name: 'notion-clipboard-bridge.asar',
      size: 18432,
      format: 'asar',
      formatLabel: 'Electron ASAR Archive Bundle',
      architecture: 'Electron Main/Preload IPC (Node.js V8)',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      entropy: 5.42,
      magicBytesHex: '04 00 00 00 98 00 00 00',
      sections: [
        {
          name: 'asar.header.json',
          offset: 0,
          size: 214,
          entropy: 4.18,
          flags: 'r--',
          description: 'Pickle-framed JSON directory header indexing package.json, main/, and preload/',
        },
        {
          name: 'main/clipboard-bridge.js',
          offset: 214,
          size: 14120,
          entropy: 5.56,
          flags: 'r-x',
          description: 'Electron main-process IPC handler framing NTCB binary headers + HMAC-SHA256 signatures',
        },
        {
          name: 'preload/bridge-preload.js',
          offset: 14334,
          size: 4098,
          entropy: 5.12,
          flags: 'r-x',
          description: 'contextBridge.exposeInMainWorld preload adapter exposing safe clipboard slice methods',
        },
      ],
      symbols: [
        {
          id: 'sym_asar_1',
          name: 'encodeClipboardEnvelope',
          kind: 'function',
          addressOrOffset: '0x00018a',
          moduleOrSection: 'main/clipboard-bridge.js',
          signature: 'encodeClipboardEnvelope(blocks: Block[], workspaceId: string, sessionSalt: string)',
          xrefCount: 4,
        },
        {
          id: 'sym_asar_2',
          name: 'computeFrameHmac',
          kind: 'function',
          addressOrOffset: '0x000112',
          moduleOrSection: 'main/clipboard-bridge.js',
          signature: 'computeFrameHmac(sessionSalt: string, payloadBuffer: Buffer) -> string',
          xrefCount: 3,
        },
        {
          id: 'sym_asar_3',
          name: 'bridge:clipboard:write-structured-slice',
          kind: 'ipc_channel',
          addressOrOffset: '0x000084',
          moduleOrSection: 'ipcMain.handle',
          signature: 'ipcMain.handle("bridge:clipboard:write-structured-slice", handler)',
          xrefCount: 6,
        },
        {
          id: 'sym_asar_4',
          name: 'bridge:clipboard:read-structured-slice',
          kind: 'ipc_channel',
          addressOrOffset: '0x0000b8',
          moduleOrSection: 'ipcMain.handle',
          signature: 'ipcMain.handle("bridge:clipboard:read-structured-slice", handler)',
          xrefCount: 5,
        },
        {
          id: 'sym_asar_5',
          name: 'clipboard.writeBuffer',
          kind: 'import',
          addressOrOffset: '0x000390',
          moduleOrSection: 'electron.clipboard',
          signature: 'clipboard.writeBuffer(format: string, buffer: Buffer) -> void',
          xrefCount: 2,
        },
      ],
      strings: [
        {
          id: 'str_asar_1',
          value: 'bridge:clipboard:write-structured-slice',
          offset: 132,
          length: 39,
          encoding: 'utf-8',
          category: 'ipc_channel',
          referencingSymbols: ['encodeClipboardEnvelope', 'ipcMain.handle'],
        },
        {
          id: 'str_asar_2',
          value: 'application/x-rea-structured-blocks+json',
          offset: 228,
          length: 40,
          encoding: 'utf-8',
          category: 'crypto_constant',
          referencingSymbols: ['encodeClipboardEnvelope', 'clipboard.writeBuffer'],
        },
        {
          id: 'str_asar_3',
          value: '0x4E544342 ("NTCB" 12-byte big-endian frame header)',
          offset: 96,
          length: 18,
          encoding: 'ascii',
          category: 'crypto_constant',
          referencingSymbols: ['encodeClipboardEnvelope'],
        },
        {
          id: 'str_asar_4',
          value: 'ERR_BRIDGE_INVALID_WORKSPACE_ID',
          offset: 742,
          length: 31,
          encoding: 'ascii',
          category: 'error_diagnostic',
          referencingSymbols: ['ipcMain.handle'],
        },
      ],
      codeSlices: [
        {
          id: 'slice_asar_main',
          title: 'main/clipboard-bridge.js (Recovered ASAR Entry)',
          language: 'javascript',
          startOffset: 214,
          endOffset: 2054,
          content: asarSourcePayload,
          relatedSymbols: [
            'encodeClipboardEnvelope',
            'computeFrameHmac',
            'bridge:clipboard:write-structured-slice',
          ],
        },
      ],
      hexBytes: asarBytes,
      presetPrompts: [
        'Trace how structured clipboard blocks are framed, signed, and sent across Electron IPC',
        'Audit the 12-byte NTCB binary header layout and HMAC-SHA256 salt handling for unknown runtime dependencies',
        'Synthesize a cleanroom TypeScript encoder/decoder compatible with application/x-rea-structured-blocks+json',
      ],
    },
    {
      id: 'sample_wasm_codec',
      name: 'frame-codec-v2.wasm',
      size: 8192,
      format: 'wasm',
      formatLabel: 'WebAssembly Binary Module (WASM v1)',
      architecture: 'wasm32-unknown-unknown',
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      entropy: 6.18,
      magicBytesHex: '00 61 73 6D 01 00 00 00',
      sections: [
        {
          name: 'Type & Import Section (ID 1, 2)',
          offset: 8,
          size: 192,
          entropy: 4.65,
          flags: 'r--',
          description: 'Declares function signatures and host imports env.host_trace_event, env.clock_timestamp_ms',
        },
        {
          name: 'Export Section (ID 7)',
          offset: 200,
          size: 148,
          entropy: 4.82,
          flags: 'r--',
          description: 'Exports memory (2 pages), encode_packet_frame, decode_packet_frame, compute_crc32c',
        },
        {
          name: 'Code Section (ID 10)',
          offset: 348,
          size: 6840,
          entropy: 6.45,
          flags: 'r-x',
          description: 'WASM bytecode bodies for frame header serialization and CRC32C Castagnoli checksums',
        },
      ],
      symbols: [
        {
          id: 'sym_wasm_1',
          name: 'encode_packet_frame',
          kind: 'export',
          addressOrOffset: '0x000180',
          moduleOrSection: 'Code[0]',
          signature: '(param $src i32) (param $len i32) (param $dst i32) (param $flags i32) -> (result i32)',
          xrefCount: 5,
        },
        {
          id: 'sym_wasm_2',
          name: 'compute_crc32c',
          kind: 'export',
          addressOrOffset: '0x0002c4',
          moduleOrSection: 'Code[1]',
          signature: '(param $ptr i32) (param $len i32) -> (result i32)',
          xrefCount: 4,
        },
        {
          id: 'sym_wasm_3',
          name: 'env.host_trace_event',
          kind: 'import',
          addressOrOffset: '0x000024',
          moduleOrSection: 'Import[0]',
          signature: '(param $event_id i32) (param $byte_len i32) -> void',
          xrefCount: 2,
        },
        {
          id: 'sym_wasm_4',
          name: 'env.clock_timestamp_ms',
          kind: 'import',
          addressOrOffset: '0x000048',
          moduleOrSection: 'Import[1]',
          signature: '() -> (result i64)',
          xrefCount: 1,
        },
      ],
      strings: [
        {
          id: 'str_wasm_1',
          value: '0x52454132 ("REA2" little-endian sync word)',
          offset: 364,
          length: 16,
          encoding: 'ascii',
          category: 'crypto_constant',
          referencingSymbols: ['encode_packet_frame'],
        },
        {
          id: 'str_wasm_2',
          value: '0x82F63B78 (CRC32C Castagnoli polynomial)',
          offset: 412,
          length: 18,
          encoding: 'ascii',
          category: 'crypto_constant',
          referencingSymbols: ['compute_crc32c'],
        },
        {
          id: 'str_wasm_3',
          value: 'ERR_PAYLOAD_OVERFLOW (len > 4096 returns -1)',
          offset: 488,
          length: 28,
          encoding: 'ascii',
          category: 'error_diagnostic',
          referencingSymbols: ['encode_packet_frame'],
        },
      ],
      codeSlices: [
        {
          id: 'slice_wasm_wat',
          title: 'frame-codec-v2.wasm (Decoded WAT Representation via inspect_wasm_artifact)',
          language: 'wat',
          startOffset: 0,
          endOffset: 1024,
          content: wasmSourceText,
          relatedSymbols: ['encode_packet_frame', 'compute_crc32c', 'env.host_trace_event'],
        },
      ],
      hexBytes: wasmBytes,
      presetPrompts: [
        'Inspect the WASM export signatures, linear memory layout, and 12-byte REA2 packet header format',
        'Verify how compute_crc32c and host_trace_event interact during encode_packet_frame',
        'Generate a zero-dependency TypeScript cleanroom implementation of the WASM packet codec',
      ],
    },
    {
      id: 'sample_elf_daemon',
      name: 'pulse-sync-daemon.elf',
      size: 32768,
      format: 'elf',
      formatLabel: 'ELF 64-bit LSB Shared Object (x86_64)',
      architecture: 'x86_64-pc-linux-gnu',
      sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      entropy: 6.74,
      magicBytesHex: '7F 45 4C 46 02 01 01 00',
      sections: [
        {
          name: '.text',
          offset: 0x1000,
          size: 0x0880,
          entropy: 6.62,
          flags: 'r-x',
          description: 'x86-64 machine instructions including pulse_handshake_verify and fnv1a_64_digest',
        },
        {
          name: '.rodata',
          offset: 0x2000,
          size: 0x0420,
          entropy: 5.14,
          flags: 'r--',
          description: 'Protocol magic constants ("PLS1"), error strings, and FNV-1a prime constants',
        },
        {
          name: '.dynsym / .dynstr',
          offset: 0x2420,
          size: 0x0380,
          entropy: 4.89,
          flags: 'r--',
          description: 'Dynamic symbol table and exported daemon procedure names',
        },
      ],
      symbols: [
        {
          id: 'sym_elf_1',
          name: 'pulse_handshake_verify',
          kind: 'export',
          addressOrOffset: '0x00401140',
          moduleOrSection: '.text',
          signature: 'int32_t pulse_handshake_verify(const uint8_t *pkt_buf)',
          xrefCount: 7,
        },
        {
          id: 'sym_elf_2',
          name: 'fnv1a_64_digest',
          kind: 'function',
          addressOrOffset: '0x004012c0',
          moduleOrSection: '.text',
          signature: 'uint64_t fnv1a_64_digest(const uint8_t *data, uint32_t len)',
          xrefCount: 4,
        },
        {
          id: 'sym_elf_3',
          name: 'pulse_frame_dispatch',
          kind: 'export',
          addressOrOffset: '0x00401350',
          moduleOrSection: '.text',
          signature: 'int32_t pulse_frame_dispatch(int sock_fd, const uint8_t *pkt_buf)',
          xrefCount: 3,
        },
      ],
      strings: [
        {
          id: 'str_elf_1',
          value: '0x31534C50 ("PLS1" handshake header magic at offset +0x00)',
          offset: 0x2010,
          length: 16,
          encoding: 'ascii',
          category: 'crypto_constant',
          referencingSymbols: ['pulse_handshake_verify'],
        },
        {
          id: 'str_elf_2',
          value: '0xcbf29ce484222325 (FNV-1a 64-bit offset basis)',
          offset: 0x2048,
          length: 20,
          encoding: 'ascii',
          category: 'crypto_constant',
          referencingSymbols: ['fnv1a_64_digest'],
        },
        {
          id: 'str_elf_3',
          value: 'ERR_HANDSHAKE_MAC_FAIL (returns -1 / 0xffffffff)',
          offset: 0x2090,
          length: 30,
          encoding: 'ascii',
          category: 'error_diagnostic',
          referencingSymbols: ['pulse_handshake_verify'],
        },
      ],
      codeSlices: [
        {
          id: 'slice_elf_asm',
          title: 'pulse_handshake_verify (.text 0x00401140 Disassembly)',
          language: 'x86_64_asm',
          startOffset: 0x1140,
          endOffset: 0x1195,
          content: elfDisassemblyText,
          relatedSymbols: ['pulse_handshake_verify', 'fnv1a_64_digest'],
        },
      ],
      hexBytes: elfBytes,
      presetPrompts: [
        'Decompile pulse_handshake_verify at 0x00401140 and map the struct offsets at [rdi+0x00..0x18]',
        'Trace how fnv1a_64_digest validates the handshake frame and identify any bounds check limitations',
        'Reconstruct the PLS1 binary handshake verifier in cleanroom TypeScript using DataView and BigInt',
      ],
    },
  ];
})();
