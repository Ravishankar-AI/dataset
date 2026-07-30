import Link from "next/link";

type Props = {
  shape: "circle" | "square" | "diamond";
  badge: string;
  title: string;
  description: string;
  bullets: string[];
  footLabel: string;
  href: string;
};

const shapeClasses: Record<Props["shape"], string> = {
  circle: "rounded-full",
  square: "",
  diamond: "rotate-45",
};

export function DoorCard({ shape, badge, title, description, bullets, footLabel, href }: Props) {
  return (
    <div className="flex flex-col gap-4 border border-line bg-card p-7">
      <div className="flex items-center gap-2 text-[0.68rem] uppercase tracking-wider text-ink-faint">
        <span className={`h-[9px] w-[9px] flex-shrink-0 border-[1.5px] border-signal-ink ${shapeClasses[shape]}`} />
        {badge}
      </div>
      <h3 className="font-display text-[1.28rem] font-extrabold">{title}</h3>
      <p className="text-[0.9rem] text-ink-soft">{description}</p>
      <ul className="flex flex-col gap-2">
        {bullets.map((b) => (
          <li key={b} className="relative pl-4 text-[0.83rem] text-ink-soft">
            <span className="absolute left-0 text-ink-faint">—</span>
            {b}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="mt-auto flex justify-between border-t border-dashed border-line pt-3.5 text-[0.72rem] uppercase tracking-wider text-signal-ink"
      >
        {footLabel} <span>→</span>
      </Link>
    </div>
  );
}
