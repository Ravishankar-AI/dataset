"use client";

/**
 * Deters casual downloading of sample preview clips: hides the browser's
 * native video download button and blocks right-click "Save Video As".
 * Not real DRM — the signed URL is still fetchable directly (dev tools,
 * curl) during its validity window. See lib/minio.ts for why: URLs are
 * signed straight from MinIO rather than proxied through the app server.
 */
export function SampleVideo({
  src,
  poster,
  label,
}: {
  src: string;
  poster?: string;
  label: string;
}) {
  return (
    <div>
      <video
        src={src}
        poster={poster}
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        muted
        onContextMenu={(e) => e.preventDefault()}
        className="aspect-video w-full rounded border border-line bg-line-strong"
      />
      <div className="mt-2 text-center text-[0.7rem] uppercase tracking-wider text-ink-faint">{label}</div>
    </div>
  );
}
