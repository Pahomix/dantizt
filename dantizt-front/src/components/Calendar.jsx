'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO, isEqual, startOfWeek, addDays, addMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import SpecialDayModal from '@/app/(protected)/admin/schedules/special-day-modal';

const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const SPECIAL_DAY_TYPES = {
  holiday: 'Праздничный день',
  vacation: 'Отпуск',
  sick_leave: 'Больничный',
  training: 'Обучение/конференция'
};

// Преобразует JavaScript день недели (0 = воскресенье) в наш формат (0 = понедельник)
const convertJsDayToOurDay = (jsDay) => {
  return jsDay === 0 ? 6 : jsDay - 1;
};

// Преобразует наш день недели (0 = понедельник) в JavaScript формат (0 = воскресенье)
const convertOurDayToJsDay = (ourDay) => {
  return ourDay === 6 ? 0 : ourDay + 1;
};

export default function Calendar({ schedules, specialDays, onDayClick, doctorId, canEdit = false }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarDays, setCalendarDays] = useState([]);
  const [isSpecialDayModalOpen, setIsSpecialDayModalOpen] = useState(false);
  const [selectedSpecialDay, setSelectedSpecialDay] = useState(null);

  // Получаем все дни для текущего месяца
  const getDaysInMonth = (date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    
    // Получаем первый день недели (понедельник) для первой недели месяца
    const firstWeekStart = startOfWeek(start, { weekStartsOn: 1 });
    
    // Создаем массив дней от начала первой недели до конца месяца
    const days = [];
    let currentDay = firstWeekStart;
    
    while (currentDay <= end || days.length % 7 !== 0) {
      days.push(currentDay);
      currentDay = addDays(currentDay, 1);
    }
    
    return days;
  };

  // Обновляем дни при изменении текущей даты
  useEffect(() => {
    setCalendarDays(getDaysInMonth(currentDate));
  }, [currentDate]);

  // Получаем расписание для конкретного дня
  const getScheduleForDay = (schedules, date) => {
    if (!schedules || !date) return null;
    
    // Преобразуем JavaScript день недели (0 = воскресенье) в наш формат (0 = понедельник)
    const adjustedDayOfWeek = convertJsDayToOurDay(date.getDay());

    return schedules.find(schedule => 
      schedule.day_of_week === adjustedDayOfWeek && 
      schedule.is_active
    );
  };

  // Получаем особый день
  const getSpecialDay = (date) => {
    if (!specialDays || !date) return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    return specialDays.find(day => {
      // Сравниваем даты в формате строк
      return day.date === dateStr;
    });
  };

  // Получаем рабочие часы для дня
  const getWorkingHours = (schedule) => {
    if (!schedule || !schedule.is_active) {
      return 'Нерабочий день';
    }
    return `${schedule.start_time} - ${schedule.end_time}`;
  };

  // Обработчики навигации
  const prevMonth = () => {
    setCurrentDate(prev => addMonths(prev, -1));
  };

  const nextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleDateClick = (date, specialDay) => {
    // Создаем новый объект Date для точного сохранения даты без времени
    const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    setSelectedDate(selectedDate);
    
    if (onDayClick) {
      onDayClick(selectedDate, specialDay);
    }
  };

  const handleSpecialDayModalClose = () => {
    setIsSpecialDayModalOpen(false);
    setSelectedSpecialDay(null);
  };

  return (
    <>
      <div className="w-full max-w-5xl mx-auto bg-white rounded-lg shadow">
        {/* Заголовок с навигацией */}
        <div className="flex items-center justify-between px-8 py-6 border-b">
          <h2 className="text-2xl font-semibold text-gray-900 capitalize">
            {format(currentDate, 'LLLL yyyy', { locale: ru })}
          </h2>
          <div className="flex space-x-4">
            <button
              onClick={prevMonth}
              className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
            >
              <ChevronRightIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Дни недели */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="py-4 text-center text-sm font-semibold text-gray-700">
              {day}
            </div>
          ))}
        </div>

        {/* Сетка календаря */}
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {calendarDays.map((day, dayIdx) => {
            const schedule = getScheduleForDay(schedules, day);
            const specialDay = getSpecialDay(day);
            const isWorkingDay = specialDay ? specialDay.is_working : schedule?.is_active;
            const workTime = getWorkingHours(schedule);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            const isSelected = selectedDate && isEqual(day, selectedDate);

            return (
              <div
                key={day.toString()}
                className={`
                  relative bg-white p-4 hover:bg-gray-50 transition-colors cursor-pointer
                  ${!isCurrentMonth ? 'text-gray-400' : ''}
                  ${isSelected ? 'bg-blue-50' : ''}
                  ${isCurrentDay ? 'ring-2 ring-blue-500 ring-inset' : ''}
                `}
                onClick={() => handleDateClick(day, specialDay)}
              >
                <div className="flex flex-col h-full min-h-[100px]">
                  {/* Номер дня */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`
                      text-sm font-medium
                      ${isCurrentDay ? 'text-blue-600' : ''}
                      ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}
                    `}>
                      {format(day, 'd')}
                    </span>
                    {isWorkingDay !== undefined && (
                      <span className={`
                        inline-flex items-center justify-center w-2 h-2 rounded-full
                        ${isWorkingDay ? 'bg-green-500' : 'bg-red-500'}
                      `} />
                    )}
                  </div>

                  {/* Рабочие часы */}
                  {isWorkingDay && (
                    <div className="mt-1">
                      <span className="text-xs font-medium text-gray-500">
                        {workTime}
                      </span>
                    </div>
                  )}

                  {/* Особый день */}
                  {specialDay && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {SPECIAL_DAY_TYPES[specialDay.type] || 'Особый день'}
                      </span>
                    </div>
                  )}

                  {/* Статус дня */}
                  <div className="mt-auto">
                    <span className={`
                      text-xs font-medium
                      ${isWorkingDay ? 'text-green-600' : 'text-red-600'}
                    `}>
                      {isWorkingDay ? 'Рабочий' : 'Нерабочий день'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Модальное окно для особых дней */}
      {canEdit && (
        <SpecialDayModal
          isOpen={isSpecialDayModalOpen}
          onClose={handleSpecialDayModalClose}
          doctorId={doctorId}
          date={selectedDate}
          specialDay={selectedSpecialDay}
        />
      )}
    </>
  );
}
