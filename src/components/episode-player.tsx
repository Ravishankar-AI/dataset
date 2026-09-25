"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SampleVideo } from "./sample-video";
import { TelemetryPanel } from "./telemetry-panel";
import type { EpisodeTelemetry } from "@/lib/telemetry";

export type CameraPreview = {
  camera: string;
  label: string;
  url: string;
  poster?: string;
};

/**
 * Owns the shared playback clock for the episode: a "Play all"/"Pause all"
 * button drives every camera's <video> in lockstep (with periodic drift
 * correction against the first camera, since browsers don't guarantee
 * multiple independently-started <video> elements stay frame-aligned),
 * and the same clock drives a cursor line across the telemetry charts.
 *
 * Scoped down from full bidirectional sync: only the first camera's
 * native controls (play/seek) also move the cursor and the other
 * cameras; scrubbing a *secondary* camera's own controls moves that
 * camera alone. Covers the actual ask -- one shared play control, charts
 * that track it -- without the complexity of every control driving every
 * other one.
 */
export function EpisodePlayer({
  cameras,
  telemetry,
  videoFps,
}: {
  cameras: CameraPreview[];
  telemetry: EpisodeTelemetry | null;
  videoFps: number;
}) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef<number | null>(null);

  const DRIFT_TOLERANCE_SECONDS = 0.25;

  const tick = useCallback(() => {
    const primary = videoRefs.current[0];
    if (primary) {
      setCurrentTime(primary.currentTime);
      for (const video of videoRefs.current) {
        if (video && video !== primary && Math.abs(video.currentTime - primary.currentTime) > DRIFT_TOLERANCE_SECONDS) {
          video.currentTime = primary.currentTime;
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, tick]);

  // Keeps the cursor (and the "Play all" label) honest even when someone
  // uses the first camera's own native controls instead of the shared
  // button -- play/pause/seek on it mirrors to the rest.
  useEffect(() => {
    const primary = videoRefs.current[0];
    if (!primary) return;

    const onTimeUpdate = () => setCurrentTime(primary.currentTime);
    const onPlay = () => {
      setPlaying(true);
      for (const video of videoRefs.current) {
        if (video && video !== primary && video.paused) video.play().catch(() => {});
      }
    };
    const onPause = () => {
      setPlaying(false);
      for (const video of videoRefs.current) {
        if (video && video !== primary && !video.paused) video.pause();
      }
    };
    const onSeeked = () => {
      setCurrentTime(primary.currentTime);
      for (const video of videoRefs.current) {
        if (video && video !== primary) video.currentTime = primary.currentTime;
      }
    };

    primary.addEventListener("timeupdate", onTimeUpdate);
    primary.addEventListener("play", onPlay);
    primary.addEventListener("pause", onPause);
    primary.addEventListener("seeked", onSeeked);
    return () => {
      primary.removeEventListener("timeupdate", onTimeUpdate);
      primary.removeEventListener("play", onPlay);
      primary.removeEventListener("pause", onPause);
      primary.removeEventListener("seeked", onSeeked);
    };
  }, [cameras.length]);

  const playAll = () => {
    const primary = videoRefs.current[0];
    if (primary?.ended) {
      for (const video of videoRefs.current) if (video) video.currentTime = 0;
    }
    for (const video of videoRefs.current) video?.play().catch(() => {});
    setPlaying(true);
  };

  const pauseAll = () => {
    for (const video of videoRefs.current) video?.pause();
    setPlaying(false);
  };

  const handleEnded = () => {
    if (videoRefs.current.every((v) => !v || v.ended)) setPlaying(false);
  };

  return (
    <div>
      {cameras.length > 0 && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={playing ? pauseAll : playAll}
              className="rounded-pill border border-line-strong bg-signal px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-on-signal shadow-brand transition-shadow hover:shadow-none"
            >
              {playing ? "Pause all" : "Play all"}
            </button>
            <span className="font-mono text-[0.72rem] tabular-nums text-ink-faint">{currentTime.toFixed(1)}s</span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {cameras.map((c, i) => (
              <SampleVideo
                key={c.camera}
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={c.url}
                poster={c.poster}
                label={c.label}
                onEnded={handleEnded}
              />
            ))}
          </div>
        </>
      )}
      {telemetry && <TelemetryPanel telemetry={telemetry} videoFps={videoFps} cursorTime={currentTime} />}
    </div>
  );
}
