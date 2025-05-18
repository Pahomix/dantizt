export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  
  // Проверка на корректность даты
  if (isNaN(date.getTime())) return '';
  
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(price);
};
