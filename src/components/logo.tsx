import Image from "next/image";

/**
 * Real Objectways wordmark (objectways.com's own logo asset). It's dark
 * text on a transparent background with no light-mode variant published,
 * so dark mode wraps it in a light chip rather than distorting its colors.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`logo-chip inline-flex items-center rounded-md px-1.5 py-1 ${className}`}>
      <Image src="/objectways-logo.png" alt="Objectways" width={640} height={93} className="h-6 w-auto" priority />
    </span>
  );
}
