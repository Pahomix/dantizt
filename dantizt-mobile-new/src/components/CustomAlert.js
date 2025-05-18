import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';

const CustomAlert = ({ 
  visible, 
  title, 
  message, 
  buttons, 
  onClose 
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          {title && <Text style={styles.modalTitle}>{title}</Text>}
          {message && <Text style={styles.modalText}>{message}</Text>}
          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'destructive' ? styles.destructiveButton : 
                  button.style === 'cancel' ? styles.cancelButton : styles.defaultButton
                ]}
                onPress={() => {
                  if (button.onPress) button.onPress();
                  onClose();
                }}
              >
                <Text 
                  style={[
                    styles.buttonText,
                    button.style === 'destructive' ? styles.destructiveText : 
                    button.style === 'cancel' ? styles.cancelText : styles.defaultText
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Функция для показа алерта (аналог Alert.alert)
export const showAlert = (title, message, buttons = [{ text: 'OK' }]) => {
  // Создаем глобальную переменную для хранения функций управления алертом
  if (!global.alertManager) {
    global.alertManager = {
      show: null,
      hide: null,
    };
  }
  
  // Вызываем функцию показа, если она определена
  if (global.alertManager.show) {
    global.alertManager.show(title, message, buttons);
    return true;
  }
  
  return false;
};

// Компонент-провайдер для алертов
export const AlertProvider = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    buttons: [{ text: 'OK' }],
  });

  // Определяем функции управления алертом
  React.useEffect(() => {
    global.alertManager = {
      show: (title, message, buttons = [{ text: 'OK' }]) => {
        setAlertConfig({ title, message, buttons });
        setVisible(true);
      },
      hide: () => {
        setVisible(false);
      },
    };
    
    return () => {
      global.alertManager = null;
    };
  }, []);

  return (
    <>
      {children}
      <CustomAlert
        visible={visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
  },
  modalTitle: {
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
    color: colors.text,
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 16,
    color: colors.text,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  button: {
    borderRadius: 5,
    padding: 12,
    elevation: 2,
    minWidth: 100,
    marginHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultButton: {
    backgroundColor: '#2196F3',
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  destructiveButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: 'bold',
  },
  defaultText: {
    color: '#FFFFFF', // Белый цвет для текста на основной кнопке
    fontSize: 16,
  },
  cancelText: {
    color: '#000000', // Черный цвет для текста на кнопке отмены
    fontSize: 16,
  },
  destructiveText: {
    color: '#FFFFFF', // Белый цвет для текста на деструктивной кнопке
    fontSize: 16,
  },
});

export default CustomAlert;
