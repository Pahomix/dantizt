from typing import Dict, Any
from datetime import datetime, timedelta
import jwt
from app.core.config import settings

def create_token(
    subject: str | int,
    expires_delta: timedelta | None = None,
    claims: Dict[str, Any] | None = None
) -> str:
    """
    Create a JWT token
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    if claims:
        to_encode.update(claims)
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt
