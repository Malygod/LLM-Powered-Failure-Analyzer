import Link from "next/link";
import Image from "next/image";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  FlaskConical,
  GitBranch,
} from "lucide-react";
export function Shell({
  children,
  live = false,
  active = "runs",
}: {
  children: React.ReactNode;
  live?: boolean;
  active?: string;
}) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="sidebar">
        <Link className="brand" href="/demo" aria-label="Causelab home">
          <Image src="/causelab.svg" width={42} height={42} alt="" />
          <span>
            causelab<span className="brand-dot">.</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <Link
            aria-current={active === "runs" ? "page" : undefined}
            className={active === "runs" ? "nav-link selected" : "nav-link"}
            href={live ? "/live" : "/demo"}
          >
            <Activity size={16} /> Runs explorer
          </Link>
          <Link
            aria-current={active === "compare" ? "page" : undefined}
            className={active === "compare" ? "nav-link selected" : "nav-link"}
            href="/demo/compare"
          >
            <GitBranch size={16} /> Version comparison
          </Link>
          <Link
            className="nav-link"
            href="/demo/runs/faulty-knowledge-09#investigation"
          >
            <FlaskConical size={16} /> Investigation lab
          </Link>
          <Link
            aria-current={active === "about" ? "page" : undefined}
            className={active === "about" ? "nav-link selected" : "nav-link"}
            href="/about"
          >
            <BookOpen size={16} /> Built by Matías
          </Link>
        </nav>
        <a
          className="portfolio-link"
          href="https://malygod.netlify.app/"
          target="_blank"
          rel="noreferrer"
        >
          Portfolio <ArrowUpRight size={14} />
        </a>
      </header>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace <span>/</span> <strong>Knowledge assistant</strong>
          </div>
          <span className={live ? "mode live-mode" : "mode"}>
            <span className="status-dot" />
            {live ? "Local live mode" : "Recorded demo"}
          </span>
        </header>
        <main id="main">{children}</main>
        <footer>
          Causelab <span>Applied AI engineering · Matías Sepúlveda</span>
          <Link href="/about">About this demo ↗</Link>
        </footer>
      </div>
    </div>
  );
}
export function Badge({
  state,
  children,
}: {
  state: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={`badge ${state}`}>
      <span className="status-dot" />
      {children || state}
    </span>
  );
}
