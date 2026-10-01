import logging
import time
from app.database import SessionLocal
from app.jobs import claim, finish
from app.analyzer import investigate, InvestigationError

logger = logging.getLogger('tracehaven.worker')


def tick():
    with SessionLocal() as db:
        job = claim(db)
        if job is None:
            return False
        try:
            report = investigate(db, job)
            finish(db, job, report=report)
        except InvestigationError as exc:
            finish(db, job, error=exc, transient=exc.transient)
        except Exception:
            db.rollback()
            logger.exception('Investigation failed: %s', job.id)
            finish(db, job, error=InvestigationError('internal_error', 'Worker failed; inspect local server logs.'))
        return True


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    while True:
        try:
            if not tick():
                time.sleep(1)
        except Exception:
            logger.exception('Worker database connection failed')
            time.sleep(5)
