from pydantic import BaseModel, condecimal, validator
from typing import Optional
from decimal import Decimal
from app.db.models import ServiceCategory

class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    cost: condecimal(max_digits=10, decimal_places=2)
    # duration: int  # длительность в минутах - удалено, так как длительность определяется специализацией врача
    category: ServiceCategory

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(ServiceBase):
    name: Optional[str] = None
    cost: Optional[condecimal(max_digits=10, decimal_places=2)] = None
    # duration: Optional[int] = None  # удалено

class ServiceInDB(ServiceBase):
    id: int

    class Config:
        from_attributes = True