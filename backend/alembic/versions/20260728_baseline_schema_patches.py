"""baseline — schema managed by schema_patches.py until cutover

Revision ID: 20260728_baseline
Revises:
Create Date: 2026-07-28

Additive columns, indexes, and new tables are still applied at startup via
``db.schema_patches.apply_schema_patches`` (see ``init_db``). This revision
only records the Alembic version table so future migrations can chain here.
"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "20260728_baseline"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
