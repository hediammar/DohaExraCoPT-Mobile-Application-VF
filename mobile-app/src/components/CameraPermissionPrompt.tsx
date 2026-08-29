import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PermissionResponse } from 'expo-camera';
import { QatarColors } from '../constants/colors';

interface CameraPermissionPromptProps {
  message: string;
  permission: PermissionResponse | null;
  onRequestPermission: () => Promise<PermissionResponse | undefined>;
  onContinue: () => void;
}

export function CameraPermissionPrompt({
  message,
  permission,
  onRequestPermission,
  onContinue,
}: CameraPermissionPromptProps) {
  const isGranted = permission?.granted ?? false;

  const handlePress = async () => {
    if (isGranted) {
      onContinue();
    } else {
      await onRequestPermission();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="camera-outline" size={64} color={QatarColors.primary} />
        </View>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity style={styles.button} onPress={handlePress} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
        {!isGranted && permission?.canAskAgain === false && (
          <Text style={styles.deniedHint}>
            Camera access was denied. Please enable it in your device settings.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QatarColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: QatarColors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 2,
    borderColor: QatarColors.border,
  },
  message: {
    fontSize: 18,
    color: QatarColors.foreground,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
  },
  button: {
    backgroundColor: QatarColors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: QatarColors.primaryForeground,
    fontSize: 16,
    fontWeight: 'bold',
  },
  deniedHint: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
});
