import QueueLoadingScaffold from "@/components/admin/QueueLoadingScaffold";

/**
 * Loading skeleton for /admin (the legacy queue + login route).
 *
 * Defers to the shared QueueLoadingScaffold so the skeleton style
 * stays in lock-step with /admin/bhandaras + /admin/spots. If the
 * caller hits /admin while unauthenticated, the real response is
 * the centered login form, which swaps in as soon as the page
 * resolves; the skeleton is brief and harmless in that case.
 */
export default function AdminLoading() {
  return <QueueLoadingScaffold rowCount={4} withThumb tabCount={4} withCta />;
}
