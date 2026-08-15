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

export function humanizeCameraName(camera: string) {
  // "observation.images.cam_left_wrist" -> "Cam Left Wrist"
  const last = camera.split(".").pop() ?? camera;
  return last
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
