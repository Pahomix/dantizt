import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '../../../vectorIconsHelper';

const PaymentFailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  
  // Получаем параметры из URL
  const paymentId = route.params?.paymentId;
  const errorMessage = route.params?.errorMessage || 'Произошла ошибка при обработке платежа';
  
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name="close-circle" size={80} color="#F44336" />
        </View>
        
        <Text style={styles.title}>Ошибка оплаты</Text>
        
        <Text style={styles.message}>{errorMessage}</Text>
        
        <Text style={styles.paymentId}>
          {paymentId ? `ID платежа: ${paymentId}` : 'ID платежа не найден'}
        </Text>
        
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]}
            onPress={() => navigation.navigate('Payments')}
          >
            <Text style={styles.buttonText}>Вернуться к платежам</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={() => {
              if (paymentId) {
                navigation.navigate('PaymentDetails', { paymentId });
              } else {
                navigation.navigate('Payments');
              }
            }}
          >
            <Text style={styles.secondaryButtonText}>
              {paymentId ? 'Детали платежа' : 'Все платежи'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.supportButton}
          onPress={() => navigation.navigate('Support')}
        >
          <Text style={styles.supportButtonText}>Обратиться в поддержку</Text>
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
    color: '#F44336',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    color: '#555',
  },
  paymentId: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    color: '#888',
  },
  buttonsContainer: {
    width: '100%',
    marginBottom: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButtonText: {
    color: '#2196F3',
    fontWeight: 'bold',
    fontSize: 16,
  },
  supportButton: {
    marginTop: 8,
  },
  supportButtonText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default PaymentFailScreen;
