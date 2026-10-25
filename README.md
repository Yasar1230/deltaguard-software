# DeltaGuard SIL Workbench

**Autonomous Automotive OTA Firmware Homologation Gate, 3D Digital Twin & REA Binary Inspector (ISO 26262 ASIL-D & JEITA)**

DeltaGuard SIL Workbench is a full-stack Software-in-the-Loop (SIL) verification studio that catches deceptive physical regressions in automotive Over-The-Air (OTA) firmware updates before fleet deployment.

---

## Core Capabilities

1. **Foxglove-Style Product Overview & Interactive Studio Workbench**
   - Seamless transition between the **Product Overview Landing Page** and the **4-Panel Docked SIL Simulation Workbench**.
2. **17-Case Closed-Loop Physical Test Suite (Vector CANoe Style)**
   - **7 ADAS Longitudinal Kinematics Cases:** Highway lead braking, wet-road braking ($\mu = 0.4$), high-speed cut-in, pedestrian emergency braking, and sensor latency stress tests.
   - **10 BMS NCR18650B Electro-Thermal Cases:** $5^\circ\text{C}$ cold fast-charge (JEITA lithium-plating detection), $45^\circ\text{C}\rightarrow 50^\circ\text{C}$ thermal runaway cutoff override, high-altitude derating, and aged-cell internal resistance sweeps.
3. **3D Deterministic Vector Digital Twin**
   - Dual-vehicle shadow simulation comparing **Baseline v1.0.0 (Blue Car)** vs. **Candidate v2.0.0 (Red Car)** at 60 FPS, plus interactive **3D Panasonic NCR18650B Jelly-Roll Thermal Cutaway**.
4. **Synchronized Multi-Channel SIL Oscilloscope**
   - Real-time waveform overlays for stopping distance delta ($-3.88\text{m}$), AEB deceleration profiles, cell current ($1.625\text{A}$ spike), and core temperature ($50.0^\circ\text{C}$ breach).
5. **REA ELF64 Binary Disassembler & AST Diff Inspector**
   - Decompiles stripped `bms_v1.so` vs. `bms_v2.so` and `update_v2.json` to pinpoint exact parameter overrides (`aeb_ttc_s: 2.0 ➔ 1.8` and `MAX_TEMP_C: 45.0 ➔ 50.0`) and auto-generate verified patches.
6. **Interactive 4-Step Product Demo Walkthrough + ElevenLabs MP3 Sync**
   - Attach a custom voiceover `.mp3` (`[ 🎵 Attach Voiceover MP3 ]`) and launch the automated 45-second virtual cursor product walkthrough (`[ 🎬 Play Launch Video ]`) with synthesized Web Audio API click and alert sound effects.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the full-stack Express + Vite server on port 3000
npm run dev

# 3. Build for production
npm run build
```
