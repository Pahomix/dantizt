import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import usePaymentStore from '../../store/paymentStore';
import { Ionicons } from '@expo/vector-icons';

const PaymentSuccessScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Проверка статуса платежа...');
  const { checkTinkoffPaymentStatus } = usePaymentStore();
  
  // Получаем параметры из URL
  const paymentId = route.params?.paymentId;
  const tinkoffPaymentId = route.params?.tinkoffPaymentId;
  
  useEffect(() => {
    if (!paymentId) {
      console.error('PaymentId не найден в параметрах');
      setStatus('error');
      setMessage('Идентификатор платежа не найден');
      return;
    }
    
    console.log('Проверка статуса платежа для ID:', paymentId);
    checkStatus();
  }, [paymentId]);
  
  const checkStatus = async () => {
    try {
      console.log('Отправка запроса на проверку статуса платежа');
      const result = await checkTinkoffPaymentStatus(paymentId, tinkoffPaymentId);
      console.log('Получен статус платежа:', result);
      
      // Маппинг статусов Tinkoff на статусы системы
      const statusMapping = {
        'NEW': 'pending',
        'AUTHORIZED': 'pending',
        'CONFIRMED': 'completed',
        'REJECTED': 'failed',
        'REFUNDED': 'refunded',
        'PARTIAL_REFUNDED': 'refunded',
        'REVERSED': 'failed',
        'CANCELED': 'failed'
      };
      
      const tinkoffStatus = result.Status;
      const localStatus = statusMapping[tinkoffStatus] || 'pending';
      
      if (localStatus === 'completed') {
        setStatus('success');
        setMessage('Платеж успешно выполнен!');
        
        // Автоматическое перенаправление через 3 секунды
        setTimeout(() => {
          navigation.navigate('Payments');
        }, 3000);
      } else if (localStatus === 'pending') {
        setStatus('pending');
        setMessage('Платеж в обработке. Пожалуйста, подождите...');
        
        // Повторная проверка через 5 секунд
        setTimeout(checkStatus, 5000);
      } else {
        setStatus('error');
        setMessage('Ошибка при обработке платежа. Пожалуйста, обратитесь в клинику.');
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      setStatus('error');
      setMessage('Ошибка при проверке статуса платежа');
    }
  };
  
  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />;
      case 'error':
        return <Ionicons name="close-circle" size={80} color="#F44336" />;
      case 'pending':
        return <Ionicons name="time" size={80} color="#FFC107" />;
      default:
        return <ActivityIndicator size="large" color="#2196F3" />;
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          {getStatusIcon()}
        </View>
        
        <Text style={styles.title}>
          {status === 'success' ? 'Оплата успешна!' : 
           status === 'error' ? 'Ошибка оплаты' : 
           'Проверка оплаты'}
        </Text>
        
        <Text style={styles.message}>{message}</Text>
        
        {status === 'success' && (
          <Text style={styles.redirectMessage}>
            Вы будете перенаправлены на страницу платежей через несколько секунд...
          </Text>
        )}
        
        {status === 'pending' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2196F3" />
            <Text style={styles.loadingText}>Проверяем статус платежа...</Text>
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('Payments')}
        >
          <Text style={styles.buttonText}>Вернуться к платежам</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    color: '#555',
  },
  redirectMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    color: '#888',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
    marginTop: 16,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default PaymentSuccessScreen;
