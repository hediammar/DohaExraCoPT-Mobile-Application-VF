import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type LicenseActivationScreenProps = {
  onActivate: (licenseKey: string) => Promise<{ success: boolean; message: string }>;
};

export default function LicenseActivationScreen({ onActivate }: LicenseActivationScreenProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleActivate = async () => {
    const key = licenseKey.trim();
    if (!key) {
      setError('Please enter your license key.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onActivate(key);
      if (!result.success) {
        setError(result.message || 'License activation failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="shield-checkmark-outline" size={44} color="#ffffff" />
          <Text style={styles.title}>License Activation Required</Text>
          <Text style={styles.subtitle}>
            Enter the client license key to unlock this app on this device.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>License Key</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter license key"
            placeholderTextColor="#D1B3B8"
            value={licenseKey}
            onChangeText={setLicenseKey}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleActivate}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.buttonText}>Activating...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Activate License</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B2633',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: '#D1B3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#5A1A23',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7A2531',
    padding: 16,
  },
  label: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7A2531',
    backgroundColor: '#3D111A',
    color: '#ffffff',
    paddingHorizontal: 12,
    fontSize: 15,
  },
  error: {
    marginTop: 10,
    color: '#FCA5A5',
    fontSize: 13,
  },
  button: {
    marginTop: 14,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#C13B4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
