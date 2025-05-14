'use client';

import { useEffect, useState } from 'react';
import { useServicesStore } from '@/store/servicesStore';

export function ServiceSelection({ appointment, onServicesSelected }) {
  const [selectedServices, setSelectedServices] = useState([]);
  const { services, loading, error, fetchServices, fetchServicesByDoctor } = useServicesStore();

  useEffect(() => {
    // Если есть данные о враче, загружаем услуги для его специализации
    if (appointment && appointment.doctor_id) {
      fetchServicesByDoctor(appointment.doctor_id);
    } else {
      // Если нет данных о враче, загружаем все услуги
      fetchServices();
    }
  }, [appointment, fetchServices, fetchServicesByDoctor]);

  useEffect(() => {
    // Если у приема уже есть выбранные услуги, устанавливаем их
    if (appointment && appointment.services && appointment.services.length > 0) {
      setSelectedServices(appointment.services.map(service => service.id));
    }
  }, [appointment]);

  const handleServiceToggle = (serviceId) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const handleSubmit = () => {
    onServicesSelected(selectedServices);
  };

  if (loading) {
    return <div className="text-center py-4">Загрузка услуг...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">Ошибка: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Выберите оказанные услуги</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map(service => (
          <div 
            key={service.id} 
            className={`
              border rounded-lg p-4 cursor-pointer transition-colors
              ${selectedServices.includes(service.id) 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'}
            `}
            onClick={() => handleServiceToggle(service.id)}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{service.name}</h3>
                {service.description && (
                  <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                )}
              </div>
              <div className="text-right">
                <span className="text-lg font-semibold text-gray-900">
                  {service.cost.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
            
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                {service.category}
              </span>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedServices.includes(service.id)}
                  onChange={() => {}} // Обработчик уже есть на родительском div
                  className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {services.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Нет доступных услуг для данной специализации врача
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSubmit}
          disabled={selectedServices.length === 0}
          className={`
            px-4 py-2 rounded-md font-medium
            ${selectedServices.length === 0
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'}
          `}
        >
          Подтвердить выбор услуг
        </button>
      </div>
    </div>
  );
}
