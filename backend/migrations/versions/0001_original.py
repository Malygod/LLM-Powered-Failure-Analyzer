"""Adopt the original schema without deleting existing prototype data."""
from alembic import op
import sqlalchemy as sa
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if 'users' not in existing:
        op.create_table('users',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False, unique=False),
            sa.Column('email', sa.String(), primary_key=False, nullable=False, unique=True),
            sa.Column('created_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
        )
        op.create_index('ix_users_id', 'users', ['id'], unique=False)
        op.create_index('ix_users_email', 'users', ['email'], unique=True)
    if 'workspaces' not in existing:
        op.create_table('workspaces',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False, unique=False),
            sa.Column('name', sa.String(), primary_key=False, nullable=False, unique=False),
            sa.Column('created_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=False),
        )
        op.create_index('ix_workspaces_id', 'workspaces', ['id'], unique=False)
    if 'projects' not in existing:
        op.create_table('projects',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False, unique=False),
            sa.Column('name', sa.String(), primary_key=False, nullable=False, unique=False),
            sa.Column('created_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
            sa.Column('workspace_id', sa.Integer(), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=False),
        )
        op.create_index('ix_projects_id', 'projects', ['id'], unique=False)
    if 'agents' not in existing:
        op.create_table('agents',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False, unique=False),
            sa.Column('name', sa.String(), primary_key=False, nullable=False, unique=False),
            sa.Column('created_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
            sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=False),
        )
        op.create_index('ix_agents_id', 'agents', ['id'], unique=False)
    if 'versions' not in existing:
        op.create_table('versions',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False, unique=False),
            sa.Column('version_tag', sa.String(), primary_key=False, nullable=False, unique=False),
            sa.Column('created_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
            sa.Column('agent_id', sa.Integer(), sa.ForeignKey('agents.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=False),
        )
        op.create_index('ix_versions_id', 'versions', ['id'], unique=False)
    if 'reports' not in existing:
        op.create_table('reports',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False, unique=False),
            sa.Column('version_a_id', sa.Integer(), sa.ForeignKey('versions.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=False),
            sa.Column('version_b_id', sa.Integer(), sa.ForeignKey('versions.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=False),
            sa.Column('summary', sa.Text(), primary_key=False, nullable=False, unique=False),
            sa.Column('status', sa.String(), primary_key=False, nullable=False, unique=False),
            sa.Column('details', sa.Text(), primary_key=False, nullable=True, unique=False),
            sa.Column('created_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
        )
        op.create_index('ix_reports_id', 'reports', ['id'], unique=False)
    if 'runs' not in existing:
        op.create_table('runs',
            sa.Column('id', sa.String(), primary_key=True, nullable=False, unique=False),
            sa.Column('timestamp', sa.DateTime(), primary_key=False, nullable=True, unique=False),
            sa.Column('success', sa.Boolean(), primary_key=False, nullable=True, unique=False),
            sa.Column('latency_ms', sa.Float(), primary_key=False, nullable=True, unique=False),
            sa.Column('cost_cents', sa.Float(), primary_key=False, nullable=True, unique=False),
            sa.Column('input_hash', sa.String(), primary_key=False, nullable=False, unique=False),
            sa.Column('input_text', sa.Text(), primary_key=False, nullable=True, unique=False),
            sa.Column('output_text', sa.Text(), primary_key=False, nullable=True, unique=False),
            sa.Column('created_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
            sa.Column('version_id', sa.Integer(), sa.ForeignKey('versions.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=False),
        )
        op.create_index('ix_runs_id', 'runs', ['id'], unique=False)
        op.create_index('ix_runs_input_hash', 'runs', ['input_hash'], unique=False)
    if 'evaluations' not in existing:
        op.create_table('evaluations',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False, unique=False),
            sa.Column('evaluator_name', sa.String(), primary_key=False, nullable=False, unique=False),
            sa.Column('score', sa.Float(), primary_key=False, nullable=False, unique=False),
            sa.Column('feedback', sa.Text(), primary_key=False, nullable=True, unique=False),
            sa.Column('created_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
            sa.Column('run_id', sa.String(), sa.ForeignKey('runs.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=False),
        )
        op.create_index('ix_evaluations_id', 'evaluations', ['id'], unique=False)
    if 'failure_analyses' not in existing:
        op.create_table('failure_analyses',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False, unique=False),
            sa.Column('error_summary', sa.Text(), primary_key=False, nullable=False, unique=False),
            sa.Column('suggested_fix', sa.Text(), primary_key=False, nullable=False, unique=False),
            sa.Column('analyzed_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
            sa.Column('run_id', sa.String(), sa.ForeignKey('runs.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=True),
        )
        op.create_index('ix_failure_analyses_id', 'failure_analyses', ['id'], unique=False)
    if 'metrics' not in existing:
        op.create_table('metrics',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False, unique=False),
            sa.Column('metric_name', sa.String(), primary_key=False, nullable=False, unique=False),
            sa.Column('metric_value', sa.Float(), primary_key=False, nullable=False, unique=False),
            sa.Column('created_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
            sa.Column('run_id', sa.String(), sa.ForeignKey('runs.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=False),
        )
        op.create_index('ix_metrics_id', 'metrics', ['id'], unique=False)
    if 'steps' not in existing:
        op.create_table('steps',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False, unique=False),
            sa.Column('step_name', sa.String(), primary_key=False, nullable=False, unique=False),
            sa.Column('input', sa.Text(), primary_key=False, nullable=True, unique=False),
            sa.Column('output', sa.Text(), primary_key=False, nullable=True, unique=False),
            sa.Column('tokens', sa.Integer(), primary_key=False, nullable=True, unique=False),
            sa.Column('latency_ms', sa.Float(), primary_key=False, nullable=True, unique=False),
            sa.Column('step_order', sa.Integer(), primary_key=False, nullable=True, unique=False),
            sa.Column('created_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
            sa.Column('run_id', sa.String(), sa.ForeignKey('runs.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=False),
        )
        op.create_index('ix_steps_id', 'steps', ['id'], unique=False)
    if 'errors' not in existing:
        op.create_table('errors',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False, unique=False),
            sa.Column('error_type', sa.String(), primary_key=False, nullable=True, unique=False),
            sa.Column('message', sa.Text(), primary_key=False, nullable=False, unique=False),
            sa.Column('stack_trace', sa.Text(), primary_key=False, nullable=True, unique=False),
            sa.Column('created_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
            sa.Column('run_id', sa.String(), sa.ForeignKey('runs.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=False),
            sa.Column('step_id', sa.Integer(), sa.ForeignKey('steps.id', ondelete='CASCADE'), primary_key=False, nullable=True, unique=False),
        )
        op.create_index('ix_errors_id', 'errors', ['id'], unique=False)
    if 'tool_calls' not in existing:
        op.create_table('tool_calls',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False, unique=False),
            sa.Column('tool_name', sa.String(), primary_key=False, nullable=False, unique=False),
            sa.Column('tool_input', sa.Text(), primary_key=False, nullable=True, unique=False),
            sa.Column('tool_output', sa.Text(), primary_key=False, nullable=True, unique=False),
            sa.Column('status', sa.String(), primary_key=False, nullable=True, unique=False),
            sa.Column('latency_ms', sa.Float(), primary_key=False, nullable=True, unique=False),
            sa.Column('created_at', sa.DateTime(), primary_key=False, nullable=True, unique=False),
            sa.Column('step_id', sa.Integer(), sa.ForeignKey('steps.id', ondelete='CASCADE'), primary_key=False, nullable=False, unique=False),
        )
        op.create_index('ix_tool_calls_id', 'tool_calls', ['id'], unique=False)

def downgrade():
    raise RuntimeError('Destructive downgrade disabled; restore a verified backup instead.')
