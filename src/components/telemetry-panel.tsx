import type { EpisodeTelemetry } from "@/lib/telemetry";
import { LineChart } from "./line-chart";
import { formatDuration } from "@/lib/format";

function formatEventTime(t: number) {
  return `${t.toFixed(1)}s`;
}

export function TelemetryPanel({ telemetry }: { telemetry: EpisodeTelemetry }) {
  const closedEvents = telemetry.graspEvents.filter((e) => e.kind === "closed");
  const totalEngagedSeconds = Object.values(telemetry.engagedSecondsByChannel).reduce((a, b) => a + b, 0);

  return (
    <div className="mt-12 border-t border-dashed border-line pt-10">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
        Telemetry — from observation.state
      </div>
      <h2 className="mb-8 text-[1.5rem]">Episode data</h2>

      <div className="mb-10 grid grid-cols-2 gap-5 border-y border-dashed border-line py-6 sm:grid-cols-4">
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold tabular-nums">
            {formatDuration(Math.round(telemetry.durationSeconds))}
          </b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Duration</span>
        </div>
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold tabular-nums">{telemetry.sampleCount.toLocaleString()}</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">State samples</span>
        </div>
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold tabular-nums">{telemetry.fps}</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">State Hz</span>
        </div>
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold tabular-nums">{closedEvents.length}</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Grasps</span>
        </div>
      </div>

      {telemetry.jointChannels.length > 0 && (
        <div className="mb-10">
          <h3 className="mb-3 font-display text-[0.95rem] font-extrabold">Joint state</h3>
          <LineChart series={telemetry.jointChannels.map((c) => ({ label: c.label, points: c.points }))} />
        </div>
      )}

      {telemetry.gripperChannels.length > 0 && (
        <div className="mb-10">
          <h3 className="mb-3 font-display text-[0.95rem] font-extrabold">
            Gripper — engaged {totalEngagedSeconds.toFixed(1)}s of {telemetry.durationSeconds.toFixed(1)}s
          </h3>
          <LineChart series={telemetry.gripperChannels.map((c) => ({ label: c.label, points: c.points }))} />
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
                      <span className="ml-1.5 text-ink-faint">· {e.channel}</span>
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
