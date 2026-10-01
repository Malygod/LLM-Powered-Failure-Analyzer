import Link from "next/link";
import { Shell } from "@/components/shell";
export default function NotFound() {
  return (
    <Shell>
      <div className="empty">
        <h1>This view isn’t available.</h1>
        <p>
          Open the recorded demo, or enable the local live interface in your
          development environment.
        </p>
        <Link className="button primary" href="/demo">
          Open demo
        </Link>
      </div>
    </Shell>
  );
}
