import QueueLoadingScaffold from "@/components/admin/QueueLoadingScaffold";

export default function OrganiseLoading() {
  return (
    <QueueLoadingScaffold rowCount={4} withThumb={false} tabCount={3} withCta={false} />
  );
}
