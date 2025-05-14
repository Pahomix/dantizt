"""add scheduled_for to notifications

Revision ID: 20231223_add_scheduled_for
Revises: 
Create Date: 2023-12-23 01:49:11.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20231223_add_scheduled_for'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем колонку scheduled_for
    op.add_column('notifications', sa.Column('scheduled_for', sa.DateTime(timezone=True), nullable=True))
    op.add_column('notifications', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))
    
    # Создаем индекс для scheduled_for
    op.create_index('ix_notifications_scheduled_for', 'notifications', ['scheduled_for'])


def downgrade() -> None:
    # Удаляем индекс
    op.drop_index('ix_notifications_scheduled_for')
    
    # Удаляем колонку
    op.drop_column('notifications', 'scheduled_for')
    op.drop_column('notifications', 'updated_at')
