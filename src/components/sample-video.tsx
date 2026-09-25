"use client";

import { forwardRef } from "react";

/**
 * Deters casual downloading of sample preview clips: hides the browser's
 * native video download button and blocks right-click "Save Video As".
 * Not real DRM — the signed URL is still fetchable directly (dev tools,
 * curl) during its validity window. See lib/minio.ts for why: URLs are
 * signed straight from MinIO rather than proxied through the app server.
 *
 * Forwards its ref to the underlying <video> element so EpisodePlayer can
 * drive synchronized playback across every camera at once.
 */
export const SampleVideo = forwardRef<
  HTMLVideoElement,
  { src: string; poster?: string; label: string; onEnded?: () => void }
>(function SampleVideo({ src, poster, label, onEnded }, ref) {
  return (
    <div>
      <video
        ref={ref}
        src={src}
        poster={poster}
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        muted
        onContextMenu={(e) => e.preventDefault()}
        onEnded={onEnded}
        className="aspect-video w-full rounded border border-line bg-line-strong"
      />
      <div className="mt-2 text-center text-[0.7rem] uppercase tracking-wider text-ink-faint">{label}</div>
    </div>
  );
});
