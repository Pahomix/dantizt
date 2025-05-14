import { create } from 'zustand';
import api from '@/lib/axios';
import { toast } from 'react-toastify';

/**
 * Documents store for managing tax deduction certificates and other documents.
 */
export const useDocumentsStore = create((set, get) => ({
  /**
   * List of documents.
   */
  documents: [],

  /**
   * Current document.
   */
  selectedDocument: null,

  /**
   * Loading state.
   */
  loading: false,

  /**
   * Error message.
   */
  error: null,

  /**
   * Pagination data.
   */
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0
  },

  /**
   * Filter state.
   */
  filter: {
    status: 'all',
    searchTerm: '',
    year: new Date().getFullYear()
  },

  /**
   * Clears the error message.
   */
  clearError: () => set({ error: null }),

  /**
   * Sets the filter state.
   * @param {object} filterData - Filter data.
   */
  setFilter: (filterData) => set(state => ({
    filter: { ...state.filter, ...filterData }
  })),

  /**
   * Sets the pagination data.
   * @param {object} paginationData - Pagination data.
   */
  setPagination: (paginationData) => set(state => ({
    pagination: { ...state.pagination, ...paginationData }
  })),

  /**
   * Fetches the list of tax deduction certificates.
   */
  fetchDocuments: async () => {
    const { filter, pagination } = get();
    set({ loading: true, error: null });
    
    try {
      // Используем новый эндпоинт для получения справок
      const params = new URLSearchParams();
      params.append('page', pagination.currentPage);
      
      if (filter.searchTerm) {
        params.append('search', filter.searchTerm);
      }
      
      if (filter.status && filter.status !== 'all') {
        params.append('status', filter.status);
      }
      
      if (filter.year) {
        params.append('year', filter.year);
      }
      
      const response = await api.get(`/certificates?${params.toString()}`);
      
      set({ 
        documents: response.data.items, 
        loading: false,
        pagination: {
          currentPage: response.data.page,
          totalPages: response.data.total_pages,
          totalItems: response.data.total
        }
      });
    } catch (error) {
      console.error('Error fetching certificates:', error);
      
      // Если получаем 404, значит API еще не обновлен, используем старый подход
      if (error.response?.status === 404) {
        await get().fetchDocumentsLegacy();
      } else {
        set({ 
          error: error.response?.data?.detail || error.message, 
          loading: false,
          documents: [] // Устанавливаем пустой массив в случае ошибки
        });
        toast('Ошибка при загрузке списка документов', { type: 'error' });
        throw error;
      }
    }
  },

  /**
   * Устаревший метод получения документов через API платежей.
   * Используется как запасной вариант, если новый API еще не доступен.
   */
  fetchDocumentsLegacy: async () => {
    const { filter, pagination } = get();
    
    try {
      // Используем API платежей как запасной вариант
      const response = await api.get('/payments', {
        params: {
          page: pagination.currentPage,
          search: filter.searchTerm,
          status: 'completed', // Получаем только завершенные платежи
          year: filter.year
        }
      });
      
      // Преобразуем данные о платежах в формат документов
      const payments = response.data.items || [];
      const documents = payments.map(payment => {
        // Учитываем возможность как плоской структуры, так и вложенных объектов
        const patientName = payment.patient_name || 
                           (payment.patient?.user?.full_name || 
                            payment.patient?.full_name || 
                            'Нет данных');
        
        return {
          id: payment.id,
          patient_id: payment.patient_id,
          patient_name: patientName,
          date: payment.created_at,
          year: new Date(payment.created_at).getFullYear(),
          amount: payment.amount,
          status: 'issued', // Все завершенные платежи считаем выданными справками
          certificate_number: `${new Date(payment.created_at).getFullYear()}-${payment.patient_id}-${payment.id}`
        };
      });
      
      set({ 
        documents: documents, 
        loading: false,
        pagination: {
          currentPage: response.data.page || 1,
          totalPages: response.data.total_pages || Math.ceil(response.data.total / 10) || 1,
          totalItems: response.data.total || documents.length
        }
      });
    } catch (error) {
      console.error('Error fetching documents legacy:', error);
      set({ 
        error: error.response?.data?.detail || error.message, 
        loading: false,
        documents: [] // Устанавливаем пустой массив в случае ошибки
      });
      toast('Ошибка при загрузке списка документов', { type: 'error' });
      throw error;
    }
  },

  /**
   * Creates a new tax deduction certificate.
   * @param {number} patientId - ID of the patient.
   * @param {number} year - Year for the certificate.
   * @param {Array} paymentIds - List of payment IDs to include in the certificate.
   */
  createCertificate: async (patientId, year, paymentIds) => {
    set({ loading: true, error: null });
    
    try {
      const response = await api.post('/certificates', {
        patient_id: patientId,
        year: year,
        payment_ids: paymentIds
      });
      
      set({ loading: false });
      toast('Справка успешно создана', { type: 'success' });
      
      // Обновляем список документов
      await get().fetchDocuments();
      
      return response.data;
    } catch (error) {
      console.error('Error creating certificate:', error);
      set({ 
        error: error.response?.data?.detail || error.message, 
        loading: false 
      });
      toast('Ошибка при создании справки', { type: 'error' });
      throw error;
    }
  },

  /**
   * Cancels a tax deduction certificate.
   * @param {number} certificateId - ID of the certificate to cancel.
   */
  cancelCertificate: async (certificateId) => {
    set({ loading: true, error: null });
    
    try {
      const response = await api.patch(`/certificates/${certificateId}`, {
        status: 'cancelled'
      });
      
      set({ loading: false });
      toast('Справка успешно отменена', { type: 'success' });
      
      // Обновляем список документов
      await get().fetchDocuments();
      
      return response.data;
    } catch (error) {
      console.error('Error cancelling certificate:', error);
      set({ 
        error: error.response?.data?.detail || error.message, 
        loading: false 
      });
      toast('Ошибка при отмене справки', { type: 'error' });
      throw error;
    }
  },

  /**
   * Generates a tax deduction certificate.
   * @param {number} patientId - ID of the patient.
   * @param {number} year - Year for the certificate.
   */
  generateTaxDeductionCertificate: async (patientId, year) => {
    set({ loading: true, error: null });
    
    try {
      // Сначала получаем платежи пациента за указанный год
      const paymentsResponse = await api.get('/payments', {
        params: {
          patient_id: patientId,
          status: 'completed',
          year: year
        }
      });
      
      const payments = paymentsResponse.data.items || [];
      
      if (payments.length === 0) {
        toast('Нет завершенных платежей за указанный год', { type: 'warning' });
        set({ loading: false });
        return null;
      }
      
      // Создаем справку с использованием новых эндпоинтов
      try {
        const paymentIds = payments.map(payment => payment.id);
        const certificate = await get().createCertificate(patientId, year, paymentIds);
        
        set({ loading: false });
        return certificate;
      } catch (error) {
        // Если новые эндпоинты не работают, используем старый подход
        if (error.response?.status === 404) {
          return await get().generateTaxDeductionCertificateLegacy(patientId, year);
        }
        throw error;
      }
    } catch (error) {
      console.error('Error generating certificate:', error);
      set({ 
        error: error.response?.data?.detail || error.message, 
        loading: false 
      });
      toast('Ошибка при генерации справки', { type: 'error' });
      throw error;
    }
  },

  /**
   * Устаревший метод генерации справки через API медицинских записей.
   * Используется как запасной вариант, если новый API еще не доступен.
   */
  generateTaxDeductionCertificateLegacy: async (patientId, year) => {
    try {
      const params = new URLSearchParams();
      params.append('year', year);
      
      const response = await api.get(`/medical-records/patient/${patientId}/tax-deduction?${params.toString()}`, {
        responseType: 'blob'
      });
      
      set({ loading: false });
      
      // Если справка скачивается как файл
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tax_deduction_${year}_${patientId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      // После успешной генерации обновляем список документов
      await get().fetchDocuments();
      
      return blob;
    } catch (error) {
      console.error('Error generating certificate legacy:', error);
      set({ 
        error: error.response?.data?.detail || error.message, 
        loading: false 
      });
      toast('Ошибка при генерации справки', { type: 'error' });
      throw error;
    }
  },

  /**
   * Prints a document.
   * @param {number} documentId - ID of the document to print.
   */
  printDocument: async (documentId) => {
    set({ loading: true, error: null });
    
    try {
      // Пробуем использовать новый эндпоинт
      try {
        const response = await api.get(`/certificates/${documentId}/download`, { responseType: 'blob' });
        
        set({ loading: false });
        
        // Открываем PDF в новом окне для печати
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        
        if (printWindow) {
          printWindow.addEventListener('load', () => {
            printWindow.print();
          });
        } else {
          toast('Пожалуйста, разрешите всплывающие окна для печати документа', { type: 'warning' });
        }
        
        return response.data;
      } catch (error) {
        // Если новый эндпоинт не работает, используем старый
        if (error.response?.status === 404) {
          const document = get().documents.find(doc => doc.id === documentId);
          if (!document) {
            throw new Error('Документ не найден');
          }
          
          const response = await api.get(`/medical-records/patient/${document.patient_id}/tax-deduction?year=${document.year}`, { 
            responseType: 'blob' 
          });
          
          set({ loading: false });
          
          // Открываем PDF в новом окне для печати
          const blob = new Blob([response.data], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          const printWindow = window.open(url, '_blank');
          
          if (printWindow) {
            printWindow.addEventListener('load', () => {
              printWindow.print();
            });
          } else {
            toast('Пожалуйста, разрешите всплывающие окна для печати документа', { type: 'warning' });
          }
          
          return response.data;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error printing document:', error);
      set({ 
        error: error.response?.data?.detail || error.message, 
        loading: false 
      });
      toast('Ошибка при печати документа', { type: 'error' });
      throw error;
    }
  },

  /**
   * Downloads a document.
   * @param {number} documentId - ID of the document to download.
   */
  downloadDocument: async (documentId) => {
    set({ loading: true, error: null });
    
    try {
      // Получаем информацию о документе
      const certificateDoc = get().documents.find(doc => doc.id === documentId);
      if (!certificateDoc) {
        throw new Error('Документ не найден');
      }
      
      // Получаем информацию о пациенте для имени файла
      const patientResponse = await api.get(`/patients/${certificateDoc.patient_id}`);
      const patientName = patientResponse.data.user?.full_name || 'Пациент';
      
      // Пробуем использовать новый эндпоинт
      try {
        const response = await api.get(`/certificates/${documentId}/download`, { responseType: 'blob' });
        
        // Создаем ссылку для скачивания файла
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Справка для налогового вычета ${patientName}.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        set({ loading: false });
        return response.data;
      } catch (error) {
        // Если новый эндпоинт не работает, используем старый
        if (error.response?.status === 404) {
          const response = await api.get(`/medical-records/patient/${certificateDoc.patient_id}/tax-deduction?year=${certificateDoc.year}`, { 
            responseType: 'blob' 
          });
          
          // Создаем ссылку для скачивания файла
          const blob = new Blob([response.data], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `Справка для налогового вычета ${patientName}.pdf`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          set({ loading: false });
          return response.data;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      set({ 
        error: error.response?.data?.detail || error.message, 
        loading: false 
      });
      toast('Ошибка при скачивании документа', { type: 'error' });
      throw error;
    }
  },
}));
