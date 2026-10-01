"""Import the canonical recorded dataset into a migrated local database."""
import json
import sys
from app.database import SessionLocal
from app.models import EvaluationCase
from app.evaluation import CASES, CHECK_VERSION
from app.schemas import IngestRunPayload
from app.crud import ingest_runs


def seed(path):
    with SessionLocal() as db:
        for case in CASES:
            if not db.get(EvaluationCase, case['id']):
                db.add(EvaluationCase(id=case['id'], check_version=CHECK_VERSION, definition=case))
        db.flush()
        ingest_runs(db,[IngestRunPayload.model_validate(p) for p in json.loads(open(path).read())])


if __name__=='__main__':
    seed(sys.argv[1] if len(sys.argv)>1 else '../seed_data.json')
    print('Recorded traces and evaluation cases imported. Identical imports are safe to repeat.')
