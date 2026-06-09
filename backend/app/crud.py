import hashlib
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app import models, schemas

def calculate_hash(text: str | None) -> str:
    if not text:
        text = ""
    normalized = text.strip().lower()
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

def ingest_runs(db: Session, runs_data: list[schemas.IngestRunPayload]):
    ingested_runs = []
    
    for payload in runs_data:
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
            
        # 6. Delete Run if it already exists to allow re-ingestion/idempotency
        existing_run = db.query(models.Run).filter(models.Run.id == payload.run_id).first()
        if existing_run:
            db.delete(existing_run)
            db.flush()
            
        # 7. Create Run
        input_hash = calculate_hash(payload.input_text)
        db_run = models.Run(
            id=payload.run_id,
            timestamp=payload.timestamp or datetime.utcnow(),
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
                step_name=step_payload.step_name,
                input=step_payload.input,
                output=step_payload.output,
                tokens=step_payload.tokens,
                latency_ms=step_payload.latency_ms,
                step_order=step_payload.step_order or idx,
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
            
        ingested_runs.append(db_run)
        
    db.commit()
    return ingested_runs

def get_runs(db: Session, version_id: int | None = None, success: bool | None = None, skip: int = 0, limit: int = 50):
    query = db.query(models.Run)
    if version_id is not None:
        query = query.filter(models.Run.version_id == version_id)
    if success is not None:
        query = query.filter(models.Run.success == success)
    
    total = query.count()
    results = query.order_by(models.Run.timestamp.desc()).offset(skip).limit(limit).all()
    
    # Transform database objects into a flatter structure for list items
    list_items = []
    for r in results:
        v = r.version
        a = v.agent
        p = a.project
        list_items.append({
            "id": r.id,
            "timestamp": r.timestamp,
            "success": r.success,
            "latency_ms": r.latency_ms,
            "cost_cents": r.cost_cents,
            "input_hash": r.input_hash,
            "input_text": r.input_text,
            "output_text": r.output_text,
            "version_id": r.version_id,
            "version_tag": v.version_tag,
            "agent_name": a.name,
            "project_name": p.name
        })
    
    return list_items, total

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

def compare_versions(db: Session, version_a_id: int, version_b_id: int) -> schemas.VersionCompareSummary:
    ver_a = db.query(models.Version).filter(models.Version.id == version_a_id).first()
    ver_b = db.query(models.Version).filter(models.Version.id == version_b_id).first()
    
    if not ver_a or not ver_b:
        raise ValueError("One or both versions do not exist")
        
    metrics_a = calculate_version_metrics(db, version_a_id)
    metrics_b = calculate_version_metrics(db, version_b_id)
    
    runs_a = db.query(models.Run).filter(models.Run.version_id == version_a_id).all()
    runs_b = db.query(models.Run).filter(models.Run.version_id == version_b_id).all()
    
    # Group runs by input hash
    runs_a_by_hash = {r.input_hash: r for r in runs_a}
    runs_b_by_hash = {r.input_hash: r for r in runs_b}
    
    regressions_raw = []
    improvements_raw = []
    
    # 1. Regressions: Succeeded in A, but Failed in B (on the same input_hash)
    for i_hash, run_a in runs_a_by_hash.items():
        if run_a.success:
            run_b = runs_b_by_hash.get(i_hash)
            if run_b and not run_b.success:
                regressions_raw.append(run_b)
                
    # 2. Improvements: Failed in A, but Succeeded in B (on the same input_hash)
    for i_hash, run_a in runs_a_by_hash.items():
        if not run_a.success:
            run_b = runs_b_by_hash.get(i_hash)
            if run_b and run_b.success:
                improvements_raw.append(run_b)
                
    # Format regressions and improvements as RunListItems
    def to_run_list_item(r):
        v = r.version
        a = v.agent
        p = a.project
        return {
            "id": r.id,
            "timestamp": r.timestamp,
            "success": r.success,
            "latency_ms": r.latency_ms,
            "cost_cents": r.cost_cents,
            "input_hash": r.input_hash,
            "input_text": r.input_text,
            "output_text": r.output_text,
            "version_id": r.version_id,
            "version_tag": v.version_tag,
            "agent_name": a.name,
            "project_name": p.name
        }
        
    regressions = [to_run_list_item(r) for r in regressions_raw]
    improvements = [to_run_list_item(r) for r in improvements_raw]
    
    return {
        "version_a": ver_a.version_tag,
        "version_b": ver_b.version_tag,
        "summary_a": metrics_a,
        "summary_b": metrics_b,
        "regressions": regressions,
        "improvements": improvements
    }
