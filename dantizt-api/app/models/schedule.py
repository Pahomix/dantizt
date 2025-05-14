from sqlalchemy import Column, Integer, Boolean, Time, Date, String, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.db.base_class import Base

class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0 = Monday, 6 = Sunday
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    is_working = Column(Boolean, default=True)
    slot_duration = Column(Integer, default=30)  # в минутах
    break_between_slots = Column(Integer, default=0)  # в минутах
    breaks = Column(JSON, default=list)  # список перерывов в формате [{"start": "HH:MM", "end": "HH:MM"}]

    doctor = relationship("Doctor", back_populates="schedules")

class DoctorSpecialDay(Base):
    __tablename__ = "doctor_special_days"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    date = Column(Date, nullable=False)
    is_working = Column(Boolean, default=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    description = Column(String, nullable=True)

    doctor = relationship("Doctor", back_populates="special_days")
