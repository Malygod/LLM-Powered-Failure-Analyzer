from alembic import context
from sqlalchemy import create_engine
from app.config import settings
from app.models import Base
from app.database import normalize_url

url = normalize_url(settings.database_url)
if context.is_offline_mode():
    raise RuntimeError('Use an online migration so the legacy schema can be inspected safely.')
else:
    with create_engine(url).connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()
