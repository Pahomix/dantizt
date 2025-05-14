from pydantic import BaseModel, Field


class ResetPassword(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
