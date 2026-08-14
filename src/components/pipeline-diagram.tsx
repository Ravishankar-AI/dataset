const NODES = [
  { label: "NAS + MinIO", sub: "Internal, push-only" },
  { label: "Ingestion + QA", sub: "Validate, anonymize" },
  { label: "Catalog", sub: "Versioned, cataloged" },
  { label: "3 Doors", sub: "Samples / Uploads / Datasets" },
];

export function PipelineDiagram() {
  return (
    <div className="border border-line bg-card px-8 pb-7 pt-10">
      <div className="flex flex-col items-stretch gap-8 md:flex-row md:items-center md:justify-between">
        {NODES.map((node, i) => (
          <div key={node.label} className="flex flex-col items-stretch gap-2 md:contents">
            <div className="flex flex-col items-center gap-2.5 text-center md:w-[130px]">
              <div className="flex h-14 w-14 items-center justify-center rounded-[10px] border-[1.5px] border-signal-ink text-signal-ink">
                <NodeIcon index={i} />
              </div>
              <div className="text-[0.72rem] font-semibold uppercase tracking-wider">{node.label}</div>
              <div className="text-[0.68rem] text-ink-faint">{node.sub}</div>
            </div>
            {i < NODES.length - 1 && (
              <div className="mx-1 h-8 border-l-[1.5px] border-dashed border-signal-ink opacity-60 md:mx-1 md:h-0 md:flex-1 md:self-center md:border-l-0 md:border-t-[1.5px]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NodeIcon({ index }: { index: number }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none" as const };
  switch (index) {
    case 0:
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="13" width="18" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="6.5" cy="8" r="0.8" fill="currentColor" />
          <circle cx="6.5" cy="16" r="0.8" fill="currentColor" />
        </svg>
      );
    case 1:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 2:
      return (
        <svg {...common}>
          <path
            d="M7 17a4 4 0 01-.5-7.97A5.5 5.5 0 0117.3 8.02 4 4 0 0117 17H7z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="6" cy="17" r="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="18" cy="17" r="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 8v4M12 12l-5 3.3M12 12l5 3.3" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}
