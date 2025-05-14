from typing import Dict, Any
from datetime import datetime, timedelta
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr
from pathlib import Path

from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Создаем директорию для шаблонов, если её нет
template_dir = Path(__file__).parent / 'email-templates'
template_dir.mkdir(exist_ok=True)

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    TEMPLATE_FOLDER=template_dir
)

fastmail = FastMail(conf)

async def send_email(
    email_to: str,
    subject_template: str = "",
    html_template: str = "",
    environment: Dict[str, Any] = {},
) -> None:
    """
    Отправка email через SMTP
    """
    try:
        message = MessageSchema(
            subject=subject_template,
            recipients=[email_to],
            body=html_template,
            subtype='html'
        )
        
        await fastmail.send_message(message)
        logger.info(f"Email sent successfully to {email_to}")
        
    except Exception as e:
        logger.error(f"Failed to send email to {email_to}: {str(e)}")
        raise

async def send_test_email(
    email_to: EmailStr,
) -> None:
    """
    Тестовая отправка email
    """
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Test email"
    
    message = MessageSchema(
        subject=subject,
        recipients=[email_to],
        body="""
            <html>
                <body>
                    <p>Test email from {project_name}</p>
                </body>
            </html>
        """,
        subtype='html'
    )
    
    await fastmail.send_message(message)

async def send_verification_email_new(email: str, full_name: str, verification_url: str):
    """Отправляет email для подтверждения адреса электронной почты"""
    
    try:
        message = MessageSchema(
            subject="Подтверждение email адреса - DantiZT",
            recipients=[email],
            body=f"""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #2c3e50;">Здравствуйте, {full_name}!</h2>
                        
                        <p>Для подтверждения вашего email адреса нажмите на кнопку ниже:</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{verification_url}" 
                               style="background-color: #3498db; 
                                      color: white; 
                                      padding: 12px 25px; 
                                      text-decoration: none; 
                                      border-radius: 5px;
                                      display: inline-block;">
                                Подтвердить email
                            </a>
                        </div>
                        
                        <p>Или перейдите по этой ссылке:</p>
                        <p><a href="{verification_url}">{verification_url}</a></p>
                        
                        <p>Ссылка действительна в течение 24 часов.</p>
                        
                        <p style="color: #7f8c8d; font-size: 0.9em;">
                            Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        
                        <p style="color: #7f8c8d; font-size: 0.9em; text-align: center;">
                            С уважением,<br>
                            Команда DantiZT
                        </p>
                    </div>
                </body>
                </html>
            """,
            subtype="html"
        )
        
        await fastmail.send_message(message)
        logger.info(f"Verification email sent to {email}")
        
    except Exception as e:
        logger.error(f"Failed to send verification email to {email}: {str(e)}")
        raise

async def send_tax_deduction_certificate(email: str, full_name: str, year: int, pdf_content: bytes):
    """Отправляет справку для налогового вычета на email пациента"""
    
    try:
        message = MessageSchema(
            subject=f"Справка для налогового вычета за {year} год - DantiZT",
            recipients=[email],
            body=f"""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #2c3e50;">Здравствуйте, {full_name}!</h2>
                        
                        <p>Во вложении находится справка для налогового вычета за {year} год.</p>
                        
                        <p>Данная справка подготовлена в соответствии с требованиями Налогового кодекса РФ и может быть использована при подаче налоговой декларации 3-НДФЛ для получения социального налогового вычета за медицинские услуги.</p>
                        
                        <p style="color: #7f8c8d; font-size: 0.9em;">
                            Если у вас возникли вопросы, пожалуйста, обратитесь в регистратуру клиники.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        
                        <p style="color: #7f8c8d; font-size: 0.9em; text-align: center;">
                            С уважением,<br>
                            Команда DantiZT
                        </p>
                    </div>
                </body>
                </html>
            """,
            subtype="html",
            attachments=[
                {
                    "file": pdf_content,
                    "filename": f"tax_deduction_{year}.pdf",
                    "content_type": "application/pdf"
                }
            ]
        )
        
        await fastmail.send_message(message)
        logger.info(f"Tax deduction certificate sent to {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send tax deduction certificate to {email}: {str(e)}")
        raise
