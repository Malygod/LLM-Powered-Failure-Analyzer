from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Any

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

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


# --- Step Schemas ---
class StepBase(BaseModel):
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

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


# --- Evaluation Schemas ---
class EvaluationBase(BaseModel):
    evaluator_name: str
    score: float
    feedback: Optional[str] = None

class EvaluationCreate(EvaluationBase):
    pass

class EvaluationResponse(EvaluationBase):
    id: int
    run_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Ingestion Schemas ---
class IngestRunPayload(BaseModel):
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
    class Config: from_attributes = True

class WorkspaceResponse(BaseModel):
    id: int
    name: str
    user_id: int
    created_at: datetime
    class Config: from_attributes = True

class ProjectResponse(BaseModel):
    id: int
    name: str
    workspace_id: int
    created_at: datetime
    class Config: from_attributes = True

class AgentResponse(BaseModel):
    id: int
    name: str
    project_id: int
    created_at: datetime
    class Config: from_attributes = True

class VersionResponse(BaseModel):
    id: int
    version_tag: str
    agent_id: int
    created_at: datetime
    class Config: from_attributes = True


# --- Failure Analysis Schemas ---
class FailureAnalysisResponse(BaseModel):
    id: int
    run_id: str
    error_summary: str
    suggested_fix: str
    analyzed_at: datetime
    class Config: from_attributes = True


# --- Run Response Schemas ---
class RunListItem(BaseModel):
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

    class Config:
        from_attributes = True

class RunDetailResponse(BaseModel):
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

    class Config:
        from_attributes = True


# --- Comparison Screen Schemas ---
class MetricSummary(BaseModel):
    success_rate: float
    avg_latency: float
    avg_cost: float
    total_runs: int
    error_rate: float

class VersionCompareSummary(BaseModel):
    version_a: str
    version_b: str
    summary_a: MetricSummary
    summary_b: MetricSummary
    regressions: List[RunListItem]
    improvements: List[RunListItem]

    class Config:
        from_attributes = True
