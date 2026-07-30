type Stat = { value: string; label: string };

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-7 border-t border-dashed border-line pt-5 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label}>
          <b className="block font-display text-[1.3rem] font-extrabold tabular-nums">{s.value}</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
