import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// Objectways' real site is set in "Gilroy" (a licensed commercial font) —
// Sora is the closest freely-licensable geometric sans for the same look.
const sora = Sora({ subsets: ["latin"], variable: "--font-display" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Objectways Data",
  description:
    "Real-world robot training data, from capture to catalog — samples, staff uploads, and licensed datasets over one registry.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader session={session} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
