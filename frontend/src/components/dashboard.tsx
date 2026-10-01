"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  Activity,
  CheckCheck,
  Clock3,
  Layers,
  Play,
} from "lucide-react";
import { runs, scores, featuredId } from "@/lib/data";
import type { RunSummary } from "@/lib/contracts";
import { Badge } from "./shell";
export function RunTable({
  rows,
  live = false,
}: {
  rows: RunSummary[];
  live?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className="runs-table">
        <thead>
          <tr>
            <th>Agent run / input</th>
            <th>Version</th>
            <th>Execution</th>
            <th>Quality</th>
            <th>Duration</th>
            <th aria-label="Open trace" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link
                  className="run-link"
                  href={`${live ? "/live" : "/demo"}/runs/${encodeURIComponent(r.id)}`}
                >
                  <span
                    className={`run-symbol ${r.quality === "failed" ? "problem" : ""}`}
                  >
                    <Activity size={16} />
                  </span>
                  <span>
                    <strong>{r.input_text || r.id}</strong>
                    <small>
                      {r.case_id || r.id} <span>·</span> {r.agent_name}
                    </small>
                  </span>
                </Link>
              </td>
              <td>
                <span className="version">{r.version_tag}</span>
              </td>
              <td>
                <Badge state={r.success ? "passed" : "failed"}>
                  {r.success ? "Completed" : "Error"}
                </Badge>
              </td>
              <td>
                <Badge state={r.quality}>
                  {r.quality === "failed"
                    ? "Needs review"
                    : r.quality === "passed"
                      ? "Passed"
                      : "Unscored"}
                </Badge>
              </td>
              <td className="mono">{(r.latency_ms / 1000).toFixed(2)}s</td>
              <td>
                <Link
                  className="arrow-link"
                  aria-label={`Open trace ${r.id}`}
                  href={`${live ? "/live" : "/demo"}/runs/${encodeURIComponent(r.id)}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="empty">
          <Search size={24} />
          <h3>No matching runs</h3>
          <p>Try a different input, version, or status.</p>
        </div>
      )}
    </div>
  );
}
export default function Dashboard() {
  const [version, setVersion] = useState("faulty");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const filtered = runs.filter(
    (r) =>
      (version === "all" || r.version_tag === version) &&
      (status === "all" ||
        (status === "error" ? !r.success : r.quality === status)) &&
      `${r.input_text} ${r.case_id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const passed = filtered.filter((r) => r.quality === "passed").length;
  const latency = filtered.length
    ? filtered.reduce((s, r) => s + r.latency_ms, 0) / filtered.length
    : 0;
  const pages = Math.ceil(filtered.length / 10);
  const current = Math.min(page, Math.max(0, pages - 1));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="status-dot" /> AGENT OBSERVABILITY
          </div>
          <h1>Every run tells a story.</h1>
          <p>Understand what happened. Find what needs to change.</p>
        </div>
        <Link href="/about#integration" className="button secondary">
          <Layers size={16} /> Integrate your agent
        </Link>
      </div>
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-label">2026 · APPLIED AI ENGINEERING</span>
          <h2>
            The run succeeded.
            <br />
            The answer didn’t.
          </h2>
          <p>
            A knowledge agent invented a retention policy. Follow the evidence
            from a missing document to a tested repair.
          </p>
          <div className="hero-tech" aria-label="Project technologies">
            {["Python", "FastAPI", "PostgreSQL", "Next.js"].map((tech) => (
              <span key={tech}>{tech}</span>
            ))}
          </div>
          <Link className="button primary" href={`/demo/runs/${featuredId}`}>
            <Play size={15} fill="currentColor" /> Explore the regression{" "}
            <ArrowRight size={17} />
          </Link>
          <small>Simulated traces · Recorded results · No setup</small>
        </div>
        <div
          className="hero-diagram"
          aria-label="Recorded trace: quality regression detected and diagnosis ready"
        >
          <div className="diagram-caption">
            <span>agent/knowledge-09</span>
            <span className="terminal-success">trace received</span>
          </div>
          <div className="terminal-events">
            <div className="terminal-event">
              <span className="terminal-dot" />
              <span>
                normalize input <span className="terminal-separator">·</span>{" "}
                sha-256
              </span>
            </div>
            <div className="terminal-connector" />
            <div className="terminal-event">
              <span className="terminal-dot failure" />
              <span>
                regression detected{" "}
                <span className="terminal-separator">·</span> 3 checks failed
              </span>
            </div>
            <div className="terminal-connector" />
            <div className="terminal-event">
              <span className="terminal-dot success" />
              <span>
                diagnostic ready <span className="terminal-separator">·</span>{" "}
                evidence attached
              </span>
            </div>
          </div>
          <div className="diagram-note">
            compare <span>→</span> explain <span>→</span> fix
          </div>
        </div>
      </section>
      <section className="stats-grid" aria-label="Filtered run statistics">
        <Metric
          title="Runs observed"
          value={String(filtered.length)}
          note="Across all matching results"
          icon={<Activity size={17} />}
        />
        <Metric
          title="Quality pass rate"
          value={`${filtered.length ? Math.round((passed / filtered.length) * 100) : 0}%`}
          note={`${filtered.length - passed} runs need review`}
          icon={<CheckCheck size={17} />}
        />
        <Metric
          title="Average duration"
          value={`${(latency / 1000).toFixed(2)}s`}
          note="Recorded fixture timing"
          icon={<Clock3 size={17} />}
        />
        <Metric
          title="Model spend"
          value="$0.00"
          note="Scripted demo · no model calls"
          icon={<Layers size={17} />}
        />
      </section>
      <div className="section-heading">
        <div>
          <h2>
            Runs explorer <span className="count">{filtered.length}</span>
          </h2>
          <p>Follow the tools, evidence, and answers behind each run.</p>
        </div>
        <Link className="text-link" href="/demo/compare">
          Compare versions <ArrowRight size={15} />
        </Link>
      </div>
      <section className="panel">
        <div className="filters">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search runs"
              placeholder="Search questions or case IDs…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label className="filter-select">
            Version
            <select
              aria-label="Filter version"
              value={version}
              onChange={(e) => {
                setVersion(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All versions</option>
              <option value="baseline">Baseline</option>
              <option value="faulty">Faulty</option>
              <option value="repaired">Repaired</option>
            </select>
          </label>
          <label className="filter-select">
            Status
            <select
              aria-label="Filter status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All statuses</option>
              <option value="failed">Needs review</option>
              <option value="passed">Quality passed</option>
              <option value="error">Execution error</option>
            </select>
          </label>
        </div>
        <RunTable rows={filtered.slice(current * 10, current * 10 + 10)} />
        <div className="pagination">
          <span>
            {filtered.length ? current * 10 + 1 : 0}–
            {Math.min(current * 10 + 10, filtered.length)} of {filtered.length}{" "}
            runs
          </span>
          <div>
            <button
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <button
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      <section className="bottom-grid">
        <div className="panel insight">
          <div className="eyebrow">VERSION HEALTH</div>
          <h3>A small change. A measurable regression.</h3>
          <div className="health-bars">
            {Object.entries(scores).map(([v, n]) => (
              <div key={v}>
                <span>{v}</span>
                <div>
                  <i
                    style={{ width: `${(n / 20) * 100}%` }}
                    className={v === "faulty" ? "bad" : ""}
                  />
                </div>
                <strong>{n}/20</strong>
              </div>
            ))}
          </div>
          <p>
            Same 20 cases. Deterministic checks. Recorded reference-agent
            results.
          </p>
        </div>
        <div className="panel insight integration-card">
          <div className="eyebrow">BUILT FOR DEVELOPERS</div>
          <h3>Your agent, with a clearer view.</h3>
          <p>
            Track nested spans, tool calls, and exceptions with a small Python
            SDK.
          </p>
          <pre>
            <code>{`with client.run("KnowledgeAssistant"):\n    with client.span("retrieve", kind="tool"):\n        documents = search(query)`}</code>
          </pre>
          <Link href="/about#integration" className="text-link">
            Read the integration guide <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </>
  );
}
export function Metric({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric">
      <div>
        <span>{title}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
