import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import LiveRun from "@/components/live-run";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (process.env.ENABLE_LIVE_UI !== "true") notFound();
  const { id } = await params;
  return (
    <Shell live>
      <LiveRun id={id} />
    </Shell>
  );
}
