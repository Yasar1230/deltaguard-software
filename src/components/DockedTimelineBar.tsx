import React from 'react';
import { Play, Pause, RotateCcw, StepForward, Camera } from 'lucide-react';
import { CameraPreset } from './SimulinkWorld3DView';

interface DockedTimelineBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetPlayback: () => void;
  onStepFrame: () => void;
  playbackTimeS: number;
  durationS: number;
  onChangePlaybackTimeS: (t: number) => void;
  playbackSpeed: number;
  onChangePlaybackSpeed: (speed: number) => void;
  cameraPreset: CameraPreset;
  onChangeCameraPreset: (preset: CameraPreset) => void;
  anomalyTimesS: number[];
  isPatchedSafe: boolean;
}

export const DockedTimelineBar: React.FC<DockedTimelineBarProps> = ({
  isPlaying,
  onTogglePlay,
  onResetPlayback,
  onStepFrame,
  playbackTimeS,
  durationS,
  onChangePlaybackTimeS,
  playbackSpeed,
  onChangePlaybackSpeed,
  cameraPreset,
  onChangeCameraPreset,
  anomalyTimesS,
  isPatchedSafe,
}) => {
  const safeDuration = Math.max(durationS, 0.1);
  const clampedTime = Math.min(Math.max(playbackTimeS, 0), safeDuration);
  const progressPct = (clampedTime / safeDuration) * 100;

  return (
    <footer className="h-10 w-full bg-slate-900 border-t border-slate-800 text-white px-3 flex items-center justify-between gap-3 shrink-0 select-none z-30">
      {/* Left: Transport Controls (Play/Pause, Reset, Step Frame) */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          data-demo-target="timeline-play-btn"
          onClick={onTogglePlay}
          className="h-7 px-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-mono text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3 h-3 fill-current" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              <span>PLAY</span>
            </>
          )}
        </button>

        <button
          onClick={onResetPlayback}
          title="Reset to T = 0.00s"
          className="h-7 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>0.00s</span>
        </button>

        <button
          onClick={onStepFrame}
          title="Step +1 Frame"
          className="h-7 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <StepForward className="w-3 h-3" />
          <span>STEP</span>
        </button>
      </div>

      {/* Center: Foxglove Scrubber with Red Anomaly Tick-Marks */}
      <div className="flex-1 flex items-center gap-2.5 min-w-0 max-w-4xl">
        <span className="font-mono text-[11px] font-bold text-blue-400 tabular-nums w-14 text-right shrink-0">
          {clampedTime.toFixed(2)}s
        </span>

        <div className="relative flex-1 h-5 flex items-center">
          {/* Track Rail */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Red Anomaly Tick-Marks */}
          {!isPatchedSafe &&
            anomalyTimesS.map((t, idx) => {
              const pct = Math.min(99, Math.max(1, (t / safeDuration) * 100));
              return (
                <div
                  key={idx}
                  style={{ left: `${pct}%` }}
                  title={`Safety Regression Event at T = ${t.toFixed(2)}s`}
                  className="absolute top-0.5 bottom-0.5 w-1 bg-red-500 rounded-xs pointer-events-none z-10"
                />
              );
            })}

          {/* Interactive Range Input */}
          <input
            type="range"
            min={0}
            max={safeDuration}
            step={safeDuration > 60 ? 1 : 0.02}
            value={clampedTime}
            onChange={(e) => onChangePlaybackTimeS(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            aria-label="Simulation Timeline Scrubber"
          />

          {/* Playhead Thumb */}
          <div
            style={{ left: `calc(${progressPct}% - 6px)` }}
            className="absolute w-3 h-3 rounded-full bg-white border-2 border-blue-500 shadow pointer-events-none z-10"
          />
        </div>

        <span className="font-mono text-[11px] text-slate-400 tabular-nums w-14 shrink-0">
          {safeDuration.toFixed(2)}s
        </span>
      </div>

      {/* Right: Playback Speed + Camera Presets (Chase | Top | Ortho) */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Speed Selector */}
        <div className="flex items-center gap-0.5 bg-slate-800 p-0.5 rounded border border-slate-700 font-mono text-[10px]">
          {[0.5, 1, 2].map((spd) => (
            <button
              key={spd}
              onClick={() => onChangePlaybackSpeed(spd)}
              className={`px-1.5 py-0.5 rounded-xs cursor-pointer ${
                playbackSpeed === spd
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {spd.toFixed(1)}x
            </button>
          ))}
        </div>

        {/* Camera Angle Buttons */}
        <div className="flex items-center gap-0.5 bg-slate-800 p-0.5 rounded border border-slate-700 font-mono text-[10px]">
          <Camera className="w-3 h-3 text-slate-400 mx-1 shrink-0" />
          {(
            [
              { id: 'chase', label: 'Chase' },
              { id: 'top', label: 'Top' },
              { id: 'isometric', label: 'Ortho' },
              { id: 'side', label: 'Side' },
            ] as const
          ).map((cam) => (
            <button
              key={cam.id}
              onClick={() => onChangeCameraPreset(cam.id)}
              className={`px-2 py-0.5 rounded-xs cursor-pointer ${
                cameraPreset === cam.id
                  ? 'bg-slate-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cam.label}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
};
