from datetime import datetime, timedelta
from typing import Optional, Union, List, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings
from app.core.utils import get_password_hash
from fastapi import Request, Depends, HTTPException, status, Response
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Константы для JWT
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
ALGORITHM = "HS256"
SECRET_KEY = settings.SECRET_KEY

# Настройки cookie
COOKIE_SETTINGS = {
    "httponly": True,
    "secure": False,  # Отключено, так как используем HTTP
    "samesite": "strict",  # Используем 'strict' для аутентификационных куки
    "path": "/",
    "domain": "www.dantizt.ru"  # Возвращаем явное указание домена
}

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Проверяет соответствие пароля его хешу
    """
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_tokens(user_id: int, email: str) -> tuple[str, str]:
    access_token_data = {
        "sub": email,
        "type": "access"
    }
    refresh_token_data = {
        "sub": email,
        "type": "refresh"
    }
    
    access_token = create_access_token(access_token_data)
    refresh_token = create_refresh_token(refresh_token_data)
    
    return access_token, refresh_token

def decode_token(token: str) -> Dict[str, Any]:
    """Декодирование JWT токена"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def set_auth_cookies(response: Response, access_token: str, refresh_token: str, user_role: str = None):
    """Установка куки с токенами"""
    # Основные токены
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # в секундах
        **COOKIE_SETTINGS
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,  # в секундах
        **COOKIE_SETTINGS
    )
    
    # Дополнительные куки для фронтенда
    response.set_cookie(
        key="authToken",
        value=access_token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **COOKIE_SETTINGS
    )
    if user_role:
        response.set_cookie(
            key="userRole",
            value=user_role,
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            **COOKIE_SETTINGS
        )

def clear_auth_cookies(response: Response):
    """Очистка куки при выходе"""
    for key in ["access_token", "refresh_token", "authToken", "userRole"]:
        response.delete_cookie(
            key=key,
            path="/",
            # Не указываем домен, чтобы куки удалялись на текущем домене
            domain=None,
            secure=COOKIE_SETTINGS["secure"],
            httponly=COOKIE_SETTINGS["httponly"],
            samesite=COOKIE_SETTINGS["samesite"]
        )

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        token = request.cookies.get("access_token")
    
    if not token:
        raise credentials_exception
    
    try:
        # Декодируем токен
        payload = decode_token(token)
        email = payload.get("sub")
        if not email:
            raise credentials_exception
        
        # Получаем пользователя из БД по email
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            raise credentials_exception
            
        return user
        
    except JWTError:
        raise credentials_exception
