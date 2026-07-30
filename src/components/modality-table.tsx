type Modality = {
  id: string;
  name: string;
  sensorManifest: string;
  sensorNote: string | null;
  typicalUse: string;
};

export function ModalityTable({ modalities }: { modalities: Modality[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr>
            <th className="border-b-2 border-line-strong pb-3.5 pr-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint">
              Modality
            </th>
            <th className="border-b-2 border-line-strong pb-3.5 pr-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint">
              Sensor Manifest
            </th>
            <th className="border-b-2 border-line-strong pb-3.5 pr-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint">
              Typical Use
            </th>
            <th className="border-b-2 border-line-strong pb-3.5 text-left" />
          </tr>
        </thead>
        <tbody>
          {modalities.map((m, i) => (
            <tr key={m.id}>
              <td
                className={`py-5 pr-4 align-top font-display text-[1.02rem] font-extrabold ${i === modalities.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
              >
                {m.name}
              </td>
              <td
                className={`py-5 pr-4 align-top ${i === modalities.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-[22px] w-[22px] flex-shrink-0 grid-cols-3 gap-[2px]">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <i key={j} className="rounded-full bg-signal-ink opacity-85" />
                    ))}
                  </span>
                  <span>
                    <b className="block text-[0.85rem] font-semibold">{m.sensorManifest}</b>
                    {m.sensorNote && <span className="text-[0.75rem] text-ink-faint">{m.sensorNote}</span>}
                  </span>
                </div>
              </td>
              <td
                className={`max-w-[34ch] py-5 pr-4 align-top text-[0.85rem] text-ink-soft ${i === modalities.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
              >
                {m.typicalUse}
              </td>
              <td
                className={`py-5 text-right align-top ${i === modalities.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
              >
                <span className="inline-flex items-center gap-2 rounded-pill border border-line-strong bg-line-strong px-3.5 py-2 font-mono text-[0.68rem] uppercase tracking-wider text-paper">
                  <span className="h-0 w-0 border-y-4 border-y-transparent border-l-[6px] border-l-current" />
                  Preview
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
