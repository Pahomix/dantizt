// Используем разные URL для разработки и продакшена
const IS_DEV = process.env.NODE_ENV === 'development';
export const API_URL = IS_DEV ? 'http://localhost:8000/api/v1' : 'https://www.dantizt.ru/api/v1';
