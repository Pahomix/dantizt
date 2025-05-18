from datetime import datetime
from pydantic import BaseModel

class BackupBase(BaseModel):
    filename: str
    created_at: datetime
    size_bytes: int
    size_human: str

class BackupList(BaseModel):
    items: list[BackupBase]
    total: int
