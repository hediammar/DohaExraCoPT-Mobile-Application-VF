import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const STORED_LICENSE_KEY = 'app_license_key';

type LicenseRpcResponse = {
  valid?: boolean;
  success?: boolean;
  message?: string;
};

export type LicenseActivationResult = {
  success: boolean;
  message: string;
};

async function getDeviceFingerprint(): Promise<string> {
  if (Platform.OS === 'ios') {
    const iosId = await Application.getIosIdForVendorAsync();
    return `ios:${iosId ?? 'unknown'}:${Application.applicationId ?? 'app'}`;
  }

  if (Platform.OS === 'android') {
    const androidId = await Application.getAndroidId();
    return `android:${androidId ?? 'unknown'}:${Application.applicationId ?? 'app'}`;
  }

  return `other:${Application.applicationId ?? 'app'}`;
}

function normalizeLicenseKey(input: string): string {
  return input.trim();
}

export async function activateLicense(licenseKey: string): Promise<LicenseActivationResult> {
  const normalizedLicenseKey = normalizeLicenseKey(licenseKey);
  if (!normalizedLicenseKey) {
    return { success: false, message: 'Please enter a valid license key.' };
  }

  try {
    const deviceFingerprint = await getDeviceFingerprint();
    const { data, error } = await supabase.rpc('activate_app_license', {
      p_license_key: normalizedLicenseKey,
      p_device_fingerprint: deviceFingerprint,
      p_app_slug: Application.applicationId ?? null,
    });

    if (error) {
      return { success: false, message: error.message || 'Activation failed.' };
    }

    const response = (data || {}) as LicenseRpcResponse;
    if (!response.success) {
      return {
        success: false,
        message: response.message || 'Invalid license key or activation limit reached.',
      };
    }

    await SecureStore.setItemAsync(STORED_LICENSE_KEY, normalizedLicenseKey);
    return { success: true, message: response.message || 'License activated successfully.' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Activation failed.',
    };
  }
}

export async function validateStoredLicense(): Promise<boolean> {
  try {
    const storedLicense = await SecureStore.getItemAsync(STORED_LICENSE_KEY);
    if (!storedLicense) {
      return false;
    }

    const deviceFingerprint = await getDeviceFingerprint();
    const { data, error } = await supabase.rpc('validate_app_license_activation', {
      p_license_key: storedLicense,
      p_device_fingerprint: deviceFingerprint,
      p_app_slug: Application.applicationId ?? null,
    });

    if (error) {
      return false;
    }

    const response = (data || {}) as LicenseRpcResponse;
    if (response.valid) {
      return true;
    }

    await SecureStore.deleteItemAsync(STORED_LICENSE_KEY);
    return false;
  } catch {
    return false;
  }
}
