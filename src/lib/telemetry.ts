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
  // Only present on observation.images.* video features -- per-camera
  // capture specs (LeRobot writes the same values for every camera on a
  // rig, but this doesn't assume that; see videoSpec()).
  info?: {
    "video.fps"?: number;
    "video.height"?: number;
    "video.width"?: number;
    "video.codec"?: string;
  };
};

export type VideoSpec = { width: number; height: number; fps: number; codec: string };

export type DatasetInfo = {
  fps: number;
  features: Record<string, FeatureSchema>;
  // Declared by the capture tool itself (meta/info.json), not derived --
  // scoped to this task's own capture folder, same as objectPrefix.
  totalEpisodes?: number;
  totalFrames?: number;
  totalVideos?: number;
};

export function parseDatasetInfo(buffer: Buffer): DatasetInfo | null {
  try {
    const json = JSON.parse(buffer.toString("utf-8"));
    if (!json.features || typeof json.features !== "object") return null;
    return {
      fps: Number(json.fps) || 30,
      features: json.features,
      totalEpisodes: typeof json.total_episodes === "number" ? json.total_episodes : undefined,
      totalFrames: typeof json.total_frames === "number" ? json.total_frames : undefined,
      totalVideos: typeof json.total_videos === "number" ? json.total_videos : undefined,
    };
  } catch {
    return null;
  }
}

// A rig reporting x/y/z/roll/pitch/yaw per hand (e.g. the UMI gripper's
// wrist pose from SLAM) is fundamentally different from one reporting
// joint_0..joint_N angles (e.g. the bimanual teleoperation arms) -- the
// chart/label should say which, not call a Cartesian pose a "joint".
const POSE_AXIS_PATTERN = /_(x|y|z|roll|pitch|yaw)$/i;
function kinematicsLabel(names: string[] | null): string {
  if (names?.some((n) => POSE_AXIS_PATTERN.test(n))) return "End-effector pose";
  return "Joint angles";
}

// Straight from the capture pipeline's own per-episode QA pass, not
// re-derived here -- it already knows which frames were frozen/duplicated
// per stream (something this app can't tell from a parquet file alone)
// and which streams never showed up in a given episode at all. One file
// per task, one record per episode_index.
function parseStaleness(buffer: Buffer, episodeIndex: number): DataQuality | null {
  try {
    const arr = JSON.parse(buffer.toString("utf-8"));
    if (!Array.isArray(arr)) return null;
    const rec = arr.find((r) => r?.episode_index === episodeIndex);
    if (!rec || typeof rec.ticks !== "number" || rec.ticks <= 0) return null;

    const staleFractionByStream: Record<string, number> = {};
    for (const [stream, ticks] of Object.entries(rec.stale_ticks ?? {})) {
      if (typeof ticks === "number") staleFractionByStream[stream] = ticks / rec.ticks;
    }
    return {
      ticks: rec.ticks,
      staleFractionByStream,
      absentStreams: Array.isArray(rec.absent_streams) ? rec.absent_streams : [],
    };
  } catch {
    return null;
  }
}

// Reads capture specs off the first observation.images.* feature that has
// them -- LeRobot writes the same fps/resolution/codec for every camera on
// a rig, so one representative camera is enough rather than assuming
// which camera key exists.
export function videoSpec(info: DatasetInfo): VideoSpec | null {
  for (const [key, schema] of Object.entries(info.features)) {
    if (!key.startsWith("observation.images.") || !schema.info) continue;
    const { "video.width": width, "video.height": height, "video.fps": fps, "video.codec": codec } = schema.info;
    if (width && height && fps && codec) return { width, height, fps, codec };
  }
  return null;
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

export type TrackingError = { mean: number; peak: number };

// Peak vector magnitude (sqrt(x²+y²+z²) per timestep, maxed over the
// episode) of a wrist-mounted IMU -- gyro in rad/s-ish raw units, accel in
// g-ish raw units, whatever the capture declares (no units given). Only
// present on rigs that actually have an IMU (see observation.imu in
// meta/info.json); nothing in the older bimanual joint-angle captures has
// this.
export type ImuSummary = { peakGyro: number; peakAccel: number };

// Per-stream frozen/duplicate-frame fraction and entirely-missing streams,
// straight from the capture pipeline's own meta/staleness.json (not
// computed here) -- see loadEpisodeTelemetry's doc comment on why this is
// trusted rather than re-derived.
export type DataQuality = {
  ticks: number;
  staleFractionByStream: Record<string, number>;
  absentStreams: string[];
};

export type EpisodeTelemetry = {
  durationSeconds: number;
  sampleCount: number;
  fps: number;
  // "End-effector pose" for a Cartesian x/y/z/roll/pitch/yaw rig (e.g. the
  // UMI gripper), "Joint angles" for a joint-space rig (e.g. the bimanual
  // teleoperation arms) -- same chart mechanics either way, this only
  // changes what the section calls itself. See kinematicsLabel().
  kinematicsLabel: string;
  jointChannels: ChannelSeries[];
  gripperChannels: ChannelSeries[];
  graspEvents: GraspEvent[];
  engagedSecondsByChannel: Record<string, number>;
  armsUsed: Side[];
  // |action - observation.state| per side, averaged/maxed across that
  // side's channels and every timestep -- how closely the arm tracked
  // what it was commanded to do. Absent (not "other") when the capture
  // has no `action` column, rather than reporting a false zero.
  trackingErrorBySide: Partial<Record<Side, TrackingError>>;
  imuBySide: Partial<Record<Side, ImuSummary>>;
  videoSpec: VideoSpec | null;
  datasetTotals: { totalEpisodes?: number; totalFrames?: number; totalVideos?: number } | null;
  dataQuality: DataQuality | null;
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

  const actionSchema = info.features["action"];
  const hasAction = Boolean(actionSchema && actionSchema.shape.length > 0);

  const imuSchema = info.features["observation.imu"];
  const hasImu = Boolean(imuSchema && imuSchema.shape.length > 0);

  const columns = ["timestamp", "observation.state"];
  if (hasAction) columns.push("action");
  if (hasImu) columns.push("observation.imu");

  let rows: Record<string, unknown>[];
  try {
    rows = await parquetReadObjects({ file: bufferToAsyncBuffer(parquetBuffer), columns });
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

  // action and observation.state share the same dims/names in every real
  // capture checked (left/right_joint_0..6) -- diffing them per timestep
  // gives how closely the arm actually tracked what it was commanded to
  // do, which is otherwise invisible (no force/torque channel exists in
  // this capture format to get it from elsewhere).
  const trackingErrorBySide: Partial<Record<Side, TrackingError>> = {};
  if (hasAction) {
    const errorsBySide = new Map<Side, number[]>();
    for (let dim = 0; dim < dims; dim++) {
      const side = channels[dim].side;
      const errors = errorsBySide.get(side) ?? [];
      for (const row of rows) {
        const actionRow = row.action as number[] | undefined;
        const stateRow = row["observation.state"] as number[];
        if (!actionRow) continue;
        errors.push(Math.abs(actionRow[dim] - stateRow[dim]));
      }
      errorsBySide.set(side, errors);
    }
    for (const [side, errors] of errorsBySide) {
      if (errors.length === 0) continue;
      trackingErrorBySide[side] = {
        mean: errors.reduce((a, b) => a + b, 0) / errors.length,
        peak: Math.max(...errors),
      };
    }
  }

  // Wrist IMU: group dims into x/y/z triplets (a "_gyro"/"_acc" group with
  // trailing _x/_y/_z stripped), take the per-timestep vector magnitude of
  // each triplet, and report the peak -- a smooth demonstration has a low,
  // steady magnitude; a jerky one spikes.
  const imuBySide: Partial<Record<Side, ImuSummary>> = {};
  if (hasImu) {
    const imuDims = imuSchema!.shape[imuSchema!.shape.length - 1];
    const imuNames = flattenNames(imuSchema!.names, imuDims);
    if (imuNames) {
      const groups = new Map<string, number[]>();
      for (let dim = 0; dim < imuDims; dim++) {
        const groupKey = imuNames[dim].replace(/_[xyz]$/i, "");
        groups.set(groupKey, [...(groups.get(groupKey) ?? []), dim]);
      }

      const gyroPeakBySide = new Map<Side, number>();
      const accelPeakBySide = new Map<Side, number>();
      for (const [groupKey, dims] of groups) {
        if (dims.length !== 3) continue;
        const side = detectSide(groupKey);
        const isGyro = /gyro/i.test(groupKey);
        const isAccel = /acc/i.test(groupKey);
        if (!isGyro && !isAccel) continue;

        let peak = 0;
        for (const row of rows) {
          const v = row["observation.imu"] as number[] | undefined;
          if (!v) continue;
          const [a, b, c] = dims.map((d) => v[d]);
          peak = Math.max(peak, Math.sqrt(a * a + b * b + c * c));
        }
        const target = isGyro ? gyroPeakBySide : accelPeakBySide;
        target.set(side, Math.max(target.get(side) ?? 0, peak));
      }
      for (const side of new Set([...gyroPeakBySide.keys(), ...accelPeakBySide.keys()])) {
        imuBySide[side] = { peakGyro: gyroPeakBySide.get(side) ?? 0, peakAccel: accelPeakBySide.get(side) ?? 0 };
      }
    }
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
    kinematicsLabel: kinematicsLabel(names),
    jointChannels,
    gripperChannels,
    graspEvents,
    engagedSecondsByChannel,
    armsUsed,
    trackingErrorBySide,
    imuBySide,
    videoSpec: videoSpec(info),
    datasetTotals: info.totalEpisodes || info.totalFrames || info.totalVideos
      ? { totalEpisodes: info.totalEpisodes, totalFrames: info.totalFrames, totalVideos: info.totalVideos }
      : null,
    // Filled in by loadEpisodeTelemetry (needs the task/bucket to fetch
    // meta/staleness.json separately) -- readEpisodeTelemetry alone only
    // has the parquet + info.json.
    dataQuality: null,
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
  task: { objectPrefix: string; chunk: string; bucket?: string | null },
  episodeIndex: number
): Promise<EpisodeTelemetry | null> {
  const bucket = task.bucket ?? undefined;
  try {
    const infoBuffer = await getObjectBuffer(datasetInfoKey(task), bucket);
    if (!infoBuffer) return null;
    const info = parseDatasetInfo(infoBuffer);
    if (!info) return null;

    const parquetBuffer = await getObjectBuffer(episodeParquetKey(task, episodeIndex), bucket);
    if (!parquetBuffer) return null;

    const telemetry = await readEpisodeTelemetry(parquetBuffer, info);
    if (!telemetry) return null;

    // Best-effort and separate from the try/catch above's failure modes --
    // most captures don't have a staleness.json at all, and that's fine,
    // it just means no data-quality section rather than no telemetry.
    const stalenessBuffer = await getObjectBuffer(`${task.objectPrefix}meta/staleness.json`, bucket).catch(() => null);
    telemetry.dataQuality = stalenessBuffer ? parseStaleness(stalenessBuffer, episodeIndex) : null;

    return telemetry;
  } catch (e) {
    console.error("[telemetry] failed to load episode telemetry:", e);
    return null;
  }
}
