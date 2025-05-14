'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePatientStore } from '@/store/patientStore';
import { Search } from 'lucide-react';

export default function MedicalRecordsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { patients, loading, error, fetchPatients } = usePatientStore();

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const filteredPatients = patients.filter(patient => {
    if (!patient?.user) return false;
    const searchLower = searchQuery.toLowerCase();
    const fullName = patient.user.full_name.toLowerCase();
    return fullName.includes(searchLower) || 
           (patient.user.email || '').toLowerCase().includes(searchLower);
  });

  const getInitials = (patient) => {
    if (!patient?.user?.full_name) return '??';
    return `${patient.user.full_name[0]}${patient.user.full_name[1] || ''}`;
  };

  const handlePatientClick = (patientId) => {
    router.push(`/admin/medical-records/${patientId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Медицинские карты</h1>
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск пациентов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPatients.map((patient) => (
          <div
            key={patient.id}
            onClick={() => handlePatientClick(patient.id)}
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer p-6"
          >
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-semibold text-lg">
                  {getInitials(patient)}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {patient.user?.full_name || 'Нет имени'}
                </h3>
                <p className="text-sm text-gray-500">{patient.user?.email || 'Нет email'}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {patient.gender && (
                <div className="text-sm">
                  <span className="text-gray-500">Пол:</span>{' '}
                  <span className="text-gray-900">
                    {patient.gender === 'male' ? 'Мужской' : 'Женский'}
                  </span>
                </div>
              )}
              {patient.address && (
                <div className="text-sm">
                  <span className="text-gray-500">Адрес:</span>{' '}
                  <span className="text-gray-900">{patient.address}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredPatients.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {searchQuery
              ? 'Пациенты не найдены'
              : 'Нет зарегистрированных пациентов'}
          </p>
        </div>
      )}
    </div>
  );
}
