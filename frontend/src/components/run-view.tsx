"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
  FlaskConical,
  GitBranch,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "./shell";
import { api } from "@/lib/api";
import type { Run, Step, Report, Job } from "@/lib/contracts";

function Payload({ value }: { value: unknown }) {
  let content = value;
  if (typeof value === "string") {
    try {
      content = JSON.parse(value);
    } catch {}
  }
  return (
    <pre className="payload">
      {typeof content === "string"
        ? content
        : JSON.stringify(content ?? "Not captured", null, 2)}
    </pre>
  );
}
export function EvaluationReport({
  report,
  onEvidence,
}: {
  report: Report;
  onEvidence: (id: string) => void;
}) {
  const [showTests, setShowTests] = useState(false);
  const before = report.before.filter((c) => c.passed).length,
    after = report.after.filter((c) => c.passed).length;
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "omni-investigation.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="report">
      <div className="report-heading">
        <div>
          <span className="eyebrow">
            {report.source === "simulated"
              ? "RECORDED INVESTIGATION"
              : "LIVE INVESTIGATION"}
          </span>
          <h3>Follow the evidence.</h3>
        </div>
        <Badge state="review">Review required</Badge>
      </div>
      <p className="cause">{report.proposal.probable_cause}</p>
      <div className="evidence-links">
        Evidence{" "}
        {report.proposal.evidence_span_ids.map((id) => (
          <button key={id} onClick={() => onEvidence(id)}>
            <GitBranch size={13} />
            {id}
            <ArrowRight size={12} />
          </button>
        ))}
      </div>
      <p className="uncertainty">{report.proposal.uncertainty}</p>
      <details className="proposal">
        <summary>Proposed prompt & retrieval configuration</summary>
        <Payload value={report.proposal.prompt} />
        <div className="proposal-config">
          <span>Documents: {report.proposal.retrieval_top_k}</span>
          <span>Tool retries: {report.proposal.retry_count}</span>
          <span>One candidate</span>
        </div>
      </details>
      <div className="test-summary">
        <div>
          <small>Before</small>
          <strong>
            {before}
            <span>/{report.before.length}</span>
          </strong>
        </div>
        <ArrowRight size={22} />
        <div>
          <small>After</small>
          <strong className={after === report.after.length ? "teal" : ""}>
            {after}
            <span>/{report.after.length}</span>
          </strong>
        </div>
        <div className="test-summary-copy">
          <strong>Cases passing</strong>
          <small>
            {report.new_regressions.length} new regressions ·{" "}
            {report.remaining_failures.length} remaining failures
          </small>
        </div>
      </div>
      <p className="provenance">
        Before: {report.baseline_source}. After: {report.candidate_source}.{" "}
        {report.model_calls} model calls.{" "}
        {report.cost_cents === null
          ? "Cost unavailable."
          : `$${(report.cost_cents / 100).toFixed(2)} model cost.`}
      </p>
      <div className="report-actions">
        <button
          className="button primary"
          onClick={() => setShowTests(!showTests)}
        >
          <FlaskConical size={16} />
          {showTests ? "Hide case results" : "Review 20 test results"}
          <ChevronDown size={15} />
        </button>
        <button className="button secondary" onClick={download}>
          <Download size={15} /> Export report
        </button>
      </div>
      {showTests && (
        <div className="test-cases">
          {report.after.map((c, i) => (
            <details key={c.case_id}>
              <summary>
                <span className="mono">
                  {c.case_id.replace("knowledge-", "#")}
                </span>
                <strong>{c.name}</strong>
                <span className="case-change">
                  {report.before[i].passed ? "Pass" : "Fail"} →{" "}
                  {c.passed ? "Pass" : "Fail"}
                </span>
              </summary>
              <div className="case-answers">
                <div>
                  <small>BEFORE</small>
                  <p>{report.before[i].answer}</p>
                </div>
                <div>
                  <small>AFTER</small>
                  <p>{c.answer}</p>
                </div>
              </div>
              <div className="check-chips">
                {Object.entries(c.checks).map(([k, v]) => (
                  <Badge state={v ? "passed" : "failed"} key={k}>
                    {k.replaceAll("_", " ")}
                  </Badge>
                ))}
              </div>
              <small>
                {c.check_version} · {c.method} · {c.source}
              </small>
            </details>
          ))}
        </div>
      )}
      <p className="decision">
        <Check size={15} />
        {report.decision}
      </p>
    </div>
  );
}
export default function RunView({
  run,
  recordedReport,
  live = false,
}: {
  run: Run;
  recordedReport?: Report;
  live?: boolean;
}) {
  const sorted = [...run.steps].sort((a, b) => a.step_order - b.step_order);
  const initial = sorted.find((s) => s.kind === "retrieval") || sorted[0];
  const [selected, setSelected] = useState(initial?.id);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [report, setReport] = useState<Report | undefined>(recordedReport);
  const [job, setJob] = useState<Job>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const step = run.steps.find((s) => s.id === selected);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!live || !job || !["queued", "running"].includes(job.status)) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api<Job>(`/api/investigations/${job.id}`, { signal: ctrl.signal })
        .then((j) => {
          setJob(j);
          if (j.report) setReport(j.report);
          if (j.status === "failed")
            setError(`${j.error_code}: ${j.error_message}`);
        })
        .catch((e) => {
          if (!ctrl.signal.aborted) setError(String(e));
        });
    }, 1500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [job, live]);
  const timed = run.steps.filter((s) => s.started_at && s.ended_at);
  const epoch = timed.length
    ? Math.min(...timed.map((s) => Date.parse(s.started_at!)))
    : 0;
  const end = timed.length
    ? Math.max(...timed.map((s) => Date.parse(s.ended_at!)))
    : 1;
  const total = Math.max(1, end - epoch);
  function selectEvidence(id: string) {
    const target = run.steps.find(
      (s) => s.span_id === id || String(s.id) === id,
    );
    if (target) {
      setSelected(target.id);
      setCollapsed([]);
      document.getElementById("trace")?.scrollIntoView({ behavior: "smooth" });
    }
  }
  function depth(s: Step) {
    let d = 0,
      p = s.parent_span_id;
    const seen = new Set<string>();
    while (p && !seen.has(p)) {
      seen.add(p);
      d++;
      p = run.steps.find((x) => x.span_id === p)?.parent_span_id;
    }
    return Math.min(d, 8);
  }
  function visible(s: Step) {
    let p = s.parent_span_id;
    const seen = new Set<string>();
    while (p && !seen.has(p)) {
      if (collapsed.includes(p)) return false;
      seen.add(p);
      p = run.steps.find((x) => x.span_id === p)?.parent_span_id;
    }
    return true;
  }
  async function investigate() {
    setOpened(true);
    if (!live) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<Job>(
        `/api/runs/${encodeURIComponent(run.id)}/investigations`,
        { method: "POST" },
      );
      setJob(result);
      if (result.report) setReport(result.report);
      if (result.status === "failed")
        setError(`${result.error_code}: ${result.error_message}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" href={live ? "/live" : "/demo"}>
        <ArrowLeft size={15} /> Runs explorer
      </Link>
      <div className="page-heading run-heading">
        <div>
          <div className="eyebrow">
            {run.case_id || "AGENT TRACE"} <span>/</span> {run.version_tag}
          </div>
          <h1>{run.input_text || "Agent run"}</h1>
          <div className="run-meta">
            <Badge state={run.success ? "passed" : "failed"}>
              Execution {run.success ? "completed" : "failed"}
            </Badge>
            <Badge state={run.quality}>Quality {run.quality}</Badge>
            <span>{run.agent_name}</span>
            <span>{(run.latency_ms / 1000).toFixed(2)}s</span>
          </div>
        </div>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.href);
              setCopied(true);
            } catch {
              setError(
                "Copy unavailable. Share this page’s URL from your address bar.",
              );
            }
          }}
        >
          <Copy size={15} />
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      {run.quality === "failed" && (
        <div className="issue-banner">
          <span className="issue-icon">!</span>
          <div>
            <strong>
              {run.success
                ? "A completed run is not always a correct answer."
                : "This run encountered a tool failure."}
            </strong>
            <p>
              {run.evaluations.filter((e) => e.score < 1).length} quality checks
              failed. Inspect the evidence before trusting the response.
            </p>
          </div>
          <a className="text-link" href="#investigation">
            Investigate <ArrowRight size={15} />
          </a>
        </div>
      )}
      <section className="panel trace-panel" id="trace">
        <div className="panel-heading">
          <h2>Execution trace</h2>
          <span>
            {run.steps.length} spans <span className="subtle">·</span>{" "}
            {run.source === "simulated"
              ? "Simulated timing"
              : "Captured timing"}
          </span>
        </div>
        <div className="trace-layout">
          <div className="trace-tree">
            <div className="trace-legend">
              <span>SPAN / TOOL</span>
              <span>DURATION</span>
            </div>
            {sorted.filter(visible).map((s) => {
              const children = run.steps.some(
                (x) => x.parent_span_id === s.span_id && s.span_id,
              );
              return (
                <div
                  className={`span-row ${s.id === selected ? "active" : ""}`}
                  key={s.id}
                >
                  <div
                    className="span-label"
                    style={{ paddingLeft: 12 + depth(s) * 17 }}
                  >
                    {children ? (
                      <button
                        className="span-toggle"
                        aria-label={`${collapsed.includes(s.span_id!) ? "Expand" : "Collapse"} ${s.step_name}`}
                        aria-expanded={!collapsed.includes(s.span_id!)}
                        onClick={() =>
                          setCollapsed(
                            collapsed.includes(s.span_id!)
                              ? collapsed.filter((x) => x !== s.span_id)
                              : [...collapsed, s.span_id!],
                          )
                        }
                      >
                        {collapsed.includes(s.span_id!) ? (
                          <ChevronRight size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    ) : (
                      <span className="branch-line" />
                    )}
                    <button
                      className="span-select"
                      onClick={() => setSelected(s.id)}
                      aria-pressed={selected === s.id}
                    >
                      <span
                        className={`span-kind ${s.status === "failure" ? "error" : ""}`}
                      >
                        {s.kind === "retrieval" ? (
                          <Search size={14} />
                        ) : s.kind === "llm" ? (
                          <Sparkles size={14} />
                        ) : (
                          <GitBranch size={14} />
                        )}
                      </span>
                      <span>
                        {s.step_name}
                        <small>{s.kind || "step"}</small>
                      </span>
                    </button>
                  </div>
                  <button
                    className="waterfall"
                    aria-label={`Inspect ${s.step_name}, ${s.latency_ms || 0} milliseconds`}
                    onClick={() => setSelected(s.id)}
                  >
                    {s.started_at && s.ended_at ? (
                      <>
                        <i
                          className={s.status === "failure" ? "failed" : ""}
                          style={{
                            left: `${((Date.parse(s.started_at) - epoch) / total) * 65}%`,
                            width: `${Math.max(1, ((Date.parse(s.ended_at) - Date.parse(s.started_at)) / total) * 65)}%`,
                          }}
                        />
                        <span>{((s.latency_ms || 0) / 1000).toFixed(2)}s</span>
                      </>
                    ) : (
                      <small>Timing unavailable</small>
                    )}
                  </button>
                </div>
              );
            })}
            <div className="timing-note">
              {timed.length
                ? `Offsets from captured span timestamps · ${(total / 1000).toFixed(2)}s total`
                : "Timing unavailable · ordered by recorded step order"}
            </div>
          </div>
          <div className="span-inspector">
            {step ? (
              <>
                <div className="inspector-heading">
                  <div>
                    <small>SELECTED SPAN</small>
                    <h3>{step.step_name}</h3>
                  </div>
                  <Badge
                    state={step.status === "failure" ? "failed" : "passed"}
                  >
                    {step.status || "Recorded"}
                  </Badge>
                </div>
                <div className="detail-kv">
                  <div>
                    <small>Duration</small>
                    <strong>{step.latency_ms ?? "—"} ms</strong>
                  </div>
                  <div>
                    <small>Tokens</small>
                    <strong>{step.tokens ?? "—"}</strong>
                  </div>
                  <div>
                    <small>Model</small>
                    <strong>{run.model || "Not captured"}</strong>
                  </div>
                  <div>
                    <small>Prompt</small>
                    <strong>{run.prompt_version || "Not captured"}</strong>
                  </div>
                </div>
                <h4>Input / arguments</h4>
                <Payload value={step.input} />
                <h4>Output / evidence</h4>
                <Payload value={step.output} />
                {step.tool_calls.map((t) => (
                  <details key={t.id} className="tool-detail">
                    <summary>
                      <FileCode2 size={14} />
                      {t.tool_name} · {t.status} · {t.latency_ms}ms
                    </summary>
                    <h4>Arguments</h4>
                    <Payload value={t.tool_input} />
                    <h4>Result</h4>
                    <Payload value={t.tool_output} />
                  </details>
                ))}
                {step.attributes && Object.keys(step.attributes).length > 0 && (
                  <details className="tool-detail">
                    <summary>Attributes & document references</summary>
                    <Payload value={step.attributes} />
                  </details>
                )}
              </>
            ) : (
              <p>No steps captured.</p>
            )}
          </div>
        </div>
      </section>
      <section className="answer-grid">
        <div className="panel answer">
          <div className="eyebrow">AGENT RESPONSE</div>
          <p>{run.output_text || "No response captured."}</p>
          <small>
            {run.source === "simulated"
              ? "Scripted example · not a live model response"
              : `Captured response · ${run.model || "model not recorded"}`}
          </small>
          {run.errors.map((e, i) => (
            <div className="error-box" key={i}>
              <strong>{e.error_type}</strong>
              <p>{e.message}</p>
              {e.stack_trace && <Payload value={e.stack_trace} />}
            </div>
          ))}
        </div>
        <div className="panel checks">
          <h3>Quality checks</h3>
          {run.evaluations.length ? (
            run.evaluations.map((e) => (
              <div key={e.evaluator_name} title={e.feedback || undefined}>
                <span>{e.evaluator_name.replaceAll("_", " ")}</span>
                <Badge state={e.score >= 1 ? "passed" : "failed"}>
                  {e.score >= 1 ? "Pass" : "Fail"}
                </Badge>
              </div>
            ))
          ) : (
            <p>No quality checks captured.</p>
          )}
          <small>
            Versioned checks · {run.evaluations[0]?.method || "No evaluator"} ·
            No model judge in the recorded demo
          </small>
        </div>
      </section>
      <section className="panel investigation" id="investigation">
        <div className="panel-heading">
          <h2>
            <FlaskConical size={18} /> Investigation lab
          </h2>
          <span>
            {live
              ? "Live provider · fixed sandbox"
              : "Recorded example · no model calls"}
          </span>
        </div>
        {error && (
          <div role="alert" className="error-box">
            {error}
            {job && (
              <button
                className="button secondary"
                onClick={() => {
                  setError("");
                  setJob({ ...job });
                }}
              >
                Check job status
              </button>
            )}
          </div>
        )}
        {(opened || (live && job?.status === "completed")) && report ? (
          <EvaluationReport report={report} onEvidence={selectEvidence} />
        ) : (
          <div className="investigation-intro">
            <div className="lab-icon">
              <FlaskConical size={27} />
            </div>
            <div>
              <h3>
                {live
                  ? "Propose once. Test before adopting."
                  : "From a suspicious answer to a testable repair."}
              </h3>
              <p>
                {live
                  ? "Read this trace, propose one bounded prompt/configuration change, and evaluate it against 20 fixed cases."
                  : "Open the recorded diagnosis, inspect its evidence, and review the repaired reference agent’s case-by-case results."}
              </p>
              <button
                className="button primary"
                disabled={
                  busy ||
                  (!!job && ["queued", "running"].includes(job.status)) ||
                  (!live && !recordedReport)
                }
                onClick={investigate}
              >
                <Sparkles size={16} />
                {busy
                  ? "Submitting…"
                  : job && ["queued", "running"].includes(job.status)
                    ? `Investigation ${job.status}…`
                    : live
                      ? "Start live investigation"
                      : recordedReport
                        ? "Open recorded investigation"
                        : "No investigation for this passing run"}
                <ArrowRight size={16} />
              </button>
              {job && (
                <p role="status" className="provenance">
                  Job {job.id} · {job.status} · attempt {job.attempts}/3
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
