from app.timeutils import utcnow
import hashlib
import json
from collections import defaultdict
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app import models, schemas

def calculate_hash(text: str | None) -> str:
    if not text:
        text = ""
    normalized = text.strip().lower()
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

class ConflictError(ValueError):
    pass


def payload_hash(payload):
    return hashlib.sha256(json.dumps(payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def quality(run):
    if not run.evaluations:
        return "unscored"
    return "passed" if all(e.score >= 1 for e in run.evaluations) else "failed"


def ingest_runs(db: Session, runs_data: list[schemas.IngestRunPayload]):
    ingested_runs = []
    
    for payload in runs_data:
        fingerprint = payload_hash(payload)
        existing_run = db.get(models.Run, payload.run_id)
        if existing_run:
            if existing_run.payload_hash != fingerprint:
                raise ConflictError("Run ID already exists with different content (or legacy content without a fingerprint); use a new ID.")
            ingested_runs.append(existing_run)
            continue
        # 1. Resolve User
        user = db.query(models.User).filter(models.User.email == payload.user_email).first()
        if not user:
            user = models.User(email=payload.user_email)
            db.add(user)
            db.flush()
            
        # 2. Resolve Workspace
        workspace = db.query(models.Workspace).filter(
            models.Workspace.name == payload.workspace_name,
            models.Workspace.user_id == user.id
        ).first()
        if not workspace:
            workspace = models.Workspace(name=payload.workspace_name, user_id=user.id)
            db.add(workspace)
            db.flush()
            
        # 3. Resolve Project
        project = db.query(models.Project).filter(
            models.Project.name == payload.project_name,
            models.Project.workspace_id == workspace.id
        ).first()
        if not project:
            project = models.Project(name=payload.project_name, workspace_id=workspace.id)
            db.add(project)
            db.flush()
            
        # 4. Resolve Agent
        agent = db.query(models.Agent).filter(
            models.Agent.name == payload.agent_name,
            models.Agent.project_id == project.id
        ).first()
        if not agent:
            agent = models.Agent(name=payload.agent_name, project_id=project.id)
            db.add(agent)
            db.flush()
            
        # 5. Resolve Version
        version = db.query(models.Version).filter(
            models.Version.version_tag == payload.version,
            models.Version.agent_id == agent.id
        ).first()
        if not version:
            version = models.Version(version_tag=payload.version, agent_id=agent.id)
            db.add(version)
            db.flush()
            
        # 7. Create Run
        input_hash = calculate_hash(payload.input_text)
        db_run = models.Run(
            id=payload.run_id,
            payload_hash=fingerprint,
            case_id=payload.case_id,
            model=payload.model,
            prompt_version=payload.prompt_version,
            source=payload.source,
            timestamp=payload.timestamp or utcnow(),
            success=payload.success,
            latency_ms=payload.latency_ms,
            cost_cents=payload.cost_cents,
            input_hash=input_hash,
            input_text=payload.input_text,
            output_text=payload.output_text,
            version_id=version.id
        )
        db.add(db_run)
        
        # 8. Create Steps
        for idx, step_payload in enumerate(payload.steps or []):
            db_step = models.Step(
                **{key: getattr(step_payload, key) for key in ("span_id", "parent_span_id", "started_at", "ended_at", "kind", "status", "attributes")},
                step_name=step_payload.step_name,
                input=step_payload.input,
                output=step_payload.output,
                tokens=step_payload.tokens,
                latency_ms=step_payload.latency_ms,
                step_order=step_payload.step_order if step_payload.step_order is not None else idx,
                run_id=db_run.id
            )
            db.add(db_step)
            db.flush()  # to get db_step.id
            
            # Create Tool Calls
            for tool_payload in step_payload.tool_calls or []:
                db_tool = models.ToolCall(
                    tool_name=tool_payload.tool_name,
                    tool_input=tool_payload.tool_input,
                    tool_output=tool_payload.tool_output,
                    status=tool_payload.status,
                    latency_ms=tool_payload.latency_ms,
                    step_id=db_step.id
                )
                db.add(db_tool)
                
        # 9. Create Metrics
        for metric_payload in payload.metrics or []:
            db_metric = models.Metric(
                metric_name=metric_payload.metric_name,
                metric_value=metric_payload.metric_value,
                run_id=db_run.id
            )
            db.add(db_metric)
            
        # 10. Create Evaluations
        for eval_payload in payload.evaluations or []:
            db_eval = models.Evaluation(
                check_version=eval_payload.check_version,
                method=eval_payload.method,
                evaluator_name=eval_payload.evaluator_name,
                score=eval_payload.score,
                feedback=eval_payload.feedback,
                run_id=db_run.id
            )
            db.add(db_eval)
            
        # 11. Create Errors (if applicable)
        if payload.error_details:
            db_error = models.Error(
                error_type=payload.error_details.error_type,
                message=payload.error_details.message,
                stack_trace=payload.error_details.stack_trace,
                run_id=db_run.id
            )
            db.add(db_error)
        elif not payload.success:
            # Create a default error record if success=False and details are missing
            db_error = models.Error(
                error_type="UnknownError",
                message="Run failed without specific error details.",
                run_id=db_run.id
            )
            db.add(db_error)
            
        db.flush()
        ingested_runs.append(db_run)
        
    db.commit()
    return ingested_runs

def run_item(r):
    return {"id": r.id, "timestamp": r.timestamp, "success": r.success,
            "latency_ms": r.latency_ms, "cost_cents": r.cost_cents, "input_hash": r.input_hash,
            "input_text": r.input_text, "output_text": r.output_text,
            "version_id": r.version_id, "version_tag": r.version.version_tag,
            "agent_name": r.version.agent.name, "project_name": r.version.agent.project.name,
            "case_id": r.case_id, "quality": quality(r), "model": r.model,
            "prompt_version": r.prompt_version, "source": r.source}


def filtered_runs(db, version_id=None, success=None, agent_id=None, search=None):
    query = db.query(models.Run)
    if version_id is not None:
        query = query.filter(models.Run.version_id == version_id)
    if success is not None:
        query = query.filter(models.Run.success == success)
    if agent_id is not None:
        query = query.join(models.Version).filter(models.Version.agent_id == agent_id)
    if search:
        query = query.filter(models.Run.input_text.ilike("%" + search + "%"))
    return query


def get_runs(db, version_id=None, success=None, skip=0, limit=50, agent_id=None, search=None):
    query = filtered_runs(db, version_id, success, agent_id, search)
    return ([run_item(r) for r in query.order_by(models.Run.timestamp.desc(), models.Run.id).offset(skip).limit(limit)], query.count())


def aggregate(db, version_id=None, success=None, agent_id=None, search=None):
    query = filtered_runs(db, version_id, success, agent_id, search)
    total, successes, latency, cost = query.with_entities(func.count(models.Run.id), func.sum(models.Run.success.cast(models.Integer)), func.avg(models.Run.latency_ms), func.sum(models.Run.cost_cents)).one()
    return {"total": total, "success_rate": round(100 * (successes or 0) / total, 1) if total else 0,
            "avg_latency": latency or 0, "total_cost": cost or 0}


def get_run_detail(db: Session, run_id: str):
    return db.query(models.Run).filter(models.Run.id == run_id).first()

def get_projects(db: Session):
    return db.query(models.Project).all()

def get_agents(db: Session, project_id: int | None = None):
    query = db.query(models.Agent)
    if project_id is not None:
        query = query.filter(models.Agent.project_id == project_id)
    return query.all()

def get_versions(db: Session, agent_id: int | None = None):
    query = db.query(models.Version)
    if agent_id is not None:
        query = query.filter(models.Version.agent_id == agent_id)
    return query.all()

def get_version_by_id(db: Session, version_id: int):
    return db.query(models.Version).filter(models.Version.id == version_id).first()

def calculate_version_metrics(db: Session, version_id: int) -> schemas.MetricSummary:
    runs = db.query(models.Run).filter(models.Run.version_id == version_id).all()
    total = len(runs)
    if total == 0:
        return schemas.MetricSummary(
            success_rate=0.0,
            avg_latency=0.0,
            avg_cost=0.0,
            total_runs=0,
            error_rate=0.0
        )
    
    successes = sum(1 for r in runs if r.success)
    total_latency = sum(r.latency_ms for r in runs)
    total_cost = sum(r.cost_cents for r in runs)
    
    success_rate = (successes / total) * 100
    error_rate = 100.0 - success_rate
    
    return schemas.MetricSummary(
        success_rate=round(success_rate, 2),
        avg_latency=round(total_latency / total, 2),
        avg_cost=round(total_cost / total, 4),
        total_runs=total,
        error_rate=round(error_rate, 2)
    )

def compare_versions(db, version_a_id, version_b_id):
    a = db.get(models.Version, version_a_id)
    b = db.get(models.Version, version_b_id)
    if not a or not b:
        raise ValueError("One or both versions do not exist")
    if a.agent_id != b.agent_id or a.id == b.id:
        raise ValueError("Choose two different versions of the same agent")
    def grouped(version):
        result = defaultdict(list)
        for run in sorted(version.runs, key=lambda r: (r.timestamp, r.id)):
            result[("case", run.case_id) if run.case_id else ("input", run.input_hash)].append(run)
        return result
    ga, gb = grouped(a), grouped(b)
    pairs, regressions, improvements, unmatched_a, unmatched_b = [], [], [], [], []
    def passed(r):
        return r.success and quality(r) != "failed"
    for key in sorted(ga.keys() | gb.keys()):
        left, right = ga[key], gb[key]
        count = min(len(left), len(right))
        for x, y in zip(left, right):
            pairs.append({"baseline": run_item(x), "candidate": run_item(y),
                          "baseline_checks": [{"name": e.evaluator_name, "score": e.score, "check_version": e.check_version} for e in x.evaluations],
                          "candidate_checks": [{"name": e.evaluator_name, "score": e.score, "check_version": e.check_version} for e in y.evaluations]})
            if passed(x) and not passed(y): regressions.append(run_item(y))
            if not passed(x) and passed(y): improvements.append(run_item(y))
        unmatched_a.extend(r.id for r in left[count:])
        unmatched_b.extend(r.id for r in right[count:])
    return {"version_a": a.version_tag, "version_b": b.version_tag,
            "summary_a": calculate_version_metrics(db, a.id), "summary_b": calculate_version_metrics(db, b.id),
            "regressions": regressions, "improvements": improvements, "pairs": pairs,
            "unmatched_a": unmatched_a, "unmatched_b": unmatched_b}
