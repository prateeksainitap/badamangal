/**
 * Admin "discover bhandaras on the web" page.
 *
 * Server-side auth wrapper around the client-side discovery UI. The
 * heavy lifting (form state, fetch loop, results rendering, per-card
 * Add action) lives in DiscoverClient so the URL doesn't have to
 * round-trip on every state change — the admin's typing should feel
 * instant even when the network call to /api/admin/discover-bhandaras
 * takes 5-10s for the grounded Gemini round-trip.
 *
 * Routes from /admin's main tab bar (the "🔎 Discover" link added in
 * /admin/page.tsx). On auth miss, redirects to /admin (the login form).
 */
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import DiscoverClient from "./DiscoverClient";

export const dynamic = "force-dynamic";

export default async function DiscoverBhandarasPage() {
  if (!(await isAdmin())) redirect("/admin");
  return <DiscoverClient />;
}
