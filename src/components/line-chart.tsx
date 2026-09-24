const COLORS = ["#4c7000", "#9180ff", "#e0745a", "#2c8fae", "#c48a00", "#7c5cff"];

export function LineChart({
  series,
  height = 220,
  unitLabel,
}: {
  series: { label: string; points: { t: number; v: number }[] }[];
  height?: number;
  unitLabel?: string;
}) {
  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length === 0) return null;

  const width = 900;
  const padLeft = 44;
  const padBottom = 24;
  const padTop = 10;
  const padRight = 10;

  const tMax = Math.max(...allPoints.map((p) => p.t));
  const vMin = Math.min(...allPoints.map((p) => p.v));
  const vMax = Math.max(...allPoints.map((p) => p.v));
  const vRange = vMax - vMin || 1;

  const x = (t: number) => padLeft + (t / (tMax || 1)) * (width - padLeft - padRight);
  const y = (v: number) => height - padBottom - ((v - vMin) / vRange) * (height - padTop - padBottom);

  const yTicks = [vMin, vMin + vRange / 2, vMax];
  const xTicks = [0, tMax / 2, tMax];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={padLeft}
            x2={width - padRight}
            y1={y(tick)}
            y2={y(tick)}
            stroke="var(--line)"
            strokeWidth={1}
          />
        ))}
        {yTicks.map((tick) => (
          <text key={tick} x={padLeft - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--ink-faint)">
            {tick.toFixed(2)}
          </text>
        ))}
        {xTicks.map((tick) => (
          <text key={tick} x={x(tick)} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--ink-faint)">
            {tick.toFixed(0)}s
          </text>
        ))}
        {series.map((s, i) => (
          <polyline
            key={s.label}
            points={s.points.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")}
            fill="none"
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={1.5}
          />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s, i) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[0.72rem] text-ink-soft">
            <span
              className="inline-block h-[9px] w-[9px] rounded-sm"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            {s.label}
          </span>
        ))}
        {unitLabel && <span className="text-[0.72rem] text-ink-faint">({unitLabel})</span>}
      </div>
    </div>
  );
}
