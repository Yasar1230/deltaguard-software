// Web Audio API Synthesizer & Persistent Voiceover MP3 Engine for DeltaGuard
// Includes cinematic keynote SFX: playClickSound, playHazardAlert, playGateBlockedStamp

let sharedAudioCtx: AudioContext | null = null;
let voiceoverAudioBuffer: AudioBuffer | null = null;
let voiceoverSourceNode: AudioBufferSourceNode | null = null;
let voiceoverStartCtxTime: number = 0;
let isWebAudioVoiceoverPlaying: boolean = false;
let loadedVoiceoverDurationS: number = 45.0;

let persistentHtmlAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * 15ms crisp mechanical click burst from 1600Hz dropping to 300Hz
 * with exponential gain decay.
 */
export function playClickSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.015);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.016);
  } catch {
    // Ignore audio context restrictions
  }
}

/**
 * Subtle high-tech confirmation chime when attaching the ElevenLabs MP3 file.
 */
export function playMp3AttachedChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 1046.5]; // C5 -> E5 -> C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.12, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.23);
    });
  } catch {
    // Ignore
  }
}

/**
 * Scene 2 (8.0s): Dramatic Crimson Hazard Alert — low sub-bass fracture + dual warning pulse.
 */
export function playHazardAlert(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Sub-bass fracture drop (140Hz -> 42Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(42, now + 0.45);
    subGain.gain.setValueAtTime(0.22, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.5);

    // 2. Dual high-tech automotive hazard klaxon (880Hz -> 660Hz)
    [0, 0.18].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 880 : 660, now + offset);
      gain.gain.setValueAtTime(0.16, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.17);
    });
  } catch {
    // Ignore
  }
}

/**
 * Scene 3 (18.0s): Clean Apple/Stripe keynote light-flash shimmer chord.
 */
export function playKeynoteRevealChord(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const chord = [261.63, 329.63, 392.0, 523.25]; // C4 major triad + C5
    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.78);
    });
  } catch {
    // Ignore
  }
}

/**
 * Scene 5 (38.0s): Heavy Cinematic Sub-Bass Impact + Metallic Stamp Lock
 * when slamming "🛑 OTA v2.0.0 BLOCKED BY DELTAGUARD".
 */
export function playGateBlockedStamp(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep cinema sub-bass impact thud (110Hz -> 28Hz)
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(110, now);
    bassOsc.frequency.exponentialRampToValueAtTime(28, now + 0.55);
    bassGain.gain.setValueAtTime(0.38, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    bassOsc.connect(bassGain);
    bassGain.connect(ctx.destination);
    bassOsc.start(now);
    bassOsc.stop(now + 0.62);

    // Crisp transient impact click (900Hz -> 120Hz)
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(900, now);
    snapOsc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
    snapGain.gain.setValueAtTime(0.24, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    snapOsc.connect(snapGain);
    snapGain.connect(ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.1);
  } catch {
    // Ignore
  }
}

/**
 * Alias for general automotive alert chime used in the workbench.
 */
export function playAlertBeep(): void {
  playHazardAlert();
}

/**
 * Loads an uploaded MP3/audio file into BOTH:
 * 1) A decoded Web Audio API AudioBuffer (immune to DOM unmounts & iframe <audio> quirks)
 * 2) A persistent module-level HTMLAudioElement fallback
 */
export async function loadVoiceoverFile(
  file: File
): Promise<{ durationS: number; url: string }> {
  stopVoiceoverTrack();

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }
  const objectUrl = URL.createObjectURL(file);
  currentObjectUrl = objectUrl;

  if (typeof window !== 'undefined') {
    if (!persistentHtmlAudio) {
      persistentHtmlAudio = new Audio();
      persistentHtmlAudio.preload = 'auto';
    }
    persistentHtmlAudio.src = objectUrl;
    persistentHtmlAudio.volume = 1.0;
    persistentHtmlAudio.muted = false;
    persistentHtmlAudio.load();
  }

  let decodedDurationS = 45.0;
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const arrayBuf = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
      voiceoverAudioBuffer = decoded;
      decodedDurationS = decoded.duration || 45.0;
      loadedVoiceoverDurationS = decodedDurationS;
    }
  } catch {
    voiceoverAudioBuffer = null;
  }

  return { durationS: decodedDurationS, url: objectUrl };
}

export function getVoiceoverDurationS(): number {
  if (voiceoverAudioBuffer && voiceoverAudioBuffer.duration > 1) {
    return voiceoverAudioBuffer.duration;
  }
  if (
    persistentHtmlAudio &&
    Number.isFinite(persistentHtmlAudio.duration) &&
    persistentHtmlAudio.duration > 1
  ) {
    return persistentHtmlAudio.duration;
  }
  return loadedVoiceoverDurationS || 45.0;
}

/**
 * Starts playing the loaded voiceover MP3 from `offsetS` (default 0.0s) using Web Audio API
 * (or persistent HTMLAudioElement fallback) at full volume.
 */
export async function playVoiceoverTrack(offsetS: number = 0): Promise<boolean> {
  stopVoiceoverTrack();

  // 1. Primary: Web Audio API AudioBufferSourceNode
  const ctx = getAudioContext();
  if (ctx && voiceoverAudioBuffer) {
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const source = ctx.createBufferSource();
      source.buffer = voiceoverAudioBuffer;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1.2, ctx.currentTime);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.onended = () => {
        if (voiceoverSourceNode === source) {
          isWebAudioVoiceoverPlaying = false;
        }
      };

      const safeOffset = Math.max(
        0,
        Math.min(offsetS, Math.max(0, voiceoverAudioBuffer.duration - 0.1))
      );
      voiceoverSourceNode = source;
      voiceoverStartCtxTime = ctx.currentTime - safeOffset;
      isWebAudioVoiceoverPlaying = true;
      source.start(0, safeOffset);
      return true;
    } catch {
      isWebAudioVoiceoverPlaying = false;
    }
  }

  // 2. Fallback: Persistent HTMLAudioElement
  if (persistentHtmlAudio && currentObjectUrl) {
    try {
      persistentHtmlAudio.volume = 1.0;
      persistentHtmlAudio.muted = false;
      persistentHtmlAudio.currentTime = Math.max(0, offsetS);
      await persistentHtmlAudio.play();
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Stops any currently playing voiceover track (both Web Audio API and HTMLAudioElement).
 */
export function stopVoiceoverTrack(): void {
  if (voiceoverSourceNode) {
    try {
      voiceoverSourceNode.onended = null;
      voiceoverSourceNode.stop();
      voiceoverSourceNode.disconnect();
    } catch {
      // Ignore if already stopped
    }
    voiceoverSourceNode = null;
  }
  isWebAudioVoiceoverPlaying = false;

  if (persistentHtmlAudio) {
    try {
      persistentHtmlAudio.pause();
      persistentHtmlAudio.currentTime = 0;
    } catch {
      // Ignore
    }
  }
}

/**
 * Returns the current playback elapsed time in seconds if the custom MP3 is playing.
 */
export function getVoiceoverElapsedS(): number | null {
  if (isWebAudioVoiceoverPlaying && sharedAudioCtx) {
    return Math.max(0, sharedAudioCtx.currentTime - voiceoverStartCtxTime);
  }
  if (
    persistentHtmlAudio &&
    !persistentHtmlAudio.paused &&
    persistentHtmlAudio.currentTime > 0
  ) {
    return persistentHtmlAudio.currentTime;
  }
  return null;
}

export function isVoiceoverTrackActive(): boolean {
  if (isWebAudioVoiceoverPlaying) return true;
  if (persistentHtmlAudio && !persistentHtmlAudio.paused) return true;
  return false;
}
