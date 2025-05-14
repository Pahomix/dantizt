'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronDown, Edit2, Eye, Trash2 } from 'lucide-react';

const recordTypeLabels = {
  note: 'Заметка',
  procedure: 'Процедура',
  prescription: 'Назначение',
  examination: 'Осмотр',
  treatment: 'Лечение',
  diagnosis: 'Диагноз'
};

const recordTypeColors = {
  note: 'bg-gray-100 text-gray-800',
  procedure: 'bg-blue-100 text-blue-800',
  prescription: 'bg-purple-100 text-purple-800',
  examination: 'bg-green-100 text-green-800',
  treatment: 'bg-yellow-100 text-yellow-800',
  diagnosis: 'bg-red-100 text-red-800'
};

export function MedicalRecordsList({ records, onView, onEdit, onDelete }) {
  const [expandedRecords, setExpandedRecords] = useState(new Set());

  const toggleExpand = (recordId) => {
    setExpandedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  if (!records?.length) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Нет медицинских записей</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.map((record) => (
        <div
          key={record.id}
          className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
        >
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    recordTypeColors[record.record_type] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {recordTypeLabels[record.record_type] || 'Неизвестный тип'}
                </span>
                <h3 className="text-lg font-medium text-gray-900">{record.title}</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onView(record)}
                  className="p-1 text-gray-400 hover:text-gray-500"
                >
                  <Eye className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onEdit(record)}
                  className="p-1 text-gray-400 hover:text-gray-500"
                >
                  <Edit2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onDelete(record)}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => toggleExpand(record.id)}
                  className="p-1 text-gray-400 hover:text-gray-500"
                >
                  <ChevronDown
                    className={`h-5 w-5 transform transition-transform ${
                      expandedRecords.has(record.id) ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {format(new Date(record.created_at), 'PPp', { locale: ru })}
            </div>
            {expandedRecords.has(record.id) && (
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Описание</h4>
                  <p className="mt-1 text-sm text-gray-500">{record.description}</p>
                </div>
                {record.tooth_positions?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Позиции зубов</h4>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {record.tooth_positions.map((position) => (
                        <span
                          key={position}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {position}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {record.notes && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Дополнительные заметки</h4>
                    <p className="mt-1 text-sm text-gray-500">{record.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
