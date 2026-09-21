"""store attendance business date as DATE

Revision ID: 8d2e4f6a9b11
Revises: 7c1d9e2f4a10
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "8d2e4f6a9b11"
down_revision: Union[str, None] = "7c1d9e2f4a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    with op.batch_alter_table("attendance_sessions") as batch_op:
        batch_op.alter_column("date", existing_type=sa.DateTime(), type_=sa.Date(), existing_nullable=False)
    op.create_index(
        "uq_open_attendance_session_per_user",
        "attendance_sessions",
        ["organization_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("logout_at IS NULL"),
        sqlite_where=sa.text("logout_at IS NULL"),
    )

def downgrade() -> None:
    op.drop_index("uq_open_attendance_session_per_user", table_name="attendance_sessions")
    with op.batch_alter_table("attendance_sessions") as batch_op:
        batch_op.alter_column("date", existing_type=sa.Date(), type_=sa.DateTime(), existing_nullable=False)
