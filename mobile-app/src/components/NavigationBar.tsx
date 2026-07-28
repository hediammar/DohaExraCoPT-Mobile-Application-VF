import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { QatarColors } from '../constants/colors';

interface NavigationBarProps {
  title: string;
  showBackButton?: boolean;
  rightComponent?: React.ReactNode;
  backgroundColor?: string;
  titleColor?: string;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({
  title,
  showBackButton = true,
  rightComponent,
  backgroundColor = QatarColors.card,
  titleColor = QatarColors.foreground,
}) => {
  const navigation = useNavigation();

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.leftSection}>
          {showBackButton && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={titleColor} />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.centerSection}>
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        
        <View style={styles.rightSection}>
          {rightComponent}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    paddingTop: 0, // SafeAreaView handles this
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
    minHeight: 56,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
