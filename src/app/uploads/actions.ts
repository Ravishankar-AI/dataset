"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createIntakeRequest } from "@/lib/catalog";
import { sendEmail } from "@/lib/email";

const SALES_EMAIL = process.env.SALES_NOTIFICATION_EMAIL || "sales@objectways.com";

export async function submitIntakeRequest(formData: FormData) {
  const session = await getSession();

  const kind = String(formData.get("kind") ?? "");
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const transferNotes = String(formData.get("transferNotes") ?? "").trim();

  if (!["sell_data", "request_evaluation"].includes(kind) || !contactName || !contactEmail || !description) {
    redirect("/uploads?error=missing");
  }

  const resolvedOrganizationName = organizationName || session?.organizationName || undefined;

  await createIntakeRequest({
    kind,
    contactName,
    contactEmail,
    organizationName: resolvedOrganizationName,
    description,
    transferNotes: transferNotes || undefined,
  });

  try {
    await sendEmail({
      to: SALES_EMAIL,
      replyTo: contactEmail,
      subject: `[Uploads] ${kind === "sell_data" ? "Sell data" : "Evaluation request"} from ${contactName}`,
      text: [
        `Kind: ${kind === "sell_data" ? "Sell data to Objectways" : "Request an evaluation"}`,
        `Name: ${contactName}`,
        `Email: ${contactEmail}`,
        resolvedOrganizationName ? `Organization: ${resolvedOrganizationName}` : null,
        "",
        "Description:",
        description,
        transferNotes ? `\nTransfer notes:\n${transferNotes}` : null,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    });
  } catch (e) {
    // Never block the submission on the email step -- the DB row (visible
    // in the admin table on /uploads) is the real record either way.
    console.error("[uploads] failed to send sales notification email:", e);
  }

  redirect("/uploads?submitted=1");
}
