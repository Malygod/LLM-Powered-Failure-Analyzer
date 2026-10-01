import { Shell } from "@/components/shell";
import Comparison from "@/components/comparison";
export default function Page() {
  return (
    <Shell active="compare">
      <Comparison />
    </Shell>
  );
}
