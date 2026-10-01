import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { scores, caseCount } from "@/lib/data";
export const metadata = { title: "Built by Matías" };
export default function About() {
  return (
    <Shell active="about">
      <section className="about-hero">
        <div className="eyebrow">INDEPENDENT ENGINEERING PROJECT</div>
        <h1>
          AI reliability, from the interface
          <br />
          to the failure modes.
        </h1>
        <p>
          I’m Matías Sepúlveda, a software engineer based in Chile. My
          background spans full-stack applications, distributed services, and
          cloud platforms. I built this project to explore a practical question:
          how do we know when an agent’s behavior gets worse?
        </p>
        <p>
          Causelab combines a Python tracing SDK, FastAPI ingestion, relational
          data, durable investigations, and a TypeScript interface. This
          iteration was developed with AI coding assistance; the source and test
          suite make the implementation open to review.
        </p>
        <div className="about-links">
          <a className="button secondary" href="/walkthrough.webm">
            Watch the walkthrough <ArrowUpRight size={15} />
          </a>
          <Link className="button primary" href="/demo">
            Try the three-minute demo <ArrowRight size={15} />
          </Link>
          <a
            className="button secondary"
            href="https://github.com/Malygod/LLM-Powered-Failure-Analyzer"
            target="_blank"
            rel="noreferrer"
          >
            Source code <ArrowUpRight size={15} />
          </a>
          <a
            className="button secondary"
            href="https://www.linkedin.com/in/matias-sepulveda-illesca/"
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn <ArrowUpRight size={15} />
          </a>
        </div>
      </section>
      <div className="about-content">
        <section className="panel">
          <div className="eyebrow">THE PROBLEM</div>
          <h2>“Success” can hide a bad answer.</h2>
          <p>
            The featured agent retrieves an overview but misses the archive
            policy. It completes normally and confidently invents a 90-day
            retention window. Causelab separates execution from answer quality,
            shows the missing evidence, and turns the failure into a testable
            repair.
          </p>
          <ul>
            <li>
              Own the complete path from SDK instrumentation to inspectable
              evidence.
            </li>
            <li>
              Preserve trace identity across retries and retain repeated
              evaluation runs.
            </li>
            <li>
              Bound model execution and require developer review of a proposed
              change.
            </li>
          </ul>
        </section>
        <section className="panel">
          <div className="eyebrow">MEASURED, WITH LIMITS</div>
          <h2>
            {scores.faulty}/{caseCount} → {scores.repaired}/{caseCount} cases
            passing.
          </h2>
          <p>
            The recorded suite runs a scripted faulty and repaired reference
            agent against the same 20 synthetic cases. Five deterministic checks
            assess required facts, forbidden claims, citations, abstention, and
            tool behavior.
          </p>
          <p style={{ marginTop: 14 }}>
            These results are reproducible fixture checks, not a claim about a
            live model or unseen inputs. Timing is simulated; model spend is
            zero. A local live investigation generates its own results and can
            fail.
          </p>
        </section>
        <section className="panel wide">
          <div className="eyebrow">ARCHITECTURE & TRADEOFFS</div>
          <h2>A small system with explicit boundaries.</h2>
          <div className="architecture">
            <span>Python SDK</span>
            <ArrowRight size={16} />
            <span>FastAPI + PostgreSQL</span>
            <ArrowRight size={16} />
            <span>Leased worker</span>
            <ArrowRight size={16} />
            <span>Fixed-tool sandbox</span>
            <ArrowRight size={16} />
            <span>Developer review</span>
          </div>
          <ul>
            <li>
              The public demo uses recorded fixtures so anyone can review it
              without an account or provider credentials.
            </li>
            <li>
              The local worker uses a database queue, bounded retry, and durable
              model-call budgets. It can change only the candidate prompt and
              allowlisted retrieval settings.
            </li>
            <li>
              The evaluation is intentionally narrow. Exact fact checks are
              understandable and repeatable, but they do not establish general
              factuality or production safety.
            </li>
            <li>
              The first SDK targets Python. Multi-tenant access control,
              production deployment, framework adapters, and automatic code
              repair remain outside this prototype.
            </li>
          </ul>
        </section>
        <section id="integration" className="panel wide">
          <div className="eyebrow">INTEGRATE AN AGENT</div>
          <h2>A few lines around the work that matters.</h2>
          <p>
            Clone the repository, install the local SDK, and start the backend
            using the README. No package-registry release is implied.
          </p>
          <pre>
            <code>{`pip install ./sdk\n\nfrom causelab import Client\n\nwith Client(endpoint="http://localhost:8000") as client:\n    with client.run("MyAgent", input=query, version="v1") as run:\n        with client.span("retrieve", kind="tool", input=query) as span:\n            documents = search(query)\n            span.set_output(documents)\n        run.set_output(answer)`}</code>
          </pre>
          <p>
            The SDK captures nested sync/async spans and exceptions, redacts
            common secret fields, and buffers delivery. Export failures do not
            interrupt your agent. Review the redactor for your own data before
            enabling payload capture.
          </p>
          <a
            className="text-link"
            href="https://github.com/Malygod/LLM-Powered-Failure-Analyzer#local-live-mode"
          >
            Setup and testing guide <ArrowUpRight size={15} />
          </a>
          <p style={{ marginTop: 20 }}>
            Already running the backend locally?{" "}
            <Link className="text-link" href="/live">
              Open local live mode <ArrowRight size={14} />
            </Link>
          </p>
        </section>
      </div>
    </Shell>
  );
}
