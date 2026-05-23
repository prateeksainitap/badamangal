import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ScanReview from "@/components/admin/ScanReview";
import { isAdmin } from "@/lib/admin-auth";
import { AREAS } from "@/lib/lucknow";
import { MENU_ITEMS } from "@/lib/menu";
import { ALL_TUESDAY_ISO, ALL_SATURDAY_ISO } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Scan & publish · Admin · BadaMangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminScanPage() {
  if (!(await isAdmin())) {
    redirect("/admin");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-gold-500/40 pb-4">
        <div>
          <p className="font-cormorant text-sm uppercase tracking-[0.25em] text-gold-500">
            Admin · Scan
          </p>
          <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
            Upload an invite, publish in seconds
          </h1>
          <p className="mt-1 text-sm text-ink-600 max-w-xl">
            Drop a WhatsApp invite image (or a spot photo), Gemini reads
            the details, Ola Maps drops the pin, you review &amp; publish.
            Goes live on the homepage instantly.
          </p>
        </div>
        <a
          href="/admin"
          className="text-sm text-ink-600 hover:text-sindoor-700"
        >
          ← Back to queue
        </a>
      </header>

      <ScanReview
        areas={[...AREAS]}
        menuItems={[...MENU_ITEMS]}
        tuesdays={[...ALL_TUESDAY_ISO]}
        saturdays={[...ALL_SATURDAY_ISO]}
      />
    </div>
  );
}
