import { parquetReadObjects, type AsyncBuffer } from "hyparquet";
import { getObjectBuffer } from "./minio";
import { datasetInfoKey, episodeParquetKey } from "./lerobot";

/**
 * Reads and interprets the numeric side of a LeRobot episode capture —
 * meta/info.json's feature schema plus the per-frame observation.state /
 * action columns in the episode's parquet file. Deliberately does NOT
 * attempt anything CV-derived (object tracking, segmentation, semantic
 * phase labels like "approach"/"transport"): those need real vision
 * models this app doesn't run. What's here is either raw values from the
 * capture, or straightforward threshold arithmetic over them.
 */

export type FeatureSchema = {
  dtype: string;
  shape: number[];
  names?: string[];
};

export type DatasetInfo = {
  fps: number;
  features: Record<string, FeatureSchema>;
};

export function parseDatasetInfo(buffer: Buffer): DatasetInfo | null {
  try {
    const json = JSON.parse(buffer.toString("utf-8"));
    if (!json.features || typeof json.features !== "object") return null;
    return { fps: Number(json.fps) || 30, features: json.features };
  } catch {
    return null;
  }
}

// LeRobot's `names` field for a list-typed feature is sometimes a flat
// array of per-dimension labels, sometimes a dict keyed by axis (e.g.
// {"motors": ["left_joint_1", ...]}) depending on export version — this
// normalizes both into a flat array, falling back to null (caller then
// labels dimensions generically) rather than guessing at a shape we can't
// confirm.
function flattenNames(names: unknown, expectedLength: number): string[] | null {
  if (Array.isArray(names) && names.every((n) => typeof n === "string")) {
    return names.length === expectedLength ? (names as string[]) : null;
  }
  if (names && typeof names === "object") {
    for (const value of Object.values(names as Record<string, unknown>)) {
      const flat = flattenNames(value, expectedLength);
      if (flat) return flat;
    }
  }
  return null;
}

function bufferToAsyncBuffer(buffer: Buffer): AsyncBuffer {
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  return {
    byteLength: arrayBuffer.byteLength,
    slice: (start: number, end?: number) => arrayBuffer.slice(start, end),
  };
}

export type Side = "left" | "right" | "other";

export type ChannelSeries = {
  key: string;
  label: string;
  side: Side;
  points: { t: number; v: number }[];
};

export type GraspEvent =
  | { kind: "onset"; t: number; channel: string; side: Side }
  | { kind: "closed"; t: number; channel: string; side: Side; holdSeconds: number; minValue: number }
  | { kind: "release"; t: number; channel: string; side: Side };

export type EpisodeTelemetry = {
  durationSeconds: number;
  sampleCount: number;
  fps: number;
  jointChannels: ChannelSeries[];
  gripperChannels: ChannelSeries[];
  graspEvents: GraspEvent[];
  engagedSecondsByChannel: Record<string, number>;
  armsUsed: Side[];
};

const GRIPPER_NAME_PATTERN = /gripper|grip(?!_?cmd$)/i;

// Bimanual rigs are the common case here (see the "Bimanual Robot
// Manipulation Dataset" in the catalog) -- named channels are expected to
// say which arm. Falls back to "other" rather than guessing at a left/right
// split for single-arm captures or a naming convention that doesn't say.
function detectSide(key: string): Side {
  // Split on separators rather than using \b word-boundary regex -- \b
  // treats underscore as a word character, so it never matches "left" in
  // "left_joint_1" (confirmed: this silently broke the split entirely
  // until caught in a screenshot test against a synthetic fixture).
  const tokens = key.toLowerCase().split(/[_.\-\s]+/);
  if (tokens.includes("left") || tokens.includes("l")) return "left";
  if (tokens.includes("right") || tokens.includes("r")) return "right";
  return "other";
}

function trailingIndex(key: string): number | null {
  const m = key.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

// Identifies the gripper channel(s) per arm side. Prefers an explicit name
// match ("left_gripper", "grip_cmd", ...); confirmed against a real
// capture (Trossen/ALOHA-style bimanual rig) that has no such name at
// all -- state channels are just "left_joint_0".."left_joint_6" (7 per
// arm). For that case, the highest-numbered channel in each side's group
// is treated as the gripper: 6-DOF arm + gripper as the 7th joint is the
// standard convention for this class of rig. Falls back to no gripper
// split (everything stays a "joint") when a side has only one channel or
// names aren't numbered, rather than guessing wrong.
function splitGripperChannels(channels: ChannelSeries[]): {
  joints: ChannelSeries[];
  grippers: ChannelSeries[];
} {
  const bySide = new Map<Side, ChannelSeries[]>();
  for (const c of channels) {
    if (!bySide.has(c.side)) bySide.set(c.side, []);
    bySide.get(c.side)!.push(c);
  }

  const joints: ChannelSeries[] = [];
  const grippers: ChannelSeries[] = [];

  for (const group of bySide.values()) {
    const named = group.filter((c) => GRIPPER_NAME_PATTERN.test(c.key));
    if (named.length > 0) {
      grippers.push(...named);
      joints.push(...group.filter((c) => !GRIPPER_NAME_PATTERN.test(c.key)));
      continue;
    }

    const indexed = group.map((c) => ({ c, idx: trailingIndex(c.key) }));
    if (group.length > 1 && indexed.every((x) => x.idx !== null)) {
      const maxIdx = Math.max(...indexed.map((x) => x.idx!));
      const gripper = indexed.find((x) => x.idx === maxIdx)!.c;
      grippers.push({ ...gripper, label: gripper.side === "other" ? "Gripper" : `${humanizeChannelName(gripper.side)} Gripper` });
      joints.push(...group.filter((c) => c !== gripper));
      continue;
    }

    joints.push(...group);
  }

  return { joints, grippers };
}


export async function readEpisodeTelemetry(
  parquetBuffer: Buffer,
  info: DatasetInfo
): Promise<EpisodeTelemetry | null> {
  const stateSchema = info.features["observation.state"];
  if (!stateSchema || stateSchema.shape.length === 0) return null;
  const dims = stateSchema.shape[stateSchema.shape.length - 1];
  const names = flattenNames(stateSchema.names, dims);

  let rows: Record<string, unknown>[];
  try {
    rows = await parquetReadObjects({
      file: bufferToAsyncBuffer(parquetBuffer),
      columns: ["timestamp", "observation.state"],
    });
  } catch {
    return null;
  }
  if (rows.length === 0) return null;

  const timestamps = rows.map((r) => Number(r.timestamp));
  const durationSeconds = timestamps[timestamps.length - 1] - timestamps[0];
  const fps = timestamps.length > 1 ? Math.round(1 / ((durationSeconds || 1) / (timestamps.length - 1))) : info.fps;

  const channels: ChannelSeries[] = [];
  for (let dim = 0; dim < dims; dim++) {
    const key = names?.[dim] ?? `dim_${dim}`;
    const label = names?.[dim] ? humanizeChannelName(names[dim]) : `Joint ${dim + 1}`;
    channels.push({
      key,
      label,
      side: detectSide(key),
      points: rows.map((r, i) => ({
        t: timestamps[i] - timestamps[0],
        v: Number((r["observation.state"] as number[])[dim]),
      })),
    });
  }

  const { joints: jointChannels, grippers: gripperChannels } = splitGripperChannels(channels);

  const graspEvents: GraspEvent[] = [];
  const engagedSecondsByChannel: Record<string, number> = {};
  for (const channel of gripperChannels) {
    const { events, engagedSeconds } = detectGraspEvents(channel);
    graspEvents.push(...events);
    engagedSecondsByChannel[channel.key] = engagedSeconds;
  }
  graspEvents.sort((a, b) => a.t - b.t);

  // A side counts as "used" if any of its channels actually moved beyond
  // sensor noise, or it grasped at least once -- distinguishes an arm
  // that sat idle for the episode from one that was actively teleoperated,
  // rather than just reporting which sides have channels at all (which is
  // every episode, on a bimanual rig).
  const MOVEMENT_EPSILON = 0.01;
  const armsUsed: Side[] = (["left", "right"] as const).filter((side) => {
    const sideChannels = channels.filter((c) => c.side === side);
    const moved = sideChannels.some((c) => {
      const values = c.points.map((p) => p.v);
      return values.length > 0 && Math.max(...values) - Math.min(...values) > MOVEMENT_EPSILON;
    });
    const grasped = graspEvents.some((e) => e.side === side);
    return moved || grasped;
  });

  return {
    durationSeconds,
    sampleCount: rows.length,
    fps,
    jointChannels,
    gripperChannels,
    graspEvents,
    engagedSecondsByChannel,
    armsUsed,
  };
}

function humanizeChannelName(name: string) {
  return name
    .split(/[_.]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Threshold-crossing state machine over a single gripper-like channel:
// "closed" once the value drops into the bottom third of its own observed
// range, "onset" is the downward crossing into that band, "release" the
// upward crossing back out. Purely arithmetic over the raw signal — no
// physical units are assumed, since info.json doesn't declare any.
function detectGraspEvents(channel: ChannelSeries): { events: GraspEvent[]; engagedSeconds: number } {
  const values = channel.points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return { events: [], engagedSeconds: 0 };

  const closedThreshold = min + range * 0.3;
  const openThreshold = min + range * 0.7;
  // Rejects millisecond-scale flicker from sensor noise on a channel that
  // isn't really bimodal (confirmed against a pure-noise test channel,
  // which produced dozens of sub-100ms "grasps" without this) -- a real
  // grasp holds for at least a few hundred ms.
  const MIN_HOLD_SECONDS = 0.15;

  const events: GraspEvent[] = [];
  let engagedSeconds = 0;
  let state: "open" | "closed" = "open";
  let onsetT = 0;
  let minSinceOnset = Infinity;

  for (const { t, v } of channel.points) {
    if (state === "open" && v <= closedThreshold) {
      state = "closed";
      onsetT = t;
      minSinceOnset = v;
    } else if (state === "closed") {
      minSinceOnset = Math.min(minSinceOnset, v);
      if (v >= openThreshold) {
        const holdSeconds = t - onsetT;
        if (holdSeconds >= MIN_HOLD_SECONDS) {
          engagedSeconds += holdSeconds;
          events.push({ kind: "onset", t: onsetT, channel: channel.key, side: channel.side });
          events.push({
            kind: "closed",
            t: onsetT,
            channel: channel.key,
            side: channel.side,
            holdSeconds,
            minValue: minSinceOnset,
          });
          events.push({ kind: "release", t, channel: channel.key, side: channel.side });
        }
        state = "open";
      }
    }
  }

  return { events, engagedSeconds };
}

// Fetches + parses everything needed for a single episode's telemetry
// panel, swallowing any failure (missing meta/info.json, malformed
// parquet, unexpected schema on a given capture) into `null` rather than
// crashing the deliverable page -- this is best-effort supplementary
// data, not the page's core content.
export async function loadEpisodeTelemetry(
  task: { objectPrefix: string; chunk: string },
  episodeIndex: number
): Promise<EpisodeTelemetry | null> {
  try {
    const infoBuffer = await getObjectBuffer(datasetInfoKey(task));
    if (!infoBuffer) return null;
    const info = parseDatasetInfo(infoBuffer);
    if (!info) return null;

    const parquetBuffer = await getObjectBuffer(episodeParquetKey(task, episodeIndex));
    if (!parquetBuffer) return null;

    return await readEpisodeTelemetry(parquetBuffer, info);
  } catch (e) {
    console.error("[telemetry] failed to load episode telemetry:", e);
    return null;
  }
}
