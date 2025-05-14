"""add inn to patient

Revision ID: add_inn_to_patient
Revises: 
Create Date: 2025-04-08 20:12:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_inn_to_patient'
down_revision = None  # Замените на ID последней миграции
branch_labels = None
depends_on = None


def upgrade():
    # Добавляем колонку inn в таблицу patients
    op.add_column('patients', sa.Column('inn', sa.String(12), nullable=True, comment="ИНН пациента для налоговых документов"))


def downgrade():
    # Удаляем колонку inn из таблицы patients
    op.drop_column('patients', 'inn')
