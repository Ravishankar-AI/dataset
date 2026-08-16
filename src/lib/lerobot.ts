/**
 * Key-building helpers for the LeRobot dataset layout used by real captures
 * in the MinIO bucket: <objectPrefix>data/<chunk>/episode_NNNNNN.parquet and
 * <objectPrefix>videos/<chunk>/<camera>/episode_NNNNNN.mp4 per camera.
 */

type DatasetLayout = {
  objectPrefix: string;
  chunk: string;
};

function pad(episodeIndex: number) {
  return String(episodeIndex).padStart(6, "0");
}

export function episodeParquetKey(dataset: DatasetLayout, episodeIndex: number) {
  return `${dataset.objectPrefix}data/${dataset.chunk}/episode_${pad(episodeIndex)}.parquet`;
}

export function episodeVideoKey(dataset: DatasetLayout, episodeIndex: number, camera: string) {
  return `${dataset.objectPrefix}videos/${dataset.chunk}/${camera}/episode_${pad(episodeIndex)}.mp4`;
}

// First-frame JPEG derived from the episode's primary (alphabetically
// first, e.g. the overhead "cam_high"/"camera_high" view over a wrist one)
// camera -- generated out-of-band, not part of the raw LeRobot layout, so
// it lives in its own `thumbnails/` folder rather than under `data/` or
// `videos/`. See Episode.hasThumbnail in schema.prisma for how the app
// knows whether one actually exists yet.
export function episodeThumbnailKey(task: DatasetLayout & { cameras: string[] }, episodeIndex: number) {
  return `${task.objectPrefix}thumbnails/${task.chunk}/episode_${pad(episodeIndex)}.jpg`;
}

export function humanizeCameraName(camera: string) {
  // "observation.images.cam_left_wrist" -> "Cam Left Wrist"
  const last = camera.split(".").pop() ?? camera;
  return last
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
