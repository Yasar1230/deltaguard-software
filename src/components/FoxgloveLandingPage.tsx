import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  FolderUp,
  ShieldCheck,
  Cpu,
  Activity,
  BatteryCharging,
  Car,
  Sparkles,
  Volume2,
  Terminal,
  Layers,
  FileCode2,
  Lock,
  Music,
  Film,
  CheckCircle2,
} from 'lucide-react';

export type CarouselSlideTarget =
  | 'adas_twin'
  | 'bms_thermal'
  | 'rea_binary'
  | 'telemetry_scopes';

interface FoxgloveLandingPageProps {
  onLaunchWorkbench: (target?: CarouselSlideTarget) => void;
  onOpenUploadModalInWorkbench: () => void;
  isPatchedSafe: boolean;
  hasVoiceoverMp3: boolean;
  voiceoverFileName: string | null;
  onAttachVoiceoverMp3: (file: File) => void;
  onPlayLaunchVideo: () => void;
}

interface SlideDefinition {
  id: CarouselSlideTarget;
  indexLabel: string;
  tabName: string;
  topicName: string;
  verdictBadge: string;
  verdictTone: 'error' | 'purple' | 'emerald';
  headline: string;
  subline: string;
  ctaLabel: string;
}

const STUDIO_SLIDES: SlideDefinition[] = [
  {
    id: 'adas_twin',
    indexLabel: '01',
    tabName: '3D ADAS Twin-Track',
    topicName: '/adas/shadow_sim/lead_brake',
    verdictBadge: 'AEB TTC: 2.0s ➔ 1.0s (-3.88m GAP)',
    verdictTone: 'error',
    headline: '3D ADAS Twin-Track Shadow Simulation (Blue v1.0 vs Red v2.0)',
    subline:
      'Synchronized 3D CAD highway grid with forward radar frustums, 3D bounding boxes, and real-time stopping gap rulers across 7 UNECE R152 highway emergency braking scenarios.',
    ctaLabel: 'Open 3D ADAS Twin in Studio',
  },
  {
    id: 'bms_thermal',
    indexLabel: '02',
    tabName: '3D NCR18650B Pack',
    topicName: '/bms/jeita_cold_charge/scen_02',
    verdictBadge: 'CRITICAL JEITA PLATING (-43.7% TIME)',
    verdictTone: 'error',
    headline: '3D NCR18650B Electro-Thermal Cutaway (Scenario BMS-02: 5°C Cold Charge)',
    subline:
      'Catches deceptive fast-charge optimizations where v2.0 cuts charge time from 10,790s to 6,070s by doubling cold-weather current to 1.625A—violating the 0.8125A JEITA lithium plating limit.',
    ctaLabel: 'Open BMS-02 Thermal Pack in Studio',
  },
  {
    id: 'rea_binary',
    indexLabel: '03',
    tabName: 'REA ELF64 Disassembly',
    topicName: '/rea/elf64_diff/bms_v2_so',
    verdictBadge: '.rodata: 0x42340000 ➔ 0x42480000 (50°C)',
    verdictTone: 'purple',
    headline: 'REA x86-64 ELF64 Disassembler & AST Control-Flow Gatekeeper',
    subline:
      'Reverse-engineers stripped supplier shared objects (bms_v1.so vs bms_v2.so) without source code to pinpoint mutated IEEE-754 floats, deleted JEITA <10°C branches, and masked sensor faults.',
    ctaLabel: 'Open ELF64 Disassembler in Studio',
  },
  {
    id: 'telemetry_scopes',
    indexLabel: '04',
    tabName: 'Multi-Channel Plots & Patch',
    topicName: '/homologation/verdict/auto_patch',
    verdictBadge: 'ISO 26262 ASIL-D: 1-CLICK PATCH READY',
    verdictTone: 'emerald',
    headline: 'Synchronized 3-Channel Plots & Autonomous AI Homologation Gate',
    subline:
      'Correlates live Current (A), Cell Temperature (°C), and Ego Velocity (m/s) waveforms against hard red safety thresholds—generating an executive voice alert and a verified C patch (v2.0.1).',
    ctaLabel: 'Open Plots & Auto-Patch in Studio',
  },
];

interface CustomerStoryCase {
  id: string;
  tabLabel: string;
  scenarioCode: string;
  target: CarouselSlideTarget;
  headline: string;
  quote: string;
  author: string;
  role: string;
  metricLabel: string;
  metricValue: string;
  verdictText: string;
}

const CASE_STUDY_TABS: CustomerStoryCase[] = [
  {
    id: 'bms-02',
    tabLabel: 'BMS-02 · 5°C Cold Charge',
    scenarioCode: 'JEITA LITHIUM PLATING',
    target: 'bms_thermal',
    headline:
      'How DeltaGuard intercepted a deceptive -43.7% fast-charge optimization before metallic lithium plating.',
    quote:
      '“Standard unit tests celebrated a 43.7% reduction in charging time (10,790s down to 6,070s). DeltaGuard disassembled bms_v2.so and proved the supplier stripped the <10°C JEITA branch, driving 1.625A into a 5°C cell.”',
    author: 'Panasonic NCR18650B Reference Plant',
    role: 'Scenario BMS-02 · Ambient 5.0°C · Max Safe Current: 0.8125A (0.25C)',
    metricLabel: 'Cold Charge Current Mutation',
    metricValue: '0.8125 A ➔ 1.6250 A (2.0x JEITA Limit)',
    verdictText: 'BLOCKED BY DELTAGUARD SIL [RULE-JEITA-COLD]',
  },
  {
    id: 'adas-01',
    tabLabel: 'ADAS-01 · Highway Brake',
    scenarioCode: 'UNECE R152 AEB',
    target: 'adas_twin',
    headline:
      'How 3D Twin-Track shadow simulation exposed a 1.0s AEB TTC delay and a -3.88m stopping gap loss.',
    quote:
      '“By running Blue Baseline v1.0 and Red Candidate v2.0 simultaneously on the 3D CAD highway track, DeltaGuard visualized the exact moment v2.0 delayed emergency braking from TTC 2.0s to 1.0s.”',
    author: 'UNECE R152 Highway Homologation Suite',
    role: 'Scenario ADAS-01 & ADAS-03 · Ego 25.0 m/s · Lead Decel -7.5 m/s²',
    metricLabel: 'Minimum Stopping Distance Delta',
    metricValue: '9.72 m (v1.0) ➔ 5.84 m (v2.0) [-3.88m Margin]',
    verdictText: 'BLOCKED BY DELTAGUARD SIL [RULE-AEB-TTC]',
  },
  {
    id: 'bms-03',
    tabLabel: 'BMS-03 · 40°C Runaway',
    scenarioCode: 'ELF64 .RODATA DIFF',
    target: 'rea_binary',
    headline:
      'How REA ELF64 binary analysis caught a 4-byte IEEE-754 float mutation raising thermal cutoff to 50.0°C.',
    quote:
      '“Without C source code, REA MCP diffed the .rodata section of bms_v2.so and flagged immediate float 0x42340000 (45.0°C) mutating to 0x42480000 (50.0°C)—preventing thermal runaway at 47.2°C.”',
    author: 'REA x86-64 Binary Gatekeeper',
    role: 'Scenario BMS-03 · Ambient 40.0°C · Symbol: compute_target_current',
    metricLabel: 'ELF64 .rodata Immediate Float',
    metricValue: '0x42340000 (45.0f) ➔ 0x42480000 (50.0f)',
    verdictText: 'BLOCKED BY DELTAGUARD SIL [RULE-THERM-45C]',
  },
  {
    id: 'bms-06',
    tabLabel: 'BMS-06 · NTC Sensor Fault',
    scenarioCode: 'ISO 26262 ASIL-D',
    target: 'telemetry_scopes',
    headline:
      'How control-flow graph diffing caught a masked temp_sensor_fail check and auto-patched v2.0.1.',
    quote:
      '“In Scenario BMS-06, an active NTC thermistor fault requires immediate 0.0A fail-safe cutoff. Candidate v2.0 ignored register %edi and pumped 1.625A blind. DeltaGuard generated the verified C patch in one click.”',
    author: 'ISO 26262 ASIL-D Fault Injection Gate',
    role: 'Scenario BMS-06 · temp_sensor_fail = 1 · Fail-Safe Target: 0.000A',
    metricLabel: 'CFG Basic Block Count',
    metricValue: '6 Blocks (v1.0) ➔ 4 Blocks (v2.0) [-2 Guards]',
    verdictText: 'AUTO-PATCHED IN v2.0.1 [17/17 PASSED]',
  },
];

export const FoxgloveLandingPage: React.FC<FoxgloveLandingPageProps> = ({
  onLaunchWorkbench,
  onOpenUploadModalInWorkbench,
  isPatchedSafe,
  hasVoiceoverMp3,
  voiceoverFileName,
  onAttachVoiceoverMp3,
  onPlayLaunchVideo,
}) => {
  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
  const [activeStepperIdx, setActiveStepperIdx] = useState<number>(0);
  const [activeCaseTabId, setActiveCaseTabId] = useState<string>('bms-02');
  const studioShowcaseRef = useRef<HTMLDivElement | null>(null);
  const mp3InputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = window.setInterval(() => {
      setActiveSlideIdx((prev) => (prev + 1) % STUDIO_SLIDES.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [isAutoPlaying]);

  const activeSlide = STUDIO_SLIDES[activeSlideIdx];
  const activeCaseStudy =
    CASE_STUDY_TABS.find((c) => c.id === activeCaseTabId) || CASE_STUDY_TABS[0];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#121619] text-white font-sans antialiased selection:bg-[#664fff] selection:text-white overflow-x-hidden">
      {/* =====================================================================
          BLOCK 0: EXACT FOXGLOVE.DEV STICKY DARK HEADER
          bg-gray-100 (#121619) | border-gray-80 (#343a3f)
         ===================================================================== */}
      <header className="sticky top-0 z-50 flex flex-col border-b border-[#343a3f] bg-[#121619]">
        <div className="max-w-[1440px] mx-auto w-full px-6 md:px-16">
          <div className="flex items-center justify-between py-4 lg:py-0">
            {/* Left: Foxglove-style Isometric Hex Mark + Brand + Dropdown Navigation */}
            <div className="flex items-center gap-8">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label="DeltaGuard home"
                className="flex items-center gap-3 shrink-0 py-4 cursor-pointer group"
              >
                {/* Exact Foxglove-inspired 6-petal isometric hex mark from foxglove-logo-light.svg */}
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 220 234"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-7 w-auto transition-transform duration-200 group-hover:scale-105"
                >
                  <path
                    d="M219.294 74.5355L182.97 53.5615C181.941 52.9674 180.673 52.9675 179.644 53.5617L130.303 82.0599V25.0789C130.303 23.8911 129.669 22.7935 128.641 22.1995L92.3161 1.22523C91.2078 0.585325 89.8224 1.38513 89.8224 2.66493V82.0432L40.4808 53.5609C39.4521 52.9671 38.1847 52.9671 37.156 53.5611L0.831225 74.5356C-0.276975 75.1755 -0.276975 76.7751 0.831225 77.415L69.5736 117.104L0.831225 156.794C-0.277075 157.434 -0.277075 159.033 0.831225 159.673L37.156 180.648C38.1847 181.242 39.4521 181.242 40.4808 180.648L89.8224 152.165V209.146C89.8224 210.334 90.4564 211.432 91.4856 212.026L127.81 232.985C128.918 233.624 130.303 232.824 130.303 231.545V152.165L179.644 180.648C180.673 181.241 181.941 181.241 182.969 180.647L219.294 159.673C220.402 159.033 220.402 157.433 219.294 156.794L150.535 117.104L219.294 77.4148C220.402 76.775 220.402 75.1755 219.294 74.5355ZM133.046 130.387L110.054 143.654L87.0792 130.387V103.838L110.054 90.5716L133.046 103.838V130.387Z"
                    fill="#937af6"
                  />
                </svg>
                <span className="font-display text-lg font-bold tracking-wider uppercase text-white">
                  DELTAGUARD
                </span>
              </button>

              {/* Main Navigation with Exact Foxglove Hover Dropdowns */}
              <nav
                className="hidden lg:flex items-center gap-1"
                aria-label="Main navigation"
              >
                {/* Product Dropdown */}
                <div className="group relative">
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-6 text-sm font-normal text-[#f2f4f8] hover:text-[#c1c7cd] transition-colors cursor-pointer"
                  >
                    <span>Product</span>
                    <ChevronDown className="h-4 w-4 text-[#c1c7cd] transition-transform duration-200 group-hover:rotate-180" />
                  </button>
                  <div className="invisible absolute top-full left-0 w-64 rounded-md bg-white p-3 whitespace-nowrap shadow-xl translate-y-4 opacity-0 transition-all duration-200 ease-out group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    <button
                      onClick={() => onLaunchWorkbench('adas_twin')}
                      className="w-full flex items-center gap-3 rounded-md p-2.5 text-sm font-normal text-[#121619] transition-colors hover:bg-[#eeeafd] hover:text-[#664fff] text-left cursor-pointer"
                    >
                      <Car className="w-4 h-4 shrink-0 text-[#697077]" />
                      <div>
                        <div className="font-medium">3D SIL Visualization</div>
                        <div className="text-[11px] text-[#697077]">
                          Twin-track ADAS &amp; radar frustums
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => onLaunchWorkbench('bms_thermal')}
                      className="w-full flex items-center gap-3 rounded-md p-2.5 text-sm font-normal text-[#121619] transition-colors hover:bg-[#eeeafd] hover:text-[#664fff] text-left cursor-pointer"
                    >
                      <BatteryCharging className="w-4 h-4 shrink-0 text-[#697077]" />
                      <div>
                        <div className="font-medium">Electro-Thermal Pack SIL</div>
                        <div className="text-[11px] text-[#697077]">
                          NCR18650B JEITA plating solver
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => onLaunchWorkbench('rea_binary')}
                      className="w-full flex items-center gap-3 rounded-md p-2.5 text-sm font-normal text-[#121619] transition-colors hover:bg-[#eeeafd] hover:text-[#664fff] text-left cursor-pointer"
                    >
                      <Cpu className="w-4 h-4 shrink-0 text-[#697077]" />
                      <div>
                        <div className="font-medium">REA Binary Disassembler</div>
                        <div className="text-[11px] text-[#697077]">
                          Zero-source ELF64 &amp; .rodata diff
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => onLaunchWorkbench('telemetry_scopes')}
                      className="w-full flex items-center gap-3 rounded-md p-2.5 text-sm font-normal text-[#121619] transition-colors hover:bg-[#eeeafd] hover:text-[#664fff] text-left cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 shrink-0 text-[#697077]" />
                      <div>
                        <div className="font-medium">Agents &amp; Auto-Patch</div>
                        <div className="text-[11px] text-[#697077]">
                          Gemini 4 Argon + 1-click C fix
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Solutions / Scenarios Dropdown */}
                <div className="group relative">
                  <button
                    type="button"
                    onClick={() => scrollToSection('case-studies')}
                    className="flex items-center gap-1 px-3 py-6 text-sm font-normal text-[#f2f4f8] hover:text-[#c1c7cd] transition-colors cursor-pointer"
                  >
                    <span>Homologation Cases</span>
                    <ChevronDown className="h-4 w-4 text-[#c1c7cd] transition-transform duration-200 group-hover:rotate-180" />
                  </button>
                  <div className="invisible absolute top-full left-0 w-64 rounded-md bg-white p-3 whitespace-nowrap shadow-xl translate-y-4 opacity-0 transition-all duration-200 ease-out group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#878d96]">
                      17 Automated SIL Regimes
                    </div>
                    <button
                      onClick={() => {
                        setActiveCaseTabId('bms-02');
                        scrollToSection('case-studies');
                      }}
                      className="w-full flex items-center justify-between rounded-md p-2 text-sm text-[#121619] hover:bg-[#eeeafd] hover:text-[#664fff] cursor-pointer"
                    >
                      <span>BMS-02: 5°C Cold Charge</span>
                      <span className="font-mono text-[10px] text-[#ea384c] font-bold">
                        BLOCK
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveCaseTabId('adas-01');
                        scrollToSection('case-studies');
                      }}
                      className="w-full flex items-center justify-between rounded-md p-2 text-sm text-[#121619] hover:bg-[#eeeafd] hover:text-[#664fff] cursor-pointer"
                    >
                      <span>ADAS-01: Sudden Lead Brake</span>
                      <span className="font-mono text-[10px] text-[#ea384c] font-bold">
                        BLOCK
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveCaseTabId('bms-03');
                        scrollToSection('case-studies');
                      }}
                      className="w-full flex items-center justify-between rounded-md p-2 text-sm text-[#121619] hover:bg-[#eeeafd] hover:text-[#664fff] cursor-pointer"
                    >
                      <span>BMS-03: 40°C Thermal Cutoff</span>
                      <span className="font-mono text-[10px] text-[#ea384c] font-bold">
                        BLOCK
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveCaseTabId('bms-06');
                        scrollToSection('case-studies');
                      }}
                      className="w-full flex items-center justify-between rounded-md p-2 text-sm text-[#121619] hover:bg-[#eeeafd] hover:text-[#664fff] cursor-pointer"
                    >
                      <span>BMS-06: NTC Fault Masking</span>
                      <span className="font-mono text-[10px] text-[#ea384c] font-bold">
                        BLOCK
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => scrollToSection('platform-stepper')}
                  className="px-3 py-6 text-sm font-normal text-[#f2f4f8] hover:text-[#c1c7cd] transition-colors cursor-pointer"
                >
                  Architecture
                </button>

                <button
                  onClick={() => scrollToSection('enterprise-foundations')}
                  className="px-3 py-6 text-sm font-normal text-[#f2f4f8] hover:text-[#c1c7cd] transition-colors cursor-pointer"
                >
                  Safety Standards
                </button>

                <button
                  onClick={() => onLaunchWorkbench('rea_binary')}
                  className="px-3 py-6 text-sm font-normal text-[#f2f4f8] hover:text-[#c1c7cd] transition-colors cursor-pointer"
                >
                  REA Binary Gate
                </button>
              </nav>
            </div>

            {/* Right Utility CTA Buttons + Launch Video & MP3 Uploader */}
            <div className="flex items-center gap-2.5 shrink-0">
              <input
                ref={mp3InputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onAttachVoiceoverMp3(file);
                  }
                  e.target.value = '';
                }}
              />

              {/* [ 🎵 Attach Voiceover MP3 ] */}
              <button
                onClick={() => mp3InputRef.current?.click()}
                title={
                  hasVoiceoverMp3
                    ? `Attached: ${voiceoverFileName} (Click to replace)`
                    : 'Attach downloaded ElevenLabs MP3 file'
                }
                className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-2 text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  hasVoiceoverMp3
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/70 hover:bg-emerald-900/80'
                    : 'bg-[#21272a] text-[#f2f4f8] border-[#343a3f] hover:bg-[#343a3f]'
                }`}
              >
                {hasVoiceoverMp3 ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>✅ Voiceover Ready</span>
                  </>
                ) : (
                  <>
                    <Music className="w-3.5 h-3.5 text-[#937af6] shrink-0" />
                    <span>🎵 Attach Voiceover MP3</span>
                  </>
                )}
              </button>

              {/* [ 🎬 Play Launch Video ] */}
              <button
                onClick={onPlayLaunchVideo}
                className="inline-flex items-center gap-1.5 rounded-sm px-3.5 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <Film className="w-3.5 h-3.5 shrink-0" />
                <span>🎬 Play Launch Video</span>
              </button>

              <button
                onClick={onOpenUploadModalInWorkbench}
                className="hidden xl:inline-flex px-2.5 py-2 text-xs font-medium text-[#f2f4f8] hover:text-[#c1c7cd] transition-colors cursor-pointer whitespace-nowrap"
              >
                Upload OTA (.so / .json)
              </button>

              <button
                onClick={() => onLaunchWorkbench()}
                className="inline-flex items-center gap-1.5 rounded-sm font-medium transition-colors px-3.5 py-2 text-xs bg-[#664fff] text-white hover:bg-[#5933f2] cursor-pointer whitespace-nowrap"
              >
                <span>Launch Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          BLOCK 1: EXACT FOXGLOVE.DEV HERO SECTION
          py-16 bg-gray-100 (#121619) | Left-aligned H1 with text-purple-50 (#937af6)
         ===================================================================== */}
      <section className="py-16 bg-[#121619]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16">
          <div>
            {/* Left-Aligned Foxglove Hero Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl leading-[1.08] tracking-tight font-medium text-white mb-6">
              Speed up{' '}
              <span className="text-[#937af6]">Physical AI &amp; OTA</span>{' '}
              homologation
            </h1>

            {/* Left-Aligned max-w-3xl Description + Dual Foxglove Buttons */}
            <div className="max-w-3xl">
              <div className="text-lg leading-normal text-[#c1c7cd] font-normal mb-8 space-y-4">
                DeltaGuard is the agentic physical safety &amp; binary
                gatekeeping platform for automotive engineers to rapidly
                disassemble, simulate, and homologate black-box supplier OTA
                updates across the entire SIL lifecycle. Catch deceptive
                fast-charge lithium plating and delayed highway braking before
                fleet deployment.
              </div>

              {/* Exact Foxglove Dual CTA Buttons */}
              <div className="flex flex-wrap gap-5">
                <button
                  onClick={() => onLaunchWorkbench()}
                  className="inline-flex items-center gap-2 rounded-sm font-medium transition-colors px-5 py-2.5 text-base bg-[#664fff] text-white hover:bg-[#5933f2] cursor-pointer"
                >
                  <span>Start Setup — Open Live Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={onOpenUploadModalInWorkbench}
                  className="inline-flex items-center gap-2 rounded-sm font-medium transition-colors px-5 py-2.5 text-base border-2 border-[#664fff] bg-[#1c0f30] text-white hover:bg-[#31135e] cursor-pointer"
                >
                  <FolderUp className="w-4 h-4 text-[#b4a3f9]" />
                  <span>Stage Supplier OTA Package (v2.0)</span>
                </button>
              </div>
            </div>
          </div>

          {/* =================================================================
              HERO MEDIA: AUTHENTIC FOXGLOVE STUDIO DARK DESKTOP INTERFACE
              mt-16 flex overflow-hidden rounded-md border border-[#343a3f]
             ================================================================= */}
          <div
            ref={studioShowcaseRef}
            className="relative mt-14 flex flex-col overflow-hidden rounded-md border border-[#343a3f] bg-[#121217] shadow-2xl"
          >
            {/* Foxglove Studio Authentic Top App Bar (#18181f) */}
            <div className="h-11 px-4 bg-[#18181f] border-b border-[#2b2b36] flex items-center justify-between gap-3 select-none">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ea384c]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                </div>
                <div className="h-4 w-px bg-[#343a3f]" />
                <span className="font-mono text-xs text-[#f2f4f8] font-medium truncate">
                  delta_guard_ota_v2_0_0_audit.mcap
                </span>
                <span className="hidden md:inline-block font-mono text-[11px] px-2 py-0.5 rounded-sm bg-[#21272a] text-[#b4a3f9] border border-[#343a3f]">
                  {activeSlide.topicName}
                </span>
              </div>

              {/* Center Layout Tab Switcher inside Foxglove Studio Chrome */}
              <div className="hidden xl:flex items-center gap-1 bg-[#121217] p-1 rounded-sm border border-[#2b2b36]">
                {STUDIO_SLIDES.map((s, idx) => {
                  const active = idx === activeSlideIdx;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setIsAutoPlaying(false);
                        setActiveSlideIdx(idx);
                      }}
                      className={`px-2.5 py-1 rounded-sm font-mono text-[11px] transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#664fff] text-white font-medium'
                          : 'text-[#a2a9b0] hover:text-white hover:bg-[#21272a]'
                      }`}
                    >
                      {s.indexLabel}. {s.tabName}
                    </button>
                  );
                })}
              </div>

              {/* Right Studio Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`hidden sm:inline-block font-mono text-[11px] font-medium px-2 py-0.5 rounded-sm border ${
                    activeSlide.verdictTone === 'error'
                      ? 'bg-[#ea384c]/15 text-[#ff808e] border-[#ea384c]/50'
                      : activeSlide.verdictTone === 'purple'
                      ? 'bg-[#382193]/50 text-[#cdc2fb] border-[#664fff]/60'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                  }`}
                >
                  {activeSlide.verdictBadge}
                </span>

                <button
                  onClick={() => setIsAutoPlaying((p) => !p)}
                  className="h-7 px-2 rounded-sm bg-[#21272a] hover:bg-[#343a3f] text-[#c1c7cd] font-mono text-[11px] flex items-center gap-1 border border-[#343a3f] cursor-pointer"
                >
                  {isAutoPlaying ? (
                    <>
                      <Pause className="w-3 h-3 text-[#937af6]" />
                      <span className="hidden md:inline">Auto</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 text-[#937af6]" />
                      <span className="hidden md:inline">Paused</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setActiveSlideIdx(
                      (prev) =>
                        (prev - 1 + STUDIO_SLIDES.length) % STUDIO_SLIDES.length
                    );
                  }}
                  aria-label="Previous view"
                  className="h-7 w-7 rounded-sm bg-[#21272a] hover:bg-[#343a3f] text-white flex items-center justify-center border border-[#343a3f] cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setActiveSlideIdx((prev) => (prev + 1) % STUDIO_SLIDES.length);
                  }}
                  aria-label="Next view"
                  className="h-7 w-7 rounded-sm bg-[#21272a] hover:bg-[#343a3f] text-white flex items-center justify-center border border-[#343a3f] cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onLaunchWorkbench(activeSlide.id)}
                  className="h-7 px-3 rounded-sm bg-[#664fff] hover:bg-[#5933f2] text-white font-mono text-[11px] font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Open in Studio</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Foxglove Studio Multi-Panel Dark Docked Workspace Preview */}
            <div
              onClick={() => onLaunchWorkbench(activeSlide.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onLaunchWorkbench(activeSlide.id);
                }
              }}
              className="grid grid-cols-1 lg:grid-cols-12 bg-[#121217] cursor-pointer group"
            >
              {/* Left Docked Panel (8 cols): 3D Viewport / Active Slide Canvas */}
              <div className="lg:col-span-8 border-b lg:border-b-0 lg:border-r border-[#2b2b36] flex flex-col">
                {/* Foxglove Panel Header Bar */}
                <div className="h-8 px-3 bg-[#18181f] border-b border-[#2b2b36] flex items-center justify-between font-mono text-[11px] text-[#a2a9b0]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#664fff]" />
                    <span className="text-[#f2f4f8] font-medium">
                      3D / {activeSlide.tabName}
                    </span>
                    <span className="text-[#697077]">
                      frame_id: base_link · 60.0 Hz
                    </span>
                  </div>
                  <span className="text-[#b4a3f9] group-hover:underline">
                    Click anywhere to launch interactive panel →
                  </span>
                </div>

                {/* Slide 01: 3D ADAS Twin-Track Dark Vector Viewport */}
                {activeSlide.id === 'adas_twin' && (
                  <div className="p-4 bg-[#0d0f12] flex-1 flex flex-col justify-between">
                    <svg
                      viewBox="0 0 760 290"
                      className="w-full h-auto block rounded-sm border border-[#21272a] bg-[#0b0d10]"
                    >
                      <defs>
                        <pattern
                          id="fgDarkGrid"
                          width="38"
                          height="38"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d="M 38 0 L 0 0 0 38"
                            fill="none"
                            stroke="#1e242b"
                            strokeWidth="1"
                          />
                        </pattern>
                        <linearGradient
                          id="fgBlueFrustum"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.38" />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
                        </linearGradient>
                        <linearGradient
                          id="fgRedFrustum"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="#ea384c" stopOpacity="0.42" />
                          <stop offset="100%" stopColor="#ea384c" stopOpacity="0.03" />
                        </linearGradient>
                      </defs>

                      <rect width="760" height="290" fill="url(#fgDarkGrid)" />

                      {/* Coordinate Axes */}
                      <line
                        x1="20"
                        y1="270"
                        x2="90"
                        y2="270"
                        stroke="#ea384c"
                        strokeWidth="2"
                      />
                      <line
                        x1="20"
                        y1="270"
                        x2="20"
                        y2="210"
                        stroke="#10b981"
                        strokeWidth="2"
                      />
                      <text
                        x="95"
                        y="273"
                        fill="#878d96"
                        fontSize="9"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        +X (Longitudinal m)
                      </text>

                      {/* Twin Highway Lanes */}
                      <rect
                        x="28"
                        y="32"
                        width="704"
                        height="96"
                        rx="3"
                        fill="#121619"
                        stroke="#343a3f"
                        strokeWidth="1.2"
                      />
                      <rect
                        x="28"
                        y="148"
                        width="704"
                        height="96"
                        rx="3"
                        fill="#121619"
                        stroke="#343a3f"
                        strokeWidth="1.2"
                      />

                      <line
                        x1="40"
                        y1="80"
                        x2="720"
                        y2="80"
                        stroke="#21272a"
                        strokeWidth="1.5"
                        strokeDasharray="10 8"
                      />
                      <line
                        x1="40"
                        y1="196"
                        x2="720"
                        y2="196"
                        stroke="#21272a"
                        strokeWidth="1.5"
                        strokeDasharray="10 8"
                      />

                      {/* Track 1: v1.0 Baseline Ego Vehicle + Radar Frustum */}
                      <polygon
                        points="250,80 510,44 510,116"
                        fill="url(#fgBlueFrustum)"
                        stroke="#38bdf8"
                        strokeWidth="1.2"
                        strokeDasharray="4 3"
                      />
                      <rect
                        x="130"
                        y="56"
                        width="120"
                        height="48"
                        rx="3"
                        fill="#0c2538"
                        stroke="#38bdf8"
                        strokeWidth="2"
                      />
                      <text
                        x="142"
                        y="76"
                        fill="#e0f2fe"
                        fontSize="11"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="bold"
                      >
                        v1.0 BASELINE
                      </text>
                      <text
                        x="142"
                        y="93"
                        fill="#38bdf8"
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        TTC=2.0s | 8.5m/s²
                      </text>

                      {/* Lead Target Track 1 */}
                      <rect
                        x="565"
                        y="56"
                        width="110"
                        height="48"
                        rx="3"
                        fill="#18181f"
                        stroke="#937af6"
                        strokeWidth="1.8"
                      />
                      <text
                        x="578"
                        y="84"
                        fill="#ded6fc"
                        fontSize="11"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        LEAD TARGET
                      </text>

                      {/* Distance Vector Track 1 */}
                      <line
                        x1="254"
                        y1="80"
                        x2="560"
                        y2="80"
                        stroke="#38bdf8"
                        strokeWidth="1.8"
                      />
                      <rect
                        x="345"
                        y="67"
                        width="132"
                        height="24"
                        rx="2"
                        fill="#121619"
                        stroke="#38bdf8"
                      />
                      <text
                        x="355"
                        y="83"
                        fill="#38bdf8"
                        fontSize="11"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="bold"
                      >
                        SAFE GAP: 9.72m
                      </text>

                      {/* Track 2: v2.0 Candidate Ego Vehicle (Late Braking!) */}
                      <polygon
                        points="405,196 560,164 560,228"
                        fill="url(#fgRedFrustum)"
                        stroke="#ea384c"
                        strokeWidth="1.2"
                        strokeDasharray="4 3"
                      />
                      <rect
                        x="285"
                        y="172"
                        width="120"
                        height="48"
                        rx="3"
                        fill="#2d0c12"
                        stroke="#ea384c"
                        strokeWidth="2.2"
                      />
                      <text
                        x="297"
                        y="192"
                        fill="#fecdd3"
                        fontSize="11"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="bold"
                      >
                        v2.0 CANDIDATE
                      </text>
                      <text
                        x="297"
                        y="209"
                        fill="#ea384c"
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        TTC=1.0s | LATE AEB
                      </text>

                      {/* Lead Target Track 2 */}
                      <rect
                        x="565"
                        y="172"
                        width="110"
                        height="48"
                        rx="3"
                        fill="#18181f"
                        stroke="#937af6"
                        strokeWidth="1.8"
                      />
                      <text
                        x="578"
                        y="200"
                        fill="#ded6fc"
                        fontSize="11"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        LEAD TARGET
                      </text>

                      {/* Critical Distance Vector Track 2 */}
                      <line
                        x1="408"
                        y1="196"
                        x2="560"
                        y2="196"
                        stroke="#ea384c"
                        strokeWidth="2.2"
                      />
                      <rect
                        x="416"
                        y="183"
                        width="138"
                        height="24"
                        rx="2"
                        fill="#2d0c12"
                        stroke="#ea384c"
                      />
                      <text
                        x="424"
                        y="199"
                        fill="#ff808e"
                        fontSize="11"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="bold"
                      >
                        CRIT GAP: 5.84m!
                      </text>
                    </svg>
                  </div>
                )}

                {/* Slide 02: 3D NCR18650B Battery Thermal Array */}
                {activeSlide.id === 'bms_thermal' && (
                  <div className="p-5 bg-[#0d0f12] flex-1 flex flex-col justify-between gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* v1.0 Baseline 16-Cell Array */}
                      <div className="rounded-sm border border-[#343a3f] bg-[#121619] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-mono text-xs font-medium text-[#38bdf8]">
                            v1.0 Baseline Pack (JEITA 0.25C Safe)
                          </span>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded-sm bg-emerald-950 text-emerald-300 border border-emerald-700">
                            0.8125 A PASS
                          </span>
                        </div>
                        <div className="grid grid-cols-8 gap-1.5 py-2">
                          {Array.from({ length: 16 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="h-14 rounded-xs bg-gradient-to-b from-sky-500/80 to-blue-900 border border-sky-400/50 flex flex-col items-center justify-between p-1 text-[9px] font-mono text-white"
                            >
                              <span>C{idx + 1}</span>
                              <span>6.2°</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex justify-between font-mono text-[11px] text-[#c1c7cd]">
                          <span>Charge Time: 10,790s</span>
                          <span className="text-emerald-400">
                            0.0% Lithium Plating
                          </span>
                        </div>
                      </div>

                      {/* v2.0 Candidate 16-Cell Array */}
                      <div className="rounded-sm border border-[#ea384c]/70 bg-[#1a0d12] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-mono text-xs font-medium text-[#ff808e]">
                            v2.0 Candidate Pack (Stripped &lt;10°C Branch)
                          </span>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded-sm bg-[#ea384c] text-white font-bold">
                            1.6250 A BLOCK
                          </span>
                        </div>
                        <div className="grid grid-cols-8 gap-1.5 py-2">
                          {Array.from({ length: 16 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="h-14 rounded-xs bg-gradient-to-b from-amber-500 via-[#ea384c] to-rose-950 border border-[#ff808e] flex flex-col items-center justify-between p-1 text-[9px] font-mono text-white font-bold"
                            >
                              <span>C{idx + 1}</span>
                              <span>PLATE</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex justify-between font-mono text-[11px] text-[#ff808e]">
                          <span>Charge Time: 6,070s (-43.7%!)</span>
                          <span className="font-bold">2.0x JEITA OVERCURRENT</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-sm bg-[#18181f] border border-[#343a3f] p-3 font-mono text-xs flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[#c1c7cd]">
                        Naive CI Verdict:{' '}
                        <strong className="text-emerald-400">
                          PASS (&ldquo;43.7% Faster Charge!&rdquo;)
                        </strong>
                      </span>
                      <span className="text-[#c1c7cd]">
                        DeltaGuard SIL Verdict:{' '}
                        <strong className="text-[#ea384c]">
                          BLOCK_OTA (Anode Lithium Dendrite Risk)
                        </strong>
                      </span>
                    </div>
                  </div>
                )}

                {/* Slide 03: REA Binary Disassembly & AST Gatekeeper */}
                {activeSlide.id === 'rea_binary' && (
                  <div className="p-5 bg-[#0d0f12] flex-1 flex flex-col justify-between font-mono text-xs gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-sm bg-[#121619] border border-[#343a3f] p-4 space-y-2">
                        <div className="text-[11px] font-bold text-emerald-400 border-b border-[#21272a] pb-1.5">
                          bms_v1.so · Baseline ELF64 Disassembly
                        </div>
                        <div className="text-[#c1c7cd]">
                          0x1140: <span className="text-[#38bdf8]">movss</span> xmm0, [rip+0xea8]{' '}
                          <span className="text-emerald-400">; 0x42340000 (45.0f °C)</span>
                        </div>
                        <div className="text-[#c1c7cd]">
                          0x1148: <span className="text-[#38bdf8]">ucomiss</span> xmm1, xmm0
                        </div>
                        <div className="text-[#c1c7cd]">
                          0x1152: <span className="text-[#38bdf8]">ucomiss</span> xmm1, [10.0f]{' '}
                          <span className="text-emerald-400">; JEITA &lt;10°C 0.25C</span>
                        </div>
                        <div className="text-[#c1c7cd]">
                          0x1160: <span className="text-[#38bdf8]">test</span> edi, edi{' '}
                          <span className="text-emerald-400">; temp_sensor_fail check</span>
                        </div>
                      </div>

                      <div className="rounded-sm bg-[#1a0d12] border border-[#ea384c]/60 p-4 space-y-2">
                        <div className="text-[11px] font-bold text-[#ff808e] border-b border-[#ea384c]/30 pb-1.5">
                          bms_v2.so · Candidate Supplier ELF64 Binary
                        </div>
                        <div className="text-white bg-[#ea384c]/25 px-1.5 py-0.5 rounded-xs">
                          0x1140: <span className="text-amber-300">movss</span> xmm0, [rip+0xea8]{' '}
                          <span className="text-[#ff808e] font-bold">; 0x42480000 (50.0f °C!)</span>
                        </div>
                        <div className="text-[#c1c7cd]">
                          0x1148: <span className="text-[#38bdf8]">ucomiss</span> xmm1, xmm0
                        </div>
                        <div className="text-white bg-[#ea384c]/25 px-1.5 py-0.5 rounded-xs">
                          0x1152: <span className="text-[#ff808e] font-bold">[DELETED BRANCH]</span>{' '}
                          <span>; 0–10°C merged into 0.5C</span>
                        </div>
                        <div className="text-white bg-[#ea384c]/25 px-1.5 py-0.5 rounded-xs">
                          0x1160: <span className="text-[#ff808e] font-bold">nop ; Masked</span>{' '}
                          <span>; temp_sensor_fail ignored</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-sm bg-[#18181f] border border-[#343a3f] p-3 flex flex-wrap items-center justify-between text-[11px] text-[#c1c7cd]">
                      <span>ELF64 Symbol: compute_target_current(soc, temp_c, fault)</span>
                      <span className="text-[#b4a3f9] font-bold">
                        CFG Basic Blocks: 6 ➔ 4 (-2 Safety Guards Removed)
                      </span>
                    </div>
                  </div>
                )}

                {/* Slide 04: Multi-Channel Plots & 1-Click Auto-Patch */}
                {activeSlide.id === 'telemetry_scopes' && (
                  <div className="p-5 bg-[#0d0f12] flex-1 flex flex-col justify-between gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-sm border border-[#343a3f] bg-[#121619] p-3">
                        <div className="flex justify-between font-mono text-[10px] text-[#c1c7cd] mb-1">
                          <span>/bms/current_a</span>
                          <span className="text-[#ea384c] font-bold">v2: 1.625A!</span>
                        </div>
                        <svg viewBox="0 0 200 72" className="w-full h-16">
                          <line
                            x1="0"
                            y1="38"
                            x2="200"
                            y2="38"
                            stroke="#ea384c"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                          />
                          <polyline
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="2"
                            points="0,42 120,42 160,55 200,64"
                          />
                          <polyline
                            fill="none"
                            stroke="#ea384c"
                            strokeWidth="2"
                            strokeDasharray="5 3"
                            points="0,14 95,14 140,48 200,64"
                          />
                        </svg>
                        <div className="font-mono text-[10px] text-[#a2a9b0]">
                          Red Dash: 0.8125A JEITA Limit
                        </div>
                      </div>

                      <div className="rounded-sm border border-[#343a3f] bg-[#121619] p-3">
                        <div className="flex justify-between font-mono text-[10px] text-[#c1c7cd] mb-1">
                          <span>/bms/cell_temp_c</span>
                          <span className="text-[#ea384c] font-bold">v2: 47.2°C!</span>
                        </div>
                        <svg viewBox="0 0 200 72" className="w-full h-16">
                          <line
                            x1="0"
                            y1="26"
                            x2="200"
                            y2="26"
                            stroke="#ea384c"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                          />
                          <polyline
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="2"
                            points="0,58 70,38 115,28 200,32"
                          />
                          <polyline
                            fill="none"
                            stroke="#ea384c"
                            strokeWidth="2"
                            strokeDasharray="5 3"
                            points="0,58 70,32 125,12 200,10"
                          />
                        </svg>
                        <div className="font-mono text-[10px] text-[#a2a9b0]">
                          Red Dash: 45.0°C Thermal Cutoff
                        </div>
                      </div>

                      <div className="rounded-sm border border-[#343a3f] bg-[#121619] p-3">
                        <div className="flex justify-between font-mono text-[10px] text-[#c1c7cd] mb-1">
                          <span>/adas/ego_vel_mps</span>
                          <span className="text-[#ea384c] font-bold">+1.0s Late AEB</span>
                        </div>
                        <svg viewBox="0 0 200 72" className="w-full h-16">
                          <polyline
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="2"
                            points="0,16 65,16 135,64 200,64"
                          />
                          <polyline
                            fill="none"
                            stroke="#ea384c"
                            strokeWidth="2"
                            strokeDasharray="5 3"
                            points="0,16 105,16 175,64 200,64"
                          />
                        </svg>
                        <div className="font-mono text-[10px] text-[#a2a9b0]">
                          Blue: v1.0 · Red: v2.0 Delayed
                        </div>
                      </div>
                    </div>

                    <div className="rounded-sm bg-[#1c0f30] border border-[#664fff] p-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono text-xs text-[#ded6fc]">
                        <Volume2 className="w-4 h-4 text-[#937af6]" />
                        <span>
                          <strong>Gemini 4 Argon + Voice Alert:</strong> Synthesizes
                          ELF64 diffs &amp; 17 SIL runs into a verified C patch.
                        </span>
                      </div>
                      <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-sm bg-[#664fff] text-white font-medium">
                        Auto-Patch v2.0.1 Ready
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Docked Inspector Panel (4 cols): Raw Messages & Telemetry Details */}
              <div className="lg:col-span-4 bg-[#18181f] flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between border-b border-[#2b2b36] pb-2.5 mb-4">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[#a2a9b0]">
                      INSPECTOR · SLIDE {activeSlide.indexLabel}/04
                    </span>
                    <span className="font-mono text-[11px] text-[#937af6]">
                      ISO 26262 ASIL-D
                    </span>
                  </div>

                  <h3 className="text-lg font-medium text-white leading-snug">
                    {activeSlide.headline}
                  </h3>
                  <p className="mt-2 font-mono text-xs text-[#c1c7cd] leading-relaxed">
                    {activeSlide.subline}
                  </p>

                  {/* Structured JSON / Topic Readout like Foxglove Raw Messages Panel */}
                  <div className="mt-4 rounded-sm bg-[#121217] border border-[#2b2b36] p-3 font-mono text-[11px] space-y-1.5 text-[#c1c7cd]">
                    <div className="text-[#878d96]">
                      &#123; /* {activeSlide.topicName} */
                    </div>
                    <div className="pl-3">
                      <span className="text-[#b4a3f9]">&quot;baseline_version&quot;</span>:{' '}
                      <span className="text-[#38bdf8]">&quot;v1.0.0-golden&quot;</span>,
                    </div>
                    <div className="pl-3">
                      <span className="text-[#b4a3f9]">&quot;candidate_version&quot;</span>:{' '}
                      <span className="text-[#ff808e]">&quot;v2.0.0-rc3&quot;</span>,
                    </div>
                    <div className="pl-3">
                      <span className="text-[#b4a3f9]">&quot;sil_verdict&quot;</span>:{' '}
                      <span className="text-[#ea384c] font-bold">
                        &quot;BLOCK_OTA_RELEASE&quot;
                      </span>
                      ,
                    </div>
                    <div className="pl-3">
                      <span className="text-[#b4a3f9]">&quot;auto_patch_available&quot;</span>:{' '}
                      <span className="text-emerald-400">true</span>
                    </div>
                    <div className="text-[#878d96]">&#125;</div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#2b2b36] flex items-center justify-between">
                  <span className="font-mono text-xs text-[#a2a9b0]">
                    17 Automated SIL Cases
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[#b4a3f9] group-hover:text-[#cdc2fb] font-medium">
                    <span>{activeSlide.ctaLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>

            {/* Foxglove Studio Bottom Timeline Bar inside the Hero Frame */}
            <div className="h-9 px-4 bg-[#18181f] border-t border-[#2b2b36] flex items-center justify-between gap-4 font-mono text-[11px] text-[#a2a9b0]">
              <div className="flex items-center gap-3">
                <span className="text-white font-medium">00:00.000</span>
                <div className="w-36 sm:w-64 h-1.5 bg-[#2b2b36] rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-[#664fff] transition-all duration-500"
                    style={{ width: `${((activeSlideIdx + 1) / 4) * 100}%` }}
                  />
                </div>
                <span className="text-[#ea384c]">3 ANOMALY MARKERS</span>
              </div>
              <div className="hidden sm:flex items-center gap-4">
                {STUDIO_SLIDES.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAutoPlaying(false);
                      setActiveSlideIdx(idx);
                    }}
                    className={`cursor-pointer transition-colors ${
                      idx === activeSlideIdx
                        ? 'text-[#b4a3f9] font-bold underline underline-offset-4'
                        : 'text-[#878d96] hover:text-white'
                    }`}
                  >
                    [{s.indexLabel}] {s.tabName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BLOCK 2: EXACT FOXGLOVE.DEV STANDARDS & ECOSYSTEM STRIP
          py-20 bg-gray-100 (#121619) | font-mono text-xl text-center
         ===================================================================== */}
      <section className="py-16 bg-[#121619] border-t border-[#21272a]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16">
          <h2 className="mb-10 text-center font-mono text-lg md:text-xl font-normal text-[#c1c7cd]">
            Engineered for automotive safety standards &amp; Physical AI verification stacks.
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-6 items-center justify-items-center opacity-85">
            {[
              { name: 'ISO 26262', sub: 'ASIL-D CERTIFIED GATE' },
              { name: 'JEITA', sub: 'LI-ION PLATING SPEC' },
              { name: 'PANASONIC', sub: 'NCR18650B ELECTRO-THERM' },
              { name: 'UNECE R152', sub: 'HIGHWAY AEB STANDARD' },
              { name: 'REA MCP', sub: 'ELF64 DISASSEMBLER' },
              { name: 'AGENT37', sub: 'CLOUD SIL SANDBOX' },
              { name: 'GEMINI 4', sub: 'ARGON SAFETY AUDITOR' },
            ].map((item) => (
              <div
                key={item.name}
                className="flex flex-col items-center text-center px-3 py-2"
              >
                <span className="font-display text-base font-bold tracking-wider text-[#f2f4f8]">
                  {item.name}
                </span>
                <span className="font-mono text-[10px] text-[#878d96] mt-0.5">
                  {item.sub}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          BLOCK 3: EXACT FOXGLOVE.DEV PURE BLACK STICKY STEPPER SECTION
          section-py bg-black (#000000) | "Tame the data mess."
         ===================================================================== */}
      <section id="platform-stepper" className="py-24 bg-black">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16">
          <div className="lg:w-3/4 mb-16 md:mb-24">
            <p className="mb-3 font-mono text-sm font-normal tracking-wide text-[#c1c7cd]">
              One platform for all your vehicle OTA binaries &amp; SIL telemetry
            </p>
            <h2 className="text-4xl leading-tight tracking-tight font-medium text-white">
              Tame the black-box OTA mess.
            </h2>
            <div className="text-xl leading-normal text-[#c1c7cd] font-normal mt-4">
              Replace naive compile-only CI checks with an{' '}
              <button
                onClick={() => onLaunchWorkbench('telemetry_scopes')}
                className="text-[#b4a3f9] hover:text-[#cdc2fb] underline-offset-4 hover:underline cursor-pointer"
              >
                agentic
              </button>{' '}
              platform for reverse-engineering, simulating, and homologating
              software-defined vehicle updates.
            </div>
          </div>

          <div className="gap-12 lg:grid lg:grid-cols-2 items-start">
            {/* Left Column: 3 Foxglove Stepper Blocks */}
            <div className="space-y-16 lg:space-y-20">
              {/* Step 0: Disassemble */}
              <div
                onMouseEnter={() => setActiveStepperIdx(0)}
                onClick={() => setActiveStepperIdx(0)}
                className={`p-6 rounded-md border transition-colors cursor-pointer ${
                  activeStepperIdx === 0
                    ? 'bg-[#121619] border-[#664fff]'
                    : 'bg-transparent border-[#21272a] hover:border-[#343a3f]'
                }`}
              >
                <p className="text-[#c1c7cd] mb-3 font-mono text-base font-medium">
                  01 · Reverse Engineer (REA MCP)
                </p>
                <h3 className="text-2xl sm:text-3xl leading-tight tracking-tight font-medium text-white mb-4">
                  Disassemble stripped supplier binaries without source code.
                </h3>
                <ul className="mt-4 list-disc space-y-3 pl-5 text-base sm:text-lg leading-normal text-[#a2a9b0]">
                  <li>
                    Extract ELF64 symbol tables and `.rodata` IEEE-754 float
                    constants (`0x42340000` ➔ `0x42480000`) directly from
                    compiled `.so` / `.bin` artifacts
                  </li>
                  <li>
                    Compare control-flow graphs (CFG) to detect deleted JEITA
                    cold-temperature branches before running a single test
                  </li>
                  <li>
                    Flag unused register parameters when a candidate update
                    silently ignores `temp_sensor_fail` fault inputs
                  </li>
                </ul>
                <div className="mt-6">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunchWorkbench('rea_binary');
                    }}
                    className="inline-flex items-center gap-1.5 font-medium text-[#b4a3f9] hover:text-[#cdc2fb] hover:underline cursor-pointer"
                  >
                    <span>Explore REA ELF64 binary gatekeeper</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Step 1: Triage & Debug in 3D */}
              <div
                onMouseEnter={() => setActiveStepperIdx(1)}
                onClick={() => setActiveStepperIdx(1)}
                className={`p-6 rounded-md border transition-colors cursor-pointer ${
                  activeStepperIdx === 1
                    ? 'bg-[#121619] border-[#664fff]'
                    : 'bg-transparent border-[#21272a] hover:border-[#343a3f]'
                }`}
              >
                <p className="text-[#c1c7cd] mb-3 font-mono text-base font-medium">
                  02 · Triage &amp; Debug in 3D SIL
                </p>
                <h3 className="text-2xl sm:text-3xl leading-tight tracking-tight font-medium text-white mb-4">
                  Visualize, understand, and reason about vehicle behavior.
                </h3>
                <ul className="mt-4 list-disc space-y-3 pl-5 text-base sm:text-lg leading-normal text-[#a2a9b0]">
                  <li>
                    Run Blue v1.0 Baseline and Red v2.0 Candidate ghost vehicles
                    simultaneously on a 3D CAD highway grid with radar frustums
                  </li>
                  <li>
                    Inspect 16-cell Panasonic NCR18650B thermal cutaways across
                    10 ambient &amp; fault-injection battery regimes
                  </li>
                  <li>
                    Scrub synchronized 3-channel oscilloscopes with red safety
                    limit markers (`0.8125A` JEITA, `45.0°C` cutoff)
                  </li>
                </ul>
                <div className="mt-6">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunchWorkbench('adas_twin');
                    }}
                    className="inline-flex items-center gap-1.5 font-medium text-[#b4a3f9] hover:text-[#cdc2fb] hover:underline cursor-pointer"
                  >
                    <span>Launch 3D Twin-Track &amp; Battery SIL</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Step 2: Auto-Patch & Homologate */}
              <div
                onMouseEnter={() => setActiveStepperIdx(2)}
                onClick={() => setActiveStepperIdx(2)}
                className={`p-6 rounded-md border transition-colors cursor-pointer ${
                  activeStepperIdx === 2
                    ? 'bg-[#121619] border-[#664fff]'
                    : 'bg-transparent border-[#21272a] hover:border-[#343a3f]'
                }`}
              >
                <p className="text-[#c1c7cd] mb-3 font-mono text-base font-medium">
                  03 · Gate &amp; Auto-Remediate
                </p>
                <h3 className="text-2xl sm:text-3xl leading-tight tracking-tight font-medium text-white mb-4">
                  Block unsafe OTA releases and generate verified C patches.
                </h3>
                <ul className="mt-4 list-disc space-y-3 pl-5 text-base sm:text-lg leading-normal text-[#a2a9b0]">
                  <li>
                    Synthesize binary disassembly and physical telemetry into an
                    auditable ISO 26262 ASIL-D release gate verdict
                  </li>
                  <li>
                    Broadcast a spoken executive safety briefing detailing exact
                    memory offsets and physical violations
                  </li>
                  <li>
                    Apply a 1-click AI-generated C firmware patch (`v2.0.1`) and
                    re-verify all 17 SIL scenarios to `PASS`
                  </li>
                </ul>
                <div className="mt-6">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunchWorkbench('telemetry_scopes');
                    }}
                    className="inline-flex items-center gap-1.5 font-medium text-[#b4a3f9] hover:text-[#cdc2fb] hover:underline cursor-pointer"
                  >
                    <span>Test 1-Click Auto-Patch in Studio</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Sticky Interactive Preview Card matching activeStepperIdx */}
            <div className="mt-10 lg:mt-0 lg:sticky lg:top-28 rounded-md border border-[#343a3f] bg-[#121619] overflow-hidden shadow-2xl">
              <div className="h-10 px-4 bg-[#18181f] border-b border-[#343a3f] flex items-center justify-between font-mono text-xs text-[#c1c7cd]">
                <span>
                  {activeStepperIdx === 0 && 'STEP 01 · REA ELF64 BINARY DIFF'}
                  {activeStepperIdx === 1 && 'STEP 02 · 3D TWIN-TRACK & BMS SIL'}
                  {activeStepperIdx === 2 && 'STEP 03 · AI HOMOLOGATION PATCH'}
                </span>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <button
                      key={i}
                      onClick={() => setActiveStepperIdx(i)}
                      className={`w-6 h-5 rounded-xs font-mono text-[10px] cursor-pointer ${
                        activeStepperIdx === i
                          ? 'bg-[#664fff] text-white'
                          : 'bg-[#21272a] text-[#878d96]'
                      }`}
                    >
                      0{i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {activeStepperIdx === 0 && (
                  <div className="font-mono text-xs space-y-3">
                    <div className="p-3 rounded-sm bg-black border border-[#343a3f] text-[#c1c7cd]">
                      <div className="text-[#937af6] font-bold mb-1">
                        $ rea-objdump -d -j .rodata bms_v1.so bms_v2.so
                      </div>
                      <div className="text-emerald-400">
                        - 0x2000 (.rodata): 00 00 34 42 // 45.0f °C MAX_TEMP
                      </div>
                      <div className="text-[#ea384c] font-bold">
                        + 0x2000 (.rodata): 00 00 48 42 // 50.0f °C (+5.0°C UNSAFE)
                      </div>
                      <div className="text-emerald-400 mt-2">
                        - 0x1152 (.text): jae 0x1170 // JEITA &lt;10°C 0.25C guard
                      </div>
                      <div className="text-[#ea384c] font-bold">
                        + 0x1152 (.text): [STRIPPED] // Cold branch deleted
                      </div>
                    </div>
                    <p className="text-sm font-sans text-[#c1c7cd]">
                      REA MCP extracts symbol tables, immediate floats, and CFG
                      diffs before execution begins.
                    </p>
                  </div>
                )}

                {activeStepperIdx === 1 && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-sm bg-black border border-[#343a3f] font-mono text-xs space-y-2">
                      <div className="flex justify-between text-[#38bdf8]">
                        <span>Track 1 (v1.0 Baseline):</span>
                        <span>AEB @ TTC 2.0s ➔ Gap 9.72m [SAFE]</span>
                      </div>
                      <div className="flex justify-between text-[#ea384c] font-bold">
                        <span>Track 2 (v2.0 Candidate):</span>
                        <span>AEB @ TTC 1.0s ➔ Gap 5.84m [FAIL]</span>
                      </div>
                      <div className="h-px bg-[#21272a] my-2" />
                      <div className="flex justify-between text-[#38bdf8]">
                        <span>BMS-02 (v1.0 @ 5°C):</span>
                        <span>0.8125A (0.25C) ➔ 10,790s [SAFE]</span>
                      </div>
                      <div className="flex justify-between text-[#ea384c] font-bold">
                        <span>BMS-02 (v2.0 @ 5°C):</span>
                        <span>1.6250A (0.50C) ➔ 6,070s [PLATING]</span>
                      </div>
                    </div>
                    <p className="text-sm text-[#c1c7cd]">
                      Synchronized 3D vehicle kinematics and Panasonic NCR18650B
                      electro-thermal ODE solvers run side-by-side.
                    </p>
                  </div>
                )}

                {activeStepperIdx === 2 && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-sm bg-black border border-emerald-700/60 font-mono text-xs space-y-1.5">
                      <div className="text-emerald-400 font-bold">
                        /* DeltaGuard Auto-Generated Patch (v2.0.1) */
                      </div>
                      <div className="text-[#c1c7cd]">
                        if (temp_sensor_fail) return 0.0f; // Restored ASIL-D
                      </div>
                      <div className="text-[#c1c7cd]">
                        if (temp_c &gt;= 45.0f) return 0.0f; // Restored 0x42340000
                      </div>
                      <div className="text-[#c1c7cd]">
                        if (temp_c &lt; 10.0f) return 0.8125f; // Restored JEITA 0.25C
                      </div>
                    </div>
                    <p className="text-sm text-[#c1c7cd]">
                      One click compiles the remediated firmware and re-verifies
                      all 17 ADAS &amp; BMS cases in the workbench.
                    </p>
                  </div>
                )}

                <div className="mt-5 pt-4 border-t border-[#21272a] flex justify-end">
                  <button
                    onClick={() =>
                      onLaunchWorkbench(
                        activeStepperIdx === 0
                          ? 'rea_binary'
                          : activeStepperIdx === 1
                          ? 'adas_twin'
                          : 'telemetry_scopes'
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-sm font-medium px-4 py-2 text-sm bg-[#664fff] text-white hover:bg-[#5933f2] cursor-pointer"
                  >
                    <span>Open Step 0{activeStepperIdx + 1} in Live Studio</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BLOCK 4: EXACT FOXGLOVE.DEV 4-COLUMN ENTERPRISE FOUNDATIONS
          section-py bg-black | 56x56 rounded-full bg-purple-80 (#382193) text-purple-30 (#cdc2fb)
         ===================================================================== */}
      <section
        id="enterprise-foundations"
        className="py-24 bg-black border-t border-[#21272a]"
      >
        <div className="max-w-[1440px] mx-auto px-6 md:px-16">
          <div className="lg:w-3/4 mb-12 md:mb-16">
            <h2 className="text-4xl leading-tight tracking-tight font-medium text-white">
              Enterprise-ready foundations for vehicle homologation.
            </h2>
            <div className="text-xl leading-normal text-[#c1c7cd] font-normal mt-4">
              Deterministic by default, extensible to stripped Tier-1 binaries,
              integrated with Agent37 cloud sandboxes, and compliant with
              automotive safety standards.
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Column 1 */}
            <div>
              <div className="mb-4 inline-flex w-14 h-14 items-center justify-center rounded-full bg-[#382193] text-[#cdc2fb]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl leading-snug tracking-normal font-medium text-white mb-2">
                Safety and compliance.
              </h3>
              <div className="text-base leading-normal text-[#c1c7cd] font-normal">
                Enforces ISO 26262 (ASIL-D), JEITA Li-Ion cold-charge rules, and
                UNECE R152 highway AEB clearance margins automatically.
                <div className="mt-4">
                  <button
                    onClick={() => onLaunchWorkbench('bms_thermal')}
                    className="text-[#b4a3f9] hover:text-[#cdc2fb] inline-flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <span>Inspect rulebook</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Column 2 */}
            <div>
              <div className="mb-4 inline-flex w-14 h-14 items-center justify-center rounded-full bg-[#382193] text-[#cdc2fb]">
                <FileCode2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl leading-snug tracking-normal font-medium text-white mb-2">
                Binary extensibility.
              </h3>
              <div className="text-base leading-normal text-[#c1c7cd] font-normal">
                Ingests stripped ELF64 `.so` shared libraries, `.bin` firmware
                images, and JSON parameter packages without requiring supplier
                source code.
                <div className="mt-4">
                  <button
                    onClick={() => onLaunchWorkbench('rea_binary')}
                    className="text-[#b4a3f9] hover:text-[#cdc2fb] inline-flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <span>View ELF64 diff</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Column 3 */}
            <div>
              <div className="mb-4 inline-flex w-14 h-14 items-center justify-center rounded-full bg-[#382193] text-[#cdc2fb]">
                <Terminal className="w-6 h-6" />
              </div>
              <h3 className="text-xl leading-snug tracking-normal font-medium text-white mb-2">
                Agentic integrations.
              </h3>
              <div className="text-base leading-normal text-[#c1c7cd] font-normal">
                Powered by Gemini 4 Argon, REA Binary MCP, Agent37 isolated
                execution receipts, and spoken executive voice briefings.
                <div className="mt-4">
                  <button
                    onClick={() => onLaunchWorkbench('telemetry_scopes')}
                    className="text-[#b4a3f9] hover:text-[#cdc2fb] inline-flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <span>Hear voice briefing</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Column 4 */}
            <div>
              <div className="mb-4 inline-flex w-14 h-14 items-center justify-center rounded-full bg-[#382193] text-[#cdc2fb]">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-xl leading-snug tracking-normal font-medium text-white mb-2">
                Deterministic SIL matrix.
              </h3>
              <div className="text-base leading-normal text-[#c1c7cd] font-normal">
                Executes 17 repeatable ADAS &amp; BMS stress scenarios with
                exportable `results.json` and `diff.json` homologation
                certificates.
                <div className="mt-4">
                  <button
                    onClick={() => onLaunchWorkbench('adas_twin')}
                    className="text-[#b4a3f9] hover:text-[#cdc2fb] inline-flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <span>Run 17-case suite</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BLOCK 5: EXACT FOXGLOVE.DEV CUSTOMER STORIES / CASE STUDY TABS
          section-py bg-gray-100 (#121619) | 4-tab bar with bg-gray-90 (#21272a) active tab
         ===================================================================== */}
      <section id="case-studies" className="py-24 bg-[#121619]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16">
          <div className="lg:w-3/4 mb-10 md:mb-14">
            <p className="mb-3 font-mono text-sm font-normal tracking-wide text-[#c1c7cd]">
              Real-world OTA regression catches
            </p>
            <h2 className="text-4xl leading-tight tracking-tight font-medium text-white">
              OEM safety teams focus on autonomy, not hidden supplier regressions.
            </h2>
            <div className="text-xl leading-normal text-[#c1c7cd] font-normal mt-4">
              Explore how DeltaGuard intercepts deceptive fast-charge hacks and
              delayed AEB braking across our 17-scenario homologation suite.
            </div>
          </div>

          {/* Exact Foxglove 4-Tab Bar (border-gray-80 mb-10 flex h-16) */}
          <div
            role="tablist"
            aria-label="Homologation case studies"
            className="border-b border-[#343a3f] mb-10 grid grid-cols-2 lg:grid-cols-4"
          >
            {CASE_STUDY_TABS.map((tab) => {
              const isSelected = tab.id === activeCaseStudy.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveCaseTabId(tab.id)}
                  className={`-mb-px flex flex-col h-16 cursor-pointer items-center justify-center border-b-2 px-4 transition-colors ${
                    isSelected
                      ? 'bg-[#21272a] rounded-t-sm border-white text-white'
                      : 'border-transparent text-[#878d96] hover:text-[#c1c7cd]'
                  }`}
                >
                  <span className="font-mono text-xs md:text-sm font-medium">
                    {tab.tabLabel}
                  </span>
                  <span className="font-mono text-[10px] text-[#937af6]">
                    {tab.scenarioCode}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Exact Foxglove 2-Column Tab Panel Content */}
          <div className="grid grid-cols-1 gap-8 pt-4 pb-8 md:grid-cols-2 md:gap-16 items-center">
            <div className="flex flex-col gap-6">
              <h3 className="text-xl leading-snug font-medium text-white md:text-2xl">
                {activeCaseStudy.headline}
              </h3>
              <p className="text-[#c1c7cd] font-mono text-sm leading-relaxed">
                {activeCaseStudy.quote}
              </p>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-[#382193] border border-[#664fff] flex items-center justify-center font-mono text-xs font-bold text-white shrink-0">
                  SIL
                </div>
                <div>
                  <p className="text-[#c1c7cd] font-mono text-sm">
                    {activeCaseStudy.author}
                  </p>
                  <p className="font-mono text-xs text-[#878d96]">
                    {activeCaseStudy.role}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onLaunchWorkbench(activeCaseStudy.target)}
                className="text-[#b4a3f9] hover:text-[#cdc2fb] inline-flex items-center gap-2 font-mono text-sm transition-colors self-start cursor-pointer"
              >
                <span>Inspect scenario in live Foxglove workbench</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Right Evidence Card */}
            <div className="overflow-hidden rounded-lg border border-[#343a3f] bg-[#18181f] p-6 font-mono">
              <div className="flex items-center justify-between border-b border-[#2b2b36] pb-3 mb-4">
                <span className="text-xs text-[#c1c7cd]">
                  TELEMETRY &amp; BINARY EVIDENCE
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-sm bg-[#ea384c]/20 text-[#ff808e] border border-[#ea384c]/50">
                  {activeCaseStudy.verdictText}
                </span>
              </div>
              <div className="p-4 rounded-sm bg-[#121217] border border-[#2b2b36] space-y-3">
                <div className="text-xs text-[#878d96]">
                  {activeCaseStudy.metricLabel}
                </div>
                <div className="text-lg md:text-xl font-bold text-white">
                  {activeCaseStudy.metricValue}
                </div>
                <div className="h-2 w-full rounded-full bg-[#21272a] overflow-hidden">
                  <div className="h-full w-4/5 bg-gradient-to-r from-[#664fff] to-[#ea384c]" />
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => onLaunchWorkbench(activeCaseStudy.target)}
                  className="inline-flex items-center gap-2 rounded-sm font-medium px-4 py-2 text-xs bg-[#664fff] text-white hover:bg-[#5933f2] cursor-pointer"
                >
                  <span>Reproduce in Live Workbench</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BLOCK 6: EXACT FOXGLOVE.DEV ISOMETRIC PURPLE CUBE BANNER
          Uses exact SVG geometry extracted from foxglove.dev/images/purple-banner-bg.svg
         ===================================================================== */}
      <section className="relative overflow-hidden bg-[#271863] py-20 md:py-28">
        {/* Exact Foxglove Isometric 3D Cubes Background SVG */}
        <svg
          viewBox="0 0 1584 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          aria-hidden="true"
        >
          <rect width="1584" height="320" fill="#271863" />
          <path
            d="M1539.51 241.5L1260.01 80.25L1260.01 402.75L1539.51 564L1539.51 241.5Z"
            fill="#4528B9"
          />
          <path
            d="M1819 80.25L1539.5 241.5L1539.5 564L1819 402.75L1819 80.25Z"
            fill="#382193"
          />
          <path
            d="M1819 80.25L1539.5 -81L1260 80.25L1539.5 241.5L1819 80.25Z"
            fill="#512EDB"
          />
          <path
            d="M44.5078 379.5L-234.992 218.25L-234.992 540.75L44.5078 702L44.5078 379.5Z"
            fill="#4528B9"
          />
          <path
            d="M324 218.25L44.5 379.5L44.5 702L324 540.75L324 218.25Z"
            fill="#382193"
          />
          <path
            d="M324 218.25L44.5 57L-235 218.25L44.5 379.5L324 218.25Z"
            fill="#512EDB"
          />
        </svg>

        <div className="relative z-10 max-w-[1440px] mx-auto px-6 text-center md:px-16">
          <h2 className="text-3xl md:text-6xl leading-tight tracking-tight font-medium text-white mb-8">
            Start homologating with DeltaGuard.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => onLaunchWorkbench()}
              className="inline-flex items-center gap-2 rounded-sm font-medium transition-colors px-6 py-2.5 text-lg bg-[#664fff] text-white hover:bg-[#5933f2] cursor-pointer shadow-lg"
            >
              <span>Get started — Launch Studio</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={onOpenUploadModalInWorkbench}
              className="inline-flex items-center gap-2 rounded-sm font-medium transition-colors px-6 py-2.5 text-lg border-2 border-[#b4a3f9] bg-[#1c0f30]/90 text-white hover:bg-[#31135e] cursor-pointer"
            >
              <FolderUp className="w-5 h-5 text-[#cdc2fb]" />
              <span>Upload OTA Binary</span>
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BLOCK 7: EXACT FOXGLOVE.DEV DARK FOOTER
          bg-gray-100 (#121619) | 4-column grid
         ===================================================================== */}
      <footer className="bg-[#121619] border-t border-[#343a3f]">
        <div className="max-w-[1440px] mx-auto px-6 py-16 md:px-16">
          <div className="grid grid-cols-2 gap-10 lg:grid-cols-4">
            <div className="col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 220 234"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-auto"
                >
                  <path
                    d="M219.294 74.5355L182.97 53.5615C181.941 52.9674 180.673 52.9675 179.644 53.5617L130.303 82.0599V25.0789C130.303 23.8911 129.669 22.7935 128.641 22.1995L92.3161 1.22523C91.2078 0.585325 89.8224 1.38513 89.8224 2.66493V82.0432L40.4808 53.5609C39.4521 52.9671 38.1847 52.9671 37.156 53.5611L0.831225 74.5356C-0.276975 75.1755 -0.276975 76.7751 0.831225 77.415L69.5736 117.104L0.831225 156.794C-0.277075 157.434 -0.277075 159.033 0.831225 159.673L37.156 180.648C38.1847 181.242 39.4521 181.242 40.4808 180.648L89.8224 152.165V209.146C89.8224 210.334 90.4564 211.432 91.4856 212.026L127.81 232.985C128.918 233.624 130.303 232.824 130.303 231.545V152.165L179.644 180.648C180.673 181.241 181.941 181.241 182.969 180.647L219.294 159.673C220.402 159.033 220.402 157.433 219.294 156.794L150.535 117.104L219.294 77.4148C220.402 76.775 220.402 75.1755 219.294 74.5355ZM133.046 130.387L110.054 143.654L87.0792 130.387V103.838L110.054 90.5716L133.046 103.838V130.387Z"
                    fill="#937af6"
                  />
                </svg>
                <span className="font-display font-bold tracking-wider uppercase text-white">
                  DELTAGUARD
                </span>
              </div>
              <p className="text-sm leading-normal text-[#c1c7cd] font-normal mt-3 max-w-xs">
                The agentic physical safety &amp; binary homologation platform
                for Software-Defined Vehicles.
              </p>
              <div className="mt-4 font-mono text-xs text-[#878d96]">
                {isPatchedSafe
                  ? '● Status: v2.0.1 Patched & Verified'
                  : '● Status: v2.0.0 Candidate Staged (3 Violations)'}
              </div>
            </div>

            <div>
              <h4 className="font-mono text-xs uppercase tracking-wider text-[#878d96] mb-4">
                Product Modules
              </h4>
              <ul className="space-y-2.5 text-sm text-[#c1c7cd]">
                <li>
                  <button
                    onClick={() => onLaunchWorkbench('adas_twin')}
                    className="hover:text-white cursor-pointer"
                  >
                    3D ADAS Twin-Track SIL
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onLaunchWorkbench('bms_thermal')}
                    className="hover:text-white cursor-pointer"
                  >
                    3D NCR18650B Battery Pack
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onLaunchWorkbench('rea_binary')}
                    className="hover:text-white cursor-pointer"
                  >
                    REA ELF64 Disassembler
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onLaunchWorkbench('telemetry_scopes')}
                    className="hover:text-white cursor-pointer"
                  >
                    Multi-Channel Oscilloscopes
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-mono text-xs uppercase tracking-wider text-[#878d96] mb-4">
                Safety Standards
              </h4>
              <ul className="space-y-2.5 text-sm text-[#c1c7cd]">
                <li>ISO 26262 (ASIL-D Gate)</li>
                <li>JEITA Cold-Charge Lithium Spec</li>
                <li>UNECE R152 Highway AEB</li>
                <li>Panasonic NCR18650B Reference</li>
              </ul>
            </div>

            <div>
              <h4 className="font-mono text-xs uppercase tracking-wider text-[#878d96] mb-4">
                Workbench Actions
              </h4>
              <ul className="space-y-2.5 text-sm text-[#c1c7cd]">
                <li>
                  <button
                    onClick={() => onLaunchWorkbench()}
                    className="text-[#b4a3f9] hover:text-[#cdc2fb] cursor-pointer"
                  >
                    Launch Foxglove SIL Studio →
                  </button>
                </li>
                <li>
                  <button
                    onClick={onOpenUploadModalInWorkbench}
                    className="hover:text-white cursor-pointer"
                  >
                    Stage Supplier OTA Package
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
