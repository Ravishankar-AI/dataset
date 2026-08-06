import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
  variant?: "solid" | "ghost" | "inverted" | "ghost-inverted";
  size?: "default" | "small";
  icon?: "play" | "arrow" | "none";
};

export function PillButton({
  href,
  children,
  variant = "solid",
  size = "default",
  icon = "none",
}: Props) {
  const base =
    "inline-flex items-center gap-2 rounded-pill font-mono uppercase tracking-wider whitespace-nowrap border transition-[box-shadow,background-color]";
  const sizeClasses = size === "small" ? "text-[0.68rem] px-3.5 py-2" : "text-[0.78rem] px-5 py-3";
  const variantClasses = {
    solid: "bg-signal text-on-signal border-line-strong shadow-brand hover:shadow-none",
    ghost: "bg-transparent text-ink border-line-strong hover:bg-signal-soft",
    inverted: "bg-paper text-line-strong border-paper hover:opacity-90",
    "ghost-inverted": "bg-transparent text-paper border-paper hover:opacity-70",
  }[variant];

  return (
    <Link href={href} className={`${base} ${sizeClasses} ${variantClasses}`}>
      {icon === "play" && (
        <span
          className="h-0 w-0 border-y-4 border-y-transparent border-l-[6px] border-l-current"
          aria-hidden
        />
      )}
      {children}
      {icon === "arrow" && <span aria-hidden>→</span>}
    </Link>
  );
}
