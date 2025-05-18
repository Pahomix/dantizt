import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import usePaymentStore from '../../store/paymentStore';

const TinkoffPayButton = ({ paymentId, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const { initTinkoffPayment } = usePaymentStore();

  const handlePayment = async () => {
    if (!paymentId) {
      Alert.alert('Ошибка', 'Идентификатор платежа не найден');
      return;
    }

    setLoading(true);
    try {
      const result = await initTinkoffPayment(paymentId);
      setLoading(false);
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      setLoading(false);
      console.error('Ошибка при инициализации платежа Tinkoff:', error);
      
      Alert.alert(
        'Ошибка оплаты',
        error.message || 'Произошла ошибка при инициализации платежа'
      );
      
      if (onError) {
        onError(error);
      }
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePayment}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <Text style={styles.buttonText}>Оплатить через Тинькофф</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#ffdd2d', // Желтый цвет Тинькофф
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  }
});

export default TinkoffPayButton;
