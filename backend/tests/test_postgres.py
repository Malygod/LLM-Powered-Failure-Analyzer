"""Run against a migrated disposable PostgreSQL database in CI, never a user database."""
import os
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import jobs,crud,schemas
from app.database import normalize_url

@pytest.mark.skipif(not os.environ.get('TEST_POSTGRES_URL'),reason='Disposable PostgreSQL not configured')
def test_two_workers_cannot_claim_the_same_job():
    engine=create_engine(normalize_url(os.environ['TEST_POSTGRES_URL']))
    factory=sessionmaker(bind=engine)
    with factory() as db:
        run=schemas.IngestRunPayload(run_id=str(uuid4()),version='queue-test',agent_name='test',project_name='test',workspace_name='test',user_email='test@example.test',success=False,latency_ms=1,cost_cents=0)
        crud.ingest_runs(db,[run]);job=jobs.enqueue(db,run.run_id);job_id=job.id
    def claim():
        with factory() as db:
            item=jobs.claim(db)
            return item.id if item else None
    with ThreadPoolExecutor(max_workers=2) as workers:
        claimed=list(workers.map(lambda _:claim(),range(2)))
    assert claimed.count(job_id)==1
    engine.dispose()
