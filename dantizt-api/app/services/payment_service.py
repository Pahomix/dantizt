from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
import logging
import uuid
from datetime import datetime

from app.core.config import settings
from app.db.models import Payment, PaymentStatus, Appointment, Service, AppointmentService, Patient, Doctor, User
from app.services.tinkoff_api import TinkoffAPI
from app.schemas.tinkoff_payment import TinkoffPaymentItem

logger = logging.getLogger(__name__)

class PaymentService:
    """Сервис для работы с платежами, включая интеграцию с API Тинькофф"""
    
    def __init__(self):
        self.tinkoff_api = TinkoffAPI(
            terminal_key=settings.TINKOFF_TERMINAL_KEY,
            password=settings.TINKOFF_PASSWORD,
            is_test=settings.TINKOFF_IS_TEST
        )
        
        # URL для перенаправления после оплаты
        self.success_url = settings.TINKOFF_SUCCESS_URL or f"{settings.FRONTEND_URL}/payment/success"
        self.fail_url = settings.TINKOFF_FAIL_URL or f"{settings.FRONTEND_URL}/payment/fail"
        self.notification_url = settings.TINKOFF_NOTIFICATION_URL or f"{settings.SERVER_HOST}{settings.API_V1_STR}/payments/notification"

    async def get_payment_details(self, payment_id: int, db: AsyncSession) -> Dict[str, Any]:
        """Получить детали платежа для инициализации в Тинькофф"""
        # Получаем платеж с информацией о записи на прием, пациенте и враче
        query = select(Payment).where(Payment.id == payment_id).options(
            joinedload(Payment.appointment).joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Payment.appointment).joinedload(Appointment.patient).joinedload(Patient.user),
            joinedload(Payment.patient).joinedload(Patient.user)
        )
        
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise ValueError(f"Платеж с ID {payment_id} не найден")
        
        # Получаем услуги для записи на прием
        services = []
        if payment.appointment:
            services_query = select(Service).join(
                AppointmentService, 
                Service.id == AppointmentService.service_id
            ).where(
                AppointmentService.appointment_id == payment.appointment.id
            )
            services_result = await db.execute(services_query)
            services = services_result.scalars().all()
        
        # Формируем данные для платежа
        payment_details = {
            "payment": payment,
            "services": services,
            "patient": payment.patient,
            "doctor": payment.appointment.doctor if payment.appointment else None
        }
        
        return payment_details

    async def prepare_receipt_items(self, services: List[Service]) -> List[Dict[str, Any]]:
        """Подготовка элементов чека для API Тинькофф"""
        receipt_items = []
        
        for service in services:
            # Преобразуем стоимость из рублей в копейки
            price_in_kopecks = int(float(service.cost) * 100)
            
            item = {
                "Name": service.name,
                "Quantity": 1.0,
                "Amount": price_in_kopecks,
                "Price": price_in_kopecks,
                "Tax": "none",
                "PaymentObject": "service",
                "PaymentMethod": "full_payment",
                "MeasurementUnit": "шт" # Добавляем единицу измерения (обязательное поле для ФФД 1.2)
            }
            receipt_items.append(item)
        
        return receipt_items

    async def init_payment(self, payment_id: int, return_url: Optional[str], db: AsyncSession) -> Dict[str, Any]:
        """Инициализация платежа через API Тинькофф"""
        # Получаем детали платежа
        payment_details = await self.get_payment_details(payment_id, db)
        payment = payment_details["payment"]
        services = payment_details["services"]
        patient = payment_details["patient"]
        
        # Если нет услуг или сумма платежа равна 0, выбрасываем ошибку
        if not services and payment.amount <= 0:
            raise ValueError("Невозможно создать платеж с нулевой суммой и без услуг")
        
        # Подготавливаем элементы чека
        receipt_items = await self.prepare_receipt_items(services)
        
        # Если нет элементов чека, но есть сумма платежа, создаем один элемент
        if not receipt_items and payment.amount > 0:
            amount_in_kopecks = int(float(payment.amount) * 100)
            receipt_items = [{
                "Name": "Медицинские услуги",
                "Quantity": 1.0,
                "Amount": amount_in_kopecks,
                "Price": amount_in_kopecks,
                "Tax": "none",
                "PaymentObject": "service",
                "PaymentMethod": "full_payment",
                "MeasurementUnit": "шт" # Добавляем единицу измерения (обязательное поле для ФФД 1.2)
            }]
        
        # Получаем email и телефон пациента
        customer_email = patient.user.email
        customer_phone = patient.user.phone_number
        
        # Если нет телефона, используем заглушку
        if not customer_phone:
            customer_phone = "+70000000000"
        
        # Формируем описание платежа
        if payment.appointment:
            appointment_date = payment.appointment.start_time.strftime("%d.%m.%Y %H:%M")
            description = f"Оплата приема {appointment_date}"
        else:
            description = f"Оплата услуг в клинике"
        
        # Создаем уникальный идентификатор заказа
        order_id = f"order_{payment.id}_{uuid.uuid4().hex[:8]}"
        
        # Обновляем информацию о платеже
        payment.external_id = order_id
        await db.commit()
        
        # Определяем сумму платежа в копейках
        amount_in_kopecks = int(float(payment.amount) * 100)
        
        # Определяем URL для возврата после оплаты
        # Приоритет отдаем URL, переданному с фронтенда
        base_success_url = return_url or self.success_url
        
        # Логируем полученный URL для отладки
        logger.info(f"Return URL from frontend: {return_url}")
        logger.info(f"Default success URL: {self.success_url}")
        
        # Добавляем дополнительные параметры в URL для успешной оплаты
        # Согласно документации Tinkoff, мы используем только параметры запроса
        # И не используем хеш-фрагменты
        
        # Проверяем, есть ли уже параметры в URL
        if "?" in base_success_url:
            # Если в URL уже есть параметры, добавляем новые через &
            success_url = f"{base_success_url}&orderId={order_id}"
            
            # Проверяем, есть ли уже параметр source
            if "source=" not in base_success_url:
                success_url += "&source=tinkoff"
        else:
            # Если в URL нет параметров, добавляем первый через ?
            success_url = f"{base_success_url}?orderId={order_id}&source=tinkoff"
        
        # Логируем информацию об инициализации платежа
        logger.info(f"Initializing Tinkoff payment for payment_id={payment.id}, amount={payment.amount}")
        logger.info(f"Notification URL: {self.notification_url}")
        logger.info(f"Success URL: {success_url}, Fail URL: {self.fail_url}")
        logger.info(f"OrderId: {order_id}, Customer: {customer_email}, {customer_phone}")
        
        # Инициализируем платеж через API Тинькофф
        response = await self.tinkoff_api.init_payment(
            amount=amount_in_kopecks,
            order_id=order_id,
            description=description,
            success_url=success_url,
            fail_url=self.fail_url,
            customer_email=customer_email,
            customer_phone=customer_phone,
            receipt_items=receipt_items,
            notification_url=self.notification_url,
            data={"paymentId": payment.id}
        )
        
        logger.info(f"Tinkoff init_payment response: {response}")
        
        # Если платеж успешно инициализирован, обновляем информацию о платеже
        if response.get("Success"):
            payment.external_payment_id = str(response.get("PaymentId"))  # Преобразуем в строку
            payment.payment_url = response.get("PaymentURL")  # Сохраняем URL для оплаты
            payment.status = PaymentStatus.pending
            payment.updated_at = datetime.now()
            await db.commit()
        
        return response

    async def check_payment_status(self, payment_id: int, tinkoff_payment_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Проверка статуса платежа через API Тинькофф"""
        logger.info("=== TINKOFF PAYMENT STATUS CHECK START ===")
        logger.info(f"Проверка статуса платежа: payment_id={payment_id}, tinkoff_payment_id={tinkoff_payment_id}")
        logger.info(f"Payment ID type: {type(payment_id)}, Tinkoff Payment ID type: {type(tinkoff_payment_id)}")
        
        # Проверяем, может ли payment_id быть в формате строки (например, 'order_123')
        effective_payment_id = payment_id
        logger.info(f"Initial payment_id: {payment_id}, type: {type(payment_id)}")
        
        # Обработка случая, когда payment_id является строкой
        if isinstance(payment_id, str):
            logger.info(f"Payment ID is a string: '{payment_id}'")
            
            # Проверяем формат order_XXX
            if payment_id.startswith('order_'):
                logger.info(f"Payment ID has 'order_' prefix: {payment_id}")
                try:
                    # Извлекаем ID платежа из формата order_{payment_id}
                    match = payment_id.split('_')
                    logger.info(f"Split parts: {match}")
                    
                    if len(match) >= 2 and match[1].isdigit():
                        effective_payment_id = int(match[1])
                        logger.info(f"Successfully extracted payment_id {effective_payment_id} from string {payment_id}")
                    else:
                        logger.warning(f"Could not extract payment ID from parts: {match}")
                        # Пробуем найти любое число в строке
                        for part in match:
                            if part.isdigit():
                                effective_payment_id = int(part)
                                logger.info(f"Found numeric part in OrderId: {effective_payment_id}")
                                break
                except Exception as e:
                    logger.error(f"Error extracting payment ID from string {payment_id}: {str(e)}")
            # Проверяем, является ли строка числом
            elif payment_id.isdigit():
                effective_payment_id = int(payment_id)
                logger.info(f"Payment ID is a numeric string, converted to int: {effective_payment_id}")
        
        logger.info(f"Effective payment_id after processing: {effective_payment_id}")
        
        # Получаем платеж из базы данных
        query = select(Payment).where(Payment.id == effective_payment_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            logger.error(f"Платеж с ID {effective_payment_id} не найден")
            raise ValueError(f"Платеж с ID {effective_payment_id} не найден")
        
        logger.info(f"Найден платеж: ID={payment.id}, статус={payment.status}, external_payment_id={payment.external_payment_id}")
        
        # Проверяем, что tinkoff_payment_id соответствует платежу, но делаем проверку более гибкой
        if payment.external_payment_id and payment.external_payment_id != tinkoff_payment_id:
            logger.warning(f"Несоответствие ID платежа в Тинькофф: в БД {payment.external_payment_id}, получен {tinkoff_payment_id}")
            # Не выбрасываем исключение, а просто логируем предупреждение
        
        # Если external_payment_id не установлен, устанавливаем его
        if not payment.external_payment_id:
            payment.external_payment_id = tinkoff_payment_id
            logger.info(f"Установлен external_payment_id={tinkoff_payment_id} для платежа ID={payment_id}")
        
        # Запрашиваем статус платежа через API Тинькофф
        try:
            # Проверяем доступные идентификаторы платежа
            logger.info(f"Payment details for Tinkoff API request:")
            logger.info(f"  - Payment ID in DB: {payment.id}")
            logger.info(f"  - External ID in DB: {payment.external_id}")
            logger.info(f"  - External Payment ID in DB: {payment.external_payment_id}")
            logger.info(f"  - Provided Tinkoff Payment ID: {tinkoff_payment_id}")
            
            # Если у нас есть external_payment_id, используем его вместо переданного tinkoff_payment_id
            effective_tinkoff_id = payment.external_payment_id if payment.external_payment_id else tinkoff_payment_id
            logger.info(f"Запрос статуса платежа в Tinkoff API: tinkoff_payment_id={effective_tinkoff_id}")
            
            # Выполняем запрос к API Tinkoff
            response = await self.tinkoff_api.get_state(effective_tinkoff_id)
            logger.info(f"Ответ от Tinkoff API: {response}")
            logger.info(f"Response keys: {list(response.keys()) if isinstance(response, dict) else 'Not a dict'}")
        except Exception as e:
            logger.error(f"Ошибка при запросе статуса платежа в Tinkoff API: {str(e)}")
            # Возвращаем заглушку для ответа, чтобы не прерывать выполнение
            return {"Success": False, "ErrorCode": "999", "Message": f"Ошибка при проверке статуса платежа: {str(e)}"}
        
        # Обновляем статус платежа в базе данных
        if response.get("Success"):
            tinkoff_status = response.get("Status")
            logger.info(f"Получен статус от Tinkoff: {tinkoff_status}")
            
            # Дополнительная информация из ответа
            payment_id_from_response = response.get("PaymentId")
            order_id_from_response = response.get("OrderId")
            amount_from_response = response.get("Amount")
            
            logger.info(f"Additional info from Tinkoff response:")
            logger.info(f"  - PaymentId: {payment_id_from_response}")
            logger.info(f"  - OrderId: {order_id_from_response}")
            logger.info(f"  - Amount: {amount_from_response}")
            
            # Маппинг статусов Тинькофф на статусы системы
            status_mapping = {
                "NEW": PaymentStatus.pending,
                "AUTHORIZED": PaymentStatus.pending,
                "CONFIRMED": PaymentStatus.completed,
                "REJECTED": PaymentStatus.failed,
                "REFUNDED": PaymentStatus.refunded,
                "PARTIAL_REFUNDED": PaymentStatus.refunded,
                "REVERSED": PaymentStatus.failed,
                "CANCELED": PaymentStatus.failed
            }
            
            logger.info(f"Status mapping: Tinkoff status '{tinkoff_status}' -> System status '{status_mapping.get(tinkoff_status, 'unknown')}'") 
            
            if tinkoff_status in status_mapping:
                old_status = payment.status
                new_status = status_mapping[tinkoff_status]
                
                logger.info(f"Current payment status: {old_status}, New status: {new_status}")
                
                # Проверяем, изменился ли статус
                if old_status != new_status:
                    payment.status = new_status
                    payment.updated_at = datetime.now()
                    
                    try:
                        await db.commit()
                        logger.info(f"Successfully updated payment status from {old_status} to {new_status} for payment ID={payment.id}")
                    except Exception as e:
                        logger.error(f"Error updating payment status in database: {str(e)}")
                        await db.rollback()
                else:
                    logger.info(f"Payment status unchanged (already {old_status}), no update needed")
                    
                # Обновляем external_payment_id, если он отсутствует, но есть в ответе
                if not payment.external_payment_id and payment_id_from_response:
                    payment.external_payment_id = payment_id_from_response
                    logger.info(f"Updated payment.external_payment_id to {payment_id_from_response}")
                    await db.commit()
            else:
                logger.warning(f"Неизвестный статус Tinkoff: {tinkoff_status}, статус платежа не обновлен")
        else:
            error_code = response.get("ErrorCode")
            error_message = response.get("Message")
            logger.warning(f"Неуспешный ответ от Tinkoff API: ErrorCode={error_code}, Message={error_message}")
        
        logger.info("=== TINKOFF PAYMENT STATUS CHECK COMPLETE ===\n")
        return response

    async def confirm_payment(self, payment_id: int, tinkoff_payment_id: str, amount: Optional[float], db: AsyncSession) -> Dict[str, Any]:
        """Подтверждение платежа через API Тинькофф"""
        # Получаем платеж из базы данных
        query = select(Payment).where(Payment.id == payment_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise ValueError(f"Платеж с ID {payment_id} не найден")
        
        # Проверяем, что tinkoff_payment_id соответствует платежу
        if payment.external_payment_id != tinkoff_payment_id:
            raise ValueError("Несоответствие ID платежа в Тинькофф")
        
        # Определяем сумму для подтверждения
        amount_in_kopecks = None
        if amount is not None:
            amount_in_kopecks = int(amount * 100)
        
        # Подтверждаем платеж через API Тинькофф
        response = await self.tinkoff_api.confirm_payment(tinkoff_payment_id, amount_in_kopecks)
        
        # Если платеж успешно подтвержден, обновляем статус
        if response.get("Success"):
            payment.status = PaymentStatus.completed
            payment.updated_at = datetime.now()
            await db.commit()
        
        return response

    async def cancel_payment(self, payment_id: int, tinkoff_payment_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Отмена платежа через API Тинькофф"""
        # Получаем платеж из базы данных
        query = select(Payment).where(Payment.id == payment_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise ValueError(f"Платеж с ID {payment_id} не найден")
        
        # Проверяем, что tinkoff_payment_id соответствует платежу
        if payment.external_payment_id != tinkoff_payment_id:
            raise ValueError("Несоответствие ID платежа в Тинькофф")
        
        # Отменяем платеж через API Тинькофф
        response = await self.tinkoff_api.cancel_payment(tinkoff_payment_id)
        
        # Если платеж успешно отменен, обновляем статус
        if response.get("Success"):
            payment.status = PaymentStatus.failed
            payment.updated_at = datetime.now()
            await db.commit()
        
        return response

    async def refund_payment(self, payment_id: int, tinkoff_payment_id: str, amount: Optional[float], db: AsyncSession) -> Dict[str, Any]:
        """Возврат платежа через API Тинькофф"""
        # Получаем платеж из базы данных
        query = select(Payment).where(Payment.id == payment_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise ValueError(f"Платеж с ID {payment_id} не найден")
        
        # Проверяем, что tinkoff_payment_id соответствует платежу
        if payment.external_payment_id != tinkoff_payment_id:
            raise ValueError("Несоответствие ID платежа в Тинькофф")
        
        # Определяем сумму для возврата
        amount_in_kopecks = None
        if amount is not None:
            amount_in_kopecks = int(amount * 100)
        
        # Возвращаем платеж через API Тинькофф
        response = await self.tinkoff_api.refund_payment(tinkoff_payment_id, amount_in_kopecks)
        
        # Если платеж успешно возвращен, обновляем статус
        if response.get("Success"):
            payment.status = PaymentStatus.refunded
            payment.updated_at = datetime.now()
            await db.commit()
        
        return response

    async def process_notification(self, notification_data: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
        """Обработка уведомления от API Тинькофф"""
        # Расширенное логирование полученных данных
        logger.info("=== TINKOFF NOTIFICATION PROCESSING START ===")
        logger.info(f"Received Tinkoff notification data: {notification_data}")
        logger.info(f"Notification data type: {type(notification_data)}")
        logger.info(f"Notification keys: {list(notification_data.keys())}")
        
        # Добавляем расширенное логирование для отладки
        logger.info(f"Raw notification data: {notification_data}")
        
        # Логируем все поля уведомления для детального анализа
        for key, value in notification_data.items():
            logger.info(f"Notification field: {key} = {value}")
        
        # Проверяем подлинность уведомления
        if not notification_data.get("Success"):
            logger.warning(f"Notification is not successful: {notification_data}")
            return {"success": False, "message": "Notification is not successful"}
        
        # Получаем данные из уведомления
        order_id = notification_data.get("OrderId")
        tinkoff_payment_id = notification_data.get("PaymentId")
        status = notification_data.get("Status")
        amount = notification_data.get("Amount")
        card_id = notification_data.get("CardId")
        pan = notification_data.get("Pan")
        exp_date = notification_data.get("ExpDate")
        
        logger.info(f"Processing notification details:")
        logger.info(f"  - OrderId: {order_id}")
        logger.info(f"  - PaymentId: {tinkoff_payment_id}")
        logger.info(f"  - Status: {status}")
        logger.info(f"  - Amount: {amount}")
        logger.info(f"  - CardId: {card_id}")
        logger.info(f"  - Pan: {pan}")
        logger.info(f"  - ExpDate: {exp_date}")
        
        # Находим платеж по external_id (OrderId в Тинькофф)
        query = select(Payment).where(Payment.external_id == order_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        logger.info(f"Payment search by external_id={order_id}: {'Found' if payment else 'Not found'}")
        
        # Если не нашли по external_id, проверяем формат order_id (может быть в формате order_{payment_id})
        if not payment and order_id and order_id.startswith('order_'):
            try:
                # Извлекаем ID платежа из формата order_{payment_id}
                match = order_id.split('_')
                if len(match) >= 2 and match[1].isdigit():
                    payment_id_from_order = int(match[1])
                    logger.info(f"Extracted payment_id {payment_id_from_order} from OrderId {order_id}")
                    
                    # Ищем платеж по ID
                    query = select(Payment).where(Payment.id == payment_id_from_order)
                    result = await db.execute(query)
                    payment = result.scalar_one_or_none()
                    logger.info(f"Payment search by extracted ID={payment_id_from_order}: {'Found' if payment else 'Not found'}")
            except Exception as e:
                logger.error(f"Error extracting payment ID from OrderId {order_id}: {str(e)}")
        
        # Если не нашли по external_id или извлеченному ID, попробуем найти по external_payment_id
        if not payment and tinkoff_payment_id:
            query = select(Payment).where(Payment.external_payment_id == tinkoff_payment_id)
            result = await db.execute(query)
            payment = result.scalar_one_or_none()
            logger.info(f"Payment search by external_payment_id={tinkoff_payment_id}: {'Found' if payment else 'Not found'}")
        
        if not payment:
            logger.error(f"Payment not found: OrderId={order_id}, PaymentId={tinkoff_payment_id}")
            logger.error("Attempting to search by other possible formats...")
            
            # Пробуем найти платеж по ID без префикса order_
            if order_id and isinstance(order_id, str) and '_' in order_id:
                parts = order_id.split('_')
                logger.info(f"Trying to extract payment ID from OrderId parts: {parts}")
                
                # Проверяем все части на числовое значение
                for part in parts:
                    if part.isdigit():
                        try:
                            payment_id_from_part = int(part)
                            logger.info(f"Found numeric part in OrderId: {payment_id_from_part}")
                            
                            # Пробуем найти платеж по этому ID
                            query = select(Payment).where(Payment.id == payment_id_from_part)
                            result = await db.execute(query)
                            potential_payment = result.scalar_one_or_none()
                            
                            if potential_payment:
                                payment = potential_payment
                                logger.info(f"Found payment by extracted ID {payment_id_from_part}: {payment.id}")
                                break
                        except Exception as e:
                            logger.error(f"Error trying to find payment by part {part}: {str(e)}")
            
            # Если все равно не нашли платеж
            if not payment:
                logger.error(f"Payment still not found after all attempts: OrderId={order_id}, PaymentId={tinkoff_payment_id}")
                return {"success": False, "message": f"Payment with OrderId {order_id} or PaymentId {tinkoff_payment_id} not found"}
        
        logger.info(f"Found payment: ID={payment.id}, Status={payment.status}, Amount={payment.amount}")
        
        # Обновляем external_payment_id, если его нет
        if not payment.external_payment_id:
            payment.external_payment_id = tinkoff_payment_id
            logger.info(f"Updated payment.external_payment_id to {tinkoff_payment_id}")
        
        # Маппинг статусов Тинькофф на статусы системы
        status_mapping = {
            "NEW": PaymentStatus.pending,
            "AUTHORIZED": PaymentStatus.pending,
            "CONFIRMED": PaymentStatus.completed,
            "REJECTED": PaymentStatus.failed,
            "REFUNDED": PaymentStatus.refunded,
            "PARTIAL_REFUNDED": PaymentStatus.refunded,
            "REVERSED": PaymentStatus.failed,
            "CANCELED": PaymentStatus.failed
        }
        
        # Обновляем статус платежа
        if status in status_mapping:
            old_status = payment.status
            new_status = status_mapping[status]
            
            logger.info(f"Status mapping: Tinkoff status '{status}' -> System status '{new_status}'")
            logger.info(f"Current payment status: {old_status}, New status: {new_status}")
            
            # Всегда обновляем статус, если это CONFIRMED (успешная оплата) или если статус изменился
            if status == 'CONFIRMED' or old_status != new_status:
                payment.status = new_status
                payment.updated_at = datetime.now()
                
                # Если это успешная оплата, обновляем external_payment_id, если его нет
                if status == 'CONFIRMED' and tinkoff_payment_id and not payment.external_payment_id:
                    payment.external_payment_id = str(tinkoff_payment_id)
                    logger.info(f"Updated external_payment_id to {tinkoff_payment_id} for payment ID={payment.id}")
                
                try:
                    await db.commit()
                    logger.info(f"Successfully updated payment status from {old_status} to {new_status} for payment ID={payment.id}")
                    
                    # Дополнительное логирование для успешных платежей
                    if status == 'CONFIRMED':
                        logger.info(f"PAYMENT CONFIRMED: ID={payment.id}, Amount={payment.amount}, External ID={payment.external_payment_id}")
                except Exception as e:
                    logger.error(f"Error updating payment status in database: {str(e)}")
                    await db.rollback()
                    return {"success": False, "message": f"Database error: {str(e)}"}
            else:
                logger.info(f"Payment status unchanged (already {old_status}), no update needed")
        else:
            logger.warning(f"Unknown Tinkoff status: {status}, payment status not updated")
        
        logger.info(f"Successfully processed notification for payment ID={payment.id}")
        logger.info("=== TINKOFF NOTIFICATION PROCESSING COMPLETE ===\n")
        return {"success": True, "message": "Notification processed successfully"}
