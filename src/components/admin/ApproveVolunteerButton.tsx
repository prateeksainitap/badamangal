"use client";

/**
 * Approve a PENDING volunteer + open the pre-filled WhatsApp
 * message in a new tab.
 *
 * Flow:
 *   1. Admin clicks → server action generates a fresh code (or
 *      reuses an existing one if double-clicked), flips status to
 *      PROBATIONARY, returns the wa.me URL.
 *   2. Client opens the URL in a new tab → WhatsApp Web / app
 *      pre-fills the message with the code + submit link.
 *   3. Admin clicks Send in WhatsApp → done.
 *
 * Idempotent: if the user clicks the button twice the second click
 * just re-opens the same wa.me link with the same code (no
 * duplicate codes issued). Useful when the WA tab was closed
 * before the admin hit Send.
 */

import { useState } from "react";
import { approveAndIssueVolunteerCodeAction } from "@/app/admin/actions";
import { trackEvent } from "@/lib/ga";

export default function ApproveVolunteerButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ code: string; waUrl: string } | null>(null);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    setError(null);
    trackEvent("admin_volunteer_approve_attempt", {});
    try {
      const result = await approveAndIssueVolunteerCodeAction(id);
      if (!result.ok) {
        trackEvent("admin_volunteer_approve_error", { err: result.error });
        setError(humanizeError(result.error));
        return;
      }
      trackEvent("admin_volunteer_approve_success", {
        already_issued: result.alreadyIssued ? 1 : 0,
      });
      setIssued({ code: result.code, waUrl: result.waUrl });
      // Open WhatsApp Web / app in a new tab with the pre-filled
      // message. Browsers may block this if it's not a direct user
      // gesture handler. The onClick wrapping the await makes it
      // synchronous-feeling enough that modern browsers allow it.
      window.open(result.waUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      trackEvent("admin_volunteer_approve_error", { msg: msg.slice(0, 80) });
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  // After the first successful click, the button switches to
  // "Re-open WhatsApp" so admin can re-deliver if the first send
  // didn't go through (e.g. they accidentally closed the WA tab).
  if (issued) {
    return (
      <div className="flex flex-col gap-2 items-start">
        <div className="text-xs text-leaf-600">
          ✓ Code <span className="font-mono font-semibold">{issued.code}</span> issued
        </div>
        <a
          href={issued.waUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-ga="admin_volunteer_reopen_whatsapp"
          className="inline-flex items-center gap-1.5 rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm transition-colors"
        >
          💬 Re-open WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? (
          <>
            <Spinner />
            Approving…
          </>
        ) : (
          <>✅ Approve &amp; send code on WhatsApp</>
        )}
      </button>
      {error ? (
        <p className="text-xs text-alert-500">{error}</p>
      ) : null}
    </div>
  );
}

function humanizeError(err: string): string {
  switch (err) {
    case "not_found":
      return "Volunteer row not found (refresh the page?).";
    case "suspended":
      return "This volunteer is SUSPENDED. Flip status to PENDING first if you really want to issue a code.";
    case "code_collision_exhausted":
      return "Couldn't generate a unique code after 5 tries. Try again.";
    case "db_error":
      return "Database write failed. Check server logs.";
    default:
      return err.replace(/_/g, " ");
  }
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 motion-safe:animate-spin rounded-full border-2 border-cream-50/40 border-t-cream-50"
    />
  );
}
