import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ScannerScreenNavigationProp } from '../../types/navigation';
import { QatarColors } from '../../constants/colors';
import { useLoadingOverlay } from '../../contexts/LoadingOverlayContext';
import { NavigationBar } from '../../components/NavigationBar';
import { CameraPermissionPrompt } from '../../components/CameraPermissionPrompt';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasContinued, setHasContinued] = useState(false);
  const initialPermissionChecked = useRef(false);
  const [scanned, setScanned] = useState(false);
  const [locationPermission, setLocationPermission] = useState<Location.LocationPermissionResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScannedData, setLastScannedData] = useState<string | null>(null);
  const isTrackingRef = useRef(false);
  const navigation = useNavigation<ScannerScreenNavigationProp>();
  const { user } = useAuth();
  const { showLoadingOverlay } = useLoadingOverlay();

  useEffect(() => {
    // Request location permission when component mounts
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (permission && !initialPermissionChecked.current) {
      initialPermissionChecked.current = true;
      if (permission.granted) {
        setHasContinued(true);
      }
    }
  }, [permission]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission({ status } as Location.LocationPermissionResponse);
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      if (locationPermission?.status !== 'granted') {
        return { latitude: null, longitude: null };
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting location:', error);
      return { latitude: null, longitude: null };
    }
  };

  const trackScan = async (panelId: string) => {
    // Prevent multiple tracking calls for the same scan
    if (isTrackingRef.current) {
      return;
    }
    
    isTrackingRef.current = true;
    
    try {
      // Check if user is authenticated using our custom auth context
      if (!user) {
        console.error('User not authenticated for scan tracking');
        return;
      }

      const location = await getCurrentLocation();
      const deviceTimestamp = new Date().toISOString();
      
      // Insert directly into scan_history table (location will be converted in ViewScansScreen)
      const { data, error } = await supabase
        .from('scan_history')
        .insert({
          panel_id: panelId,
          user_id: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
          location: location.latitude && location.longitude 
            ? `Lat: ${location.latitude}, Lng: ${location.longitude}` 
            : 'Location not available',
          created_at_device: deviceTimestamp,
        })
        .select()
        .single();

      if (error) {
        console.error('Error tracking scan:', error);
        // Don't show error to user as scan tracking is secondary
      } else if (__DEV__) {
        console.log('Scan tracked successfully:', data);
      }
    } catch (error) {
      console.error('Error in trackScan:', error);
    } finally {
      // Reset the tracking flag after a delay to allow for new scans
      setTimeout(() => {
        isTrackingRef.current = false;
      }, 2000); // 2 second cooldown
    }
  };

  const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
    // Prevent multiple scans of the same QR code
    if (scanned || isProcessing || lastScannedData === data) {
      return;
    }
    
    setIsProcessing(true);
    setScanned(true);
    setLastScannedData(data);
    
    // Parse QR code data - expecting format: /panels/{panelId}
    if (data.includes('/panels/')) {
      const panelId = data.split('/panels/')[1];
      if (panelId) {
        // Start tracking the scan in background (non-blocking)
        trackScan(panelId);
        
        // Show loading overlay and navigate to panel details
        showLoadingOverlay();
        navigation.navigate('PanelDetails', { panelId });
      } else {
        Alert.alert('Invalid QR Code', 'This QR code does not contain a valid panel ID');
        setScanned(false);
        setIsProcessing(false);
        setLastScannedData(null);
      }
    } else {
      Alert.alert('Invalid QR Code', 'This QR code is not for a panel');
      setScanned(false);
      setIsProcessing(false);
      setLastScannedData(null);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  const showPermissionPrompt = !permission.granted || !hasContinued;

  if (showPermissionPrompt) {
    return (
      <CameraPermissionPrompt
        message="Camera access is required to scan the panel QR code"
        permission={permission}
        onRequestPermission={requestPermission}
        onContinue={() => setHasContinued(true)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <NavigationBar title="QR Scanner" showBackButton={false} />
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'pdf417'],
        }}
      />
      
      {/* Exit Button - Top Right */}
      <TouchableOpacity 
        style={styles.exitButton}
        onPress={() => {
          // Navigate back to main tabs (home page)
          navigation.getParent()?.goBack();
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="close" size={28} color="white" />
      </TouchableOpacity>
      
      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={styles.corner} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        
        <Text style={styles.instruction}>
          Position the QR code within the frame
        </Text>
        
        {scanned && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setScanned(false);
              setIsProcessing(false);
              setLastScannedData(null);
              isTrackingRef.current = false;
            }}
          >
            <Ionicons name="refresh-outline" size={20} color="white" />
            <Text style={styles.buttonText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  exitButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    borderWidth: 2,
    borderColor: 'white',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: QatarColors.primary,
    borderWidth: 3,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    top: 0,
    left: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    left: 'auto',
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    top: 'auto',
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    top: 'auto',
    left: 'auto',
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  instruction: {
    color: 'white',
    fontSize: 16,
    marginTop: 30,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  message: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: QatarColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});