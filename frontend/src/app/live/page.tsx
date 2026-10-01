import { Shell } from "@/components/shell";
import LiveDashboard from "@/components/live-dashboard";
import { notFound } from "next/navigation";
export default function Page() {
  if (process.env.ENABLE_LIVE_UI !== "true") notFound();
  return (
    <Shell live>
      <LiveDashboard />
    </Shell>
  );
}
