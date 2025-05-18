import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';

const PatientTabBar = ({ state, navigation }) => {
  const tabs = [
    { name: 'Profile', label: 'Профиль' },
    { name: 'Appointments', label: 'Записи' },
    { name: 'MedicalRecords', label: 'Медкарта' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab, index) => {
        const isFocused = state.index === index;

        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tab, isFocused && styles.focusedTab]}
            onPress={() => navigation.navigate(tab.name)}
          >
            <Text style={[
              styles.label,
              isFocused && styles.focusedLabel
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    height: 60,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  focusedTab: {
    backgroundColor: colors.gray[50],
  },
  label: {
    color: colors.gray[600],
    fontSize: 12,
  },
  focusedLabel: {
    color: colors.primary,
    fontWeight: 'bold',
  },
});

export default PatientTabBar;
