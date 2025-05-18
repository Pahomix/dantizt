import httpx
from typing import Optional, Dict, Any, List
import uuid
import json
from datetime import datetime
import hashlib
import logging

logger = logging.getLogger(__name__)

class TinkoffAPI:
    def __init__(self, terminal_key: str, password: str, is_test: bool = True):
        self.terminal_key = terminal_key
        self.password = password
        self.base_url = "https://securepay.tinkoff.ru/v2/"
        self.is_test = is_test
        self.session = httpx.AsyncClient(timeout=30.0)

    def _generate_token(self, params: dict, endpoint: str = None) -> str:
        """Генерация токена для запроса по документации Тинькофф"""
        # Копируем параметры
        params_copy = params.copy()
        logger.debug(f"Initial params for {endpoint}: {json.dumps(params_copy, ensure_ascii=False)}")
        
        # Создаем словарь для параметров токена
        token_params = {}
        
        # Исключаем поля, которые не должны участвовать в формировании токена
        excluded_fields = ['Token', 'Receipt', 'DATA', 'TestMode']
        
        # Для метода Init используем только необходимые параметры
        if endpoint == 'Init':
            # Добавляем только необходимые параметры
            required_fields = ['TerminalKey', 'Amount', 'OrderId', 'Description', 'SuccessURL', 'FailURL', 'NotificationURL']
            
            for key in required_fields:
                if key in params_copy and params_copy[key] is not None and params_copy[key] != '':
                    token_params[key] = str(params_copy[key])
        else:
            # Для других методов добавляем все параметры, кроме исключенных
            for key, value in params_copy.items():
                if key not in excluded_fields and value is not None and value != '':
                    if isinstance(value, bool):
                        token_params[key] = "1" if value else "0"
                    else:
                        token_params[key] = str(value)
        
        # Добавляем пароль
        token_params['Password'] = self.password
        
        logger.debug(f"Token parameters for {endpoint}: {json.dumps(token_params, ensure_ascii=False)}")
        
        # Сортируем ключи в алфавитном порядке
        sorted_keys = sorted(token_params.keys())
        
        # Конкатенируем значения всех пар
        concatenated = ''
        for key in sorted_keys:
            concatenated += str(token_params[key])
        
        logger.debug(f"Concatenated string for hashing: {concatenated}")
        
        # Вычисляем хэш SHA-256
        token = hashlib.sha256(concatenated.encode('utf-8')).hexdigest()
        logger.debug(f"Generated token for {endpoint}: {token}")
        
        # Для отладки метода Init
        if endpoint == 'Init':
            logger.debug("\nFor testing on https://tokentcs.web.app/")
            logger.debug("Parameters:")
            for key in sorted_keys:
                if key != 'Password':
                    logger.debug(f"{key}: {token_params[key]}")
            logger.debug(f"Password: {token_params['Password']}")
        
        return token

    async def _make_request(self, endpoint: str, params: dict) -> dict:
        """Базовый метод для отправки запросов"""
        # Добавляем TerminalKey в параметры
        params["TerminalKey"] = self.terminal_key
        
        # Добавляем тестовый режим если нужно
        if self.is_test:
            params["TestMode"] = 1
            
        # Генерируем токен и добавляем его в параметры
        params["Token"] = self._generate_token(params, endpoint=endpoint)
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                logger.info(f"Tinkoff API request ({endpoint}): {json.dumps(params, ensure_ascii=False)}")
                response = await client.post(
                    f"{self.base_url}{endpoint}",
                    json=params
                )
                
                # Проверяем HTTP-статус
                response.raise_for_status()
                
                response_data = response.json()
                logger.info(f"Tinkoff API response ({endpoint}): {json.dumps(response_data, ensure_ascii=False)}")
                
                # Проверяем статус ответа от API
                if not response_data.get("Success", False):
                    error_code = response_data.get("ErrorCode", "unknown")
                    error_message = response_data.get("Message", "Unknown error")
                    logger.error(f"Tinkoff API error: {error_code} - {error_message}")
                
                return response_data
        except httpx.HTTPStatusError as e:
            logger.error(f"Tinkoff API HTTP error: {e.response.status_code} - {str(e)}")
            raise
        except httpx.RequestError as e:
            logger.error(f"Tinkoff API request error: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Tinkoff API unexpected error: {str(e)}")
            raise

    async def init_payment(
        self,
        amount: float,
        order_id: str,
        description: str,
        success_url: str,
        fail_url: str,
        customer_email: str,
        customer_phone: str,
        receipt_items: List[Dict[str, Any]],
        notification_url: str,
        data: Optional[Dict[str, Any]] = None
    ) -> dict:
        """Инициализация платежа"""
        # Сумма уже передается в копейках, не нужно дополнительное преобразование
        amount_in_kopecks = amount
        
        # Отладочный вывод
        logger.debug(f"Init payment with amount: {amount_in_kopecks}")
        
        payload = {
            "Amount": amount_in_kopecks,
            "OrderId": order_id,
            "Description": description,
            "SuccessURL": success_url,
            "FailURL": fail_url,
            "NotificationURL": notification_url,
            "Receipt": {
                "Email": customer_email,
                "Phone": customer_phone,
                "EmailCompany": customer_email,
                "Taxation": "osn",
                "Items": receipt_items,
                "FfdVersion": "1.2"
            }
        }

        if data:
            payload["DATA"] = data

        return await self._make_request("Init", payload)

    async def get_state(self, payment_id: str) -> dict:
        """Получение статуса платежа"""
        payload = {
            "PaymentId": payment_id
        }
        return await self._make_request("GetState", payload)

    async def confirm_payment(self, payment_id: str, amount: Optional[int] = None) -> dict:
        """Подтверждение платежа"""
        payload = {
            "PaymentId": payment_id
        }
        if amount is not None:
            payload["Amount"] = amount
        return await self._make_request("Confirm", payload)

    async def cancel_payment(self, payment_id: str) -> dict:
        """Отмена платежа"""
        payload = {
            "PaymentId": payment_id
        }
        return await self._make_request("Cancel", payload)

    async def refund_payment(self, payment_id: str, amount: Optional[int] = None) -> dict:
        """Возврат платежа"""
        payload = {
            "PaymentId": payment_id
        }
        if amount is not None:
            payload["Amount"] = amount
        return await self._make_request("Refund", payload)
