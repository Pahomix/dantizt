import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { colors } from '../dantizt-mobile-new/src/utils/colors';
import { MaterialIcons, preloadIcons } from './vectorIconsHelper';
import React from 'react';
import { Alert } from 'react-native';
import { TouchableOpacity } from 'react-native';

// Auth Screens
import LoginScreen from '../dantizt-mobile-new/src/screens/LoginScreen';
import RegisterScreen from '../dantizt-mobile-new/src/screens/RegisterScreen';
import RegisterSuccessScreen from '../dantizt-mobile-new/src/screens/RegisterSuccessScreen';

// Patient Screens
import ProfileScreen from '../dantizt-mobile-new/src/screens/patient/ProfileScreen';
import AppointmentsScreen from '../dantizt-mobile-new/src/screens/patient/AppointmentsScreen';
import MedicalRecordsScreen from '../dantizt-mobile-new/src/screens/patient/MedicalRecordsScreen';
import CreateAppointmentScreen from '../dantizt-mobile-new/src/screens/patient/CreateAppointmentScreen';
import PaymentsScreen from '../dantizt-mobile-new/src/screens/patient/PaymentsScreen';

// Components
import PatientTabBar from '../dantizt-mobile-new/src/components/PatientTabBar';

import useAuthStore from '../dantizt-mobile-new/src/store/authStore';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen 
        name="RegisterSuccess" 
        component={RegisterSuccessScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
};

const AppointmentsStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AppointmentsList"
        component={AppointmentsScreen}
        options={{
          title: 'Мои приемы',
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.background,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Stack.Screen
        name="CreateAppointment"
        component={CreateAppointmentScreen}
        options={{
          title: 'Новая запись',
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.background,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
    </Stack.Navigator>
  );
};

const PatientTabs = () => {
  const logout = useAuthStore(state => state.logout);

  const handleLogout = () => {
    Alert.alert(
      "Выход",
      "Вы уверены, что хотите выйти?",
      [
        {
          text: "Отмена",
          style: "cancel"
        },
        {
          text: "Выйти",
          onPress: () => logout(),
          style: "destructive"
        }
      ]
    );
  };

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.background,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen
        name="Appointments"
        component={AppointmentsStack}
        options={{
          title: 'Приемы',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="calendar-today" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{
          title: 'Платежи',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="payment" size={size} color={color} />
          ),
        }}
      />
      {/* <Tab.Screen
        name="MedicalRecords"
        component={MedicalRecordsScreen}
        options={{
          title: 'Мед. карта',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="folder" size={size} color={color} />
          ),
        }}
      /> */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={handleLogout}
              style={{ marginRight: 16 }}
            >
              <MaterialIcons 
                name="logout" 
                size={24} 
                color={colors.background}
              />
            </TouchableOpacity>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default function App() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const checkAuth = useAuthStore(state => state.checkAuth);

  // Предзагружаем иконки и проверяем авторизацию при запуске приложения
  React.useEffect(() => {
    // Предзагрузка иконок
    preloadIcons();
    // Проверка авторизации
    checkAuth();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : (
          <Stack.Screen name="PatientTabs" component={PatientTabs} />
        )}
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
