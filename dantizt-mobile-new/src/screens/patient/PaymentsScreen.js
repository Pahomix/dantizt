import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { colors } from '../../utils/colors';
import { MaterialIcons } from '../../../vectorIconsHelper';
import usePaymentStore from '../../store/paymentStore';
import { formatDate, formatPrice } from '../../utils/formatters';
import axios from '../../utils/axios';

const PaymentModal = ({ isVisible, onClose, payment, onSubmit }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');

  const formatCardNumber = (text) => {
    const cleaned = text.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = cleaned.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return text;
    }
  };

  const formatExpiryDate = (text) => {
    const cleaned = text.replace(/[^0-9]/gi, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handleCardNumberChange = (text) => {
    const formatted = formatCardNumber(text);
    if (formatted.length <= 19) { // 16 digits + 3 spaces
      setCardNumber(formatted);
    }
  };

  const handleExpiryDateChange = (text) => {
    const formatted = formatExpiryDate(text);
    if (formatted.length <= 5) { // MM/YY
      setExpiryDate(formatted);
    }
  };

  const handleCvvChange = (text) => {
    if (text.length <= 3) {
      setCvv(text.replace(/[^0-9]/gi, ''));
    }
  };

  const handleSubmit = () => {
    if (cardNumber.length === 19 && expiryDate.length === 5 && cvv.length === 3) {
      onSubmit({
        cardNumber: cardNumber.replace(/\s+/g, ''),
        expiryDate,
        cvv
      });
    }
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      backdropOpacity={0.5}
      style={styles.modal}
    >
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Оплата услуги</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={colors.gray[500]} />
          </TouchableOpacity>
        </View>

        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName}>{payment.service_name}</Text>
          <Text style={styles.serviceDate}>{payment.date}</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Сумма к оплате:</Text>
            <Text style={styles.amount}>{formatPrice(payment.amount)} ₽</Text>
          </View>
        </View>

        <View style={styles.cardForm}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Номер карты</Text>
            <View style={styles.cardNumberContainer}>
              <MaterialIcons name="credit-card" size={24} color={colors.gray[400]} style={styles.cardIcon} />
              <TextInput
                style={styles.cardNumberInput}
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChangeText={handleCardNumberChange}
                keyboardType="numeric"
                maxLength={19}
              />
            </View>
          </View>

          <View style={styles.rowContainer}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.inputLabel}>Срок действия</Text>
              <TextInput
                style={styles.input}
                placeholder="MM/YY"
                value={expiryDate}
                onChangeText={handleExpiryDateChange}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <View style={[styles.inputContainer, { flex: 1 }]}>
              <Text style={styles.inputLabel}>CVV</Text>
              <TextInput
                style={styles.input}
                placeholder="•••"
                value={cvv}
                onChangeText={handleCvvChange}
                keyboardType="numeric"
                maxLength={3}
                secureTextEntry
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.payButton,
            !(cardNumber.length === 19 && expiryDate.length === 5 && cvv.length === 3) && styles.payButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!(cardNumber.length === 19 && expiryDate.length === 5 && cvv.length === 3)}
        >
          <Text style={styles.payButtonText}>Оплатить</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const PaymentsScreen = ({ navigation }) => {
  const { payments, fetchPayments, isLoading, error } = usePaymentStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [completedPayments, setCompletedPayments] = useState([]);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (payments) {
      setPendingPayments(payments.filter(p => p.status === 'pending'));
      // Учитываем оба возможных статуса успешных платежей: 'succeeded' и 'completed'
      setCompletedPayments(payments.filter(p => p.status === 'succeeded' || p.status === 'completed'));
    }
  }, [payments]);

  const loadData = () => {
    fetchPayments();
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayments().finally(() => setRefreshing(false));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'succeeded':
      case 'completed':
        return { backgroundColor: colors.success + '20', color: colors.success };
      case 'pending':
        return { backgroundColor: colors.warning + '20', color: colors.warning };
      case 'failed':
        return { backgroundColor: colors.error + '20', color: colors.error };
      default:
        return { backgroundColor: colors.gray[200], color: colors.gray[600] };
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'succeeded':
      case 'completed':
        return 'Оплачено';
      case 'pending':
        return 'Ожидает оплаты';
      case 'failed':
        return 'Ошибка оплаты';
      default:
        return 'Неизвестный статус';
    }
  };

  const handleWebViewPayment = async (payment) => {
    try {
      setProcessingPayment(true);
      
      // Проверяем, что payment и payment.id существуют и преобразуем в число
      if (!payment || !payment.id) {
        throw new Error('Неверный ID платежа');
      }
      
      // Преобразуем ID в число, если он был строкой
      const paymentId = parseInt(payment.id, 10);
      
      // Проверяем, что ID является допустимым числом
      if (isNaN(paymentId) || paymentId <= 0) {
        throw new Error('Недопустимый ID платежа');
      }
      
      console.log('Инициализация платежа с ID:', paymentId);
      const response = await usePaymentStore.getState().initTinkoffPayment(paymentId);
      
      if (response && response.PaymentURL && response.PaymentId) {
        const payment_url = response.PaymentURL;
        const order_id = response.PaymentId;
        
        navigation.navigate('PaymentWebView', {
          paymentUrl: payment_url,
          orderId: order_id,
          paymentId: paymentId // Передаем paymentId в параметрах навигации
        });
      } else {
        throw new Error('Не удалось получить платежную ссылку');
      }
    } catch (error) {
      console.error('Ошибка при создании платежной сессии:', error);
      Alert.alert(
        'Ошибка',
        'Не удалось инициализировать платежную сессию. Пожалуйста, попробуйте позже.'
      );
    } finally {
      setProcessingPayment(false);
    }
  };

  // Формируем заголовок на основе услуг
  const getPaymentTitle = (payment) => {
    if (payment.appointment?.services && payment.appointment.services.length > 0) {
      if (payment.appointment.services.length === 1) {
        // Если одна услуга, показываем её название
        return payment.appointment.services[0].name;
      } else {
        // Если несколько услуг, показываем "Комплекс услуг" или первую услугу со счетчиком
        return `Комплекс услуг (${payment.appointment.services.length})`;
      }
    }
    // Если нет услуг, проверяем наличие service
    return payment.appointment?.service?.name || payment.service_name || 'Стоматологические услуги';
  };

  const renderPaymentCard = (payment, showPayButton = false) => {
    const statusStyle = getStatusColor(payment.status);

    return (
      <View key={payment.id} style={styles.card}>
        {/* Заголовок карточки с названием услуги */}
        <Text style={styles.serviceName}>{getPaymentTitle(payment)}</Text>
        
        {/* Дата */}
        <Text style={styles.date}>{formatDate(payment.date || payment.created_at)}</Text>
        
        {/* Информация о враче */}
        {payment.appointment?.doctor?.user?.full_name && (
          <Text style={styles.doctorName}>Врач: {payment.appointment.doctor.user.full_name}</Text>
        )}
        
        {/* Статус платежа */}
        <View style={[styles.status, { backgroundColor: statusStyle.backgroundColor, alignSelf: 'flex-start', marginTop: 8 }]}>
          <MaterialIcons
            name={payment.status === 'succeeded' || payment.status === 'completed' ? 'check-circle' : payment.status === 'pending' ? 'schedule' : 'error'}
            size={12}
            color={statusStyle.color}
          />
          <Text style={[styles.statusText, { color: statusStyle.color }]}>
            {getStatusText(payment.status)}
          </Text>
        </View>

        <View style={styles.divider} />
        
        {/* Детализация услуг */}
        {payment.appointment?.services && payment.appointment.services.length > 0 && (
          <View style={styles.servicesContainer}>
            <Text style={styles.servicesTitle}>Состав услуг:</Text>
            {payment.appointment.services.map(service => (
              <View key={service.id} style={styles.serviceRow}>
                <Text style={styles.serviceItemName}>{service.name}</Text>
                <Text style={styles.serviceItemPrice}>{formatPrice(service.cost)} ₽</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Итого:</Text>
              <Text style={styles.totalValue}>{formatPrice(payment.amount)} ₽</Text>
            </View>
          </View>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Сумма:</Text>
            <Text style={styles.priceValue}>{formatPrice(payment.amount)} ₽</Text>
          </View>

          {showPayButton && payment.status === 'pending' && (
            <TouchableOpacity
              style={styles.payNowButton}
              onPress={() => handleWebViewPayment(payment)}
              disabled={processingPayment}
            >
              {processingPayment ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.payNowButtonText}>Оплатить</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {pendingPayments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ожидают оплаты</Text>
            {pendingPayments.map(payment => renderPaymentCard(payment, true))}
          </View>
        )}

        {completedPayments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Оплаченные</Text>
            {completedPayments.map(payment => renderPaymentCard(payment))}
          </View>
        )}

        {payments.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="payment" size={48} color={colors.gray[400]} />
            <Text style={styles.emptyText}>У вас пока нет платежей</Text>
          </View>
        )}
      </ScrollView>

      {selectedPayment && (
        <PaymentModal
          isVisible={!!selectedPayment}
          onClose={() => setSelectedPayment(null)}
          payment={selectedPayment}
          onSubmit={async (data) => {
            try {
              await usePaymentStore.getState().processPayment({
                paymentId: selectedPayment.id,
                ...data
              });
              setSelectedPayment(null);
              await loadData();
            } catch (error) {
              Alert.alert('Ошибка', error.message || 'Произошла ошибка при обработке платежа');
            }
          }}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[900],
    marginBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 32,
  },
  emptyText: {
    color: colors.gray[600],
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: colors.gray[900],
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  serviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[900],
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 4,
  },
  doctorName: {
    fontSize: 14,
    color: colors.gray[600],
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginVertical: 12,
  },
  // Новые стили для детализации услуг
  servicesContainer: {
    marginBottom: 12,
    paddingTop: 4,
  },
  servicesTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray[700],
    marginBottom: 8,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  serviceItemName: {
    fontSize: 14,
    color: colors.gray[600],
    flex: 1,
    marginRight: 8,
  },
  serviceItemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray[700],
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray[700],
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[900],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: colors.gray[600],
    marginRight: 4,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[900],
  },
  payNowButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  payNowButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 48,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.gray[900],
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
  serviceInfo: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.gray[900],
    marginBottom: 4,
  },
  serviceDate: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 12,
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: colors.gray[600],
  },
  amount: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[900],
  },
  cardForm: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 8,
  },
  cardNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: colors.white,
  },
  cardIcon: {
    marginRight: 8,
  },
  cardNumberInput: {
    flex: 1,
    fontSize: 16,
    color: colors.gray[900],
    height: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 16,
    color: colors.gray[900],
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  payButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  payButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PaymentsScreen;
