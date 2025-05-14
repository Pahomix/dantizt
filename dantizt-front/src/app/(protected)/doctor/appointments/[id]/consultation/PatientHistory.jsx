'use client';

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const recordTypeLabels = {
  examination: 'Осмотр',
  diagnosis: 'Диагноз',
  treatment: 'План лечения',
  procedure: 'Процедура',
  prescription: 'Рецепт',
  xray: 'Рентген',
  note: 'Заметка',
  lab_result: 'Результаты анализов'
};

export function PatientHistory({ records, appointment, diagnoses, handleViewRecord, handleEditRecord, handleDeleteRecord }) {
  const sortedRecords = [...(records || [])].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  // Фильтруем записи по текущему приему
  const currentAppointmentRecords = sortedRecords.filter(
    record => record.appointment_id === appointment.id
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Записи текущего приема
        </h3>
        {currentAppointmentRecords.map((record) => (
          <div key={record.id} className="bg-white p-6 rounded-lg shadow mb-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{record.title}</h3>
                <p className="text-sm text-gray-500">
                  {formatDate(record.created_at)}
                </p>
              </div>
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                {recordTypeLabels[record.record_type] || record.record_type}
              </span>
            </div>
            
            <div className="prose max-w-none">
              <p className="text-gray-700">{record.description}</p>
              
              {record.tooth_positions && record.tooth_positions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Зубы:</h4>
                  <ul className="list-disc pl-5">
                    {record.tooth_positions.map((tooth, index) => (
                      <li key={index} className="text-gray-700">
                        {tooth.quadrant}-{tooth.number}
                        {tooth.surfaces && tooth.surfaces.length > 0 && 
                          ` (${tooth.surfaces.join(', ')})`
                        }
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {record.notes && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Заметки:</h4>
                  <p className="text-gray-700">{record.notes}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          История предыдущих приемов
        </h3>
        {sortedRecords.filter(record => record.appointment_id !== appointment.id).map((record) => (
          <div key={record.id} className="bg-white p-6 rounded-lg shadow mb-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{record.title}</h3>
                <p className="text-sm text-gray-500">
                  {formatDate(record.created_at)}
                </p>
              </div>
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                {recordTypeLabels[record.record_type] || record.record_type}
              </span>
            </div>
            
            <div className="prose max-w-none">
              <p className="text-gray-700">{record.description}</p>
              
              {record.tooth_positions && record.tooth_positions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Зубы:</h4>
                  <ul className="list-disc pl-5">
                    {record.tooth_positions.map((tooth, index) => (
                      <li key={index} className="text-gray-700">
                        {tooth.quadrant}-{tooth.number}
                        {tooth.surfaces && tooth.surfaces.length > 0 && 
                          ` (${tooth.surfaces.join(', ')})`
                        }
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {record.notes && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Заметки:</h4>
                  <p className="text-gray-700">{record.notes}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
