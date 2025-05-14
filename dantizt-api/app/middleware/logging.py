import time
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        logger.info(f"Request: {request.method} {request.url}")
        logger.debug(f"Headers: {dict(request.headers)}")

        try:
            body = await request.json()
            logger.debug(f"Body: {body}")
        except:
            body = None
        
        response = await call_next(request)

        process_time = time.time() - start_time
        
        logger.info(
            f"Response: {request.method} {request.url} - Status: {response.status_code} "
            f"- Process Time: {process_time:.4f}s"
        )
        
        return response
