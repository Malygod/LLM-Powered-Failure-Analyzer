from app.timeutils import utcnow
"""Database queue with leases, fencing tokens, and bounded retry."""
from datetime import datetime, timedelta
from uuid import uuid4
from sqlalchemy import or_, and_, update
from sqlalchemy.exc import IntegrityError
from app.models import Investigation

MAX_ATTEMPTS = 3
LEASE_SECONDS = 240


def enqueue(db, run_id):
    key = f'{run_id}:investigator/1'
    existing = db.query(Investigation).filter_by(dedupe_key=key).first()
    if existing:
        return existing
    job = Investigation(id=str(uuid4()), run_id=run_id, dedupe_key=key)
    db.add(job)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return db.query(Investigation).filter_by(dedupe_key=key).one()
    db.refresh(job)
    return job


def claim(db, now=None):
    now = now or utcnow()
    expired = and_(Investigation.status == 'running', Investigation.lease_until < now)
    db.query(Investigation).filter(expired, Investigation.attempts >= MAX_ATTEMPTS).update(
        dict(status='failed', error_code='attempts_exhausted', error_message='Worker lease expired after the final attempt.', updated_at=now))
    eligible = and_(Investigation.attempts < MAX_ATTEMPTS,
                    or_(and_(Investigation.status == 'queued', Investigation.available_at <= now), expired))
    query = db.query(Investigation).filter(eligible).order_by(Investigation.created_at)
    if db.bind.dialect.name == 'postgresql':
        query = query.with_for_update(skip_locked=True)
    job = query.first()
    if not job:
        db.commit()
        return None
    token = str(uuid4())
    changed = db.execute(update(Investigation).where(Investigation.id == job.id, eligible).values(
        status='running', attempts=Investigation.attempts + 1, lease_token=token,
        lease_until=now + timedelta(seconds=LEASE_SECONDS), updated_at=now))
    db.commit()
    if not changed.rowcount:
        return None
    db.refresh(job)
    return job


def checkpoint(db, job, data):
    changed = db.execute(update(Investigation).where(Investigation.id == job.id,
        Investigation.lease_token == job.lease_token, Investigation.status == 'running').values(checkpoint=data, updated_at=utcnow()))
    db.commit()
    if not changed.rowcount:
        raise RuntimeError('Investigation lease lost')


def finish(db, job, report=None, error=None, transient=False):
    now = utcnow()
    retry = error and transient and job.attempts < MAX_ATTEMPTS
    values = dict(status='queued' if retry else ('failed' if error else 'completed'),
                  report=report, error_code=getattr(error, 'code', 'internal_error') if error else None,
                  error_message=str(error)[:500] if error else None,
                  available_at=now + timedelta(seconds=2 ** job.attempts), updated_at=now,
                  lease_until=None, lease_token=None)
    changed = db.execute(update(Investigation).where(Investigation.id == job.id,
        Investigation.lease_token == job.lease_token, Investigation.status == 'running').values(**values))
    db.commit()
    return bool(changed.rowcount)
