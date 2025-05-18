import api from '@/lib/axios';
import { paymentsApi } from './payments';

// Экспортируем сервис для работы с платежами
export { paymentsApi };

// Сервис для работы с пациентами
export const patientsApi = {
  getAll: (params) => api.get('/patients', { params }),
  getById: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  delete: (id) => api.delete(`/patients/${id}`),
};

// Сервис для работы с диагнозами
export const diagnosesApi = {
  getAll: (params) => api.get('/diagnoses', { params }),
  getById: (id) => api.get(`/diagnoses/${id}`),
  getByPatient: (patientId) => api.get(`/diagnoses/patient/${patientId}`),
  create: (data) => api.post('/diagnoses', data),
  update: (id, data) => api.put(`/diagnoses/${id}`, data),
  delete: (id) => api.delete(`/diagnoses/${id}`),
};

// Сервис для работы с медицинскими записями
export const medicalRecordsApi = {
  getAll: (params) => api.get('/medical-records', { params }),
  getById: (id) => api.get(`/medical-records/${id}`),
  getByPatient: (patientId) => api.get(`/medical-records/patient/${patientId}`),
  create: (data) => api.post('/medical-records', data),
  update: (id, data) => api.put(`/medical-records/${id}`, data),
  delete: (id) => api.delete(`/medical-records/${id}`),
  addAttachment: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/medical-records/${id}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Сервис для работы с планами лечения
export const treatmentPlansApi = {
  getAll: (params) => api.get('/treatment-plans', { params }),
  getById: (id) => api.get(`/treatment-plans/${id}`),
  getByPatient: (patientId) => api.get(`/treatment-plans/patient/${patientId}`),
  create: (data) => api.post('/treatment-plans', data),
  update: (id, data) => api.put(`/treatment-plans/${id}`, data),
  delete: (id) => api.delete(`/treatment-plans/${id}`),
  // Операции с шагами плана
  addStep: (planId, data) => api.post(`/treatment-plans/${planId}/steps`, data),
  updateStep: (planId, stepId, data) => api.put(`/treatment-plans/${planId}/steps/${stepId}`, data),
  deleteStep: (planId, stepId) => api.delete(`/treatment-plans/${planId}/steps/${stepId}`),
};

// Сервис для работы с расписанием врачей
export const schedulesApi = {
  getDoctorSchedule: (doctorId, date) => {
    const params = date ? { date } : {};
    return api.get(`/schedules/doctors/${doctorId}/schedules`, { params });
  },
  getDoctorAvailability: (doctorId, date, slotDuration = 30) => {
    return api.get(`/schedules/doctors/${doctorId}/availability`, {
      params: { date, slot_duration: slotDuration }
    });
  },
  updateDoctorSchedule: (doctorId, schedules) => {
    return api.put(`/schedules/doctors/${doctorId}/schedules`, { schedules });
  },
  createSpecialDay: (doctorId, specialDay) => {
    return api.post(`/schedules/doctors/${doctorId}/special-days`, specialDay);
  },
  updateSpecialDay: (doctorId, specialDayId, specialDay) => {
    return api.put(`/schedules/doctors/${doctorId}/special-days/${specialDayId}`, specialDay);
  },
  deleteSpecialDay: (doctorId, specialDayId) => {
    return api.delete(`/schedules/doctors/${doctorId}/special-days/${specialDayId}`);
  },
  // Добавляем методы для работы с шаблонами расписания
  getDoctorScheduleTemplates: (doctorId) => {
    return api.get(`/schedules/doctors/${doctorId}/schedule-templates`);
  },
  createScheduleTemplate: (doctorId, template) => {
    return api.post(`/schedules/doctors/${doctorId}/schedule-templates`, template);
  },
  updateScheduleTemplate: (doctorId, templateId, template) => {
    return api.put(`/schedules/doctors/${doctorId}/schedule-templates/${templateId}`, template);
  },
  deleteScheduleTemplate: (doctorId, templateId) => {
    return api.delete(`/schedules/doctors/${doctorId}/schedule-templates/${templateId}`);
  }
};

// Сервис для работы с документами и справками
export const documentsApi = {
  // Получить справку для налогового вычета
  getTaxDeductionCertificate: (patientId, year, sendEmail = false) => {
    const params = new URLSearchParams();
    params.append('year', year);
    if (sendEmail) {
      params.append('send_email', 'true');
    }
    
    return api.get(`/medical-records/patient/${patientId}/tax-deduction?${params.toString()}`, {
      responseType: sendEmail ? 'json' : 'blob'
    });
  }
};
