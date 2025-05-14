from datetime import datetime
from sqlalchemy import Column, DateTime, func

class TimestampMixin:
    """Миксин для добавления полей created_at и updated_at"""
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
