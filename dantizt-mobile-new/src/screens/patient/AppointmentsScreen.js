import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../utils/colors';
import useAppointmentStore from '../../store/appointmentStore';
import useAuthStore from '../../store/authStore';
import usePaymentStore from '../../store/paymentStore';
import { MaterialIcons as Icon } from '../../../vectorIconsHelper';
import PaymentAlert from '../../components/PaymentAlert';

const AppointmentsScreen = () => {
  const navigation = useNavigation();
  const { patientProfile, fetchPatientProfile } = useAuthStore();
  const { appointments, loading, error, fetchPatientAppointments, cancelAppointment } = useAppointmentStore();
  const { statistics, fetchPayments } = usePaymentStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadAppointments = useCallback(async () => {
    try {
      const profile = await fetchPatientProfile();
      if (profile?.id) {
        await fetchPatientAppointments(profile.id);
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  }, [fetchPatientProfile, fetchPatientAppointments]);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        loadAppointments(),
        fetchPayments()
      ]);
    };
    loadData();
  }, [loadAppointments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadAppointments(),
      fetchPayments()
    ]);
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCancelAppointment = async (appointmentId) => {
    Alert.alert(
      'Отмена записи',
      'Вы уверены, что хотите отменить запись?',
      [
        { text: 'Нет', style: 'cancel' },
        {
          text: 'Да',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelAppointment(appointmentId);
              Alert.alert('Успех', 'Запись успешно отменена');
              loadAppointments(); // Перезагружаем список после отмены
            } catch (error) {
              Alert.alert('Ошибка', error.message);
            }
          },
        },
      ]
    );
  };

  const renderAppointment = ({ item }) => (
    <View style={styles.appointmentCard}>
      <Text style={styles.doctorName}>{item.doctor_name}</Text>
      <Text style={styles.specialization}>{item.doctor_specialty}</Text>
      <Text style={styles.service}>{item.service_name}</Text>
      <Text style={styles.dateTime}>
        {formatDate(item.start_time)}
      </Text>
      <Text style={styles.status}>
        Статус: <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
          {getStatusText(item.status)}
        </Text>
      </Text>
      
      {item.status === 'scheduled' && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => handleCancelAppointment(item.id)}
        >
          <Text style={styles.cancelButtonText}>Отменить запись</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return colors.warning;
      case 'in_progress': return colors.info;
      case 'completed': return colors.success;
      case 'cancelled': return colors.error;
      case 'postponed': return colors.warning;
      case 'no_show': return colors.gray[700];
      default: return colors.gray[500];
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'scheduled': return 'Запланирована';
      case 'in_progress': return 'В процессе';
      case 'completed': return 'Завершена';
      case 'cancelled': return 'Отменена';
      case 'postponed': return 'Отложена';
      case 'no_show': return 'Неявка';
      default: return 'Неизвестно';
    }
  };

  const ListHeaderComponent = () => (
    <PaymentAlert pendingCount={statistics.pendingCount} />
  );

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadAppointments}
        >
          <Text style={styles.retryButtonText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={appointments}
        renderItem={renderAppointment}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={ListHeaderComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>У вас пока нет записей на прием</Text>
              <Text style={styles.emptySubText}>Потяните вниз чтобы обновить</Text>
            </View>
          )
        }
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('CreateAppointment')}
      >
        <View style={styles.addButtonContent}>
          <Text style={styles.addButtonText}>Записаться на прием</Text>
          <Icon name="arrow-forward" size={20} color={colors.background} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  appointmentCard: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.gray[900],
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[900],
    marginBottom: 4,
  },
  specialization: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 8,
  },
  service: {
    fontSize: 15,
    color: colors.gray[800],
    marginBottom: 12,
  },
  dateTime: {
    fontSize: 14,
    color: colors.gray[700],
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  status: {
    fontSize: 14,
    color: colors.gray[700],
    marginBottom: 12,
  },
  statusText: {
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: colors.gray[100],
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    left: 16,
    backgroundColor: colors.primary,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  addButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    color: colors.gray[600],
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptySubText: {
    color: colors.gray[600],
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default AppointmentsScreen;
