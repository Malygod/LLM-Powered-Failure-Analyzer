"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  CheckCheck,
  Clock3,
  Layers,
  RefreshCw,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import type { RunPage } from "@/lib/contracts";
import { RunTable, Metric } from "./dashboard";
export default function LiveDashboard() {
  const [data, setData] = useState<RunPage>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [success, setSuccess] = useState("all");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      setError("");
      const params = new URLSearchParams({
        skip: String(page * 15),
        limit: "15",
        search,
      });
      if (success !== "all") params.set("success", String(success === "true"));
      api<RunPage>(`/api/runs?${params}`, { signal: ctrl.signal })
        .then(setData)
        .catch((e) => {
          if (!ctrl.signal.aborted) setError(String(e));
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setBusy(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [page, search, success, refresh]);
  return (
    <>
      <div className="page-heading live-heading">
        <div>
          <div className="eyebrow">LOCAL LIVE ENVIRONMENT</div>
          <h1>Your agent, under observation.</h1>
          <p>Captured traces from your local FastAPI backend.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => setRefresh(refresh + 1)}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      <div className="recorded-note">
        Local developer mode requires a running API and worker. The public
        recorded demo remains available without either service.
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
          <p>
            Start the local stack, enable LIVE_ENABLED, and confirm
            NEXT_PUBLIC_API_URL points to it.
          </p>
        </div>
      )}
      {data && (
        <div className="stats-grid">
          <Metric
            title="Matching runs"
            value={String(data.stats.total)}
            note="All matching pages"
            icon={<Activity size={16} />}
          />
          <Metric
            title="Execution success"
            value={`${data.stats.success_rate}%`}
            note="Not an answer-quality score"
            icon={<CheckCheck size={16} />}
          />
          <Metric
            title="Average latency"
            value={`${(data.stats.avg_latency / 1000).toFixed(2)}s`}
            note="All matching pages"
            icon={<Clock3 size={16} />}
          />
          <Metric
            title="Reported cost"
            value={`$${(data.stats.total_cost / 100).toFixed(4)}`}
            note="As supplied by instrumentation"
            icon={<Layers size={16} />}
          />
        </div>
      )}
      <section className="panel">
        <div className="filters">
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search live runs"
              placeholder="Search input…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label className="filter-select">
            Execution
            <select
              value={success}
              onChange={(e) => {
                setSuccess(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All</option>
              <option value="true">Completed</option>
              <option value="false">Failed</option>
            </select>
          </label>
        </div>
        {busy ? (
          <div className="empty" role="status">
            <RefreshCw className="spin" size={20} />
            Loading traces…
          </div>
        ) : (
          <RunTable rows={error ? [] : data?.runs || []} live />
        )}
        <div className="pagination">
          <span>
            Page {page + 1} · {data?.total || 0} matching runs
          </span>
          <div>
            <button
              disabled={page === 0 || busy}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              disabled={!data || (page + 1) * 15 >= data.total || busy}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
