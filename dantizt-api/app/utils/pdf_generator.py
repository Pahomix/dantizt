from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
import os
import io
from datetime import datetime

# Попытка зарегистрировать шрифт с поддержкой кириллицы
try:
    # Путь к шрифту в системе
    font_path = os.path.join(os.environ.get('WINDIR', ''), 'Fonts', 'times.ttf')
    bold_font_path = os.path.join(os.environ.get('WINDIR', ''), 'Fonts', 'timesbd.ttf')
    
    if os.path.exists(font_path) and os.path.exists(bold_font_path):
        pdfmetrics.registerFont(TTFont('TimesRussian', font_path))
        pdfmetrics.registerFont(TTFont('TimesRussian-Bold', bold_font_path))
        main_font = 'TimesRussian'
        bold_font = 'TimesRussian-Bold'
    else:
        main_font = 'Helvetica'
        bold_font = 'Helvetica-Bold'
except:
    main_font = 'Helvetica'
    bold_font = 'Helvetica-Bold'

def generate_tax_deduction_certificate(
    patient_name, 
    patient_inn, 
    clinic_name, 
    clinic_inn, 
    clinic_address, 
    services, 
    total_amount, 
    payment_date,
    certificate_number,
    staff_name,
    staff_phone
):
    """
    Генерирует справку для налогового вычета в соответствии с законодательством РФ.
    
    Args:
        patient_name (str): ФИО пациента
        patient_inn (str): ИНН пациента
        clinic_name (str): Название клиники
        clinic_inn (str): ИНН клиники
        clinic_address (str): Адрес клиники
        services (list): Список оказанных услуг [{"name": "Название", "cost": 1000.0, "date": "2025-01-01"}]
        total_amount (float): Общая сумма
        payment_date (str): Дата оплаты
        certificate_number (str): Номер справки
        staff_name (str): ФИО сотрудника регистратуры
        staff_phone (str): Телефон сотрудника регистратуры
    
    Returns:
        bytes: PDF-документ в виде байтов
    """
    buffer = io.BytesIO()
    
    # Создаем PDF документ
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=1*cm,
        bottomMargin=1*cm
    )
    
    # Стили
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='CertHeader',
        fontName=main_font,
        fontSize=10,
        alignment=TA_CENTER,
        spaceAfter=0.1*cm
    ))
    
    styles.add(ParagraphStyle(
        name='CertificateTitle',
        fontName=bold_font,
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=0.3*cm
    ))
    
    styles.add(ParagraphStyle(
        name='CertNormal',
        fontName=main_font,
        fontSize=10,
        alignment=TA_LEFT,
        spaceAfter=0.2*cm
    ))
    
    styles.add(ParagraphStyle(
        name='CertRight',
        fontName=main_font,
        fontSize=10,
        alignment=TA_RIGHT,
        spaceAfter=0.2*cm
    ))
    
    styles.add(ParagraphStyle(
        name='CertJustify',
        fontName=main_font,
        fontSize=10,
        alignment=TA_JUSTIFY,
        spaceAfter=0.2*cm
    ))
    
    styles.add(ParagraphStyle(
        name='CertBold',
        fontName=bold_font,
        fontSize=10,
        alignment=TA_LEFT,
        spaceAfter=0.2*cm
    ))
    
    styles.add(ParagraphStyle(
        name='CertUnderline',
        fontName=main_font,
        fontSize=10,
        alignment=TA_LEFT,
        spaceAfter=0.2*cm,
        underline=True
    ))
    
    styles.add(ParagraphStyle(
        name='CertSmall',
        fontName=main_font,
        fontSize=8,
        alignment=TA_LEFT,
        spaceAfter=0.1*cm
    ))
    
    # Элементы документа
    elements = []
    
    # Шапка документа в левом верхнем углу
    header_style = ParagraphStyle(
        name='LeftHeader',
        fontName=main_font,
        fontSize=10,
        alignment=TA_LEFT,
        spaceAfter=0.1*cm
    )
    
    elements.append(Paragraph("Министерство здравоохранения", header_style))
    elements.append(Paragraph("Российской Федерации", header_style))
    elements.append(Paragraph(f"{clinic_name}", header_style))
    elements.append(Paragraph(f"ИНН {clinic_inn}", header_style))
    elements.append(Paragraph(f"Адрес: {clinic_address}", header_style))
    
    elements.append(Spacer(1, 1*cm))
    
    # Заголовок справки
    elements.append(Paragraph("СПРАВКА", styles['CertificateTitle']))
    elements.append(Paragraph("ОБ ОПЛАТЕ МЕДИЦИНСКИХ УСЛУГ ДЛЯ ПРЕДСТАВЛЕНИЯ", styles['CertBold']))
    elements.append(Paragraph(f"В НАЛОГОВЫЕ ОРГАНЫ РОССИЙСКОЙ ФЕДЕРАЦИИ № {certificate_number}", styles['CertBold']))
    
    elements.append(Spacer(1, 0.5*cm))
    
    # Дата выдачи
    current_date = datetime.now().strftime("%d.%m.%Y")
    elements.append(Paragraph(f"от \"___\" __________ {datetime.now().year} г.", styles['CertRight']))
    
    elements.append(Spacer(1, 0.5*cm))
    
    # Информация о пациенте
    elements.append(Paragraph(f"Выдана налогоплательщику (Ф.И.О.): <u>{patient_name}</u>", styles['CertNormal']))
    elements.append(Paragraph(f"ИНН налогоплательщика: <u>{patient_inn}</u>", styles['CertNormal']))
    
    # Сумма прописью
    from num2words import num2words
    
    def num_to_words_ru(number):
        try:
            # Разделяем число на целую и дробную части
            rubles, kopecks = str(float(number)).split('.')
            kopecks = kopecks.ljust(2, '0')[:2]  # Убедимся, что у нас 2 цифры после запятой
            
            # Преобразуем в слова
            rubles_text = num2words(int(rubles), lang='ru')
            
            # Определяем правильное склонение слова "рубль"
            last_digit = int(rubles[-1]) if rubles else 0
            last_two_digits = int(rubles[-2:]) if len(rubles) > 1 else last_digit
            
            if last_two_digits in range(11, 20):
                ruble_form = "рублей"
            elif last_digit == 1:
                ruble_form = "рубль"
            elif last_digit in range(2, 5):
                ruble_form = "рубля"
            else:
                ruble_form = "рублей"
            
            # Формируем полную строку
            result = f"{rubles_text} {ruble_form} {kopecks} копеек"
            return result.capitalize()
        except:
            return f"{number} рублей"
    
    # Сумма прописью
    sum_in_words = num_to_words_ru(total_amount)
    elements.append(Paragraph(f"В том, что он (она) оплатил(а) медицинские услуги стоимостью <u>{total_amount} руб. 00 копеек</u>", styles['CertNormal']))
    
    elements.append(Spacer(1, 0.1*cm))
    elements.append(Paragraph(f"<u>{sum_in_words}</u>", styles['CertNormal']))
    elements.append(Paragraph("(сумма прописью)", styles['CertSmall']))
    
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph("оказанные: ему (ей), супругу(е), сыну (дочери), матери (отцу)", styles['CertNormal']))
    elements.append(Paragraph("(нужное подчеркнуть)", styles['CertSmall']))
    
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph(f"ФИО пациента: <u>{patient_name}</u>", styles['CertNormal']))
    elements.append(Paragraph("(Ф.И.О. полностью)", styles['CertSmall']))
    
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph(f"Дата оплаты: <u>{payment_date}</u>", styles['CertNormal']))
    
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph(f"Фамилия, имя, отчество и должность лица, выдавшего справку: <u>{staff_name}</u> регистратор", styles['CertNormal']))
    
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph(f"Телефон: <u>{staff_phone}</u>", styles['CertNormal']))
    
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph("М.П.", styles['CertBold']))
    
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph("* Справка дает право на получение социального налогового вычета в соответствии с п.3 ч.1 ст.219 Налогового кодекса РФ.", styles['CertSmall']))
    
    # Генерируем PDF
    doc.build(elements)
    
    # Получаем содержимое буфера
    pdf_content = buffer.getvalue()
    buffer.close()
    
    return pdf_content
