'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useAuthStore } from '@/store/auth.store';
import { HOME_ROUTES } from '@/constants/routes';
import api from '@/lib/axios';

export default function Register() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm();
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { login } = useAuthStore();

  // Функция для проверки возраста (не менее 18 лет)
  const isAdult = (dateString) => {
    if (!dateString) return true; // Если дата не указана, пропускаем проверку
    
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 18;
  };

  // Форматирование телефонного номера
  const formatPhoneNumber = (value) => {
    if (!value) return value;
    
    // Удаляем все нецифровые символы
    const phoneNumber = value.replace(/[^\d]/g, '');
    
    // Форматируем номер телефона
    if (phoneNumber.length <= 1) {
      return phoneNumber === '7' ? '+7' : phoneNumber === '8' ? '+7' : `+7${phoneNumber}`;
    }
    if (phoneNumber.length <= 4) {
      return `+7 (${phoneNumber.slice(1)}`;
    }
    if (phoneNumber.length <= 7) {
      return `+7 (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4)}`;
    }
    if (phoneNumber.length <= 9) {
      return `+7 (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4, 7)}-${phoneNumber.slice(7)}`;
    }
    return `+7 (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4, 7)}-${phoneNumber.slice(7, 9)}-${phoneNumber.slice(9, 11)}`;
  };

  // Обработчик изменения телефона
  const handlePhoneChange = (e) => {
    const formattedValue = formatPhoneNumber(e.target.value);
    e.target.value = formattedValue;
  };

  // Форматирование ИНН
  const formatInn = (value) => {
    if (!value) return value;
    
    // Удаляем все нецифровые символы
    return value.replace(/[^\d]/g, '').slice(0, 12);
  };

  // Обработчик изменения ИНН
  const handleInnChange = (e) => {
    const formattedValue = formatInn(e.target.value);
    e.target.value = formattedValue;
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      
      // Очищаем телефон от форматирования перед отправкой
      const cleanPhone = data.phone ? data.phone.replace(/[^\d+]/g, '') : undefined;
      
      // Создаем объект для регистрации пользователя
      const userData = {
        email: data.email,
        password: data.password,
        full_name: data.fullName,
        phone_number: cleanPhone || undefined,
        role: 'patient'  // Используем строковое значение, соответствующее enum UserRole в API
      };
      
      // Создаем объект с дополнительными данными пациента
      const patientData = {
        birth_date: data.birthDate || null,
        gender: data.gender || null,
        address: data.address || null,
        contraindications: data.contraindications || null,
        inn: data.inn || null
      };
      
      // Выводим данные в консоль для отладки
      console.log('Отправляемые данные:', {
        ...userData,
        patient: patientData
      });
      
      // Проверяем, что данные пациента не пустые
      const hasPatientData = Object.values(patientData).some(value => value !== null && value !== '');
      console.log('Есть данные пациента:', hasPatientData);
      
      // Дополнительное логирование для отладки
      console.log('JSON данных:', JSON.stringify({
        ...userData,
        patient: patientData
      }));
      
      // Убеждаемся, что все поля patient не являются пустыми строками
      const cleanPatientData = {};
      Object.entries(patientData).forEach(([key, value]) => {
        // Если значение не пустая строка и не null, добавляем его
        if (value !== '' && value !== null) {
          cleanPatientData[key] = value;
        } else {
          // Для пустых значений устанавливаем null
          cleanPatientData[key] = null;
        }
      });
      
      console.log('Очищенные данные пациента:', cleanPatientData);
      
      // Отправляем запрос на регистрацию с данными пользователя и пациента
      const response = await api.post('/auth/register', {
        ...userData,
        patient: cleanPatientData
      });

      if (response.data) {
        setRegistered(true);
        toast.success('Регистрация успешна! Проверьте вашу почту для подтверждения аккаунта.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.detail || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Проверьте вашу почту
            </h2>
            <p className="text-gray-600 mb-8">
              Мы отправили письмо с подтверждением на вашу почту. 
              Пожалуйста, перейдите по ссылке в письме для активации аккаунта.
            </p>
            <div className="text-sm text-gray-500">
              Не получили письмо? Проверьте папку "Спам" или{' '}
              <button 
                className="text-indigo-600 hover:text-indigo-500 font-medium"
                onClick={() => {
                  // TODO: Добавить функцию повторной отправки письма
                  toast.info('Функция повторной отправки письма будет добавлена позже');
                }}
              >
                отправить повторно
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Создайте свой аккаунт
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Заполните форму для регистрации в системе DantiZT
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Основная информация</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
                <input
                  {...register('fullName', { required: 'Это поле обязательно' })}
                  type="text"
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Иванов Иван Иванович"
                />
                {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  {...register('email', { 
                    required: 'Это поле обязательно',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Некорректный email адрес'
                    }
                  })}
                  type="email"
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="example@mail.ru"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                <input
                  {...register('phone', {
                    pattern: {
                      value: /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/,
                      message: 'Некорректный номер телефона'
                    }
                  })}
                  type="tel"
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="+7 (999) 123-45-67"
                  onChange={handlePhoneChange}
                />
                {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
              </div>
              <div>
                <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 mb-1">Дата рождения</label>
                <input
                  {...register('birthDate', {
                    validate: {
                      adult: value => !value || isAdult(value) || 'Пациент должен быть старше 18 лет'
                    }
                  })}
                  type="date"
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                />
                {errors.birthDate && <p className="mt-1 text-sm text-red-600">{errors.birthDate.message}</p>}
              </div>
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">Пол</label>
                <select
                  {...register('gender')}
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Выберите пол</option>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                </select>
              </div>
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
                <input
                  {...register('address')}
                  type="text"
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="г. Москва, ул. Примерная, д. 1, кв. 1"
                />
              </div>
              <div>
                <label htmlFor="inn" className="block text-sm font-medium text-gray-700 mb-1">ИНН</label>
                <input
                  {...register('inn', {
                    pattern: {
                      value: /^\d{12}$/,
                      message: 'ИНН должен содержать 12 цифр'
                    }
                  })}
                  type="text"
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="123456789012"
                  onChange={handleInnChange}
                  maxLength={12}
                />
                {errors.inn && <p className="mt-1 text-sm text-red-600">{errors.inn.message}</p>}
              </div>
              <div className="md:col-span-2">
                <label htmlFor="contraindications" className="block text-sm font-medium text-gray-700 mb-1">Противопоказания</label>
                <textarea
                  {...register('contraindications')}
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Укажите противопоказания, если есть"
                  rows="3"
                ></textarea>
              </div>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mt-6 mb-4">Безопасность</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                <input
                  {...register('password', { 
                    required: 'Это поле обязательно',
                    minLength: {
                      value: 8,
                      message: 'Пароль должен содержать минимум 8 символов'
                    }
                  })}
                  type="password"
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Минимум 8 символов"
                />
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Подтверждение пароля</label>
                <input
                  {...register('confirmPassword', { 
                    required: 'Это поле обязательно',
                    validate: value => value === watch('password') || 'Пароли не совпадают'
                  })}
                  type="password"
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Повторите пароль"
                />
                {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {loading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : null}
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </div>
        </form>

        <div className="text-sm text-center">
          <Link href="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Уже есть аккаунт? Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
