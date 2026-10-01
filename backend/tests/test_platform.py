from app.timeutils import utcnow
from datetime import datetime, timedelta
from types import SimpleNamespace
import json
import subprocess
import os
from pathlib import Path
import pytest
from sqlalchemy import create_engine, text
from fastapi.testclient import TestClient
from app import crud, schemas, models, jobs
from app.evaluation import CASES, simulate, evaluate, suite
from app.analyzer import investigate, InvestigationError


def test_idempotency_preserves_investigation(db,payload):
    run = crud.ingest_runs(db,[payload])[0]
    job = jobs.enqueue(db,run.id)
    assert crud.ingest_runs(db,[payload])[0].id == run.id
    assert db.query(models.Run).count() == 1
    assert db.get(models.Investigation,job.id)
    with pytest.raises(crud.ConflictError):
        crud.ingest_runs(db,[payload.model_copy(update={'output_text':'changed'})])
    db.rollback()
    assert db.get(models.Run,run.id).output_text == 'unsupported'


def test_batch_rolls_back_on_conflict(db,payload):
    crud.ingest_runs(db,[payload])
    with pytest.raises(crud.ConflictError):
        crud.ingest_runs(db,[payload.model_copy(update={'run_id':'run-2'}),payload.model_copy(update={'output_text':'changed'})])
    db.rollback()
    assert db.query(models.Run).count()==1


def test_statistics_cover_all_pages(db,payload):
    crud.ingest_runs(db,[payload.model_copy(update={'run_id':str(i),'success':i<10,'latency_ms':100 if i<10 else 900}) for i in range(20)])
    rows,total=crud.get_runs(db,limit=5)
    assert len(rows)==5 and total==20
    assert crud.aggregate(db)==dict(total=20,success_rate=50,avg_latency=500,total_cost=20)
    assert crud.aggregate(db,success=False)['avg_latency']==900


def test_comparison_retains_repetitions_and_unmatched(db,payload):
    rows=[payload.model_copy(update={'run_id':'a1','evaluations':[schemas.EvaluationCreate(evaluator_name='facts',score=1)]}),
          payload.model_copy(update={'run_id':'a2'}),
          payload.model_copy(update={'run_id':'b1','version':'v2'}),
          payload.model_copy(update={'run_id':'b2','version':'v2'}),
          payload.model_copy(update={'run_id':'b3','version':'v2','case_id':'other'})]
    crud.ingest_runs(db,rows)
    versions=crud.get_versions(db)
    result=crud.compare_versions(db,versions[0].id,versions[1].id)
    assert len(result['pairs'])==2
    assert len(result['regressions'])==1  # successful execution, failed answer quality
    assert result['unmatched_b']==['b3']
    assert result['unmatched_a']==[]


def test_legacy_hash_pairing_and_agent_boundary(db,payload):
    crud.ingest_runs(db,[payload.model_copy(update={'case_id':None}),payload.model_copy(update={'run_id':'b','version':'v2','case_id':None}),payload.model_copy(update={'run_id':'c','agent_name':'other'})])
    versions=crud.get_versions(db)
    assert len(crud.compare_versions(db,versions[0].id,versions[1].id)['pairs'])==1
    with pytest.raises(ValueError):crud.compare_versions(db,versions[0].id,versions[2].id)


def test_span_cycles_and_missing_parents_rejected(payload):
    for steps in [[dict(step_name='a',span_id='a',parent_span_id='a')],[dict(step_name='a',span_id='a',parent_span_id='missing')]]:
        with pytest.raises(ValueError):schemas.IngestRunPayload.model_validate({**payload.model_dump(),'steps':steps})


def test_job_deduplication_and_lease_recovery(db,payload):
    crud.ingest_runs(db,[payload])
    job=jobs.enqueue(db,payload.run_id)
    assert jobs.enqueue(db,payload.run_id).id==job.id
    claimed=jobs.claim(db)
    old_token=claimed.lease_token
    assert jobs.claim(db) is None
    claimed=jobs.claim(db,utcnow()+timedelta(seconds=250))
    assert claimed.attempts==2 and claimed.lease_token!=old_token
    stale=SimpleNamespace(id=claimed.id,lease_token=old_token,attempts=1)
    assert not jobs.finish(db,stale,report={'invalid':True})
    assert jobs.finish(db,claimed,report={'done':True})
    assert jobs.claim(db) is None


def test_final_expired_lease_fails(db,payload):
    crud.ingest_runs(db,[payload]);job=jobs.enqueue(db,payload.run_id)
    job.status='running';job.attempts=3;job.lease_until=utcnow()-timedelta(seconds=1);db.commit()
    assert jobs.claim(db) is None
    db.refresh(job);assert job.status=='failed'


PROPOSAL={'probable_cause':'Incomplete evidence','evidence_span_ids':['retrieve'],'uncertainty':'Controlled benchmark only','prompt':'Use evidence only. Abstain if facts cannot be verified. Cite document identifiers.','retrieval_top_k':3,'retry_count':1}
class FakeClient:
    def __init__(self, proposal=PROPOSAL, bad_candidate=False):
        self.chat=SimpleNamespace(completions=self)
        self.calls=0;self.proposal=proposal;self.bad_candidate=bad_candidate
    def create(self, **kwargs):
        self.calls+=1
        if self.calls==1:
            content=json.dumps(self.proposal)
        else:
            case=CASES[self.calls-2]
            content=json.dumps({'answer':'unlimited HACKED'} if self.bad_candidate else {'answer':simulate(case,'repaired')['answer']})
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))],usage=SimpleNamespace(total_tokens=10))


def test_bounded_investigation_and_regression_visibility(db,payload):
    crud.ingest_runs(db,[payload]);jobs.enqueue(db,payload.run_id);job=jobs.claim(db)
    client=FakeClient(bad_candidate=True)
    report=investigate(db,job,client)
    assert client.calls==21
    assert report['source']=='live'
    assert len(report['new_regressions'])==8
    assert report['remaining_failures']
    assert report['model_calls']==21
    assert 'No production changes' in report['decision']


def test_valid_candidate_report(db,payload):
    crud.ingest_runs(db,[payload]);jobs.enqueue(db,payload.run_id);job=jobs.claim(db)
    report=investigate(db,job,FakeClient())
    assert len(report['after'])==20
    assert not report['remaining_failures']


@pytest.mark.parametrize('proposal', [{}, {**PROPOSAL,'evidence_span_ids':['invented']},{**PROPOSAL,'retrieval_top_k':999}])
def test_invalid_proposals_never_run_candidate(db,payload,proposal):
    crud.ingest_runs(db,[payload]);jobs.enqueue(db,payload.run_id);job=jobs.claim(db);client=FakeClient(proposal)
    with pytest.raises(InvestigationError) as err:investigate(db,job,client)
    assert err.value.code in ('malformed_model_output','invalid_evidence')
    assert client.calls==1


def test_exhausted_budget_does_not_call_provider(db,payload):
    crud.ingest_runs(db,[payload]);jobs.enqueue(db,payload.run_id);job=jobs.claim(db)
    job.checkpoint={'calls':24,'deadline':(utcnow()+timedelta(seconds=60)).isoformat(),'results':[]};db.commit()
    client=FakeClient()
    with pytest.raises(InvestigationError,match='budget'):investigate(db,job,client)
    assert client.calls==0


def test_provider_missing_is_failure_not_mock(db,payload,monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings,'openai_api_key',None)
    crud.ingest_runs(db,[payload]);jobs.enqueue(db,payload.run_id);job=jobs.claim(db)
    with pytest.raises(InvestigationError) as exc:investigate(db,job)
    assert exc.value.code=='provider_not_configured'
    assert job.report is None


def test_fixtures_injection_and_bad_repair():
    assert len(CASES)==20
    assert sum(c['passed'] for c in suite('faulty'))==8
    assert all(c['passed'] for c in suite('repaired'))
    malicious=next(c for c in CASES if c['category']=='injection')
    assert not evaluate(malicious,simulate(malicious,'faulty'))['passed']
    assert evaluate(malicious,simulate(malicious,'repaired'))['passed']
    normal=CASES[0]
    abstention=simulate(normal,'repaired');abstention['answer']='I cannot verify this'
    assert not evaluate(normal,abstention)['passed']


def test_api_access_and_errors(db,payload,monkeypatch):
    from app.main import app
    from app.database import get_db
    from app.config import settings
    app.dependency_overrides[get_db]=lambda:db
    with TestClient(app) as client:
        assert client.get('/api/debug').status_code==404
        monkeypatch.setattr(settings,'live_enabled',False)
        assert client.get('/api/runs').status_code==403
        monkeypatch.setattr(settings,'live_enabled',True)
        assert client.post('/api/ingest',json=[payload.model_dump(mode='json')]).status_code==200
        response=client.post('/api/runs/run-1/investigations')
        assert response.status_code==202
        assert client.get('/api/investigations/'+response.json()['id']).json()['status']=='queued'
        assert client.get('/api/runs/run-1').json()['quality']=='failed'
        assert client.get('/api/runs?limit=0').status_code==422
        altered=payload.model_dump(mode='json');altered['output_text']='changed'
        assert client.post('/api/ingest',json=[altered]).status_code==409
    app.dependency_overrides.clear()


def test_migration_preserves_legacy_data(tmp_path):
    import sys
    root=Path(__file__).resolve().parents[1]
    url=f'sqlite:///{tmp_path}/legacy.db'
    env={**os.environ,'DATABASE_URL':url}
    command=[sys.executable,'-m','alembic','-c',str(root/'alembic.ini'),'upgrade']
    subprocess.run(command+['0001'],check=True,env=env,capture_output=True)
    engine=create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO users (id,email) VALUES (1,'legacy@example.test')"))
        conn.execute(text("INSERT INTO workspaces (id,name,user_id) VALUES (1,'Legacy',1)"))
        conn.execute(text("INSERT INTO projects (id,name,workspace_id) VALUES (1,'Legacy',1)"))
        conn.execute(text("INSERT INTO agents (id,name,project_id) VALUES (1,'Legacy',1)"))
        conn.execute(text("INSERT INTO versions (id,version_tag,agent_id) VALUES (1,'v1',1)"))
        conn.execute(text("INSERT INTO runs (id,input_hash,version_id) VALUES ('legacy','hash',1)"))
        conn.execute(text("INSERT INTO failure_analyses (id,run_id,error_summary,suggested_fix) VALUES (1,'legacy','saved','preserve me')"))
        conn.execute(text('DROP TABLE alembic_version')) # adoption of an unversioned prototype
    subprocess.run(command+['head'],check=True,env=env,capture_output=True)
    with engine.connect() as conn:
        assert conn.execute(text('SELECT suggested_fix FROM failure_analyses')).scalar()=='preserve me'
        assert conn.execute(text("SELECT payload_hash FROM runs WHERE id='legacy'")).scalar() is None
        assert conn.execute(text('SELECT version_num FROM alembic_version')).scalar()=='0002'
    engine.dispose()
