import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '../../vectorIconsHelper';
import { colors } from '../utils/colors';
import { useNavigation } from '@react-navigation/native';

const PaymentAlert = ({ pendingCount }) => {
  const navigation = useNavigation();

  if (!pendingCount) return null;

  const getPaymentText = (count) => {
    if (count === 1) return 'услуга';
    if (count > 1 && count < 5) return 'услуги';
    return 'услуг';
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialIcons name="warning" size={24} color={colors.warning} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            Внимание! У вас есть неоплаченные услуги
          </Text>
          <Text style={styles.message}>
            У вас есть {pendingCount} неоплаченных {getPaymentText(pendingCount)}. 
            Пожалуйста, оплатите их для продолжения лечения.
          </Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('Payments')}
      >
        <Text style={styles.buttonText}>Перейти к оплате</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF3C7', // yellow-50
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E', // yellow-800
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#B45309', // yellow-700
  },
  button: {
    marginTop: 12,
    backgroundColor: '#FEF3C7', // yellow-100
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400E', // yellow-800
  },
});

export default PaymentAlert;
