"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Run } from "@/lib/contracts";
import RunView from "./run-view";
export default function LiveRun({ id }: { id: string }) {
  const [run, setRun] = useState<Run>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    api<Run>(`/api/runs/${encodeURIComponent(id)}`, { signal: ctrl.signal })
      .then(setRun)
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(String(e));
      });
    return () => ctrl.abort();
  }, [id, attempt]);
  if (error)
    return (
      <div role="alert" className="error-box">
        {error}
        <button
          className="button secondary"
          onClick={() => {
            setError("");
            setAttempt(attempt + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  if (!run)
    return (
      <div className="empty" role="status">
        Loading trace…
      </div>
    );
  return <RunView run={run} live />;
}
