from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    workspaces = relationship("Workspace", back_populates="user", cascade="all, delete-orphan")

class Workspace(Base):
    __tablename__ = "workspaces"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user = relationship("User", back_populates="workspaces")
    projects = relationship("Project", back_populates="workspace", cascade="all, delete-orphan")

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    workspace = relationship("Workspace", back_populates="projects")
    agents = relationship("Agent", back_populates="project", cascade="all, delete-orphan")

class Agent(Base):
    __tablename__ = "agents"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    project = relationship("Project", back_populates="agents")
    versions = relationship("Version", back_populates="agent", cascade="all, delete-orphan")

class Version(Base):
    __tablename__ = "versions"
    id = Column(Integer, primary_key=True, index=True)
    version_tag = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    agent = relationship("Agent", back_populates="versions")
    runs = relationship("Run", back_populates="version", cascade="all, delete-orphan")

class Run(Base):
    __tablename__ = "runs"
    id = Column(String, primary_key=True, index=True)  # Using external UUID or run_id
    timestamp = Column(DateTime, default=datetime.utcnow)
    success = Column(Boolean, default=True)
    latency_ms = Column(Float, default=0.0)
    cost_cents = Column(Float, default=0.0)
    input_hash = Column(String, index=True, nullable=False)
    input_text = Column(Text, nullable=True)
    output_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    version_id = Column(Integer, ForeignKey("versions.id", ondelete="CASCADE"), nullable=False)
    version = relationship("Version", back_populates="runs")
    
    steps = relationship("Step", back_populates="run", cascade="all, delete-orphan")
    errors = relationship("Error", back_populates="run", cascade="all, delete-orphan")
    metrics = relationship("Metric", back_populates="run", cascade="all, delete-orphan")
    evaluations = relationship("Evaluation", back_populates="run", cascade="all, delete-orphan")
    failure_analysis = relationship("FailureAnalysis", back_populates="run", uselist=False, cascade="all, delete-orphan")

class Step(Base):
    __tablename__ = "steps"
    id = Column(Integer, primary_key=True, index=True)
    step_name = Column(String, nullable=False)
    input = Column(Text, nullable=True)
    output = Column(Text, nullable=True)
    tokens = Column(Integer, default=0)
    latency_ms = Column(Float, default=0.0)
    step_order = Column(Integer, default=0)  # to maintain sequence
    created_at = Column(DateTime, default=datetime.utcnow)
    run_id = Column(String, ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    run = relationship("Run", back_populates="steps")
    
    tool_calls = relationship("ToolCall", back_populates="step", cascade="all, delete-orphan")
    errors = relationship("Error", back_populates="step", cascade="all, delete-orphan")

class ToolCall(Base):
    __tablename__ = "tool_calls"
    id = Column(Integer, primary_key=True, index=True)
    tool_name = Column(String, nullable=False)
    tool_input = Column(Text, nullable=True)
    tool_output = Column(Text, nullable=True)
    status = Column(String, default="success")  # success, failure
    latency_ms = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    step_id = Column(Integer, ForeignKey("steps.id", ondelete="CASCADE"), nullable=False)
    step = relationship("Step", back_populates="tool_calls")

class Error(Base):
    __tablename__ = "errors"
    id = Column(Integer, primary_key=True, index=True)
    error_type = Column(String, nullable=True)
    message = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    run_id = Column(String, ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    run = relationship("Run", back_populates="errors")
    step_id = Column(Integer, ForeignKey("steps.id", ondelete="CASCADE"), nullable=True)
    step = relationship("Step", back_populates="errors")

class Metric(Base):
    __tablename__ = "metrics"
    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String, nullable=False)
    metric_value = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    run_id = Column(String, ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    run = relationship("Run", back_populates="metrics")

class Evaluation(Base):
    __tablename__ = "evaluations"
    id = Column(Integer, primary_key=True, index=True)
    evaluator_name = Column(String, nullable=False)
    score = Column(Float, nullable=False)
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    run_id = Column(String, ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    run = relationship("Run", back_populates="evaluations")

class FailureAnalysis(Base):
    __tablename__ = "failure_analyses"
    id = Column(Integer, primary_key=True, index=True)
    error_summary = Column(Text, nullable=False)
    suggested_fix = Column(Text, nullable=False)
    analyzed_at = Column(DateTime, default=datetime.utcnow)
    run_id = Column(String, ForeignKey("runs.id", ondelete="CASCADE"), nullable=False, unique=True)
    run = relationship("Run", back_populates="failure_analysis")

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    version_a_id = Column(Integer, ForeignKey("versions.id", ondelete="CASCADE"), nullable=False)
    version_b_id = Column(Integer, ForeignKey("versions.id", ondelete="CASCADE"), nullable=False)
    summary = Column(Text, nullable=False)
    status = Column(String, nullable=False)  # better, worse, risky
    details = Column(Text, nullable=True)  # JSON serialized data containing comparisons
    created_at = Column(DateTime, default=datetime.utcnow)
    
    version_a = relationship("Version", foreign_keys=[version_a_id])
    version_b = relationship("Version", foreign_keys=[version_b_id])
