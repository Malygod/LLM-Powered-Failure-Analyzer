from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Any, Literal
from pydantic import ConfigDict, model_validator

# --- Tool Call Schemas ---
class ToolCallBase(BaseModel):
    tool_name: str
    tool_input: Optional[str] = None
    tool_output: Optional[str] = None
    status: Optional[str] = "success"
    latency_ms: Optional[float] = 0.0

class ToolCallCreate(ToolCallBase):
    pass

class ToolCallResponse(ToolCallBase):
    id: int
    step_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Error Schemas ---
class ErrorBase(BaseModel):
    error_type: Optional[str] = None
    message: str
    stack_trace: Optional[str] = None

class ErrorCreate(ErrorBase):
    pass

class ErrorResponse(ErrorBase):
    id: int
    run_id: str
    step_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Step Schemas ---
class StepBase(BaseModel):
    span_id: str | None = None
    parent_span_id: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    kind: str | None = None
    status: str | None = None
    attributes: dict | None = None

    step_name: str
    input: Optional[str] = None
    output: Optional[str] = None
    tokens: Optional[int] = 0
    latency_ms: Optional[float] = 0.0
    step_order: Optional[int] = 0

class StepCreate(StepBase):
    tool_calls: Optional[List[ToolCallCreate]] = []

class StepResponse(StepBase):
    id: int
    run_id: str
    created_at: datetime
    tool_calls: List[ToolCallResponse] = []
    errors: List[ErrorResponse] = []

    model_config = ConfigDict(from_attributes=True)


# --- Metric Schemas ---
class MetricBase(BaseModel):
    metric_name: str
    metric_value: float

class MetricCreate(MetricBase):
    pass

class MetricResponse(MetricBase):
    id: int
    run_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Evaluation Schemas ---
class EvaluationBase(BaseModel):
    check_version: str | None = None
    method: str | None = "deterministic"
    evaluator_name: str
    score: float
    feedback: Optional[str] = None

class EvaluationCreate(EvaluationBase):
    pass

class EvaluationResponse(EvaluationBase):
    id: int
    run_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Ingestion Schemas ---
class IngestRunPayload(BaseModel):
    case_id: str | None = None
    model: str | None = None
    prompt_version: str | None = None
    source: Literal["live", "simulated"] = "live"

    @model_validator(mode="after")
    def validate_spans(self):
        spans = {s.span_id: s for s in self.steps or [] if s.span_id}
        if len(spans) != sum(bool(s.span_id) for s in self.steps or []):
            raise ValueError("Duplicate span identifiers")
        for span in self.steps or []:
            if span.started_at and span.ended_at and span.ended_at < span.started_at:
                raise ValueError("Span ends before it starts")
            seen = {span.span_id}
            parent = span.parent_span_id
            while parent:
                if parent not in spans or parent in seen:
                    raise ValueError("Invalid span parent or cycle")
                seen.add(parent)
                parent = spans[parent].parent_span_id
        return self

    run_id: str
    version: str
    agent_name: str
    project_name: str
    workspace_name: str
    user_email: str
    timestamp: Optional[datetime] = None
    success: bool
    latency_ms: float
    cost_cents: float
    input_text: Optional[str] = None
    output_text: Optional[str] = None
    steps: Optional[List[StepCreate]] = []
    metrics: Optional[List[MetricCreate]] = []
    evaluations: Optional[List[EvaluationCreate]] = []
    error_details: Optional[ErrorCreate] = None


# --- Model Response Schemas ---
class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class WorkspaceResponse(BaseModel):
    id: int
    name: str
    user_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ProjectResponse(BaseModel):
    id: int
    name: str
    workspace_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AgentResponse(BaseModel):
    id: int
    name: str
    project_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class VersionResponse(BaseModel):
    id: int
    version_tag: str
    agent_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Failure Analysis Schemas ---
class FailureAnalysisResponse(BaseModel):
    id: int
    run_id: str
    error_summary: str
    suggested_fix: str
    analyzed_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Run Response Schemas ---
class RunListItem(BaseModel):
    case_id: str | None = None
    model: str | None = None
    prompt_version: str | None = None
    source: str | None = None
    quality: str = "unscored"

    id: str
    timestamp: datetime
    success: bool
    latency_ms: float
    cost_cents: float
    input_hash: str
    input_text: Optional[str] = None
    output_text: Optional[str] = None
    version_id: int
    version_tag: str
    agent_name: str
    project_name: str

    model_config = ConfigDict(from_attributes=True)

class RunDetailResponse(BaseModel):
    case_id: str | None = None
    model: str | None = None
    prompt_version: str | None = None
    source: str | None = None
    quality: str = "unscored"
    agent_name: str = ""
    project_name: str = ""
    version_tag: str = ""

    id: str
    timestamp: datetime
    success: bool
    latency_ms: float
    cost_cents: float
    input_hash: str
    input_text: Optional[str] = None
    output_text: Optional[str] = None
    version_id: int
    created_at: datetime
    
    version: VersionResponse
    steps: List[StepResponse] = []
    errors: List[ErrorResponse] = []
    metrics: List[MetricResponse] = []
    evaluations: List[EvaluationResponse] = []
    failure_analysis: Optional[FailureAnalysisResponse] = None

    model_config = ConfigDict(from_attributes=True)


# --- Comparison Screen Schemas ---
class MetricSummary(BaseModel):
    success_rate: float
    avg_latency: float
    avg_cost: float
    total_runs: int
    error_rate: float

class VersionCompareSummary(BaseModel):
    pairs: list[dict] = Field(default_factory=list)
    unmatched_a: list[str] = Field(default_factory=list)
    unmatched_b: list[str] = Field(default_factory=list)

    version_a: str
    version_b: str
    summary_a: MetricSummary
    summary_b: MetricSummary
    regressions: List[RunListItem]
    improvements: List[RunListItem]

    model_config = ConfigDict(from_attributes=True)


class Proposal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    probable_cause: str = Field(min_length=1, max_length=2000)
    evidence_span_ids: list[str] = Field(min_length=1, max_length=20)
    uncertainty: str = Field(min_length=1, max_length=1000)
    prompt: str = Field(min_length=20, max_length=3000)
    retrieval_top_k: int = Field(ge=1, le=3)
    retry_count: int = Field(ge=0, le=1)

class InvestigationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    run_id: str
    status: str
    attempts: int
    created_at: datetime
    updated_at: datetime
    error_code: str | None = None
    error_message: str | None = None
    report: dict | None = None
