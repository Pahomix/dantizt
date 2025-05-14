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
        logger.debug(f"Initial params: {json.dumps(params_copy, ensure_ascii=False)}")
        
        # Определяем поля, которые должны участвовать в генерации токена для каждого метода
        required_fields = {
            'Init': {'Amount', 'OrderId', 'TerminalKey'},
            'GetState': {'PaymentId', 'TerminalKey'},
            'Confirm': {'PaymentId', 'TerminalKey'},
            'Cancel': {'PaymentId', 'TerminalKey'},
            'Refund': {'PaymentId', 'TerminalKey'},
        }
        
        # Если метод не указан или не найден в списке, используем все поля кроме исключенных
        if not endpoint or endpoint not in required_fields:
            excluded_fields = {
                'Token', 'Receipt', 'DATA', 'Shops', 'SuccessURL', 'FailURL', 
                'NotificationURL', 'Description'
            }
            # Удаляем исключенные поля и None значения
            token_params = {}
            for key, value in params_copy.items():
                if key not in excluded_fields and value not in [None, '']:
                    # Преобразуем все значения в строки
                    if isinstance(value, bool):
                        token_params[key] = "1" if value else "0"
                    else:
                        token_params[key] = str(value)
        else:
            # Используем только требуемые поля для данного метода
            token_params = {}
            for key in required_fields[endpoint]:
                if key in params_copy and params_copy[key] not in [None, '']:
                    value = params_copy[key]
                    if isinstance(value, bool):
                        token_params[key] = "1" if value else "0"
                    else:
                        token_params[key] = str(value)
                
        # Добавляем пароль
        token_params['Password'] = self.password
        
        logger.debug(f"Params for token: {json.dumps(token_params, ensure_ascii=False)}")
        
        # Начинаем строку с пароля
        values = [self.password]
        
        # Добавляем остальные значения в отсортированном порядке
        for key in sorted(token_params.keys()):
            if key != 'Password':  # Пропускаем Password, так как мы уже добавили его
                values.append(token_params[key])
            
        values_str = ''.join(values)
        logger.debug(f"Values string for hashing: {values_str}")
        
        # Генерируем токен
        token = hashlib.sha256(values_str.encode('utf-8')).hexdigest()
        logger.debug(f"Generated token: {token}")
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
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}{endpoint}",
                    json=params
                )
                response_data = response.json()
                logger.info(f"Tinkoff API request ({endpoint}): {json.dumps(params, ensure_ascii=False)}")
                logger.info(f"Tinkoff API response ({endpoint}): {json.dumps(response_data, ensure_ascii=False)}")
                return response_data
        except Exception as e:
            logger.error(f"Tinkoff API request error: {str(e)}")
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
