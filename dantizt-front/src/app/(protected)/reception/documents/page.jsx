'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MagnifyingGlassIcon, 
  DocumentArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PrinterIcon,
  EnvelopeIcon,
  DocumentDuplicateIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { useDocumentsStore } from '@/store/documentsStore';
import { usePatientsStore } from '@/store/patientsStore';
import PatientSelector from '@/components/PatientSelector';
import YearSelector from '@/components/YearSelector';

// Собственная реализация хука useDebounce
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

export default function DocumentsPage() {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { 
    documents, 
    loading, 
    pagination, 
    filter,
    fetchDocuments, 
    setFilter, 
    setPagination,
    generateTaxDeductionCertificate,
    printDocument,
    downloadDocument,
    cancelCertificate
  } = useDocumentsStore();
  
  const { patients, fetchPatients } = usePatientsStore();
  
  // Загружаем список документов при монтировании компонента
  useEffect(() => {
    fetchDocuments().catch(console.error);
    fetchPatients().catch(console.error);
  }, [fetchDocuments, fetchPatients]);
  
  // Обновляем список документов при изменении фильтров
  useEffect(() => {
    setFilter({ searchTerm: debouncedSearchTerm });
    fetchDocuments().catch(console.error);
  }, [debouncedSearchTerm, setFilter, fetchDocuments]);
  
  // Обработчик изменения года
  const handleYearChange = useCallback((year) => {
    setSelectedYear(year);
    setFilter({ year });
    fetchDocuments().catch(console.error);
  }, [setFilter, fetchDocuments]);
  
  // Обработчик изменения страницы
  const handlePageChange = useCallback((page) => {
    setPagination({ currentPage: page });
    fetchDocuments().catch(console.error);
  }, [setPagination, fetchDocuments]);
  
  // Обработчик выбора пациента
  const handlePatientSelect = useCallback((patient) => {
    setSelectedPatient(patient);
  }, []);
  
  // Обработчик генерации справки
  const handleGenerateCertificate = useCallback(async (patientId, year) => {
    if (!patientId) {
      toast('Выберите пациента', { type: 'warning' });
      return;
    }
    
    if (!year) {
      toast('Выберите год', { type: 'warning' });
      return;
    }
    
    setIsGenerating(true);
    try {
      await generateTaxDeductionCertificate(patientId, year, false);
      toast('Справка успешно сформирована', { type: 'success' });
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast('Ошибка при формировании справки', { type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  }, [generateTaxDeductionCertificate]);
  
  // Обработчик печати документа
  const handlePrint = useCallback(async (documentId) => {
    try {
      await printDocument(documentId);
    } catch (error) {
      console.error('Error printing document:', error);
    }
  }, [printDocument]);
  
  // Обработчик скачивания документа
  const handleDownload = useCallback(async (documentId) => {
    try {
      await downloadDocument(documentId);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  }, [downloadDocument]);
  
  // Обработчик отмены справки
  const handleCancelCertificate = useCallback(async (certificateId) => {
    if (!confirm('Вы уверены, что хотите отменить эту справку?')) {
      return;
    }
    
    try {
      await cancelCertificate(certificateId);
    } catch (error) {
      console.error('Error cancelling certificate:', error);
    }
  }, [cancelCertificate]);
  
  // Форматирование даты
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'dd MMMM yyyy', { locale: ru });
    } catch (error) {
      return 'Некорректная дата';
    }
  };
  
  // Получение статуса справки
  const getStatusBadge = (status) => {
    switch (status) {
      case 'issued':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Выдана
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Отменена
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };
  
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold leading-6 text-gray-900">Справки для налогового вычета</h1>
          <p className="mt-2 text-sm text-gray-700">
            Список справок для налогового вычета, выданных пациентам
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => handleGenerateCertificate(selectedPatient?.id, selectedYear)}
            disabled={isGenerating || loading}
          >
            {isGenerating ? 'Формирование...' : 'Выдать справку'}
          </button>
        </div>
      </div>
      
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="patient" className="block text-sm font-medium text-gray-700">
            Пациент
          </label>
          <div className="mt-1">
            <PatientSelector 
              patients={patients} 
              selectedPatient={selectedPatient} 
              onSelect={handlePatientSelect} 
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="year" className="block text-sm font-medium text-gray-700">
            Год
          </label>
          <div className="mt-1">
            <YearSelector 
              selectedYear={selectedYear} 
              onChange={handleYearChange} 
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700">
            Поиск
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              name="search"
              id="search"
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 pr-3 py-2 sm:text-sm border border-gray-300 rounded-md h-[38px]"
              placeholder="Поиск по пациенту или номеру справки"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              {loading ? (
                <div className="text-center py-12">
                  <div className="spinner"></div>
                  <p className="mt-2 text-sm text-gray-500">Загрузка данных...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12">
                  <DocumentDuplicateIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Справки не найдены</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {filter.searchTerm ? 'Попробуйте изменить параметры поиска' : 'Выдайте справку для пациента, чтобы она появилась в списке'}
                  </p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Пациент
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Номер справки
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Дата выдачи
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Год
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Сумма
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Статус
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Действия</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {documents.map((document) => (
                      <tr key={document.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {document.patient_name || (document.patient?.user?.full_name)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {document.certificate_number}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatDate(document.date || document.issued_at)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {document.year}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {document.amount} ₽
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {getStatusBadge(document.status)}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex justify-end space-x-2">
                            {document.status !== 'cancelled' && (
                              <>
                                <button
                                  type="button"
                                  className="text-indigo-600 hover:text-indigo-900"
                                  onClick={() => handlePrint(document.id)}
                                  title="Распечатать"
                                >
                                  <PrinterIcon className="h-5 w-5" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="text-indigo-600 hover:text-indigo-900"
                                  onClick={() => handleCancelCertificate(document.id)}
                                  title="Отменить справку"
                                >
                                  <XCircleIcon className="h-5 w-5" aria-hidden="true" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className="text-indigo-600 hover:text-indigo-900"
                              onClick={() => handleDownload(document.id)}
                              title="Скачать"
                            >
                              <DocumentArrowDownIcon className="h-5 w-5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Пагинация */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(Math.max(1, pagination.currentPage - 1))}
              disabled={pagination.currentPage === 1}
              className={`relative inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
                pagination.currentPage === 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Предыдущая
            </button>
            <button
              onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
              disabled={pagination.currentPage === pagination.totalPages}
              className={`relative ml-3 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
                pagination.currentPage === pagination.totalPages
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Следующая
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Показано <span className="font-medium">{(pagination.currentPage - 1) * 10 + 1}</span> по{' '}
                <span className="font-medium">
                  {Math.min(pagination.currentPage * 10, pagination.totalItems)}
                </span>{' '}
                из <span className="font-medium">{pagination.totalItems}</span> результатов
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(Math.max(1, pagination.currentPage - 1))}
                  disabled={pagination.currentPage === 1}
                  className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 ${
                    pagination.currentPage === 1
                      ? 'cursor-not-allowed'
                      : 'hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                  }`}
                >
                  <span className="sr-only">Предыдущая</span>
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                </button>
                
                {/* Номера страниц */}
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                      page === pagination.currentPage
                        ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                        : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 ${
                    pagination.currentPage === pagination.totalPages
                      ? 'cursor-not-allowed'
                      : 'hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                  }`}
                >
                  <span className="sr-only">Следующая</span>
                  <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border-left-color: #3b82f6;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
