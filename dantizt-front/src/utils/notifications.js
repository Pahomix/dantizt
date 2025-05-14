import { toast } from 'react-toastify';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

// Конфигурация NProgress
NProgress.configure({ 
  showSpinner: false,
  minimum: 0.1,
  easing: 'ease',
  speed: 500
});

// Функция для показа успешного уведомления
export const showSuccess = (message) => {
  toast.success(message, {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: false,
    draggable: true,
    progress: undefined,
  });
};

// Функция для показа уведомления об ошибке
export const showError = (message) => {
  toast.error(message, {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
  });
};

// Функция для показа информационного уведомления
export const showInfo = (message) => {
  toast.info(message, {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
  });
};

// Функции для работы с прогресс-баром
export const startProgress = () => {
  NProgress.start();
};

export const stopProgress = () => {
  NProgress.done();
};

// Функция для добавления прогресс-бара к асинхронным операциям
export const withProgress = async (promise) => {
  startProgress();
  try {
    const result = await promise;
    stopProgress();
    return result;
  } catch (error) {
    stopProgress();
    throw error;
  }
};
