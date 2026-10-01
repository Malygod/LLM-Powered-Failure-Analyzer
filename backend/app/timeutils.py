from datetime import datetime, timezone


def utcnow():
    """UTC wall time, stored without timezone for compatibility with the legacy SQL schema."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
