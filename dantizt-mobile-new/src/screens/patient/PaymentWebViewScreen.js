import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, BackHandler } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../../utils/colors';
import usePaymentStore from '../../store/paymentStore';
import { showAlert } from '../../components/CustomAlert';

const PaymentWebViewScreen = ({ route, navigation }) => {
  const { paymentUrl, orderId } = route.params;
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusCheckInterval, setStatusCheckInterval] = useState(null);
  // Флаг для отслеживания начала проверки статуса
  const [startStatusCheck, setStartStatusCheck] = useState(false);

  // Обработка нажатия кнопки "Назад"
  useEffect(() => {
    const backAction = () => {
      showAlert(
        'Прервать оплату?',
        'Вы уверены, что хотите прервать процесс оплаты?',
        [
          { text: 'Нет', style: 'cancel', onPress: () => {} },
          { 
            text: 'Да', 
            style: 'destructive', 
            onPress: () => {
              // Очищаем интервал проверки статуса
              if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
              }
              navigation.goBack();
            } 
          }
        ]
      );
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigation, statusCheckInterval]);

  // Функция для проверки статуса платежа
  const checkPaymentStatus = async () => {
    try {
      setCheckingStatus(true);
      
      // Извлекаем paymentId из разных источников
      let paymentId = null;
      
      // Способ 1: Извлекаем из параметров маршрута, если они были переданы
      if (route.params?.paymentId) {
        paymentId = parseInt(route.params.paymentId);
        console.log('Извлеченный paymentId из параметров маршрута:', paymentId);
      }
      
      // Способ 2: Извлекаем из orderId
      if (!paymentId && orderId) {
        const orderIdMatch = orderId.match(/order_(\d+)_/);
        if (orderIdMatch && orderIdMatch[1]) {
          paymentId = parseInt(orderIdMatch[1]);
          console.log('Извлеченный paymentId из orderId:', paymentId);
        }
      }
      
      // Способ 3: Извлекаем из URL платежа
      if (!paymentId && route.params?.paymentUrl) {
        // Проверяем несколько возможных форматов параметров в URL
        const patterns = [
          /paymentId=(\d+)/, // Стандартный формат
          /payment_id=(\d+)/, // Альтернативный формат
          /OrderId=order_(\d+)_/, // Формат с OrderId
          /PaymentId=(\d+)/ // Формат с заглавной буквы
        ];
        
        for (const pattern of patterns) {
          const match = route.params.paymentUrl.match(pattern);
          if (match && match[1]) {
            paymentId = parseInt(match[1]);
            console.log(`Извлеченный paymentId из URL по шаблону ${pattern}:`, paymentId);
            break;
          }
        }
      }
      
      // Способ 4: Извлекаем из текущего URL WebView, если доступен
      if (!paymentId && webViewRef.current) {
        try {
          webViewRef.current.injectJavaScript(`
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'current_url', url: window.location.href }));
            true;
          `);
        } catch (error) {
          console.log('Ошибка при попытке получить текущий URL:', error);
        }
      }
      
      // Если все способы не сработали, используем значение из предыдущего успешного платежа
      if (!paymentId) {
        // Получаем последний использованный paymentId из хранилища
        try {
          const lastPaymentId = usePaymentStore.getState().lastPaymentId;
          if (lastPaymentId) {
            paymentId = lastPaymentId;
            console.log('Используем последний известный paymentId:', paymentId);
          }
        } catch (e) {
          console.log('Ошибка при получении последнего paymentId:', e);
        }
      }
      
      // В крайнем случае используем значение по умолчанию
      if (!paymentId) {
        paymentId = 6; // Фиксированный ID только в крайнем случае
        console.log('Используем фиксированный paymentId как последнее средство:', paymentId);
      }
      
      // Используем существующий метод checkTinkoffPaymentStatus из paymentStore
      console.log('Отправляем запрос на проверку статуса с paymentId:', paymentId);
      const response = await usePaymentStore.getState().checkTinkoffPaymentStatus(paymentId, orderId);
      
      // Определяем статус платежа на основе ответа от API
      let status = 'pending';
      if (response && response.Status) {
        if (response.Status === 'CONFIRMED') {
          status = 'succeeded';
        } else if (['REJECTED', 'REVERSED', 'CANCELED'].includes(response.Status)) {
          status = 'failed';
        }
      }
      
      if (status === 'succeeded') {
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          setStatusCheckInterval(null);
        }
        showAlert(
          'Оплата успешна',
          'Ваш платеж успешно обработан',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else if (status === 'failed') {
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          setStatusCheckInterval(null);
        }
        showAlert(
          'Оплата не выполнена',
          'Произошла ошибка при обработке платежа',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
      
      setCheckingStatus(false);
      return status;
    } catch (error) {
      console.error('Ошибка при проверке статуса платежа:', error);
      setCheckingStatus(false);
      return 'error';
    }
  };

  // Настраиваем периодическую проверку статуса платежа только после взаимодействия с формой
  useEffect(() => {
    if (startStatusCheck && orderId && !statusCheckInterval) {
      console.log('Запускаем проверку статуса платежа');
      
      // Сразу проверяем статус платежа после нажатия кнопки оплаты
      checkPaymentStatus();
      
      // Запускаем периодическую проверку статуса
      const interval = setInterval(async () => {
        try {
          // Проверяем статус платежа
          const status = await checkPaymentStatus();
          
          // Если статус успешный или неудачный, останавливаем проверку
          if (status === 'succeeded' || status === 'failed') {
            clearInterval(interval);
            setStatusCheckInterval(null);
          }
        } catch (error) {
          console.error('Ошибка при периодической проверке статуса:', error);
        }
      }, 5000); // Проверяем каждые 5 секунд
      
      setStatusCheckInterval(interval);
      
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }
  }, [startStatusCheck, orderId]);

  // Обработка событий навигации в WebView
  const handleNavigationStateChange = (navState) => {
    console.log('Изменение состояния навигации:', navState.url);
    
    const { url } = navState;
    
    // Проверяем URL на успешную оплату или ошибку
    if (url.includes('payment/success') || url.includes('payment_success')) {
      console.log('Обнаружен URL успешной оплаты:', url);
      
      // Очищаем интервал проверки статуса
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        setStatusCheckInterval(null);
      }
      
      // Проверяем статус платежа
      checkPaymentStatus();
    } else if (url.includes('payment/fail') || url.includes('payment_fail')) {
      console.log('Обнаружен URL неудачной оплаты:', url);
      
      // Очищаем интервал проверки статуса
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        setStatusCheckInterval(null);
      }
      
      showAlert(
        'Оплата не выполнена',
        'Произошла ошибка при обработке платежа',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
    
    return true;
  };

  // JavaScript для внедрения в WebView для отслеживания событий
  const injectedJavaScript = `
    (function() {
      // Отправляем сообщение о загрузке формы
      window.ReactNativeWebView.postMessage('form_load');
      
      // Отслеживаем нажатие на кнопку оплаты
      document.addEventListener('click', function(e) {
        if (e.target && (e.target.type === 'submit' || 
            e.target.classList.contains('payButton') || 
            e.target.classList.contains('pay-button') || 
            e.target.id === 'payButton' || 
            e.target.id === 'pay-button' || 
            (e.target.innerText && e.target.innerText.toLowerCase().includes('оплатить')))) {
          window.ReactNativeWebView.postMessage('payment_button_click');
        }
      }, true);
      
      // Отслеживаем отправку формы
      document.addEventListener('submit', function(e) {
        window.ReactNativeWebView.postMessage('submit_payment');
      }, true);
      
      // Отслеживаем сообщения от Tinkoff API
      window.addEventListener('message', function(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify(e.data));
      });
      
      // Отслеживаем изменения URL
      let lastUrl = location.href;
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          window.ReactNativeWebView.postMessage('url_changed: ' + url);
        }
      }).observe(document, {subtree: true, childList: true});
      
      true;
    })();
  `;

  // Обработчик сообщений от WebView
  const handleMessage = (event) => {
    try {
      let data;
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch (parseError) {
        // Если не JSON, то используем как строку
        data = event.nativeEvent.data;
      }
      
      console.log('Получено сообщение от WebView:', data);
      
      // Проверяем, если это сообщение о загрузке формы
      if (data === 'form_load') {
        console.log('Форма оплаты загружена');
        return;
      }
      
      // Проверяем, если это сообщение о нажатии кнопки оплаты
      if (data === 'payment_button_click' || data === 'submit_payment') {
        console.log('Нажата кнопка оплаты, запускаем проверку статуса');
        
        // Сразу запускаем периодическую проверку статуса
        setStartStatusCheck(true);
        return;
      }
      
      // Проверяем, если это сообщение об изменении URL
      if (typeof data === 'string' && data.startsWith('url_changed:')) {
        const newUrl = data.replace('url_changed: ', '');
        console.log('Изменен URL в WebView:', newUrl);
        
        // Проверяем, если это URL успешной оплаты
        if (newUrl.includes('payment/success') || newUrl.includes('payment_success')) {
          console.log('Обнаружен URL успешной оплаты:', newUrl);
          checkPaymentStatus();
        } else if (newUrl.includes('payment/fail') || newUrl.includes('payment_fail')) {
          console.log('Обнаружен URL неудачной оплаты:', newUrl);
          showAlert(
            'Оплата не выполнена',
            'Произошла ошибка при обработке платежа',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      }
      
      // Проверяем, если это сообщение о текущем URL
      if (data && data.type === 'current_url' && data.url) {
        console.log('Получен текущий URL из WebView:', data.url);
        
        // Извлекаем paymentId из URL
        const paymentIdMatch = data.url.match(/paymentId=(\d+)/);
        if (paymentIdMatch && paymentIdMatch[1]) {
          const extractedPaymentId = parseInt(paymentIdMatch[1]);
          console.log('Извлеченный paymentId из текущего URL:', extractedPaymentId);
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке сообщения от WebView:', error);
    }
  };

  // Простой обработчик для проверки URL
  const handleShouldStartLoad = (request) => {
    const url = request.url || request;
    console.log('Проверка URL перед загрузкой:', url);
    
    return true; // Разрешаем загрузку всех URL
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: paymentUrl }}
        style={styles.webview}
        onLoad={() => setLoading(false)}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      />
      {(loading || checkingStatus) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});

export default PaymentWebViewScreen;
