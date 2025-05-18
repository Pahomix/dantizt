from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LogBase(BaseModel):
    table_name: str
    action_type: str
    record_id: int
    old_data: Optional[str] = None
    new_data: Optional[str] = None
    created_at: datetime

class LogResponse(LogBase):
    id: int

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, log):
        return cls(
            id=log.id,
            table_name=log.table_name,
            action_type=log.action_type,
            record_id=log.record_id,
            old_data=log.old_data,
            new_data=log.new_data,
            created_at=log.created_at
        )

class LogList(BaseModel):
    items: List[LogResponse]
    total: int
    page: int
    size: int
