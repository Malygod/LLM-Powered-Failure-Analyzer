from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from app import models, schemas, crud, database, analyzer

# Auto-create tables on startup (perfect for zero-setup demo!)
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Sira AI MVP API Platform", version="1.0.0")

# Setup CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For prototype, allow all origins. Can be locked down later.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "healthy", "service": "Sira AI API"}

@app.post("/api/ingest", response_model=dict)
def ingest_traces(payload: List[schemas.IngestRunPayload], db: Session = Depends(database.get_db)):
    try:
        runs = crud.ingest_runs(db, payload)
        return {"status": "success", "message": f"Successfully ingested {len(runs)} run traces"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ingestion failed: {str(e)}")

@app.get("/api/projects", response_model=List[schemas.ProjectResponse])
def get_projects(db: Session = Depends(database.get_db)):
    return crud.get_projects(db)

@app.get("/api/agents", response_model=List[schemas.AgentResponse])
def get_agents(project_id: Optional[int] = None, db: Session = Depends(database.get_db)):
    return crud.get_agents(db, project_id=project_id)

@app.get("/api/versions", response_model=List[schemas.VersionResponse])
def get_versions(agent_id: Optional[int] = None, db: Session = Depends(database.get_db)):
    return crud.get_versions(db, agent_id=agent_id)

@app.get("/api/runs")
def get_runs(
    version_id: Optional[int] = None,
    success: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(database.get_db)
):
    runs, total = crud.get_runs(db, version_id=version_id, success=success, skip=skip, limit=limit)
    return {
        "runs": runs,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@app.get("/api/runs/{run_id}", response_model=schemas.RunDetailResponse)
def get_run_detail(run_id: str, db: Session = Depends(database.get_db)):
    run = crud.get_run_detail(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run trace not found")
    return run

@app.get("/api/compare", response_model=schemas.VersionCompareSummary)
def compare_versions(
    version_a: int = Query(..., description="ID of Version A"),
    version_b: int = Query(..., description="ID of Version B"),
    db: Session = Depends(database.get_db)
):
    try:
        comparison = crud.compare_versions(db, version_a, version_b)
        return comparison
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")

@app.post("/api/runs/{run_id}/analyze", response_model=schemas.FailureAnalysisResponse)
def analyze_run_failure(
    run_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db)
):
    # Check if run exists and is failed
    run = crud.get_run_detail(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run trace not found")
    if run.success:
        raise HTTPException(status_code=400, detail="Cannot analyze a successful run")
        
    # Trigger LLM analysis
    try:
        # We can either run it synchronously for instant dashboard feedback in the prototype,
        # or in background_tasks. Let's do it synchronously here for immediate UI response.
        # This keeps the prototype experience extremely responsive!
        analysis = analyzer.analyze_failure(db, run_id)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
