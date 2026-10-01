/** Shared view contract: recorded fixtures and FastAPI responses use the same DTOs. */
export interface ToolCall {
  id: number;
  tool_name: string;
  tool_input?: string | null;
  tool_output?: string | null;
  status?: string | null;
  latency_ms?: number | null;
}
export interface Step {
  id: number;
  span_id?: string | null;
  parent_span_id?: string | null;
  step_name: string;
  kind?: string | null;
  status?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  latency_ms?: number | null;
  tokens?: number | null;
  input?: string | null;
  output?: string | null;
  step_order: number;
  attributes?: Record<string, unknown> | null;
  tool_calls: ToolCall[];
}
export interface Evaluation {
  evaluator_name: string;
  score: number;
  feedback?: string | null;
  check_version?: string | null;
  method?: string | null;
}
export interface RunSummary {
  id: string;
  timestamp: string;
  success: boolean;
  quality: string;
  latency_ms: number;
  cost_cents: number;
  input_text?: string | null;
  output_text?: string | null;
  version_id: number;
  version_tag: string;
  agent_name: string;
  project_name: string;
  case_id?: string | null;
  model?: string | null;
  prompt_version?: string | null;
  source?: string | null;
}
export interface Run extends RunSummary {
  steps: Step[];
  evaluations: Evaluation[];
  errors: {
    message: string;
    error_type?: string | null;
    stack_trace?: string | null;
  }[];
}
export interface CaseResult {
  case_id: string;
  name: string;
  category: string;
  answer: string;
  passed: boolean;
  checks: Record<string, boolean>;
  check_version: string;
  method: string;
  source: string;
}
export interface Report {
  source: string;
  investigator_version: string;
  check_version: string;
  model: string;
  proposal: {
    probable_cause: string;
    evidence_span_ids: string[];
    uncertainty: string;
    prompt: string;
    retrieval_top_k: number;
    retry_count: number;
  };
  before: CaseResult[];
  after: CaseResult[];
  baseline_source: string;
  candidate_source: string;
  remaining_failures: string[];
  new_regressions: string[];
  model_calls: number;
  tokens: number;
  cost_cents: number | null;
  decision: string;
}
export interface Job {
  id: string;
  run_id: string;
  status: string;
  attempts: number;
  error_code?: string | null;
  error_message?: string | null;
  report?: Report | null;
}
export interface Stats {
  total: number;
  success_rate: number;
  avg_latency: number;
  total_cost: number;
}
export interface RunPage {
  runs: RunSummary[];
  total: number;
  skip: number;
  limit: number;
  stats: Stats;
}
