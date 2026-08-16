import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listIntakeRequests } from "@/lib/catalog";
import { formatRelativeTime } from "@/lib/format";
import { submitIntakeRequest } from "./actions";

export const metadata = { title: "Uploads — Objectways Data" };

const STATUS_STYLE: Record<string, string> = {
  new: "text-signal-ink border-signal-ink",
  in_review: "text-ink border-ink",
  closed: "text-ink-faint border-ink-faint line-through",
};

export default async function UploadsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { submitted, error } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/uploads");

  const requests = session.role === "admin" ? await listIntakeRequests() : null;

  return (
    <div className="mx-auto max-w-[820px] px-8 py-16">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-signal-ink">
        Contribute data
      </div>
      <h1 className="mb-4 text-[2rem] sm:text-[2.6rem]">Uploads</h1>
      <p className="mb-10 max-w-[62ch] text-ink-soft">
        Have teleoperation or manipulation footage of your own? Tell us whether you&apos;d like to sell it
        to us outright or have us run an evaluation against it — a person on our team will follow up by
        email with next steps, including secure transfer instructions.
      </p>

      {submitted && (
        <div className="mb-8 border border-signal-ink bg-signal-soft px-5 py-4 text-[0.85rem] text-signal-ink">
          Thanks — we&apos;ve got your request and will follow up by email within 2 business days.
        </div>
      )}
      {error === "missing" && (
        <div className="mb-8 border border-line-strong bg-paper-alt px-5 py-4 text-[0.85rem] text-ink">
          Please fill in your name, email, and a description before submitting.
        </div>
      )}

      <form action={submitIntakeRequest} className="mb-16 flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
            What would you like to do?
          </legend>
          <label className="flex cursor-pointer items-start gap-3 border border-line p-4 has-[:checked]:border-signal-ink has-[:checked]:bg-signal-soft">
            <input type="radio" name="kind" value="sell_data" required className="mt-1" />
            <span>
              <span className="block font-display text-[0.95rem] font-extrabold">Sell data to Objectways</span>
              <span className="block text-[0.8rem] text-ink-soft">
                You have existing capture data and want to license or sell it to us.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 border border-line p-4 has-[:checked]:border-signal-ink has-[:checked]:bg-signal-soft">
            <input type="radio" name="kind" value="request_evaluation" required className="mt-1" />
            <span>
              <span className="block font-display text-[0.95rem] font-extrabold">Request an evaluation</span>
              <span className="block text-[0.8rem] text-ink-soft">
                You want us to run an evaluation against your footage before deciding anything further.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">Your name</span>
            <input
              type="text"
              name="contactName"
              required
              defaultValue={session.name}
              className="border border-line bg-card px-3.5 py-2.5 text-[0.9rem]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">Email</span>
            <input
              type="email"
              name="contactEmail"
              required
              defaultValue={session.email}
              className="border border-line bg-card px-3.5 py-2.5 text-[0.9rem]"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">
            Organization (optional)
          </span>
          <input
            type="text"
            name="organizationName"
            defaultValue={session.organizationName ?? ""}
            className="border border-line bg-card px-3.5 py-2.5 text-[0.9rem]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">
            Describe the data
          </span>
          <span className="text-[0.78rem] text-ink-faint">
            Task(s) performed, robot/embodiment, roughly how many episodes or hours, camera setup.
          </span>
          <textarea
            name="description"
            required
            rows={4}
            className="border border-line bg-card px-3.5 py-2.5 text-[0.9rem]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">
            Where is the data now? (optional)
          </span>
          <span className="text-[0.78rem] text-ink-faint">
            A link (Drive, S3, etc.) or a note on how you&apos;d transfer it — we&apos;ll follow up with
            secure transfer instructions either way.
          </span>
          <textarea
            name="transferNotes"
            rows={2}
            className="border border-line bg-card px-3.5 py-2.5 text-[0.9rem]"
          />
        </label>

        <button
          type="submit"
          className="self-start rounded-pill border border-line-strong bg-signal px-5 py-3 font-mono text-[0.78rem] uppercase tracking-wider text-on-signal shadow-brand transition-shadow hover:shadow-none"
        >
          Submit request
        </button>
      </form>

      {requests && (
        <div>
          <h2 className="mb-1.5 font-display text-[1.15rem] font-extrabold">Submitted requests</h2>
          <p className="mb-5 text-[0.85rem] text-ink-soft">Admin view — every intake request, newest first.</p>

          {requests.length === 0 ? (
            <p className="text-ink-faint">No requests submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    {["Contact", "Kind", "Description", "Submitted", "Status"].map((h) => (
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
                  {requests.map((r, i) => (
                    <tr key={r.id}>
                      <td
                        className={`py-4 pr-4 text-[0.85rem] ${i === requests.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                      >
                        <div className="font-medium">{r.contactName}</div>
                        <div className="text-[0.75rem] text-ink-faint">{r.contactEmail}</div>
                        {r.organizationName && <div className="text-[0.75rem] text-ink-faint">{r.organizationName}</div>}
                      </td>
                      <td
                        className={`py-4 pr-4 text-[0.8rem] ${i === requests.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                      >
                        {r.kind === "sell_data" ? "Sell data" : "Request evaluation"}
                      </td>
                      <td
                        className={`max-w-[32ch] py-4 pr-4 text-[0.8rem] text-ink-soft ${i === requests.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                      >
                        {r.description}
                      </td>
                      <td
                        className={`py-4 pr-4 font-mono text-[0.78rem] text-ink-faint ${i === requests.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                      >
                        {formatRelativeTime(r.createdAt)}
                      </td>
                      <td className={`py-4 ${i === requests.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}>
                        <span
                          className={`inline-block rounded-pill border px-3 py-1 font-mono text-[0.66rem] uppercase tracking-wider ${STATUS_STYLE[r.status]}`}
                        >
                          {r.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
