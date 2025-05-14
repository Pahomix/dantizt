from pydantic import BaseModel

class AllergyBase(BaseModel):
    name: str
    description: str | None = None

class AllergyCreate(AllergyBase):
    pass

class AllergyUpdate(AllergyBase):
    pass

class AllergyInDB(AllergyBase):
    id: int

    class Config:
        from_attributes = True 