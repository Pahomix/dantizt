import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import useAuthStore from '../../store/authStore';
import { colors } from '../../utils/colors';
import axios from '../../utils/axios';
import PaymentAlert from '../../components/PaymentAlert';
import usePaymentStore from '../../store/paymentStore';

const ProfileScreen = () => {
  const { user, patientProfile, updateProfile } = useAuthStore();
  const { statistics } = usePaymentStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Данные пользователя
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone_number: user?.phone_number || '',
    // Данные профиля пациента
    birth_date: patientProfile?.birth_date || '',
    address: patientProfile?.address || '',
    gender: patientProfile?.gender || '',
    contraindications: patientProfile?.contraindications || '',
  });

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Обновляем профиль пациента
      const { data: updatedProfile } = await axios.put('/patients/me', {
        birth_date: formData.birth_date,
        address: formData.address,
        gender: formData.gender,
        contraindications: formData.contraindications,
        // Данные пользователя тоже обновляются через /patients/me
        email: formData.email,
        full_name: formData.full_name,
        phone_number: formData.phone_number
      });

      await updateProfile({
        user: updatedProfile.user,
        patientProfile: updatedProfile
      });

      setIsEditing(false);
      Alert.alert('Успех', 'Профиль успешно обновлен');
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert(
        'Ошибка',
        error.response?.data?.detail || 'Не удалось обновить профиль'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderField = (label, key) => {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        {isEditing ? (
          <TextInput
            style={styles.value}
            value={formData[key]}
            onChangeText={(text) => setFormData(prev => ({ ...prev, [key]: text }))}
            placeholder={`Введите ${label.toLowerCase()}`}
          />
        ) : (
          <Text style={styles.value}>
            {formData[key] || 'Не указано'}
          </Text>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PaymentAlert pendingCount={statistics.pendingCount} />
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>А</Text>
          </View>
          <Text style={styles.name}>{user?.full_name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Основная информация</Text>
          {renderField('ФИО', 'full_name')}
          {renderField('Email', 'email')}
          {renderField('Телефон', 'phone_number')}
          {renderField('Дата рождения', 'birth_date')}
          {renderField('Адрес', 'address')}
          {renderField('Пол', 'gender')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Медицинская информация</Text>
          {renderField('Противопоказания', 'contraindications')}
        </View>

        <TouchableOpacity 
          style={styles.button}
          onPress={() => {
            if (isEditing) {
              handleSave();
            } else {
              setIsEditing(true);
            }
          }}
        >
          <Text style={styles.buttonText}>
            {isEditing ? 'Сохранить' : 'Редактировать'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '600',
    color: colors.gray[600],
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.gray[900],
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: colors.gray[600],
    marginBottom: 8,
  },
  section: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.gray[900],
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[900],
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 16,
    color: colors.gray[600],
  },
  value: {
    fontSize: 16,
    color: colors.gray[900],
    fontWeight: '500',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ProfileScreen;
