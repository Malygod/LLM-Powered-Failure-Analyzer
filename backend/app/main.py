from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app import models, schemas, crud, database
from app.config import settings
from app.jobs import enqueue

app = FastAPI(title="Causelab API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins,
                  allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


def live_access():
    if not settings.live_enabled:
        raise HTTPException(403, "Live mode is disabled. Use the recorded demo or enable LIVE_ENABLED locally.")


@app.get('/')
def health_check(db: Session = Depends(database.get_db)):
    try:
        db.execute(text('SELECT 1'))
        revision = db.execute(text('SELECT version_num FROM alembic_version')).scalar()
        if revision != '0002':
            raise RuntimeError('Migration required')
    except Exception:
        raise HTTPException(503, 'Database unavailable or migrations pending')
    return {"status": "healthy", "service": "Causelab API"}


@app.post('/api/ingest', dependencies=[Depends(live_access)])
def ingest_traces(payload: list[schemas.IngestRunPayload], db: Session = Depends(database.get_db)):
    if len(payload) > 100:
        raise HTTPException(413, 'Maximum 100 runs per batch')
    try:
        runs = crud.ingest_runs(db, payload)
        return {"status": "success", "message": f"Accepted {len(runs)} traces", "run_ids": [r.id for r in runs]}
    except (crud.ConflictError, IntegrityError):
        db.rollback()
        raise HTTPException(409, 'Run conflict; retry identical content or use a new run ID')
    except Exception:
        db.rollback()
        raise


@app.get('/api/projects', response_model=list[schemas.ProjectResponse], dependencies=[Depends(live_access)])
def projects(db: Session = Depends(database.get_db)):
    return crud.get_projects(db)


@app.get('/api/agents', response_model=list[schemas.AgentResponse], dependencies=[Depends(live_access)])
def agents(project_id: int | None = None, db: Session = Depends(database.get_db)):
    return crud.get_agents(db, project_id)


@app.get('/api/versions', response_model=list[schemas.VersionResponse], dependencies=[Depends(live_access)])
def versions(agent_id: int | None = None, db: Session = Depends(database.get_db)):
    return crud.get_versions(db, agent_id)


@app.get('/api/runs', dependencies=[Depends(live_access)])
def runs(version_id: int | None = None, success: bool | None = None, agent_id: int | None = None,
         search: str | None = None, skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
         db: Session = Depends(database.get_db)):
    rows, total = crud.get_runs(db, version_id, success, skip, limit, agent_id, search)
    return {"runs": rows, "total": total, "skip": skip, "limit": limit,
            "stats": crud.aggregate(db, version_id, success, agent_id, search)}


@app.get('/api/runs/{run_id}', response_model=schemas.RunDetailResponse, dependencies=[Depends(live_access)])
def detail(run_id: str, db: Session = Depends(database.get_db)):
    run = crud.get_run_detail(db, run_id)
    if not run:
        raise HTTPException(404, 'Trace not found')
    result = schemas.RunDetailResponse.model_validate(run).model_dump()
    return {**result, **crud.run_item(run), 'steps': sorted(result['steps'], key=lambda s: (s['step_order'], s['id']))}


@app.get('/api/compare', response_model=schemas.VersionCompareSummary, dependencies=[Depends(live_access)])
def compare(version_a: int, version_b: int, db: Session = Depends(database.get_db)):
    try:
        return crud.compare_versions(db, version_a, version_b)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post('/api/runs/{run_id}/investigations', status_code=202, response_model=schemas.InvestigationResponse, dependencies=[Depends(live_access)])
def investigate(run_id: str, db: Session = Depends(database.get_db)):
    run = db.get(models.Run, run_id)
    if not run:
        raise HTTPException(404, 'Trace not found')
    if run.success and crud.quality(run) != 'failed':
        raise HTTPException(400, 'Select an execution failure or a failed quality check')
    return enqueue(db, run_id)


@app.get('/api/investigations/{job_id}', response_model=schemas.InvestigationResponse, dependencies=[Depends(live_access)])
def investigation(job_id: str, db: Session = Depends(database.get_db)):
    job = db.get(models.Investigation, job_id)
    if not job:
        raise HTTPException(404, 'Investigation not found')
    return job


@app.post('/api/runs/{run_id}/analyze', status_code=202, response_model=schemas.InvestigationResponse, dependencies=[Depends(live_access)], deprecated=True)
def legacy_analysis(run_id: str, db: Session = Depends(database.get_db)):
    """Compatibility route: diagnostics now return an asynchronous investigation job."""
    return investigate(run_id, db)
