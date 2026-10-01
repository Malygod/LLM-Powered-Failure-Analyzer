import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f'sqlite:///{tmp_path}/test.db')
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as session:
        yield session
    engine.dispose()


@pytest.fixture
def payload():
    from app.schemas import IngestRunPayload
    return IngestRunPayload(run_id='run-1',version='v1',agent_name='Agent',project_name='Project',workspace_name='Workspace',user_email='engineer@example.test',success=True,latency_ms=100,cost_cents=1,input_text='question',output_text='unsupported',case_id='knowledge-09',steps=[dict(step_name='retrieve',span_id='retrieve',kind='retrieval',input='query',output='document')],evaluations=[dict(evaluator_name='facts',score=0)])
