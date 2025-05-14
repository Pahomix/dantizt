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
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../utils/colors';

const CreateAppointmentScreen = ({ navigation }) => {
  const { user, patientProfile, fetchPatientProfile } = useAuthStore();
  const { loading: appointmentLoading, error, createAppointment } = useAppointmentStore();
  
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
      } catch (error) {
        console.error('Error loading initial data:', error);
        Alert.alert('Ошибка', 'Не удалось загрузить необходимые данные');
      }

      setLoading(false);
    };
    loadInitialData();
  }, []);

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
      setAvailableSlots(data.slots || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить доступные слоты');
    }
  };

  const handleSpecializationSelect = (specializationId) => {
    console.log('Selected specialization ID:', specializationId);
    console.log('Doctors data:', doctors);
    
    setSelectedSpecialization(specializationId);
    
    if (specializationId) {
      // Преобразуем ID в число для корректного сравнения
      const specId = Number(specializationId);
      const filtered = doctors.filter(doctor => {
        console.log('Doctor:', doctor.id, 'Specialization ID:', doctor.specialization_id);
        return doctor.specialization_id === specId;
      });
      console.log('Filtered doctors:', filtered);
      setFilteredDoctors(filtered);
    } else {
      setFilteredDoctors(doctors);
    }
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

  const handleSubmit = async () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot || !patientProfile) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
      return;
    }

    try {
      const appointmentData = {
        patient_id: patientProfile.id,
        doctor_id: selectedDoctor.id,
        start_time: new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedSlot.start_time}`).toISOString(),
        end_time: new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedSlot.end_time}`).toISOString(),
        notes: notes
      };

      await createAppointment(appointmentData);
      Alert.alert('Успех', 'Запись на прием успешно создана', [
        { text: 'OK', onPress: () => navigation.navigate('AppointmentsList') }
      ]);
    } catch (error) {
      console.error('Error creating appointment:', error);
      Alert.alert('Ошибка', 'Не удалось создать запись на прием');
    }
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
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.gray[900]} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, step]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        <View style={[styles.stepLine, styles.stepLineActive]} />
        <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
      </View>

      {step === 1 && (
        <View>
          {/* Specialization Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Выберите специализацию</Text>
            <Picker
              selectedValue={selectedSpecialization}
              onValueChange={(itemValue) => handleSpecializationSelect(itemValue)}
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
                        <MaterialIcons name="star" size={16} color={colors.primary} /> {doctor.average_rating?.toFixed(1) || 'Нет оценок'}
                      </Text>
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
