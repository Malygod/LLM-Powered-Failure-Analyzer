"""Add trace semantics, benchmark cases and durable investigations."""
from alembic import op
import sqlalchemy as sa
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    for name, typ in [('payload_hash',sa.String()),('case_id',sa.String()),('model',sa.String()),('prompt_version',sa.String()),('source',sa.String())]:
        op.add_column('runs',sa.Column(name,typ,nullable=True))
    op.create_index('ix_runs_case_id','runs',['case_id'])
    for name,typ in [('span_id',sa.String()),('parent_span_id',sa.String()),('started_at',sa.DateTime()),('ended_at',sa.DateTime()),('kind',sa.String()),('status',sa.String()),('attributes',sa.JSON())]:
        op.add_column('steps',sa.Column(name,typ,nullable=True))
    op.add_column('evaluations',sa.Column('check_version',sa.String(),nullable=True))
    op.add_column('evaluations',sa.Column('method',sa.String(),nullable=True))
    op.create_table('evaluation_cases',sa.Column('id',sa.String(),primary_key=True),sa.Column('check_version',sa.String(),nullable=False),sa.Column('definition',sa.JSON(),nullable=False))
    op.create_table('investigations',
        sa.Column('id',sa.String(),primary_key=True),
        sa.Column('run_id',sa.String(),sa.ForeignKey('runs.id'),nullable=False),
        sa.Column('dedupe_key',sa.String(),unique=True,nullable=False),
        sa.Column('status',sa.String(),nullable=False),
        sa.Column('attempts',sa.Integer(),nullable=False),
        sa.Column('available_at',sa.DateTime(),nullable=False),
        sa.Column('lease_until',sa.DateTime()),sa.Column('lease_token',sa.String()),
        sa.Column('created_at',sa.DateTime(),nullable=False),sa.Column('updated_at',sa.DateTime(),nullable=False),
        sa.Column('error_code',sa.String()),sa.Column('error_message',sa.Text()),
        sa.Column('report',sa.JSON()),sa.Column('checkpoint',sa.JSON()))
    op.create_index('ix_investigations_status','investigations',['status'])


def downgrade():
    raise RuntimeError('Destructive downgrade disabled; restore a verified backup instead.')
