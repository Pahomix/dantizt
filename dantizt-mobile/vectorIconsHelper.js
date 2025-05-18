// Этот файл помогает решить проблему с шрифтами в @expo/vector-icons
import React from 'react';
import { MaterialIcons, Ionicons, AntDesign, FontAwesome, Entypo } from '@expo/vector-icons';

// Предзагрузка иконок
export const preloadIcons = () => {
  // Создаем компоненты иконок, чтобы они были предзагружены
  return (
    <>
      <MaterialIcons name="home" size={0} />
      <Ionicons name="home" size={0} />
      <AntDesign name="home" size={0} />
      <FontAwesome name="home" size={0} />
      <Entypo name="home" size={0} />
    </>
  );
};

// Экспортируем иконки для использования в приложении
export { MaterialIcons, Ionicons, AntDesign, FontAwesome, Entypo };
