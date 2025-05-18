from datetime import datetime, date, time, timedelta
from enum import Enum
from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float,
    ForeignKey, Integer, String, Text, Time, Enum as SQLEnum, Index,
    CheckConstraint, UniqueConstraint, func, ARRAY, Numeric
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSON
from app.db.base_class import Base
from app.db.mixins import TimestampMixin
import re
import logging

# Настраиваем логирование
logger = logging.getLogger(__name__)

# Вспомогательные функции
def validate_email(email: str) -> bool:
    """Проверяет корректность email адреса"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_phone(phone: str) -> bool:
    """Проверяет корректность номера телефона"""
    pattern = r'^\+?[1-9]\d{1,14}$'
    return bool(re.match(pattern, phone))

def validate_tooth_positions(positions: list) -> bool:
    """Проверяет корректность номеров зубов"""
    if not positions:
        return True
    for pos in positions:
        quadrant = pos.get('quadrant', 0)
        number = pos.get('number', 0)
        if not (1 <= quadrant <= 4 and 1 <= number <= 8):
            return False
    return True

# Определение перечислений
class ServiceCategory(str, Enum):
    therapy = "therapy"
    surgery = "surgery"
    diagnostics = "diagnostics"
    consultation = "consultation"
    prevention = "prevention"

class AppointmentStatus(str, Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"

class RecordType(str, Enum):
    diagnosis = "diagnosis"
    treatment = "treatment"
    prescription = "prescription"
    note = "note"
    test_result = "test_result"
    examination = "examination"

class RecordStatus(str, Enum):
    active = "active"
    archived = "archived"
    deleted = "deleted"

class PaymentStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"
    refunded = "refunded"

class PaymentMethod(str, Enum):
    cash = "cash"
    card = "card"
    insurance = "insurance"

class NotificationType(str, Enum):
    appointment = "appointment"
    reminder = "reminder"
    system = "system"
    payment = "payment"

class SpecialDayType(str, Enum):
    holiday = "holiday"
    vacation = "vacation"
    sick_leave = "sick_leave"
    training = "training"

class TreatmentStatus(str, Enum):
    planned = "planned"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

class UserRole(str, Enum):
    admin = 'admin'
    doctor = 'doctor'
    patient = 'patient'
    reception = 'reception'  # Роль для сотрудников регистратуры

    def __str__(self):
        return self.value

class CertificateStatus(str, Enum):
    """Статус справки для налогового вычета"""
    issued = "issued"      # Выдана
    cancelled = "cancelled"  # Отменена

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String, unique=True, nullable=True)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean(), default=True)
    is_superuser = Column(Boolean(), default=False)
    role = Column(String, nullable=False, default=UserRole.patient.value)
    email_verified = Column(Boolean(), default=False)
    email_verification_token = Column(String, unique=True, nullable=True)
    email_verification_token_expires = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    doctor = relationship("Doctor", back_populates="user", uselist=False)
    patient = relationship("Patient", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")
    
    __table_args__ = (
        Index('ix_users_email_phone', 'email', 'phone_number'),
        Index('ix_users_role', 'role'),
    )

class Specialization(Base):
    __tablename__ = "specializations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    appointment_duration = Column(Integer, default=30, nullable=False)  # Длительность приема в минутах
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    doctors = relationship("Doctor", back_populates="specialization")

class Doctor(Base):
    __tablename__ = "doctors"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    specialization_id = Column(Integer, ForeignKey("specializations.id", ondelete="SET NULL"), nullable=True)
    experience_years = Column(Integer, default=0)
    education = Column(String)
    certifications = Column(ARRAY(String), default=list)
    bio = Column(String)
    schedule_template = Column(JSON)
    average_rating = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Отношения
    user = relationship("User", back_populates="doctor", uselist=False)
    specialization = relationship("Specialization", back_populates="doctors")
    appointments = relationship("Appointment", back_populates="doctor")
    services = relationship("Service", secondary="doctor_services", back_populates="doctors")
    payments = relationship("Payment", back_populates="doctor")
    schedules = relationship("DoctorSchedule", back_populates="doctor", cascade="all, delete-orphan")
    special_days = relationship("DoctorSpecialDay", back_populates="doctor", cascade="all, delete-orphan")
    treatment_plans = relationship("TreatmentPlan", back_populates="doctor", cascade="all, delete-orphan")
    medical_records = relationship("MedicalRecord", back_populates="doctor", cascade="all, delete-orphan")
    reviews = relationship("DoctorReview", back_populates="doctor", cascade="all, delete-orphan")
    doctor_services = relationship("DoctorService", back_populates="doctor", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_doctors_user', 'user_id'),
        Index('ix_doctors_specialization', 'specialization_id'),
    )

class DoctorSchedule(Base, TimestampMixin):
    """Расписание врача"""
    __tablename__ = "doctor_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"))
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    slot_duration = Column(Integer, nullable=False, default=30)
    break_between_slots = Column(Integer, nullable=False, default=0)
    breaks = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    doctor = relationship("Doctor", back_populates="schedules")
    
    __table_args__ = (
        CheckConstraint('day_of_week >= 0 AND day_of_week <= 6', name='check_day_of_week'),
        CheckConstraint('slot_duration > 0', name='check_slot_duration'),
        CheckConstraint('break_between_slots >= 0', name='check_break_duration'),
        Index('ix_doctor_schedules_doctor', 'doctor_id'),
    )

class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    birth_date = Column(Date)
    gender = Column(String(20))
    address = Column(String)
    contraindications = Column(Text)
    inn = Column(String(12), nullable=True, comment="ИНН пациента для налоговых документов")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="patient")
    appointments = relationship("Appointment", back_populates="patient")
    medical_records = relationship("MedicalRecord", back_populates="patient")
    payments = relationship("Payment", back_populates="patient")
    treatment_plans = relationship("TreatmentPlan", back_populates="patient", cascade="all, delete-orphan")
    reviews = relationship("DoctorReview", back_populates="patient", cascade="all, delete-orphan")
    certificates = relationship("TaxDeductionCertificate", back_populates="patient", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_patients_user', 'user_id'),
    )

class Service(Base):
    __tablename__ = "services"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    cost = Column(Numeric(10, 2), nullable=False)
    # duration = Column(Integer, nullable=False)  # Удалено, так как длительность определяется специализацией врача
    category = Column(SQLEnum(ServiceCategory), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    appointments = relationship("Appointment", back_populates="service")  # Для обратной совместимости
    doctor_services = relationship("DoctorService", back_populates="service", cascade="all, delete-orphan")
    doctors = relationship("Doctor", secondary="doctor_services", back_populates="services")
    appointment_services = relationship("AppointmentService", back_populates="service", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_services_name', 'name'),
        Index('ix_services_category', 'category'),
        Index('ix_services_cost', 'cost'),
    )

class DoctorService(Base):
    __tablename__ = "doctor_services"

    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), primary_key=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), primary_key=True)
    
    doctor = relationship("Doctor", back_populates="doctor_services")
    service = relationship("Service", back_populates="doctor_services")

class AppointmentService(Base):
    __tablename__ = "appointment_services"
    
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), primary_key=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), primary_key=True)
    
    appointment = relationship("Appointment", back_populates="appointment_services")
    service = relationship("Service", back_populates="appointment_services")

class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)  # Оставляем для обратной совместимости
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(SQLEnum(AppointmentStatus), default=AppointmentStatus.scheduled)
    cancellation_reason = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    service = relationship("Service", back_populates="appointments")  # Оставляем для обратной совместимости
    medical_records = relationship("MedicalRecord", back_populates="appointment")
    payments = relationship("Payment", back_populates="appointment")
    review = relationship("DoctorReview", back_populates="appointment", uselist=False)
    appointment_services = relationship("AppointmentService", back_populates="appointment", cascade="all, delete-orphan")
    services = relationship("Service", secondary="appointment_services", viewonly=True)
    
    __table_args__ = (
        Index('ix_appointments_patient', 'patient_id'),
        Index('ix_appointments_doctor', 'doctor_id'),
        Index('ix_appointments_service', 'service_id'),
        Index('ix_appointments_start_time', 'start_time'),
        Index('ix_appointments_status', 'status'),
    )

class MedicalRecord(Base, TimestampMixin):
    """Медицинская запись"""
    __tablename__ = "medical_records"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    treatment_plan_id = Column(Integer, ForeignKey("treatment_plans.id", ondelete="CASCADE"))
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"))
    record_type = Column(SQLEnum(RecordType), nullable=False)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    status = Column(SQLEnum(RecordStatus), nullable=False, default=RecordStatus.active)
    date = Column(Date, nullable=False)
    tooth_data = Column(JSON)  # Данные о зубах в формате JSON
    attachments = Column(ARRAY(String), default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    patient = relationship("Patient", back_populates="medical_records")
    doctor = relationship("Doctor", back_populates="medical_records")
    treatment_plan = relationship("TreatmentPlan", back_populates="medical_records")
    appointment = relationship("Appointment", back_populates="medical_records")
    
    __table_args__ = (
        Index('ix_medical_records_patient', 'patient_id'),
        Index('ix_medical_records_doctor', 'doctor_id'),
        Index('ix_medical_records_date', 'date'),
        Index('ix_medical_records_type', 'record_type'),
        Index('ix_medical_records_appointment', 'appointment_id'),
    )

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"))
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(SQLEnum(PaymentStatus), nullable=False, default=PaymentStatus.pending)
    payment_method = Column(SQLEnum(PaymentMethod), nullable=False)
    description = Column(String, nullable=True)  # Описание платежа
    external_id = Column(String, nullable=True, index=True)  # Внешний ID заказа (OrderId в Тинькофф)
    external_payment_id = Column(String, nullable=True, index=True)  # Внешний ID платежа (PaymentId в Тинькофф)
    payment_url = Column(String, nullable=True)  # URL для оплаты (PaymentURL в Тинькофф)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    appointment = relationship("Appointment", back_populates="payments")
    patient = relationship("Patient", back_populates="payments")
    doctor = relationship("Doctor", back_populates="payments")
    certificates = relationship("TaxDeductionCertificate", secondary="certificate_payments", viewonly=True)
    
    __table_args__ = (
        Index('ix_payments_appointment', 'appointment_id'),
        Index('ix_payments_patient', 'patient_id'),
        Index('ix_payments_doctor', 'doctor_id'),
        Index('ix_payments_status', 'status'),
    )

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(SQLEnum(NotificationType))
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)
    
    user = relationship("User", back_populates="notifications")
    
    __table_args__ = (
        Index('ix_notifications_user', 'user_id'),
        Index('ix_notifications_type', 'type'),
        Index('ix_notifications_scheduled_for', 'scheduled_for'),
    )

class DoctorSpecialDay(Base):
    """Особый день в расписании врача (отпуск, праздник и т.д.)"""
    __tablename__ = "doctor_special_days"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    type = Column(SQLEnum(SpecialDayType), nullable=False)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    doctor = relationship("Doctor", back_populates="special_days")

    __table_args__ = (
        Index('ix_doctor_special_days_doctor', 'doctor_id'),
        Index('ix_doctor_special_days_date', 'date'),
        Index('ix_doctor_special_days_type', 'type'),
    )

class TreatmentPlan(Base):
    """План лечения"""
    __tablename__ = "treatment_plans"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    status = Column(SQLEnum(TreatmentStatus), nullable=False, default=TreatmentStatus.planned)
    notes = Column(String)

    patient = relationship("Patient", back_populates="treatment_plans")
    doctor = relationship("Doctor", back_populates="treatment_plans")
    medical_records = relationship("MedicalRecord", back_populates="treatment_plan")
    
    __table_args__ = (
        Index('ix_treatment_plans_patient', 'patient_id'),
        Index('ix_treatment_plans_doctor', 'doctor_id'),
        Index('ix_treatment_plans_start_date', 'start_date'),
    )

class DoctorReview(Base):
    __tablename__ = "doctor_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"))
    rating = Column(Integer, CheckConstraint("rating >= 1 AND rating <= 5"), nullable=False)
    comment = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    doctor = relationship("Doctor", back_populates="reviews")
    patient = relationship("Patient", back_populates="reviews")
    appointment = relationship("Appointment", back_populates="review")
    
    __table_args__ = (
        Index('ix_doctor_reviews_doctor', 'doctor_id'),
        Index('ix_doctor_reviews_patient', 'patient_id'),
        Index('ix_doctor_reviews_appointment', 'appointment_id'),
        Index('ix_doctor_reviews_rating', 'rating'),
    )

class ActionLog(Base):
    __tablename__ = "action_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String, nullable=False)
    action_type = Column(String, nullable=False)
    record_id = Column(Integer, nullable=False)
    old_data = Column(String)
    new_data = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index('ix_action_logs_table_action', 'table_name', 'action_type'),
        Index('ix_action_logs_created_at', 'created_at'),
    )

class TaxDeductionCertificate(Base):
    """Справка для налогового вычета"""
    __tablename__ = "tax_deduction_certificates"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    certificate_number = Column(String, unique=True, nullable=False)
    status = Column(SQLEnum(CertificateStatus), nullable=False, default=CertificateStatus.issued)
    issued_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    patient = relationship("Patient", back_populates="certificates")
    issued_by = relationship("User", foreign_keys=[issued_by_id])
    cancelled_by = relationship("User", foreign_keys=[cancelled_by_id])
    payments = relationship("Payment", secondary="certificate_payments")
    
    __table_args__ = (
        Index('ix_tax_certificates_patient', 'patient_id'),
        Index('ix_tax_certificates_year', 'year'),
        Index('ix_tax_certificates_status', 'status'),
    )

class CertificatePayment(Base):
    """Связь между справками и платежами"""
    __tablename__ = "certificate_payments"
    
    certificate_id = Column(Integer, ForeignKey("tax_deduction_certificates.id", ondelete="CASCADE"), primary_key=True)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
