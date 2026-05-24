import QueueLoadingScaffold from "@/components/admin/QueueLoadingScaffold";

export default function SpotsLoading() {
  return <QueueLoadingScaffold rowCount={5} withThumb tabCount={4} withCta />;
}
