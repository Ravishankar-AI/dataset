import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { listRecentLogins, listRecentAccess, listUserActivitySummary } from "@/lib/audit";
import { formatRelativeTime } from "@/lib/format";
import { blockUser } from "./actions";

export const metadata = { title: "Activity — Objectways Data" };

// A user with 15+ distinct episodes touched in the last 24h reads as
// scraping rather than someone reviewing samples -- browsing a handful of
// episodes across a session is normal, dozens in a day isn't.
const SUSPICIOUS_EPISODE_THRESHOLD = 15;

function truncate(s: string | null, n: number) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default async function AdminActivityPage() {
  const session = await requireRole("admin");
  if (!session) redirect("/sign-in?next=/admin/activity");

  const [users, logins, access] = await Promise.all([
    listUserActivitySummary(),
    listRecentLogins(50),
    listRecentAccess(50),
  ]);

  return (
    <div className="mx-auto max-w-[1180px] px-8 py-16">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
        Staff · Signed in as {session.name}
      </div>
      <h1 className="mb-4 text-[2rem] sm:text-[2.6rem]">Activity</h1>
      <p className="mb-10 max-w-[68ch] text-ink-soft">
        Sign-ins and file access across every account. &quot;Access&quot; means a page view that issued a
        signed video/thumbnail link, not a confirmed download — actual bytes are fetched by the browser
        straight from the NAS, so this is the closest signal available. A user with many distinct
        episodes in a short window is flagged below; block them to cut off both sign-in and further
        signed links immediately.
      </p>

      <div className="mb-14">
        <h2 className="mb-4 font-display text-[1.15rem] font-extrabold">Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr>
                {["User", "Role", "Last login", "Logins", "Access (24h)", "Episodes (24h)", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="border-b-2 border-line-strong pb-3.5 pr-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const suspicious = u.distinctEpisodesLast24h >= SUSPICIOUS_EPISODE_THRESHOLD;
                const border = i === users.length - 1 ? "border-b border-line" : "border-b border-dashed border-line";
                return (
                  <tr key={u.id}>
                    <td className={`py-3.5 pr-4 text-[0.82rem] ${border}`}>
                      <div>{u.name}</div>
                      <div className="font-mono text-[0.72rem] text-ink-faint">{u.email}</div>
                    </td>
                    <td className={`py-3.5 pr-4 font-mono text-[0.76rem] text-ink-soft ${border}`}>{u.role}</td>
                    <td className={`py-3.5 pr-4 text-[0.78rem] text-ink-faint ${border}`}>
                      {u.lastLoginAt ? formatRelativeTime(u.lastLoginAt) : "never"}
                    </td>
                    <td className={`py-3.5 pr-4 font-mono text-[0.8rem] tabular-nums ${border}`}>{u.totalLogins}</td>
                    <td className={`py-3.5 pr-4 font-mono text-[0.8rem] tabular-nums ${border}`}>{u.accessLast24h}</td>
                    <td
                      className={`py-3.5 pr-4 font-mono text-[0.8rem] tabular-nums ${border} ${suspicious ? "text-signal-ink font-bold" : ""}`}
                    >
                      {u.distinctEpisodesLast24h}
                      {suspicious && <span className="ml-1.5">⚠</span>}
                    </td>
                    <td className={`py-3.5 pr-4 font-mono text-[0.72rem] uppercase tracking-wider ${border}`}>
                      {u.isBlocked ? (
                        <span className="text-signal-ink">
                          Blocked{u.blockedAt ? ` · ${formatRelativeTime(u.blockedAt)}` : ""}
                        </span>
                      ) : (
                        "Active"
                      )}
                    </td>
                    <td className={`py-3.5 ${border}`}>
                      {u.id !== session.userId && (
                        <form action={blockUser}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="blocked" value={String(!u.isBlocked)} />
                          <button
                            type="submit"
                            className="font-mono text-[0.7rem] uppercase tracking-wider text-signal-ink underline"
                          >
                            {u.isBlocked ? "Unblock" : "Block"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-14">
        <h2 className="mb-4 font-display text-[1.15rem] font-extrabold">Recent sign-ins</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                {["User", "When", "IP", "User agent"].map((h) => (
                  <th
                    key={h}
                    className="border-b-2 border-line-strong pb-3.5 pr-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-[0.85rem] text-ink-faint">
                    No sign-ins recorded yet.
                  </td>
                </tr>
              ) : (
                logins.map((l, i) => {
                  const border = i === logins.length - 1 ? "border-b border-line" : "border-b border-dashed border-line";
                  return (
                    <tr key={l.id}>
                      <td className={`py-3 pr-4 text-[0.8rem] ${border}`}>{l.user.email}</td>
                      <td className={`py-3 pr-4 text-[0.78rem] text-ink-faint ${border}`}>
                        {formatRelativeTime(l.createdAt)}
                      </td>
                      <td className={`py-3 pr-4 font-mono text-[0.76rem] text-ink-soft ${border}`}>
                        {l.ipAddress ?? "—"}
                      </td>
                      <td className={`py-3 pr-4 font-mono text-[0.72rem] text-ink-faint ${border}`} title={l.userAgent ?? ""}>
                        {truncate(l.userAgent, 48)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-display text-[1.15rem] font-extrabold">Recent file access</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr>
                {["User", "Dataset", "Episode", "Cameras", "When", "IP"].map((h) => (
                  <th
                    key={h}
                    className="border-b-2 border-line-strong pb-3.5 pr-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {access.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-[0.85rem] text-ink-faint">
                    No file access recorded yet.
                  </td>
                </tr>
              ) : (
                access.map((a, i) => {
                  const border = i === access.length - 1 ? "border-b border-line" : "border-b border-dashed border-line";
                  return (
                    <tr key={a.id}>
                      <td className={`py-3 pr-4 text-[0.8rem] ${border}`}>{a.user.email}</td>
                      <td className={`py-3 pr-4 font-mono text-[0.76rem] text-ink-soft ${border}`}>{a.datasetSlug}</td>
                      <td className={`py-3 pr-4 font-mono text-[0.76rem] tabular-nums text-ink-soft ${border}`}>
                        {a.episodeIndex}
                      </td>
                      <td className={`py-3 pr-4 font-mono text-[0.78rem] tabular-nums ${border}`}>{a.cameraCount}</td>
                      <td className={`py-3 pr-4 text-[0.78rem] text-ink-faint ${border}`}>
                        {formatRelativeTime(a.createdAt)}
                      </td>
                      <td className={`py-3 pr-4 font-mono text-[0.76rem] text-ink-soft ${border}`}>{a.ipAddress ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
