import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { QatarColors } from '../constants/colors';

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const rootNavigation = navigation.getParent();
  const totalTabs = state.routes.length;
  const middleIndex = Math.floor(totalTabs / 2);

  return (
    <View style={styles.container}>
      {/* Background tabs container */}
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          
          // Determine icon
          let iconName: keyof typeof Ionicons.glyphMap = 'help-outline';
          if (route.name === 'Projects') {
            iconName = isFocused ? 'folder' : 'folder-outline';
          } else if (route.name === 'Notes') {
            iconName = isFocused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'PanelGroups') {
            iconName = isFocused ? 'layers' : 'layers-outline';
          } else if (route.name === 'Profile') {
            iconName = isFocused ? 'person' : 'person-outline';
          }

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Safely extract and validate all props
          const tabBarTestID = 'tabBarTestID' in options && typeof (options as any).tabBarTestID === 'string' 
            ? (options as any).tabBarTestID 
            : null;
          const accessibilityLabel = typeof options.tabBarAccessibilityLabel === 'string' 
            ? options.tabBarAccessibilityLabel 
            : String(route.name);

          // Build props conditionally to avoid undefined values
          const touchableProps: {
            accessibilityRole: 'button';
            accessibilityLabel: string;
            onPress: () => void;
            style: any;
            accessibilityState?: { selected: boolean };
            testID?: string;
          } = {
            accessibilityRole: 'button',
            accessibilityLabel: accessibilityLabel,
            onPress: onPress,
            style: styles.tab,
          };

          if (isFocused) {
            touchableProps.accessibilityState = { selected: true };
          }

          if (tabBarTestID) {
            touchableProps.testID = tabBarTestID;
          }

          return (
            <React.Fragment key={route.key}>
              <TouchableOpacity 
                {...touchableProps}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                activeOpacity={0.6}
              >
                <View style={styles.tabIconContainer}>
                  <Ionicons
                    name={iconName}
                    size={32}
                    color={isFocused ? QatarColors.primary : QatarColors.mutedForeground}
                  />
                </View>
              </TouchableOpacity>
              {/* Add spacer in the middle for the floating button */}
              {index === middleIndex - 1 && <View style={styles.centerSpacer} />}
            </React.Fragment>
          );
        })}
      </View>

      {/* Floating Scanner Button */}
      <View style={styles.scannerButtonWrapper}>
        <TouchableOpacity
          style={styles.scannerButton}
          onPress={() => {
            if (rootNavigation) {
              rootNavigation.navigate('Scanner' as never);
            }
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Scan QR Code"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="qr-code" size={36} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: QatarColors.card,
    borderTopWidth: 1,
    borderTopColor: QatarColors.border,
    height: Platform.OS === 'ios' ? 100 : 100,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 60,
  },
  tabIconContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerSpacer: {
    width: 85,
    height: '100%',
  },
  scannerButtonWrapper: {
    position: 'absolute',
    width: '100%',
    bottom: Platform.OS === 'ios' ? 45 : 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    pointerEvents: 'box-none',
  },
  scannerButton: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: QatarColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 12,
    borderWidth: 5,
    borderColor: QatarColors.card,
  },
});
