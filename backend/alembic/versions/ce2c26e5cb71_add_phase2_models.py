"""add_phase2_models

Revision ID: ce2c26e5cb71
Revises: 2dc6c7f1c4ac
Create Date: 2026-10-17 23:01:46.174477

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ce2c26e5cb71'
down_revision: Union[str, Sequence[str], None] = '2dc6c7f1c4ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def table_exists(name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return name in insp.get_table_names()


def column_exists(table: str, col: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = [c["name"] for c in insp.get_columns(table)]
    return col in cols


def upgrade() -> None:
    """Upgrade schema with safety checks for SQLite batch mode."""
    if not table_exists('merkle_roots'):
        op.create_table('merkle_roots',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('date', sa.String(length=10), nullable=False),
            sa.Column('root', sa.String(length=64), nullable=False),
            sa.Column('entry_count', sa.Integer(), nullable=False),
            sa.Column('max_entry_id', sa.Integer(), nullable=False),
            sa.Column('signature', sa.String(length=128), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('merkle_roots', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_merkle_roots_date'), ['date'], unique=True)
            batch_op.create_index(batch_op.f('ix_merkle_roots_id'), ['id'], unique=False)

    if not table_exists('signing_keys'):
        op.create_table('signing_keys',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('key_id', sa.String(length=64), nullable=False),
            sa.Column('public_key_hex', sa.String(length=64), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('signing_keys', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_signing_keys_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_signing_keys_key_id'), ['key_id'], unique=True)

    if not table_exists('ingest_drafts'):
        op.create_table('ingest_drafts',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('document_type', sa.String(length=20), nullable=False),
            sa.Column('image_ref', sa.String(length=255), nullable=False),
            sa.Column('extracted_json', sa.Text(), nullable=False),
            sa.Column('confidence_json', sa.Text(), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('reviewer_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('ingest_drafts', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_ingest_drafts_id'), ['id'], unique=False)

    if not table_exists('khatians'):
        op.create_table('khatians',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('plot_id', sa.Integer(), nullable=False),
            sa.Column('survey_type', sa.String(length=10), nullable=False),
            sa.Column('khatian_no', sa.String(length=50), nullable=False),
            sa.Column('dag_no', sa.String(length=50), nullable=False),
            sa.Column('area_decimal', sa.Float(), nullable=False),
            sa.Column('owners_json', sa.Text(), nullable=False),
            sa.Column('parent_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['parent_id'], ['khatians.id'], ),
            sa.ForeignKeyConstraint(['plot_id'], ['plots.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('khatians', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_khatians_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_khatians_plot_id'), ['plot_id'], unique=False)

    if table_exists('deeds') and not column_exists('deeds', 'price_bdt'):
        with op.batch_alter_table('deeds', schema=None) as batch_op:
            batch_op.add_column(sa.Column('price_bdt', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    if table_exists('deeds') and column_exists('deeds', 'price_bdt'):
        with op.batch_alter_table('deeds', schema=None) as batch_op:
            batch_op.drop_column('price_bdt')

    if table_exists('khatians'):
        with op.batch_alter_table('khatians', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_khatians_plot_id'))
            batch_op.drop_index(batch_op.f('ix_khatians_id'))
        op.drop_table('khatians')

    if table_exists('ingest_drafts'):
        with op.batch_alter_table('ingest_drafts', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_ingest_drafts_id'))
        op.drop_table('ingest_drafts')

    if table_exists('signing_keys'):
        with op.batch_alter_table('signing_keys', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_signing_keys_key_id'))
            batch_op.drop_index(batch_op.f('ix_signing_keys_id'))
        op.drop_table('signing_keys')

    if table_exists('merkle_roots'):
        with op.batch_alter_table('merkle_roots', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_merkle_roots_id'))
            batch_op.drop_index(batch_op.f('ix_merkle_roots_date'))
        op.drop_table('merkle_roots')
