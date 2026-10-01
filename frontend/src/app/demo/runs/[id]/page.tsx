import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import RunView from "@/components/run-view";
import { runs, reports } from "@/lib/data";
export function generateStaticParams() {
  return runs.map((r) => ({ id: r.id }));
}
export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = runs.find((r) => r.id === id);
  if (!run) notFound();
  return (
    <Shell>
      <RunView run={run} recordedReport={reports[id]} />
    </Shell>
  );
}
