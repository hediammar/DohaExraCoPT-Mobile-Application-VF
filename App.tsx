import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

// Contexts
import { AuthProvider } from './src/contexts/AuthContext';
import { ToastProvider } from './src/contexts/ToastContext';

// Screens
import LoginScreen from './src/screens/auth/LoginScreen';
import QRScannerScreen from './src/screens/scanner/QRScannerScreen';
import PanelDetailsScreen from './src/screens/panels/PanelDetailsScreen';
import StatusUpdateScreen from './src/screens/panels/StatusUpdateScreen';
import HistoryScreen from './src/screens/history/HistoryScreen';
import ProfileScreen from './src/screens/profile/ProfileScreen';

// Components
import { ProtectedRoute } from './src/components/ProtectedRoute';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Scanner') {
            iconName = focused ? 'qr-code' : 'qr-code-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Scanner" component={QRScannerScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator 
            initialRouteName="Login"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="PanelDetails" component={PanelDetailsScreen} />
            <Stack.Screen name="StatusUpdate" component={StatusUpdateScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </ToastProvider>
    </AuthProvider>
  );
}
