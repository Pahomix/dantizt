import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { colors } from '../utils/colors';
import useAuthStore from '../store/authStore';
import CustomInput from '../components/CustomInput';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      return;
    }

    try {
      await login(email, password);
    } catch (error) {
      // Ошибка уже обработана в store
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dantizt</Text>
        <Text style={styles.subtitle}>Медицинская система</Text>
      </View>

      <View style={styles.form}>
        <CustomInput
          value={email}
          onChangeText={(text) => {
            clearError();
            setEmail(text);
          }}
          placeholder="Email"
          keyboardType="email-address"
        />

        <CustomInput
          value={password}
          onChangeText={(text) => {
            clearError();
            setPassword(text);
          }}
          placeholder="Пароль"
          secureTextEntry
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>Войти</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerText}>
            Нет аккаунта? <Text style={styles.registerLink}>Зарегистрироваться</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
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
    padding: 20,
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
  registerButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    color: colors.gray[600],
    fontSize: 14,
  },
  registerLink: {
    color: colors.primary,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
