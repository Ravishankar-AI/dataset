import type { ChannelSeries, EpisodeTelemetry, Side } from "@/lib/telemetry";
import { LineChart } from "./line-chart";
import { formatDuration } from "@/lib/format";

function formatEventTime(t: number) {
  return `${t.toFixed(1)}s`;
}

function sideLabel(side: Side) {
  return side === "left" ? "L" : side === "right" ? "R" : null;
}

function groupBySide(channels: ChannelSeries[]) {
  return {
    left: channels.filter((c) => c.side === "left"),
    right: channels.filter((c) => c.side === "right"),
    other: channels.filter((c) => c.side === "other"),
  };
}

function ChartSeries(channels: ChannelSeries[]) {
  return channels.map((c) => ({ label: c.label, points: c.points }));
}

export function TelemetryPanel({
  telemetry,
  videoFps,
  cursorTime,
}: {
  telemetry: EpisodeTelemetry;
  videoFps: number;
  cursorTime?: number;
}) {
  const closedEvents = telemetry.graspEvents.filter((e) => e.kind === "closed");
  const totalEngagedSeconds = Object.values(telemetry.engagedSecondsByChannel).reduce((a, b) => a + b, 0);

  const joints = groupBySide(telemetry.jointChannels);
  const jointsSplit = joints.left.length > 0 && joints.right.length > 0;

  const grippers = groupBySide(telemetry.gripperChannels);
  const grippersSplit = grippers.left.length > 0 && grippers.right.length > 0;

  const engagedFor = (channels: ChannelSeries[]) =>
    channels.reduce((sum, c) => sum + (telemetry.engagedSecondsByChannel[c.key] ?? 0), 0);

  // Video frame count isn't read from the capture (that'd mean opening
  // every camera's mp4 just to probe it) -- estimated from the dataset's
  // declared capture fps × this episode's duration instead.
  const estimatedFrames = Math.round(videoFps * telemetry.durationSeconds);

  // How closely the arm tracked what it was commanded to do (|action -
  // observation.state|, see telemetry.ts) -- the closest thing to a data-
  // quality signal this capture format has, since there's no force/torque
  // channel to get one from instead.
  const trackingErrorLabel = (side: "left" | "right") => {
    const e = telemetry.trackingErrorBySide[side];
    return e ? `${e.mean.toFixed(3)} avg · ${e.peak.toFixed(3)} peak` : "no data";
  };

  const metaStats: { label: string; value: string }[] = [
    { label: "Duration", value: formatDuration(Math.round(telemetry.durationSeconds)) },
    {
      label: "Arms used",
      value: telemetry.armsUsed.length === 2 ? "both" : telemetry.armsUsed[0] ?? "—",
    },
    { label: "Grasps", value: String(closedEvents.length) },
    { label: "Peak force · L", value: "no data" },
    { label: "Peak force · R", value: "no data" },
    { label: "Tracking error · L", value: trackingErrorLabel("left") },
    { label: "Tracking error · R", value: trackingErrorLabel("right") },
    { label: "Engaged", value: `${totalEngagedSeconds.toFixed(1)}s of ${telemetry.durationSeconds.toFixed(1)}s` },
    { label: "Engaged left", value: `${engagedFor(grippers.left).toFixed(1)}s` },
    { label: "Engaged right", value: `${engagedFor(grippers.right).toFixed(1)}s` },
    { label: "State samples", value: telemetry.sampleCount.toLocaleString() },
    { label: "State Hz", value: String(telemetry.fps) },
    { label: "Frames (est.)", value: `${estimatedFrames.toLocaleString()} RGB` },
    ...(telemetry.videoSpec
      ? [{
          label: "Video",
          value: `${telemetry.videoSpec.width}×${telemetry.videoSpec.height} · ${telemetry.videoSpec.codec.toUpperCase()} · ${telemetry.videoSpec.fps}fps`,
        }]
      : []),
  ];

  return (
    <div className="mt-12 border-t border-dashed border-line pt-10">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
        Telemetry — from observation.state
      </div>
      <h2 className="mb-8 text-[1.5rem]">Episode data</h2>

      <div className="mb-2 border-y border-dashed border-line">
        {metaStats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between gap-4 border-b border-dashed border-line py-3 last:border-b-0"
          >
            <span className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-faint">{stat.label}</span>
            <span className="font-display text-[0.95rem] font-extrabold tabular-nums">{stat.value}</span>
          </div>
        ))}
      </div>

      {telemetry.datasetTotals ? (
        <p className="mb-10 text-[0.72rem] text-ink-faint">
          This task&apos;s full capture: {telemetry.datasetTotals.totalEpisodes?.toLocaleString() ?? "—"} episodes ·{" "}
          {telemetry.datasetTotals.totalFrames?.toLocaleString() ?? "—"} frames ·{" "}
          {telemetry.datasetTotals.totalVideos?.toLocaleString() ?? "—"} videos
        </p>
      ) : (
        <div className="mb-8" />
      )}

      {telemetry.jointChannels.length > 0 && (
        <div className="mb-10">
          <h3 className="mb-3 font-display text-[0.95rem] font-extrabold">Joint angles</h3>
          {jointsSplit ? (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div>
                <div className="mb-2 font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">Left arm</div>
                <LineChart series={ChartSeries(joints.left)} cursorTime={cursorTime} />
              </div>
              <div>
                <div className="mb-2 font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">Right arm</div>
                <LineChart series={ChartSeries(joints.right)} cursorTime={cursorTime} />
              </div>
            </div>
          ) : (
            <LineChart series={ChartSeries(telemetry.jointChannels)} cursorTime={cursorTime} />
          )}
          {!jointsSplit && joints.other.length > 0 && (joints.left.length > 0 || joints.right.length > 0) && (
            <p className="mt-2 text-[0.72rem] text-ink-faint">
              Some joint channel names don&apos;t say which arm, so they&apos;re shown together above.
            </p>
          )}
        </div>
      )}

      {telemetry.gripperChannels.length > 0 && (
        <div className="mb-10">
          <h3 className="mb-3 font-display text-[0.95rem] font-extrabold">
            Grip aperture — engaged {totalEngagedSeconds.toFixed(1)}s of {telemetry.durationSeconds.toFixed(1)}s
          </h3>
          {grippersSplit ? (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div>
                <div className="mb-2 font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">
                  Left — engaged {engagedFor(grippers.left).toFixed(1)}s
                </div>
                <LineChart series={ChartSeries(grippers.left)} cursorTime={cursorTime} />
              </div>
              <div>
                <div className="mb-2 font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">
                  Right — engaged {engagedFor(grippers.right).toFixed(1)}s
                </div>
                <LineChart series={ChartSeries(grippers.right)} cursorTime={cursorTime} />
              </div>
            </div>
          ) : (
            <LineChart series={ChartSeries(telemetry.gripperChannels)} cursorTime={cursorTime} />
          )}
        </div>
      )}

      {telemetry.graspEvents.length > 0 && (
        <div>
          <h3 className="mb-3 font-display text-[0.95rem] font-extrabold">Events</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <tbody>
                {telemetry.graspEvents.map((e, i) => (
                  <tr key={i} className="border-b border-dashed border-line">
                    <td className="py-2.5 pr-4 font-mono text-[0.78rem] tabular-nums text-ink-faint">
                      {formatEventTime(e.t)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[0.72rem] uppercase tracking-wider">
                      {e.kind === "onset" && "Grasp onset"}
                      {e.kind === "closed" && "Grasp closed"}
                      {e.kind === "release" && "Release"}
                      <span className="ml-1.5 text-signal-ink">· {sideLabel(e.side) ?? e.channel}</span>
                    </td>
                    <td className="py-2.5 text-[0.8rem] text-ink-soft">
                      {e.kind === "closed" &&
                        `hold ${e.holdSeconds.toFixed(2)}s, min value ${e.minValue.toFixed(3)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
