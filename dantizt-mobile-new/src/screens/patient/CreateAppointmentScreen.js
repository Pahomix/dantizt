import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import axios from '../../utils/axios';
import useAppointmentStore from '../../store/appointmentStore';
import useAuthStore from '../../store/authStore';
import usePaymentStore from '../../store/paymentStore';
import { MaterialIcons } from '../../../vectorIconsHelper';
import { colors } from '../../utils/colors';
import { paymentStyles } from './payment-styles';

const CreateAppointmentScreen = ({ navigation }) => {
  const { user, patientProfile, fetchPatientProfile } = useAuthStore();
  const { loading: appointmentLoading, error, createAppointment } = useAppointmentStore();
  const { payments, statistics, fetchPayments, isLoading: paymentsLoading } = usePaymentStore();
  
  const [loading, setLoading] = useState(true);
  const [specializations, setSpecializations] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedSpecialization, setSelectedSpecialization] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState(1); // 1: Specialization & Doctor, 2: Date & Time
  const [availableSlots, setAvailableSlots] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [hasPendingPayments, setHasPendingPayments] = useState(false);
  const [pendingPayments, setPendingPayments] = useState([]);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Загружаем профиль пациента
        await fetchPatientProfile();
        
        // Загружаем специализации и врачей
        const [specializationsRes, doctorsRes] = await Promise.all([
          axios.get('/specializations/'),
          axios.get('/doctors')
        ]);
        
        // Проверяем и обрабатываем данные о специализациях
        const specializationsData = specializationsRes.data;
        console.log('Specializations data:', specializationsData);
        setSpecializations(Array.isArray(specializationsData) ? specializationsData : []);
        
        const doctorsData = Array.isArray(doctorsRes.data) ? doctorsRes.data : [];
        setDoctors(doctorsData);
        setFilteredDoctors(doctorsData);
        
        // Загружаем платежи пациента
        await fetchPayments();
      } catch (error) {
        console.error('Error loading initial data:', error);
        Alert.alert('Ошибка', 'Не удалось загрузить необходимые данные');
      }

      setLoading(false);
    };
    loadInitialData();
  }, [fetchPatientProfile, fetchPayments]);
  
  // Проверяем наличие неоплаченных платежей
  useEffect(() => {
    if (payments && payments.length > 0) {
      // Фильтруем неоплаченные платежи
      const pending = payments.filter(payment => payment.status === 'pending');
      setPendingPayments(pending);
      setHasPendingPayments(pending.length > 0);
    }
  }, [payments]);

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedDoctor, selectedDate]);

  const fetchAvailableSlots = async () => {
    try {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const { data } = await axios.get(`/schedules/doctors/${selectedDoctor.id}/availability`, {
        params: {
          date: formattedDate
        }
      });
      setAvailableSlots(data || []);
    } catch (error) {
      console.error('Error fetching available slots:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить доступное время');
      setAvailableSlots([]);
    }
  };

  const handleSpecializationSelect = (specializationId) => {
    setSelectedSpecialization(specializationId);
    
    // Если выбрана специализация, фильтруем врачей
    if (specializationId) {
      const filtered = doctors.filter(doctor => 
        doctor.specialization && doctor.specialization.id === specializationId
      );
      setFilteredDoctors(filtered);
    } else {
      // Если специализация не выбрана, показываем всех врачей
      setFilteredDoctors(doctors);
    }
    
    // Сбрасываем выбранного врача
    setSelectedDoctor(null);
  };

  const handleDoctorSelect = (doctor) => {
    setSelectedDoctor(doctor);
    setStep(2);
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
  };

  const handleSubmit = () => {
    if (!selectedDoctor || !selectedSlot) {
      Alert.alert('Ошибка', 'Пожалуйста, выберите врача и время приема');
      return;
    }

    Alert.alert(
      'Подтверждение записи',
      `Вы хотите записаться к ${selectedDoctor.user?.full_name || 'врачу'} на ${format(selectedDate, 'dd MMMM yyyy', { locale: ru })} в ${format(new Date(`2000-01-01T${selectedSlot.start_time}`), 'HH:mm')}?`,
      [
        {
          text: 'Отмена',
          style: 'cancel'
        },
        {
          text: 'Подтвердить',
          onPress: async () => {
            try {
              await createAppointment({
                doctor_id: selectedDoctor.id,
                date: format(selectedDate, 'yyyy-MM-dd'),
                start_time: selectedSlot.start_time,
                end_time: selectedSlot.end_time,
                notes: notes
              });
              
              Alert.alert('Успешно', 'Вы успешно записались на прием', [
                { text: 'OK', onPress: () => navigation.navigate('Appointments') }
              ]);
            } catch (err) {
              console.error('Error creating appointment:', err);
              Alert.alert('Ошибка', err.response?.data?.detail || 'Не удалось создать запись на прием');
            }
          }
        }
      ]
    );
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      navigation.goBack();
    }
  };

  // Настраиваем заголовок экрана с кнопкой "Назад"
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
      )
    });
  }, [navigation, step]);

  if (loading || appointmentLoading || paymentsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.gray[600] }}>Загрузка...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Предупреждение о неоплаченных услугах */}
      {hasPendingPayments && (
        <View style={paymentStyles.warningCard}>
          <View style={paymentStyles.warningHeader}>
            <MaterialIcons name="warning" size={24} color={colors.warning} />
            <Text style={paymentStyles.warningTitle}>Внимание! У вас есть неоплаченные услуги</Text>
          </View>
          <Text style={paymentStyles.warningText}>
            У вас есть {pendingPayments.length} {pendingPayments.length === 1 ? 'неоплаченная услуга' : 'неоплаченных услуг'}. 
            Для записи на новый прием необходимо оплатить все предыдущие услуги.
          </Text>
          <TouchableOpacity 
            style={paymentStyles.warningButton}
            onPress={() => navigation.navigate('Payments')}
          >
            <Text style={paymentStyles.warningButtonText}>Перейти к оплате</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Если есть неоплаченные услуги, показываем блок с сообщением о блокировке */}
      {hasPendingPayments ? (
        <View style={paymentStyles.blockedContainer}>
          <MaterialIcons name="block" size={64} color={colors.gray[300]} />
          <Text style={paymentStyles.blockedTitle}>Запись на прием недоступна</Text>
          <Text style={paymentStyles.blockedText}>Пожалуйста, оплатите все предыдущие услуги, чтобы продолжить</Text>
          <TouchableOpacity 
            style={paymentStyles.primaryButton}
            onPress={() => navigation.navigate('Payments')}
          >
            <Text style={paymentStyles.primaryButtonText}>Перейти к оплате</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepLine, step >= 1 && styles.stepLineActive]} />
            <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          </View>
          
          {step === 1 && (
            <View>
              {/* Specialization Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Выберите специализацию</Text>
                <Picker
                  selectedValue={selectedSpecialization}
                  onValueChange={handleSpecializationSelect}
                  style={styles.picker}
                >
                  <Picker.Item label="Все специализации" value={null} />
                  {specializations && specializations.length > 0 ? (
                    specializations.map(spec => (
                      <Picker.Item key={spec.id} label={spec.name} value={spec.id} />
                    ))
                  ) : (
                    <Picker.Item label="Загрузка специализаций..." value={null} />
                  )}
                </Picker>
              </View>

              {/* Doctor Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Выберите врача</Text>
                {filteredDoctors.length === 0 ? (
                  <Text style={styles.noDataText}>Нет доступных врачей для выбранной специализации</Text>
                ) : (
                  filteredDoctors.map(doctor => (
                    <TouchableOpacity
                      key={doctor.id}
                      style={[
                        styles.card,
                        selectedDoctor?.id === doctor.id && styles.cardSelected
                      ]}
                      onPress={() => handleDoctorSelect(doctor)}
                    >
                      <Text style={styles.cardTitle}>{doctor.user?.full_name || 'Неизвестный врач'}</Text>
                      <Text style={styles.cardSubtitle}>
                        {doctor.specialization?.name || 'Специализация не указана'}
                      </Text>
                      <View style={styles.cardFooter}>
                        <View style={styles.doctorInfo}>
                          <Text style={styles.doctorInfoText}>
                            <MaterialIcons name="work" size={16} color={colors.gray[600]} /> {doctor.experience_years || 0} лет опыта
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              {/* Selected Doctor Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Выбранный врач</Text>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{selectedDoctor.user?.full_name || 'Неизвестный врач'}</Text>
                  <Text style={styles.cardSubtitle}>
                    {selectedDoctor.specialization?.name || 'Специализация не указана'}
                  </Text>
                </View>
              </View>

              {/* Date Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Выберите дату</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateText}>
                    {format(selectedDate, 'dd MMMM yyyy', { locale: ru })}
                  </Text>
                  <MaterialIcons name="calendar-today" size={24} color={colors.primary} />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                )}
              </View>

              {/* Time Slots */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Доступное время</Text>
                {availableSlots.length === 0 ? (
                  <Text style={styles.noDataText}>Нет доступных слотов на выбранную дату</Text>
                ) : (
                  <View style={styles.slotsList}>
                    {availableSlots.map((slot, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.slotButton,
                          selectedSlot === slot && styles.slotButtonSelected
                        ]}
                        onPress={() => handleSlotSelect(slot)}
                      >
                        <Text
                          style={[
                            styles.slotButtonText,
                            selectedSlot === slot && styles.slotButtonTextSelected
                          ]}
                        >
                          {format(new Date(`2000-01-01T${slot.start_time}`), 'HH:mm')} - 
                          {format(new Date(`2000-01-01T${slot.end_time}`), 'HH:mm')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Notes */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Примечания к приему</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Опишите причину визита или дополнительную информацию..."
                  multiline
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!selectedDoctor || !selectedSlot) && styles.submitButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={!selectedDoctor || !selectedSlot}
              >
                <Text style={styles.submitButtonText}>Записаться на прием</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: colors.gray[200],
    borderRadius: 1.5,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[900],
    marginBottom: 16,
    marginTop: 8,
  },
  picker: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    marginBottom: 12,
  },
  card: {
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
  cardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.gray[900],
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.gray[600],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  doctorInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  doctorInfoText: {
    fontSize: 14,
    color: colors.gray[700],
  },
  datePickerButton: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 16,
    color: colors.gray[900],
  },
  slotsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  slotButton: {
    backgroundColor: colors.gray[50],
    borderRadius: 8,
    padding: 12,
    margin: 4,
    minWidth: '30%',
    alignItems: 'center',
  },
  slotButtonSelected: {
    backgroundColor: colors.primary,
  },
  slotButtonText: {
    fontSize: 14,
    color: colors.gray[900],
    fontWeight: '500',
  },
  slotButtonTextSelected: {
    color: colors.background,
  },
  notesInput: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.gray[900],
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 24,
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray[200],
  },
  submitButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    color: colors.gray[600],
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  headerButton: {
    marginLeft: 8,
    padding: 8,
  },
});

export default CreateAppointmentScreen;
