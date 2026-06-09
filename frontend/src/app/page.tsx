"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, 
  AlertCircle, 
  ArrowRight, 
  CheckCircle, 
  ChevronDown, 
  ChevronRight, 
  Code, 
  Coins, 
  Cpu, 
  Database, 
  FileJson, 
  Filter, 
  HelpCircle, 
  Layers, 
  ListFilter, 
  Play, 
  Plus, 
  RefreshCw, 
  Search, 
  ShieldAlert, 
  Sliders, 
  Sparkles, 
  TrendingDown, 
  TrendingUp, 
  Upload, 
  Zap 
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Interface definitions
interface Project {
  id: number;
  name: string;
}

interface Agent {
  id: number;
  name: string;
}

interface Version {
  id: number;
  version_tag: string;
  agent_id: number;
}

interface Run {
  id: string;
  timestamp: string;
  success: boolean;
  latency_ms: number;
  cost_cents: number;
  input_hash: string;
  input_text?: string;
  output_text?: string;
  version_id: number;
  version_tag: string;
  agent_name: string;
  project_name: string;
}

interface ToolCall {
  id: number;
  tool_name: string;
  tool_input?: string;
  tool_output?: string;
  status: string;
  latency_ms: number;
}

interface Step {
  id: number;
  step_name: string;
  input?: string;
  output?: string;
  tokens: number;
  latency_ms: number;
  step_order: number;
  tool_calls: ToolCall[];
}

interface RunError {
  id: number;
  error_type?: string;
  message: string;
  stack_trace?: string;
}

interface Metric {
  id: number;
  metric_name: string;
  metric_value: number;
}

interface Evaluation {
  id: number;
  evaluator_name: string;
  score: number;
  feedback?: string;
}

interface FailureAnalysis {
  id: number;
  error_summary: string;
  suggested_fix: string;
  analyzed_at: string;
}

interface RunDetail extends Run {
  version: Version;
  steps: Step[];
  errors: RunError[];
  metrics: Metric[];
  evaluations: Evaluation[];
  failure_analysis?: FailureAnalysis;
}

interface MetricSummary {
  success_rate: number;
  avg_latency: number;
  avg_cost: number;
  total_runs: number;
  error_rate: number;
}

interface ComparisonResult {
  version_a: string;
  version_b: string;
  summary_a: MetricSummary;
  summary_b: MetricSummary;
  regressions: Run[];
  improvements: Run[];
}

export default function Home() {
  // Navigation & View states
  const [activeTab, setActiveTab] = useState<"dashboard" | "compare" | "ingest">("dashboard");
  
  // Data lists
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  
  // Selection / Filters
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedVersion, setSelectedVersion] = useState<string>("all");
  const [successFilter, setSuccessFilter] = useState<string>("all");
  
  // Pagination & Loading
  const [loading, setLoading] = useState(false);
  const [totalRuns, setTotalRuns] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 15;

  // Selected Run Detail modal/sidepanel
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analyzingFailure, setAnalyzingFailure] = useState(false);

  // Version Comparison inputs/outputs
  const [compAgentId, setCompAgentId] = useState<string>("");
  const [compVersionA, setCompVersionA] = useState<string>("");
  const [compVersionB, setCompVersionB] = useState<string>("");
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Ingestion upload state
  const [uploadText, setUploadText] = useState("");
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global Stat Cards
  const [stats, setStats] = useState({
    total: 0,
    successRate: 0,
    avgLatency: 0,
    totalCost: 0,
  });

  // Fetch initial setup data
  useEffect(() => {
    fetchMetadata();
  }, []);

  // Fetch runs list when filters change
  useEffect(() => {
    fetchRuns();
  }, [selectedVersion, successFilter, page]);

  // Handle auto-stats updating when runs list changes
  useEffect(() => {
    if (runs.length > 0) {
      const total = runs.length;
      const successes = runs.filter(r => r.success).length;
      const avgLat = runs.reduce((sum, r) => sum + r.latency_ms, 0) / total;
      const totCost = runs.reduce((sum, r) => sum + r.cost_cents, 0);
      setStats({
        total: totalRuns,
        successRate: Math.round((successes / total) * 1000) / 10,
        avgLatency: Math.round(avgLat),
        totalCost: Math.round(totCost * 100) / 100,
      });
    } else {
      setStats({ total: 0, successRate: 0, avgLatency: 0, totalCost: 0 });
    }
  }, [runs, totalRuns]);

  const fetchMetadata = async () => {
    try {
      const projRes = await fetch(`${API_BASE}/api/projects`);
      if (projRes.ok) {
        const data = await projRes.json();
        setProjects(data);
      }
      
      const agentRes = await fetch(`${API_BASE}/api/agents`);
      if (agentRes.ok) {
        const data = await agentRes.json();
        setAgents(data);
        if (data.length > 0 && !compAgentId) {
          setCompAgentId(data[0].id.toString());
        }
      }

      const verRes = await fetch(`${API_BASE}/api/versions`);
      if (verRes.ok) {
        const data = await verRes.json();
        setVersions(data);
      }
    } catch (err) {
      console.error("Error fetching metadata:", err);
    }
  };

  const fetchRuns = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/runs?skip=${(page - 1) * limit}&limit=${limit}`;
      if (selectedVersion !== "all") {
        url += `&version_id=${selectedVersion}`;
      }
      if (successFilter !== "all") {
        url += `&success=${successFilter === "success"}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs);
        setTotalRuns(data.total);
      }
    } catch (err) {
      console.error("Error fetching runs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRunDetail = async (runId: string) => {
    setDetailLoading(true);
    setSelectedRunId(runId);
    try {
      const res = await fetch(`${API_BASE}/api/runs/${runId}`);
      if (res.ok) {
        const data = await res.json();
        setRunDetail(data);
      }
    } catch (err) {
      console.error("Error fetching run details:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRunLLMAnalysis = async (runId: string) => {
    setAnalyzingFailure(true);
    try {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/analyze`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (runDetail && runDetail.id === runId) {
          setRunDetail({
            ...runDetail,
            failure_analysis: data,
          });
        }
      }
    } catch (err) {
      console.error("LLM failure analysis error:", err);
    } finally {
      setAnalyzingFailure(false);
    }
  };

  const handleCompare = async () => {
    if (!compVersionA || !compVersionB) {
      alert("Please select both Version A and Version B for comparison");
      return;
    }
    setCompareLoading(true);
    setComparisonResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/compare?version_a=${compVersionA}&version_b=${compVersionB}`);
      if (res.ok) {
        const data = await res.json();
        setComparisonResult(data);
      } else {
        const errData = await res.json();
        alert(`Comparison failed: ${errData.detail}`);
      }
    } catch (err) {
      console.error("Comparison request failed:", err);
      alert("Failed to connect to the comparison endpoint.");
    } finally {
      setCompareLoading(false);
    }
  };

  const handleJsonUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadText.trim()) {
      setUploadStatus({ type: "error", message: "Please paste a JSON payload or select a seed file." });
      return;
    }

    setUploading(true);
    setUploadStatus({ type: null, message: "" });
    try {
      const parsed = JSON.parse(uploadText);
      const payload = Array.isArray(parsed) ? parsed : [parsed];

      const res = await fetch(`${API_BASE}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json();
        setUploadStatus({ type: "success", message: result.message });
        setUploadText("");
        fetchMetadata();
        fetchRuns();
      } else {
        const errData = await res.json();
        setUploadStatus({ type: "error", message: `Ingestion failed: ${errData.detail}` });
      }
    } catch (err: any) {
      setUploadStatus({ type: "error", message: `Invalid JSON format: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setUploadText(content);
    };
    reader.readAsText(file);
  };

  const loadSeedDataset = async () => {
    setUploading(true);
    setUploadStatus({ type: null, message: "" });
    try {
      const res = await fetch("/seed_data.json");
      if (!res.ok) {
        throw new Error("Could not find seed_data.json locally. Paste raw seed data directly.");
      }
      const text = await res.text();
      setUploadText(text);
      setUploadStatus({ type: "success", message: "Seeding payload successfully loaded! Click 'Submit Ingest Traces' below." });
    } catch (err: any) {
      setUploadStatus({ type: "error", message: err.message });
    } finally {
      setUploading(false);
    }
  };

  const compVersions = versions.filter(v => v.agent_id === Number(compAgentId));

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans flex antialiased">
      {/* Sidebar Navigation - Sleek Minimalist contrast */}
      <aside className="w-64 border-r border-zinc-200 bg-white flex flex-col p-6 sticky top-0 h-screen shrink-0">
        
        {/* Sira Brand Logo Image */}
        <div className="mb-10 w-32 h-10 overflow-hidden relative flex items-center justify-center">
          <img 
            src="/logo.png" 
            alt="Sira AI Logo" 
            className="w-full h-full object-cover"
          />
        </div>

        <nav className="flex-1 space-y-1">
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              activeTab === "dashboard" 
                ? "bg-zinc-100 text-zinc-900" 
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <Layers className="h-4 w-4" />
            Runs Explorer
          </button>
          
          <button 
            onClick={() => {
              setActiveTab("compare");
              if (versions.length >= 2 && (!compVersionA || !compVersionB)) {
                setCompVersionA(versions[0].id.toString());
                setCompVersionB(versions[1].id.toString());
              }
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              activeTab === "compare" 
                ? "bg-zinc-100 text-zinc-900" 
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <Sliders className="h-4 w-4" />
            Compare Versions
          </button>

          <button 
            onClick={() => setActiveTab("ingest")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              activeTab === "ingest" 
                ? "bg-zinc-100 text-zinc-900" 
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <Upload className="h-4 w-4" />
            Trace Ingestion
          </button>
        </nav>

        {/* Workspace Footer Info */}
        <div className="border-t border-zinc-200 pt-5 mt-auto">
          <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200/60 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold text-zinc-800 uppercase tracking-wider">Sira Platform</span>
              <span className="block text-[9px] text-zinc-450">MVP Prototype v1.0.0</span>
            </div>
            <Sparkles className="h-3.5 w-3.5 text-zinc-900 shrink-0" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-8 flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center mb-8 pb-6 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-950">
              {activeTab === "dashboard" && "Runs Explorer & Observability"}
              {activeTab === "compare" && "Version Performance Comparison"}
              {activeTab === "ingest" && "Ingestion & Schema Ingestor"}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {activeTab === "dashboard" && "Observe, filter, and drill into individual agent runs and traces."}
              {activeTab === "compare" && "Compare model success rates, costs, latencies, and regression cases."}
              {activeTab === "ingest" && "Upload trace JSON payloads directly to ingest workspace runs."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "dashboard" && (
              <button 
                onClick={fetchRuns}
                className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            <div className="text-[10px] px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 font-bold flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              API Online
            </div>
          </div>
        </header>

        {/* Tab 1: Dashboard / Runs Explorer */}
        {activeTab === "dashboard" && (
          <div className="flex-1 space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-sm hover:shadow hover:-translate-y-0.5 hover:border-zinc-350 transition-all duration-300 relative overflow-hidden group">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Total Active Runs
                </div>
                <div className="text-2xl font-extrabold text-zinc-900">{stats.total}</div>
                <div className="text-[10px] text-zinc-450 mt-2">
                  <span className="text-zinc-800 font-semibold">Workspace:</span> Engineering
                </div>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-sm hover:shadow hover:-translate-y-0.5 hover:border-zinc-350 transition-all duration-300 relative overflow-hidden group">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Success Rate
                </div>
                <div className="text-2xl font-extrabold text-emerald-600">{stats.successRate}%</div>
                <div className="text-[10px] text-zinc-450 mt-2">
                  Healthy execution sessions
                </div>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-sm hover:shadow hover:-translate-y-0.5 hover:border-zinc-350 transition-all duration-300 relative overflow-hidden group">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Average Latency
                </div>
                <div className="text-2xl font-extrabold text-zinc-900">{stats.avgLatency} <span className="text-xs font-semibold text-zinc-400">ms</span></div>
                <div className="text-[10px] text-zinc-450 mt-2">
                  Average duration per run
                </div>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-sm hover:shadow hover:-translate-y-0.5 hover:border-zinc-350 transition-all duration-300 relative overflow-hidden group">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Aggregate Cost
                </div>
                <div className="text-2xl font-extrabold text-zinc-900">{stats.totalCost} <span className="text-xs font-semibold text-zinc-400">¢</span></div>
                <div className="text-[10px] text-zinc-450 mt-2">
                  Cents spent on active runs
                </div>
              </div>
            </div>

            {/* Filters bar */}
            <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between shadow-sm">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-semibold">
                  <Filter className="h-3.5 w-3.5 text-zinc-400" />
                  Filters:
                </div>

                <div className="relative">
                  <select 
                    value={selectedVersion} 
                    onChange={(e) => { setSelectedVersion(e.target.value); setPage(1); }}
                    className="appearance-none bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 pr-8 text-xs text-zinc-700 font-semibold focus:outline-none focus:border-zinc-400"
                  >
                    <option value="all">All Versions</option>
                    {versions.map(v => (
                      <option key={v.id} value={v.id}>{v.version_tag}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 h-3 w-3 text-zinc-500 pointer-events-none" />
                </div>

                <div className="relative">
                  <select 
                    value={successFilter} 
                    onChange={(e) => { setSuccessFilter(e.target.value); setPage(1); }}
                    className="appearance-none bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 pr-8 text-xs text-zinc-700 font-semibold focus:outline-none focus:border-zinc-400"
                  >
                    <option value="all">All Statuses</option>
                    <option value="success">Success</option>
                    <option value="failure">Failure</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 h-3 w-3 text-zinc-500 pointer-events-none" />
                </div>
              </div>

              <div className="text-[11px] font-bold text-zinc-400">
                Viewing {runs.length} of {totalRuns} total runs
              </div>
            </div>

            {/* Empty State */}
            {runs.length === 0 && !loading && (
              <div className="border border-dashed border-zinc-300 rounded-xl p-16 text-center bg-white shadow-sm">
                <FileJson className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
                <h3 className="font-bold text-sm text-zinc-700">No Runs Found</h3>
                <p className="text-xs text-zinc-450 max-w-sm mx-auto mt-1 mb-5">
                  This workspace has no ingested traces matching the selected filters. Seed data to get started.
                </p>
                <button 
                  onClick={() => setActiveTab("ingest")}
                  className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 rounded-lg text-xs font-semibold text-white transition-all shadow-sm"
                >
                  Go to Ingestion Portal
                </button>
              </div>
            )}

            {/* List & Details Layout */}
            {runs.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Runs Table */}
                <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-400 text-[10px] font-bold uppercase tracking-wider bg-zinc-50/50">
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Run ID / Agent</th>
                          <th className="px-4 py-3">Input Prompt</th>
                          <th className="px-4 py-3 text-right">Latency</th>
                          <th className="px-4 py-3 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map(run => (
                          <tr 
                            key={run.id}
                            onClick={() => fetchRunDetail(run.id)}
                            className={`border-b border-zinc-100 hover:bg-zinc-50/70 transition-all cursor-pointer ${
                              selectedRunId === run.id ? "bg-zinc-50 border-l-[3px] border-l-zinc-950 pl-[13px]" : ""
                            }`}
                          >
                            <td className="px-4 py-3.5">
                              {run.success ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Success
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  Failed
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-semibold text-xs text-zinc-900 block font-mono">{run.id}</span>
                              <span className="text-[10px] text-zinc-400 block mt-0.5">
                                {run.agent_name} • <span className="text-zinc-600 font-bold">{run.version_tag}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3.5 max-w-[180px] truncate text-xs text-zinc-500">
                              {run.input_text || <span className="text-zinc-350 italic">No input</span>}
                            </td>
                            <td className="px-4 py-3.5 text-right text-xs font-mono text-zinc-700">
                              {run.latency_ms} ms
                            </td>
                            <td className="px-4 py-3.5 text-right text-xs font-mono text-zinc-500">
                              {run.cost_cents}¢
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Pagination */}
                  {totalRuns > limit && (
                    <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-50/50 border-t border-zinc-200 text-xs">
                      <button 
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        className="px-3 py-1 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-zinc-700 font-semibold"
                      >
                        Previous
                      </button>
                      <span className="text-zinc-500">Page {page} of {Math.ceil(totalRuns / limit)}</span>
                      <button 
                        disabled={page * limit >= totalRuns}
                        onClick={() => setPage(page + 1)}
                        className="px-3 py-1 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-zinc-700 font-semibold"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>

                {/* Run Detail Sidepanel */}
                <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-5 shadow-sm min-h-[500px]">
                  {!selectedRunId ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-24">
                      <HelpCircle className="h-8 w-8 text-zinc-300 mb-2" />
                      <h3 className="font-bold text-xs text-zinc-400">No Run Selected</h3>
                      <p className="text-[11px] text-zinc-400 max-w-[180px] mx-auto mt-1">
                        Select an agent run trace from the list to inspect detailed parameters.
                      </p>
                    </div>
                  ) : detailLoading ? (
                    <div className="h-full flex flex-col items-center justify-center py-24">
                      <RefreshCw className="h-6 w-6 text-zinc-400 animate-spin mb-2" />
                      <p className="text-xs text-zinc-400">Loading trace steps...</p>
                    </div>
                  ) : runDetail ? (
                    <div className="space-y-6">
                      {/* Detail Header */}
                      <div className="border-b border-zinc-100 pb-3">
                        <div className="flex justify-between items-start mb-1.5">
                          <h3 className="font-bold font-mono text-xs text-zinc-950">{runDetail.id}</h3>
                          <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded ${
                            runDetail.success ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                          }`}>
                            {runDetail.success ? "Success" : "Failed"}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 flex flex-wrap gap-x-3 gap-y-1">
                          <span>Agent: <strong className="text-zinc-700">{runDetail.agent_name}</strong></span>
                          <span>Version: <strong className="text-zinc-700">{runDetail.version.version_tag}</strong></span>
                        </div>
                      </div>

                      {/* AI Diagnostic Report Panel (Stark contrast card) */}
                      {!runDetail.success && (
                        <div className="bg-zinc-900 border border-zinc-800 text-white rounded-xl p-4.5 shadow-sm">
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <Sparkles className="h-4 w-4 text-white animate-pulse" />
                            <h4 className="font-bold text-[10px] uppercase tracking-wider text-zinc-100">AI Failure Diagnostic</h4>
                          </div>

                          {runDetail.failure_analysis ? (
                            <div className="space-y-3 text-[11px] leading-relaxed text-zinc-300">
                              <div>
                                <span className="block text-zinc-500 font-bold uppercase text-[9px] tracking-wider mb-0.5">Root Cause Analysis:</span>
                                <p className="text-zinc-200">{runDetail.failure_analysis.error_summary}</p>
                              </div>
                              <div className="border-t border-zinc-800 pt-2.5">
                                <span className="block text-emerald-400 font-bold uppercase text-[9px] tracking-wider mb-0.5">Suggested Remedy:</span>
                                <p className="text-zinc-200">{runDetail.failure_analysis.suggested_fix}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-1">
                              <p className="text-[11px] text-zinc-400 mb-3">
                                Run automatic AI analysis to extract root errors and suggestions.
                              </p>
                              <button 
                                onClick={() => handleRunLLMAnalysis(runDetail.id)}
                                disabled={analyzingFailure}
                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-zinc-100 rounded-lg text-xs font-bold text-zinc-950 shadow transition-all"
                              >
                                {analyzingFailure ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-950" />
                                    Analyzing failure...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-3.5 w-3.5 text-zinc-950" />
                                    Analyze Failure with AI
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Input / Output */}
                      <div className="space-y-3 text-xs">
                        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
                          <span className="block text-zinc-400 font-bold uppercase text-[9px] tracking-wider mb-1">Input Prompt</span>
                          <p className="text-zinc-800 leading-relaxed font-mono whitespace-pre-wrap">{runDetail.input_text || "None"}</p>
                        </div>
                        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
                          <span className="block text-zinc-400 font-bold uppercase text-[9px] tracking-wider mb-1">Agent Output</span>
                          <p className="text-zinc-800 leading-relaxed font-mono whitespace-pre-wrap">{runDetail.output_text || "None"}</p>
                        </div>
                      </div>

                      {/* Errors list */}
                      {runDetail.errors.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
                          <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs uppercase tracking-wider">
                            <ShieldAlert className="h-4 w-4" />
                            Runtime Exception
                          </div>
                          {runDetail.errors.map(err => (
                            <div key={err.id} className="text-xs">
                              <span className="font-bold text-rose-800 block font-mono text-[10px]">{err.error_type}</span>
                              <p className="text-rose-950 mt-1 leading-relaxed">{err.message}</p>
                              {err.stack_trace && (
                                <pre className="bg-zinc-900 text-zinc-400 font-mono text-[9px] p-2.5 rounded-lg mt-2 overflow-x-auto whitespace-pre leading-relaxed border border-zinc-800 max-h-32">
                                  {err.stack_trace}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Trace Steps Visualizer */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 text-zinc-500 font-bold text-[10px] uppercase tracking-wider">
                          <Layers className="h-3.5 w-3.5" />
                          Execution Trace Steps
                        </div>

                        {runDetail.steps.length === 0 ? (
                          <p className="text-xs text-zinc-450 italic">No execution steps recorded in this trace.</p>
                        ) : (
                          <div className="space-y-2.5">
                            {runDetail.steps.map((step, idx) => (
                              <div key={step.id} className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2.5">
                                <div className="flex justify-between items-center text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center h-4.5 w-4.5 rounded-full bg-zinc-200 text-[9px] font-bold text-zinc-650">
                                      {idx + 1}
                                    </span>
                                    <strong className="text-zinc-800 font-bold">{step.step_name}</strong>
                                  </div>
                                  <span className="text-[10px] text-zinc-400 font-mono">
                                    {step.latency_ms}ms • {step.tokens} tokens
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] border-t border-zinc-150 pt-2 font-mono">
                                  <div>
                                    <span className="text-zinc-450 uppercase text-[8px] tracking-wider font-bold block mb-0.5">Input</span>
                                    <p className="text-zinc-600 truncate">{step.input || "None"}</p>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 uppercase text-[8px] tracking-wider font-bold block mb-0.5">Output</span>
                                    <p className="text-zinc-600 truncate">{step.output || "None"}</p>
                                  </div>
                                </div>

                                {/* Step Tool Calls */}
                                {step.tool_calls.length > 0 && (
                                  <div className="border-t border-zinc-150 pt-2 space-y-1.5">
                                    <span className="text-[9px] text-zinc-550 uppercase tracking-widest font-bold block">
                                      Tool Calls
                                    </span>
                                    {step.tool_calls.map(tc => (
                                      <div key={tc.id} className="bg-white rounded-lg p-2 border border-zinc-200 text-[10px] space-y-1">
                                        <div className="flex justify-between items-center">
                                          <span className="font-mono text-zinc-950 font-bold flex items-center gap-1">
                                            <Code className="h-3 w-3" />
                                            {tc.tool_name}
                                          </span>
                                          <span className="text-[9px] text-zinc-400 font-mono">{tc.latency_ms}ms</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[9px] font-mono pt-1 text-zinc-500">
                                          <div className="truncate">
                                            <span className="text-zinc-400 block text-[8px] uppercase tracking-wider">Args:</span>
                                            {tc.tool_input || "None"}
                                          </div>
                                          <div className="truncate">
                                            <span className="text-zinc-400 block text-[8px] uppercase tracking-wider">Result:</span>
                                            {tc.tool_output || "None"}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Evaluations and custom Metrics */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-250 pt-4 text-xs">
                        <div className="space-y-1.5">
                          <span className="block text-zinc-400 font-bold uppercase text-[9px] tracking-wider">Evaluations</span>
                          {runDetail.evaluations.length === 0 ? (
                            <p className="text-zinc-400 italic">No evaluations.</p>
                          ) : (
                            runDetail.evaluations.map(ev => (
                              <div key={ev.id} className="bg-zinc-50 rounded-xl p-2 border border-zinc-200">
                                <div className="flex justify-between items-center font-bold text-zinc-800">
                                  <span>{ev.evaluator_name}</span>
                                  <span className="text-zinc-950 font-mono">{(ev.score * 100).toFixed(0)}%</span>
                                </div>
                                {ev.feedback && <p className="text-zinc-500 text-[10px] mt-1 leading-relaxed">{ev.feedback}</p>}
                              </div>
                            ))
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <span className="block text-zinc-400 font-bold uppercase text-[9px] tracking-wider">Custom Metrics</span>
                          {runDetail.metrics.length === 0 ? (
                            <p className="text-zinc-400 italic">No custom metrics.</p>
                          ) : (
                            runDetail.metrics.map(m => (
                              <div key={m.id} className="flex justify-between items-center bg-zinc-50 rounded-xl px-3.5 py-2 border border-zinc-200 font-mono text-[10px]">
                                <span className="text-zinc-450">{m.metric_name}</span>
                                <span className="text-zinc-800 font-bold">{m.metric_value}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Compare Versions Screen */}
        {activeTab === "compare" && (
          <div className="flex-1 space-y-6">
            {/* Compare Version Inputs */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">Select Agent</label>
                  <div className="relative">
                    <select 
                      value={compAgentId} 
                      onChange={(e) => { setCompAgentId(e.target.value); setCompVersionA(""); setCompVersionB(""); }}
                      className="w-full appearance-none bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 font-semibold focus:outline-none focus:border-zinc-400"
                    >
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">Baseline Version A</label>
                  <div className="relative">
                    <select 
                      value={compVersionA} 
                      onChange={(e) => setCompVersionA(e.target.value)}
                      className="w-full appearance-none bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 font-semibold focus:outline-none focus:border-zinc-400"
                    >
                      <option value="">-- Choose baseline --</option>
                      {compVersions.map(v => (
                        <option key={v.id} value={v.id}>{v.version_tag}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">Candidate Version B</label>
                  <div className="relative">
                    <select 
                      value={compVersionB} 
                      onChange={(e) => setCompVersionB(e.target.value)}
                      className="w-full appearance-none bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 font-semibold focus:outline-none focus:border-zinc-400"
                    >
                      <option value="">-- Choose candidate --</option>
                      {compVersions.map(v => (
                        <option key={v.id} value={v.id}>{v.version_tag}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <button 
                    onClick={handleCompare}
                    disabled={compareLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 rounded-lg text-xs font-bold text-white transition-all shadow-sm"
                  >
                    {compareLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Running Analysis...
                      </>
                    ) : (
                      <>
                        <Sliders className="h-4 w-4" />
                        Run Comparison
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Comparison results */}
            {!comparisonResult && !compareLoading && (
              <div className="border border-dashed border-zinc-300 bg-white rounded-xl p-16 text-center shadow-sm">
                <Sliders className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
                <h3 className="font-bold text-sm text-zinc-700">Run Comparison Report</h3>
                <p className="text-xs text-zinc-450 max-w-sm mx-auto mt-1">
                  Select baseline version A and new candidate version B above to run regression checking and aggregated performance reports.
                </p>
              </div>
            )}

            {comparisonResult && (
              <div className="space-y-6 animate-fade-in">
                {/* Aggregated comparison cards */}
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-6">
                  <div className="flex justify-between items-center border-b border-zinc-100 pb-3.5">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-800">Aggregated Version Metrics</h3>
                    <div className="text-[11px] text-zinc-450 font-bold">
                      Comparing baseline <strong className="text-zinc-950">{comparisonResult.version_a}</strong> to candidate <strong className="text-zinc-950">{comparisonResult.version_b}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Success Rate Comparison */}
                    <div className="bg-zinc-50 rounded-xl p-5 border border-zinc-200 flex flex-col justify-between">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-2.5">
                        Success Rate
                      </span>
                      <div className="flex justify-between items-baseline mb-2.5">
                        <div>
                          <span className="text-[9px] text-zinc-450 uppercase font-bold block">{comparisonResult.version_a}</span>
                          <span className="text-2xl font-black text-zinc-800">{comparisonResult.summary_a.success_rate}%</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                        <div className="text-right">
                          <span className="text-[9px] text-zinc-450 uppercase font-bold block">{comparisonResult.version_b}</span>
                          <span className="text-2xl font-black text-emerald-600">{comparisonResult.summary_b.success_rate}%</span>
                        </div>
                      </div>
                      
                      {comparisonResult.summary_b.success_rate - comparisonResult.summary_a.success_rate >= 0 ? (
                        <div className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
                          <TrendingUp className="h-3 w-3" />
                          +{(comparisonResult.summary_b.success_rate - comparisonResult.summary_a.success_rate).toFixed(1)}% improvement
                        </div>
                      ) : (
                        <div className="text-[10px] text-rose-700 font-extrabold flex items-center gap-1 mt-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 w-fit">
                          <TrendingDown className="h-3 w-3" />
                          {(comparisonResult.summary_b.success_rate - comparisonResult.summary_a.success_rate).toFixed(1)}% regression
                        </div>
                      )}
                    </div>

                    {/* Latency Comparison */}
                    <div className="bg-zinc-50 rounded-xl p-5 border border-zinc-200 flex flex-col justify-between">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-2.5">
                        Avg Latency
                      </span>
                      <div className="flex justify-between items-baseline mb-2.5">
                        <div>
                          <span className="text-[9px] text-zinc-450 uppercase font-bold block">{comparisonResult.version_a}</span>
                          <span className="text-2xl font-black text-zinc-800">{comparisonResult.summary_a.avg_latency} <span className="text-[10px] font-bold text-zinc-400">ms</span></span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                        <div className="text-right">
                          <span className="text-[9px] text-zinc-450 uppercase font-bold block">{comparisonResult.version_b}</span>
                          <span className="text-2xl font-black text-zinc-800">{comparisonResult.summary_b.avg_latency} <span className="text-[10px] font-bold text-zinc-400">ms</span></span>
                        </div>
                      </div>

                      {comparisonResult.summary_b.avg_latency - comparisonResult.summary_a.avg_latency <= 0 ? (
                        <div className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
                          <TrendingUp className="h-3 w-3" />
                          -{Math.round(comparisonResult.summary_a.avg_latency - comparisonResult.summary_b.avg_latency)}ms faster
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-700 font-extrabold flex items-center gap-1 mt-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 w-fit">
                          <TrendingDown className="h-3 w-3" />
                          +{Math.round(comparisonResult.summary_b.avg_latency - comparisonResult.summary_a.avg_latency)}ms slower
                        </div>
                      )}
                    </div>

                    {/* Cost Comparison */}
                    <div className="bg-zinc-50 rounded-xl p-5 border border-zinc-200 flex flex-col justify-between">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-2.5">
                        Avg Cost
                      </span>
                      <div className="flex justify-between items-baseline mb-2.5">
                        <div>
                          <span className="text-[9px] text-zinc-450 uppercase font-bold block">{comparisonResult.version_a}</span>
                          <span className="text-2xl font-black text-zinc-800">{comparisonResult.summary_a.avg_cost} <span className="text-[10px] font-bold text-zinc-400">¢</span></span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                        <div className="text-right">
                          <span className="text-[9px] text-zinc-450 uppercase font-bold block">{comparisonResult.version_b}</span>
                          <span className="text-2xl font-black text-zinc-800">{comparisonResult.summary_b.avg_cost} <span className="text-[10px] font-bold text-zinc-400">¢</span></span>
                        </div>
                      </div>

                      {comparisonResult.summary_b.avg_cost - comparisonResult.summary_a.avg_cost <= 0 ? (
                        <div className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
                          <TrendingUp className="h-3 w-3" />
                          -{(comparisonResult.summary_a.avg_cost - comparisonResult.summary_b.avg_cost).toFixed(4)}¢ cheaper
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-700 font-extrabold flex items-center gap-1 mt-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 w-fit">
                          <TrendingDown className="h-3 w-3" />
                          +{(comparisonResult.summary_b.avg_cost - comparisonResult.summary_a.avg_cost).toFixed(4)}¢ costlier
                        </div>
                      )}
                    </div>
                  </div>

                  {/* release report */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs">
                    <div className="flex items-center gap-1.5 mb-1.5 font-bold uppercase tracking-wider text-zinc-850">
                      <Cpu className="h-4 w-4 text-zinc-950" />
                      Sira AI Release Recommendation
                    </div>
                    <p className="text-zinc-650 leading-relaxed max-w-2xl">
                      Based on comparative statistics: Version <strong>{comparisonResult.version_b}</strong> has 
                      {comparisonResult.summary_b.success_rate >= comparisonResult.summary_a.success_rate ? " equal or improved success rate " : " a LOWER success rate "} 
                      compared to baseline. We detected <strong>{comparisonResult.regressions.length} regression cases</strong> and 
                      <strong> {comparisonResult.improvements.length} improvements</strong> on matched prompt inputs.
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="font-bold text-zinc-500">Release Assessment:</span>
                      {comparisonResult.regressions.length > 0 ? (
                        <span className="px-2 py-0.5 bg-amber-55/15 border border-amber-200 rounded text-amber-700 font-bold">
                          RISKY (Regressions detected)
                        </span>
                      ) : comparisonResult.summary_b.success_rate >= comparisonResult.summary_a.success_rate ? (
                        <span className="px-2 py-0.5 bg-emerald-55/15 border border-emerald-200 rounded text-emerald-700 font-bold">
                          STABLE (Safe to deploy)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-55/15 border border-rose-200 rounded text-rose-700 font-bold">
                          REGRESSED (Not recommended)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Regression/Improvement lists */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Regression cases */}
                  <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-rose-600" />
                        Regressions ({comparisonResult.regressions.length})
                      </h4>
                      <span className="text-[10px] text-zinc-400 font-bold">Succeeded in A, failed in B</span>
                    </div>

                    {comparisonResult.regressions.length === 0 ? (
                      <div className="py-12 text-center text-xs text-zinc-400 italic">
                        No regression cases detected for matched inputs.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {comparisonResult.regressions.map(r => (
                          <div 
                            key={r.id}
                            className="bg-zinc-50 border border-zinc-250 hover:border-zinc-400 rounded-xl p-3.5 transition-all cursor-pointer"
                            onClick={() => {
                              setActiveTab("dashboard");
                              fetchRunDetail(r.id);
                            }}
                          >
                            <div className="flex justify-between items-start text-xs mb-1.5">
                              <span className="font-semibold font-mono text-[10px] text-zinc-800 block truncate max-w-[130px]">{r.id}</span>
                              <span className="text-[9px] text-zinc-400 font-mono">{r.latency_ms}ms</span>
                            </div>
                            <div className="text-[10px] font-mono text-zinc-650 leading-relaxed bg-white p-2.5 rounded-lg border border-zinc-200/80 mb-2 truncate">
                              Prompt: {r.input_text || "None"}
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-rose-700 font-bold">
                              <span>Click to inspect failure steps</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Improvement cases */}
                  <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                        Improvements ({comparisonResult.improvements.length})
                      </h4>
                      <span className="text-[10px] text-zinc-400 font-bold">Failed in A, succeeded in B</span>
                    </div>

                    {comparisonResult.improvements.length === 0 ? (
                      <div className="py-12 text-center text-xs text-zinc-400 italic">
                        No improvement cases detected for matched inputs.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {comparisonResult.improvements.map(r => (
                          <div 
                            key={r.id}
                            className="bg-zinc-50 border border-zinc-250 hover:border-zinc-400 rounded-xl p-3.5 transition-all cursor-pointer"
                            onClick={() => {
                              setActiveTab("dashboard");
                              fetchRunDetail(r.id);
                            }}
                          >
                            <div className="flex justify-between items-start text-xs mb-1.5">
                              <span className="font-semibold font-mono text-[10px] text-zinc-800 block truncate max-w-[130px]">{r.id}</span>
                              <span className="text-[9px] text-zinc-400 font-mono">{r.latency_ms}ms</span>
                            </div>
                            <div className="text-[10px] font-mono text-zinc-650 leading-relaxed bg-white p-2.5 rounded-lg border border-zinc-200/80 mb-2 truncate">
                              Prompt: {r.input_text || "None"}
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-emerald-700 font-bold">
                              <span>Click to inspect trace metrics</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Trace Ingestion Screen */}
        {activeTab === "ingest" && (
          <div className="max-w-2xl mx-auto w-full space-y-6">
            <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-800 mb-1.5">Ingest Trace Event JSON</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                Paste raw agent trace outputs below to load workspaces, project hierarchies, versions, runs, metrics, and evaluations automatically.
              </p>

              <form onSubmit={handleJsonUpload} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="block text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Trace JSON Payload</span>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={loadSeedDataset}
                        className="text-[10px] text-zinc-900 hover:text-zinc-600 font-bold transition-colors border border-zinc-250 px-2 py-0.5 rounded bg-zinc-50"
                      >
                        Load Seed dataset
                      </button>

                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[10px] text-zinc-500 hover:text-zinc-800 transition-colors border border-zinc-200 px-2 py-0.5 rounded bg-white"
                      >
                        Upload file
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".json"
                        className="hidden" 
                      />
                    </div>
                  </div>

                  <textarea 
                    rows={10}
                    value={uploadText}
                    onChange={(e) => setUploadText(e.target.value)}
                    placeholder="Paste a single agent run trace object, or a list of trace runs here..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-4 font-mono text-xs text-zinc-700 focus:outline-none focus:border-zinc-400 leading-relaxed shadow-inner"
                  />
                </div>

                {uploadStatus.type && (
                  <div className={`text-xs p-3.5 rounded-lg border flex items-start gap-2 ${
                    uploadStatus.type === "success" 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-250" 
                      : "bg-rose-50 text-rose-700 border-rose-250"
                  }`}>
                    {uploadStatus.type === "success" ? (
                      <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    )}
                    <div className="leading-relaxed font-bold">{uploadStatus.message}</div>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-1.5 px-6 py-2.5 bg-zinc-950 hover:bg-zinc-850 rounded-lg text-xs font-bold text-white transition-all shadow-sm"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Processing Traces...
                    </>
                  ) : (
                    <>
                      <Database className="h-3.5 w-3.5" />
                      Submit Ingest Traces
                    </>
                  )}
                </button>
              </form>
            </div>
            
            {/* Schema Docs */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 text-xs space-y-3 shadow-inner">
              <h4 className="font-bold text-zinc-800 uppercase tracking-wider">Schema Structure Quick Reference</h4>
              <p className="text-zinc-500 leading-relaxed">
                Ingested payload elements resolve hierarchy endpoints automatically. If workspace_name, project_name, or agent_name is not found, the relational builder initializes them.
              </p>
              <pre className="bg-white text-zinc-450 p-3 rounded-lg font-mono overflow-x-auto text-[9.5px] leading-relaxed border border-zinc-200 shadow-sm">
{`[
  {
    "run_id": "run-uuid-1234",
    "version": "v1.0.0",
    "agent_name": "MyAgent",
    "project_name": "MyProject",
    "workspace_name": "DefaultWorkspace",
    "user_email": "engineer@sira.ai",
    "success": true, // or false
    "latency_ms": 1200,
    "cost_cents": 0.45,
    "input_text": "Prompt text query...",
    "output_text": "Response text output..."
  }
]`}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
