  // Этот код нужно вставить в компонент CreateAppointmentScreen
  // вместо существующего кода рендера

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
        <View style={styles.warningCard}>
          <View style={styles.warningHeader}>
            <MaterialIcons name="warning" size={24} color={colors.warning} />
            <Text style={styles.warningTitle}>Внимание! У вас есть неоплаченные услуги</Text>
          </View>
          <Text style={styles.warningText}>
            У вас есть {pendingPayments.length} {pendingPayments.length === 1 ? 'неоплаченная услуга' : 'неоплаченных услуг'}. 
            Для записи на новый прием необходимо оплатить все предыдущие услуги.
          </Text>
          <TouchableOpacity 
            style={styles.warningButton}
            onPress={() => navigation.navigate('Payments')}
          >
            <Text style={styles.warningButtonText}>Перейти к оплате</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Если есть неоплаченные услуги, показываем блок с сообщением о блокировке */}
      {hasPendingPayments ? (
        <View style={styles.blockedContainer}>
          <MaterialIcons name="block" size={64} color={colors.gray[300]} />
          <Text style={styles.blockedTitle}>Запись на прием недоступна</Text>
          <Text style={styles.blockedText}>Пожалуйста, оплатите все предыдущие услуги, чтобы продолжить</Text>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Payments')}
          >
            <Text style={styles.primaryButtonText}>Перейти к оплате</Text>
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
