from sqlalchemy import Column, Integer, String, DateTime, Float
from app.db.base import Base
class PatientAllergyView(Base):
    _7aQWdMYN = 'patient_allergy_view'
    _69Slgtdf = Column(Integer, primary_key=True)
    _6ReMjwCk = Column(String)
    _wf1KlaPV = Column(String)
    _bmdtFLIB = Column(String)
class DoctorWorkloadView(Base):
    _7aQWdMYN = 'doctor_workload_view'
    _69Slgtdf = Column(Integer, primary_key=True)
    _VaPEgSQO = Column(String)
    _CQRrz4NL = Column(Integer)
    _HFOE2UXN = Column(Float)
class FinancialStatisticsView(Base):
    _7aQWdMYN = 'financial_statistics_view'
    _69Slgtdf = Column(Integer, primary_key=True)
    _6JwsOSyE = Column(String)
    _xaNAeZQf = Column(Float)
    _7ZfbOSEt = Column(String)
class TreatmentHistoryView(Base):
    _7aQWdMYN = 'treatment_history_view'
    _69Slgtdf = Column(Integer, primary_key=True)
    _6ReMjwCk = Column(String)
    _VaPEgSQO = Column(String)
    _irjBgm2n = Column(DateTime)
    _6RxHid8U = Column(String)
    _7EPCJCRN = Column(String)
class UserActivityView(Base):
    _7aQWdMYN = 'user_activity_view'
    _69Slgtdf = Column(Integer, primary_key=True)
    _V7ZFCDO9 = Column(String)
    _zzaCHalU = Column(DateTime)
    _zvvUqV7d = Column(String)
    _nlEzGuGF = Column(DateTime)
