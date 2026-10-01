"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, GitBranch } from "lucide-react";
import { runs } from "@/lib/data";
import { Badge } from "./shell";
export default function Comparison() {
  const [a, setA] = useState("baseline"),
    [b, setB] = useState("faulty");
  const baseline = runs.filter((r) => r.version_tag === a),
    candidate = runs.filter((r) => r.version_tag === b);
  const pairs = baseline.map((x) => ({
    a: x,
    b: candidate.find((y) => y.case_id === x.case_id)!,
  }));
  const regressions = pairs.filter(
    (p) => p.a.quality === "passed" && p.b.quality === "failed",
  );
  const improvements = pairs.filter(
    (p) => p.a.quality === "failed" && p.b.quality === "passed",
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TEST-SET REGRESSION DETECTION</div>
          <h1>Changes you can measure.</h1>
          <p>
            Same questions. Different versions. Evidence for your next release.
          </p>
        </div>
      </div>
      <div className="recorded-note">
        Recorded reference-agent results. Deterministic checks on 20 synthetic
        cases; this is not statistical production drift monitoring.
      </div>
      <section className="panel compare-controls">
        <label>
          Baseline
          <select
            aria-label="Baseline version"
            value={a}
            onChange={(e) => setA(e.target.value)}
          >
            {["baseline", "faulty", "repaired"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <ArrowRight size={20} />
        <label>
          Candidate
          <select
            aria-label="Candidate version"
            value={b}
            onChange={(e) => setB(e.target.value)}
          >
            {["baseline", "faulty", "repaired"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <div className="compare-counts">
          <strong>
            {regressions.length}
            <small>regressions</small>
          </strong>
          <strong className="teal">
            {improvements.length}
            <small>improvements</small>
          </strong>
          <strong>
            {pairs.length}
            <small>matched cases</small>
          </strong>
          <strong>
            0<small>unmatched</small>
          </strong>
        </div>
      </section>
      {a === b && (
        <p className="recorded-note">
          The same version is selected on both sides. Choose another version to
          inspect a change.
        </p>
      )}
      <section className="comparison-list">
        {pairs.map(({ a: x, b: y }) => (
          <details className="panel compare-case" key={x.case_id}>
            <summary>
              <GitBranch size={17} />
              <strong>{x.input_text}</strong>
              <Badge
                state={
                  x.quality === "passed" && y.quality === "failed"
                    ? "failed"
                    : x.quality === "failed" && y.quality === "passed"
                      ? "passed"
                      : "unscored"
                }
              >
                {x.quality === "passed" && y.quality === "failed"
                  ? "Regression"
                  : x.quality === "failed" && y.quality === "passed"
                    ? "Improvement"
                    : "Unchanged"}
              </Badge>
            </summary>
            <div className="case-answers">
              {[x, y].map((r, i) => (
                <div key={i}>
                  <small>
                    {i === 0 ? "BASELINE" : "CANDIDATE"} · {r.version_tag}
                  </small>
                  <p>{r.output_text}</p>
                  <div className="check-chips">
                    {r.evaluations.map((e) => (
                      <Badge
                        key={e.evaluator_name}
                        state={e.score === 1 ? "passed" : "failed"}
                      >
                        {e.evaluator_name.replaceAll("_", " ")}
                      </Badge>
                    ))}
                  </div>
                  <Link className="text-link" href={`/demo/runs/${r.id}`}>
                    Inspect trace <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          </details>
        ))}
      </section>
    </>
  );
}
