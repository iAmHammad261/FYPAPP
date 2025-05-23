import MaterialIcons from '@expo/vector-icons/MaterialIcons'; // Ensure you have this package
import React from 'react';
import { Platform, StatusBar as RNStatusBar, ScrollView, StyleSheet, Text, View } from 'react-native';

// Theme colors inspired by your HomeScreen.js
const darkThemeColors = {
  background: '#1A1D21',       // Dark cool slate
  surface: '#26292E',          // Slightly lighter slate for cards
  primaryText: '#EAEAEA',       // Off-white, good readability
  secondaryText: '#9E9E9E',     // Muted gray for less emphasis
  accent: '#00ACC1',            // A vibrant cyan/teal
  cardBorder: '#373A3F',        // Subtle border for cards
  iconColor: '#B0BEC5',         // Muted icon color (blue-gray)
  statusBar: 'light-content',
};

// Constants for status bar height if needed, similar to your HomeScreen
const ANDROID_STATUS_BAR_HEIGHT = RNStatusBar.currentHeight || 24;

const AboutScreen = () => {
  const instructions = [
    "For translating sign language videos into corresponding sign, upload an already recorded video or record a new one by clicking on the \"add video\" in the card.",
    "Change an already uploaded video by long-pressing the video card.",
    "For watching sign language videos, query using voice or text input."
  ];

  return (
    <View style={styles.container}>
      <RNStatusBar barStyle={darkThemeColors.statusBar} backgroundColor={darkThemeColors.background} translucent={Platform.OS === 'android'} />
      <ScrollView contentContainerStyle={styles.scrollContentContainer}>
        {/* Optional Header like in your app */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>About & Privacy</Text>
        </View>

        {/* Instructions Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="list-alt" size={26} color={darkThemeColors.accent} style={styles.cardIcon} />
            <Text style={styles.cardTitle}>Instructions</Text>
          </View>
          <View style={styles.cardContent}>
            {instructions.map((instruction, index) => (
              <View key={index} style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>{index + 1}.</Text>
                <Text style={styles.instructionText}>{instruction}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Data Privacy Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="security" size={26} color={darkThemeColors.accent} style={styles.cardIcon} />
            <Text style={styles.cardTitle}>Data Privacy</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.privacyText}>
              We are committed to protecting your privacy. Any video you record or upload for sign language translation
              will <Text style={styles.boldText}>not be stored on our servers</Text>.
              The video data is processed in real-time for inference and is
              <Text style={styles.boldText}> deleted immediately after the translation process is complete</Text>.
              We do not retain copies of your videos, ensuring your information remains confidential.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkThemeColors.background,
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT : 0,
  },
  scrollContentContainer: {
    paddingBottom: 30, // Space at the bottom
    paddingHorizontal: 15,
  },
  header: {
    paddingVertical: 15,
    marginBottom: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: darkThemeColors.cardBorder,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: darkThemeColors.primaryText,
  },
  card: {
    backgroundColor: darkThemeColors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: darkThemeColors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardIcon: {
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600', // Semibold
    color: darkThemeColors.primaryText,
  },
  cardContent: {
    // No specific styles needed here for now, content flows naturally
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start', // Align number to top of text
  },
  instructionNumber: {
    color: darkThemeColors.accent,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    minWidth: 20, // Ensures alignment if numbers go to double digits
  },
  instructionText: {
    flex: 1, // Allows text to wrap
    color: darkThemeColors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
  },
  privacyText: {
    color: darkThemeColors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: 'bold',
    color: darkThemeColors.primaryText, // Make bolded parts stand out more
  },
});

export default AboutScreen;
