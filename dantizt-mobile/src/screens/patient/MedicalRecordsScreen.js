import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { colors } from '../../utils/colors';
import { MaterialIcons } from '@expo/vector-icons';
import useAuthStore from '../../store/authStore';
import usePaymentStore from '../../store/paymentStore';
import PaymentAlert from '../../components/PaymentAlert';

const MedicalRecordsScreen = () => {
  const { patientProfile, fetchPatientProfile } = useAuthStore();
  const { statistics, fetchPayments } = usePaymentStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchPatientProfile(),
        fetchPayments()
      ]);
    } catch (error) {
      console.error('Error loading medical records:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
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
      <PaymentAlert pendingCount={statistics.pendingCount} />
      
      {/* Основная информация */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Основная информация</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <MaterialIcons name="person" size={20} color={colors.gray[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>ФИО</Text>
              <Text style={styles.infoValue}>{patientProfile?.full_name || 'Не указано'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <MaterialIcons name="cake" size={20} color={colors.gray[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Дата рождения</Text>
              <Text style={styles.infoValue}>{patientProfile?.birth_date || 'Не указано'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <MaterialIcons name="wc" size={20} color={colors.gray[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Пол</Text>
              <Text style={styles.infoValue}>{patientProfile?.gender || 'Не указано'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Медицинская информация */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Медицинская информация</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <MaterialIcons name="history" size={20} color={colors.gray[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>История болезни</Text>
              <Text style={styles.infoValue}>{patientProfile?.medical_history || 'Нет данных'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <MaterialIcons name="warning" size={20} color={colors.gray[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Аллергии</Text>
              <Text style={styles.infoValue}>{patientProfile?.allergies || 'Нет данных'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <MaterialIcons name="local-pharmacy" size={20} color={colors.gray[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Текущие медикаменты</Text>
              <Text style={styles.infoValue}>{patientProfile?.current_medications || 'Нет данных'}</Text>
            </View>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  card: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: colors.gray[900],
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginVertical: 8,
  }
});

export default MedicalRecordsScreen;
