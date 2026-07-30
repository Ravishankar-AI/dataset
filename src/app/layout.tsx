import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Objectways Data",
  description:
    "Real-world robot training data, from capture to catalog — samples, staff uploads, and licensed datasets over one registry.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <SiteHeader session={session} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
