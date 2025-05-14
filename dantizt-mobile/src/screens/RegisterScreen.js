import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { colors } from '../utils/colors';
import useAuthStore from '../store/authStore';
import CustomInput from '../components/CustomInput';

const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone_number: '',
    birth_date: '',
  });
  const [errors, setErrors] = useState({});
  const { register, isLoading, error, clearError } = useAuthStore();

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email обязателен';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Некорректный email';
    }

    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Пароль должен быть не менее 8 символов';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }

    if (!formData.full_name) {
      newErrors.full_name = 'ФИО обязательно';
    }

    if (!formData.phone_number) {
      newErrors.phone_number = 'Номер телефона обязателен';
    }

    if (!formData.birth_date) {
      newErrors.birth_date = 'Дата рождения обязательна';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      navigation.navigate('RegisterSuccess');
    } catch (error) {
      // Ошибка уже обработана в store
    }
  };

  const updateFormData = (field, value) => {
    clearError();
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Регистрация</Text>
          <Text style={styles.subtitle}>Создайте аккаунт пациента</Text>
        </View>

        <View style={styles.form}>
          <CustomInput
            value={formData.email}
            onChangeText={(text) => updateFormData('email', text)}
            placeholder="Email"
            keyboardType="email-address"
            error={errors.email}
          />

          <CustomInput
            value={formData.full_name}
            onChangeText={(text) => updateFormData('full_name', text)}
            placeholder="ФИО"
            autoCapitalize="words"
            error={errors.full_name}
          />

          <CustomInput
            value={formData.phone_number}
            onChangeText={(text) => updateFormData('phone_number', text)}
            placeholder="Номер телефона"
            keyboardType="phone-pad"
            error={errors.phone_number}
          />

          <CustomInput
            value={formData.birth_date}
            onChangeText={(text) => updateFormData('birth_date', text)}
            placeholder="Дата рождения (ГГГГ-ММ-ДД)"
            error={errors.birth_date}
          />

          <CustomInput
            value={formData.password}
            onChangeText={(text) => updateFormData('password', text)}
            placeholder="Пароль"
            secureTextEntry
            error={errors.password}
          />

          <CustomInput
            value={formData.confirmPassword}
            onChangeText={(text) => updateFormData('confirmPassword', text)}
            placeholder="Подтвердите пароль"
            secureTextEntry
            error={errors.confirmPassword}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>Зарегистрироваться</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginText}>
              Уже есть аккаунт? <Text style={styles.loginLink}>Войти</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: colors.gray[600],
  },
  form: {
    width: '100%',
    marginBottom: 20,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginTop: 10,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginText: {
    color: colors.gray[600],
    fontSize: 14,
  },
  loginLink: {
    color: colors.primary,
    fontWeight: 'bold',
  },
});

export default RegisterScreen;
