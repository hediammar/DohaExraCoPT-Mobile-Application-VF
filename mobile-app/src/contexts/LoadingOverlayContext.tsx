import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import { QatarColors } from '../constants/colors';

interface LoadingOverlayContextType {
  showLoadingOverlay: () => void;
  hideLoadingOverlay: () => void;
  isLoadingVisible: boolean;
}

const LoadingOverlayContext = createContext<LoadingOverlayContextType | undefined>(undefined);

export const useLoadingOverlay = () => {
  const context = useContext(LoadingOverlayContext);
  if (context === undefined) {
    throw new Error('useLoadingOverlay must be used within a LoadingOverlayProvider');
  }
  return context;
};

interface LoadingOverlayProviderProps {
  children: ReactNode;
}

export function LoadingOverlayProvider({ children }: LoadingOverlayProviderProps) {
  const [visible, setVisible] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const pulseRef = React.useRef<Animated.CompositeAnimation | null>(null);

  const showLoadingOverlay = useCallback(() => {
    setVisible(true);
    pulseAnim.setValue(1);
    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseRef.current.start();
  }, [pulseAnim]);

  const hideLoadingOverlay = useCallback(() => {
    setVisible(false);
    pulseRef.current?.stop();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const value = {
    showLoadingOverlay,
    hideLoadingOverlay,
    isLoadingVisible: visible,
  };

  return (
    <LoadingOverlayContext.Provider value={value}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <View style={styles.content}>
            <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
              <Image
                source={require('../../assets/DohaTracker.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </Animated.View>
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={QatarColors.primary} />
            </View>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      </Modal>
    </LoadingOverlayContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: QatarColors.background,
    borderRadius: 24,
    padding: 48,
    minWidth: 260,
  },
  logoContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  loaderContainer: {
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
    fontWeight: '500',
  },
});
