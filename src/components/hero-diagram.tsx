export function HeroDiagram() {
  return (
    <div className="relative min-h-[380px] rounded-md border border-line bg-paper-alt p-8">
      <div
        className="absolute inset-0 rounded-md opacity-55"
        style={{
          backgroundImage: "radial-gradient(var(--line) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
      <svg
        viewBox="0 0 320 260"
        fill="none"
        className="relative z-10 w-full"
        aria-label="Diagram of a capture rig with camera, IMU, and gripper sensors"
      >
        <circle cx="160" cy="112" r="86" stroke="var(--signal-ink)" strokeWidth="1.2" strokeDasharray="2 5" opacity="0.5" />
        <rect x="120" y="70" width="80" height="56" rx="6" stroke="var(--ink)" strokeWidth="1.6" />
        <circle cx="160" cy="98" r="13" stroke="var(--signal-ink)" strokeWidth="1.6" />
        <circle cx="160" cy="98" r="4" fill="var(--signal-ink)" />
        <rect x="138" y="118" width="44" height="10" rx="2" stroke="var(--ink-faint)" strokeWidth="1" />
        <path d="M120 98 L64 98" stroke="var(--ink)" strokeWidth="1.6" />
        <rect x="40" y="86" width="24" height="24" rx="4" stroke="var(--signal-ink)" strokeWidth="1.4" />
        <text x="52" y="126" textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize="8" fill="var(--ink-faint)">
          IMU
        </text>
        <path d="M200 98 L256 98" stroke="var(--ink)" strokeWidth="1.6" />
        <path d="M256 98 L256 70" stroke="var(--ink)" strokeWidth="1.6" />
        <path d="M256 70 L286 50" stroke="var(--ink)" strokeWidth="1.6" />
        <circle cx="286" cy="50" r="6" stroke="var(--ink)" strokeWidth="1.6" />
        <path d="M256 70 L286 90" stroke="var(--ink)" strokeWidth="1.6" />
        <circle cx="286" cy="90" r="6" stroke="var(--ink)" strokeWidth="1.6" />
        <text x="256" y="60" textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize="8" fill="var(--ink-faint)">
          GRIPPER
        </text>
        <path d="M160 126 L160 168" stroke="var(--ink)" strokeWidth="1.6" />
        <rect x="120" y="168" width="80" height="34" rx="4" stroke="var(--ink-faint)" strokeWidth="1.2" strokeDasharray="3 3" />
        <text x="160" y="189" textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize="9" fill="var(--ink-faint)">
          EPISODE LOG
        </text>
        <text
          x="160"
          y="222"
          textAnchor="middle"
          fontFamily="ui-monospace,monospace"
          fontSize="9"
          fill="var(--signal-ink)"
          letterSpacing="1"
        >
          CAM + IMU + GRIPPER FT
        </text>
      </svg>
      <div className="relative z-10 mt-3.5 text-center text-[0.68rem] uppercase tracking-wider text-ink-faint">
        Egocentric capture rig — sensor manifest preview
      </div>
    </div>
  );
}
