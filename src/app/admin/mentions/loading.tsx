import QueueLoadingScaffold from "@/components/admin/QueueLoadingScaffold";

export default function MentionsLoading() {
  // Mentions are text-only (no thumb) and the page typically shows
  // a denser list than the photo queues, so paint more placeholders.
  return (
    <QueueLoadingScaffold rowCount={7} withThumb={false} tabCount={4} withCta={false} />
  );
}
