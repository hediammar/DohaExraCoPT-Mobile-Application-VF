import React from 'react';
import {
  View,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { QatarColors } from '../../constants/colors';

interface SplashScreenProps {
  onLoadingComplete: () => void;
}

export default function SplashScreen({ onLoadingComplete }: SplashScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo - centered, no effects */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/DohaTracker.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Circular Loader */}
        <View style={styles.loaderContainer}>
          <ActivityIndicator
            size="large"
            color={QatarColors.primary}
          />
        </View>
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
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
