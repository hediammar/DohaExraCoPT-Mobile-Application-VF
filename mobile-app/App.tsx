import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { CommonActions } from '@react-navigation/native';
import { 
  RootStackParamList, 
  MainTabParamList, 
  ProjectStackParamList, 
  ScannerStackParamList, 
  HistoryStackParamList, 
  NotesStackParamList,
  PanelGroupsStackParamList,
  ProfileStackParamList 
} from './src/types/navigation';
import { useAuth } from './src/contexts/AuthContext';
import { canAccessNavigation, UserRole } from './src/utils/rolePermissions';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { QatarColors } from './src/constants/colors';

// Contexts
import { AuthProvider } from './src/contexts/AuthContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { LoadingOverlayProvider } from './src/contexts/LoadingOverlayContext';

// Screens
import SplashScreen from './src/screens/splash/SplashScreen';

// Screens
import LoginScreen from './src/screens/auth/LoginScreen';
import LicenseActivationScreen from './src/screens/auth/LicenseActivationScreen';
import QRScannerScreen from './src/screens/scanner/QRScannerScreen';
import PanelDetailsScreen from './src/screens/panels/PanelDetailsScreen';
import StatusUpdateScreen from './src/screens/panels/StatusUpdateScreen';
import ViewScansScreen from './src/screens/scan-history/ViewScansScreen';
import NotesScreen from './src/screens/notes/NotesScreen';
import NoteDetailsScreen from './src/screens/notes/NoteDetailsScreen';
import PanelGroupsScreen from './src/screens/panel-groups/PanelGroupsScreen';
import PanelGroupDetailsScreen from './src/screens/panel-groups/PanelGroupDetailsScreen';
import ProfileScreen from './src/screens/profile/ProfileScreen';
import ProjectManagementScreen from './src/screens/projects/ProjectManagementScreen';
import ProjectDetailsScreen from './src/screens/projects/ProjectDetailsScreen';
import BuildingDetailsScreen from './src/screens/buildings/BuildingDetailsScreen';
import FacadeDetailsScreen from './src/screens/facades/FacadeDetailsScreen';

// Components
import { ProtectedRoute } from './src/components/ProtectedRoute';
import { CustomTabBar } from './src/components/CustomTabBar';
import { activateLicense, validateStoredLicense } from './src/lib/license';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<RootStackParamList>();
const ProjectStackNav = createStackNavigator<ProjectStackParamList>();
const ScannerStackNav = createStackNavigator<ScannerStackParamList>();
const HistoryStackNav = createStackNavigator<HistoryStackParamList>();
const NotesStackNav = createStackNavigator<NotesStackParamList>();
const PanelGroupsStackNav = createStackNavigator<PanelGroupsStackParamList>();
const ProfileStackNav = createStackNavigator<ProfileStackParamList>();

// Helper to ensure boolean props are actual booleans (not strings)
const ensureBooleanOptions = (options: any) => {
  const safeOptions: any = {};
  if (options.headerShown !== undefined) safeOptions.headerShown = !!options.headerShown;
  if (options.gestureEnabled !== undefined) safeOptions.gestureEnabled = !!options.gestureEnabled;
  if (options.animationEnabled !== undefined) safeOptions.animationEnabled = !!options.animationEnabled;
  if (options.replaceAnimation !== undefined) safeOptions.replaceAnimation = options.replaceAnimation;
  if (options.fullScreenGestureEnabled !== undefined) safeOptions.fullScreenGestureEnabled = !!options.fullScreenGestureEnabled;
  if (options.headerBackVisible !== undefined) safeOptions.headerBackVisible = !!options.headerBackVisible;
  if (options.headerLargeTitle !== undefined) safeOptions.headerLargeTitle = !!options.headerLargeTitle;
  if (options.headerShadowVisible !== undefined) safeOptions.headerShadowVisible = !!options.headerShadowVisible;
  if (options.headerTransparent !== undefined) safeOptions.headerTransparent = !!options.headerTransparent;
  if (options.headerHideShadow !== undefined) safeOptions.headerHideShadow = !!options.headerHideShadow;
  if (options.headerLargeTitleShadowVisible !== undefined) safeOptions.headerLargeTitleShadowVisible = !!options.headerLargeTitleShadowVisible;
  if (options.headerTranslucent !== undefined) safeOptions.headerTranslucent = !!options.headerTranslucent;
  if (options.headerBackTitleVisible !== undefined) safeOptions.headerBackTitleVisible = !!options.headerBackTitleVisible;
  if (options.headerBackButtonMenuEnabled !== undefined) safeOptions.headerBackButtonMenuEnabled = !!options.headerBackButtonMenuEnabled;
  if (options.headerLargeTitleHideShadow !== undefined) safeOptions.headerLargeTitleHideShadow = !!options.headerLargeTitleHideShadow;
  if (options.freezeOnBlur !== undefined) safeOptions.freezeOnBlur = !!options.freezeOnBlur;
  // Copy non-boolean props
  Object.keys(options).forEach(key => {
    if (!['headerShown', 'gestureEnabled', 'animationEnabled', 'replaceAnimation', 'fullScreenGestureEnabled', 
          'headerBackVisible', 'headerLargeTitle', 'headerShadowVisible', 'headerTransparent', 
          'headerHideShadow', 'headerLargeTitleShadowVisible', 'headerTranslucent', 
          'headerBackTitleVisible', 'headerBackButtonMenuEnabled', 'headerLargeTitleHideShadow', 
          'freezeOnBlur'].includes(key)) {
      safeOptions[key] = options[key];
    }
  });
  return safeOptions;
};

function MainTabs() {
  const { user } = useAuth();
  const userRole = user?.role as UserRole;

  // If no user, don't render tabs (prevents navigator error during logout)
  if (!user) {
    return null;
  }

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={({ route }) => {
        let iconName: keyof typeof Ionicons.glyphMap = 'help-outline';
        let focusedIconName: keyof typeof Ionicons.glyphMap = 'help-outline';

        if (route.name === 'Projects') {
          iconName = 'folder-outline';
          focusedIconName = 'folder';
        } else if (route.name === 'Notes') {
          iconName = 'document-text-outline';
          focusedIconName = 'document-text';
        } else if (route.name === 'PanelGroups') {
          iconName = 'layers-outline';
          focusedIconName = 'layers';
        } else if (route.name === 'Profile') {
          iconName = 'person-outline';
          focusedIconName = 'person';
        }

        return {
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
            return <Ionicons name={focused ? focusedIconName : iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: QatarColors.primary,
          tabBarInactiveTintColor: QatarColors.mutedForeground,
          tabBarStyle: {
            backgroundColor: QatarColors.card,
            borderTopColor: QatarColors.border,
          },
          headerShown: false,
        };
      }}
    >
      {canAccessNavigation(userRole, 'projects') && (
        <Tab.Screen name="Projects" component={ProjectStack} />
      )}
      {canAccessNavigation(userRole, 'panelGroups') && (
        <Tab.Screen name="PanelGroups" component={PanelGroupsStack} />
      )}
      {canAccessNavigation(userRole, 'notes') && (
        <Tab.Screen name="Notes" component={NotesStack} />
      )}
      {canAccessNavigation(userRole, 'profile') && (
        <Tab.Screen name="Profile" component={ProfileStack} />
      )}
    </Tab.Navigator>
  );
}

// Stack navigators for each tab
function ProjectStack() {
  return (
    <ProjectStackNav.Navigator 
      screenOptions={() => ensureBooleanOptions({
        headerShown: false,
      })}
    >
      <ProjectStackNav.Screen name="ProjectManagement" component={ProjectManagementScreen} />
      <ProjectStackNav.Screen name="ProjectDetails" component={ProjectDetailsScreen} />
      <ProjectStackNav.Screen name="BuildingDetails" component={BuildingDetailsScreen} />
      <ProjectStackNav.Screen name="FacadeDetails" component={FacadeDetailsScreen} />
      <ProjectStackNav.Screen name="PanelDetails" component={PanelDetailsScreen} />
    </ProjectStackNav.Navigator>
  );
}

function ScannerStack() {
  return (
    <ScannerStackNav.Navigator 
      screenOptions={() => ensureBooleanOptions({
        headerShown: false,
      })}
    >
      <ScannerStackNav.Screen name="QRScanner" component={QRScannerScreen} />
      <ScannerStackNav.Screen name="PanelDetails" component={PanelDetailsScreen} />
      <ScannerStackNav.Screen name="StatusUpdate" component={StatusUpdateScreen} />
    </ScannerStackNav.Navigator>
  );
}

function HistoryStack() {
  return (
    <HistoryStackNav.Navigator 
      screenOptions={() => ensureBooleanOptions({
        headerShown: false,
      })}
    >
      <HistoryStackNav.Screen name="HistoryMain" component={ViewScansScreen} />
      <HistoryStackNav.Screen name="ViewScans" component={ViewScansScreen} />
    </HistoryStackNav.Navigator>
  );
}

function NotesStack() {
  return (
    <NotesStackNav.Navigator 
      screenOptions={() => ensureBooleanOptions({
        headerShown: false,
      })}
    >
      <NotesStackNav.Screen name="NotesMain" component={NotesScreen} />
      <NotesStackNav.Screen name="NoteDetails" component={NoteDetailsScreen} />
      <NotesStackNav.Screen name="PanelDetails" component={PanelDetailsScreen} />
    </NotesStackNav.Navigator>
  );
}

function PanelGroupsStack() {
  return (
    <PanelGroupsStackNav.Navigator 
      screenOptions={() => ensureBooleanOptions({
        headerShown: false,
      })}
    >
      <PanelGroupsStackNav.Screen name="PanelGroupsMain" component={PanelGroupsScreen} />
      <PanelGroupsStackNav.Screen name="PanelGroupDetails" component={PanelGroupDetailsScreen} />
      <PanelGroupsStackNav.Screen name="PanelDetails" component={PanelDetailsScreen} />
    </PanelGroupsStackNav.Navigator>
  );
}

function ProfileStack() {
  return (
    <ProfileStackNav.Navigator 
      screenOptions={() => ensureBooleanOptions({
        headerShown: false,
      })}
    >
      <ProfileStackNav.Screen name="ProfileMain" component={ProfileScreen} />
    </ProfileStackNav.Navigator>
  );
}

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [licenseLoading, setLicenseLoading] = useState(true);
  const [isLicenseValid, setIsLicenseValid] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // Hide Android navigation bar
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
    }
  }, []);

  // Handle navigation when user logs out
  useEffect(() => {
    if (!authLoading && isLicenseValid && !user && navigationRef.current) {
      navigationRef.current.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );
    }
  }, [user, authLoading, isLicenseValid]);

  useEffect(() => {
    const checkLicenseStatus = async () => {
      try {
        const valid = await validateStoredLicense();
        setIsLicenseValid(valid);
      } finally {
        setLicenseLoading(false);
      }
    };

    checkLicenseStatus();
  }, []);

  useEffect(() => {
    // Initialize app data in the background
    const initializeApp = async () => {
      try {
        // Minimum splash screen display time for better UX (1.5 seconds)
        const minSplashTime = 1500;
        const startTime = Date.now();

        // Check for updates - TEMPORARILY DISABLED FOR TESTING
        // if (!__DEV__) {
        //   try {
        //     const update = await Updates.checkForUpdateAsync();
        //     if (update.isAvailable) {
        //       await Updates.fetchUpdateAsync();
        //       // Update will be applied on next app restart
        //       console.log('Update downloaded, will apply on next restart');
        //     }
        //   } catch (updateError) {
        //     console.error('Error checking for updates:', updateError);
        //     // Continue with app initialization even if update check fails
        //   }
        // }
        
        // Ensure minimum splash screen time
        const elapsed = Date.now() - startTime;
        if (elapsed < minSplashTime) {
          await new Promise(resolve => setTimeout(resolve, minSplashTime - elapsed));
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setIsInitializing(false);
        // Small delay before hiding splash for smooth transition
        setTimeout(() => {
          setIsSplashVisible(false);
        }, 300);
      }
    };

    if (!authLoading && !licenseLoading) {
      initializeApp();
    }
  }, [authLoading, licenseLoading]);

  const handleLicenseActivation = async (licenseKey: string) => {
    const result = await activateLicense(licenseKey);
    if (result.success) {
      setIsLicenseValid(true);
    }
    return result;
  };

  // Show splash screen while loading or initializing
  if (isSplashVisible || authLoading || isInitializing || licenseLoading) {
    return (
      <>
        <StatusBar style="light" />
        <SplashScreen onLoadingComplete={() => {}} />
      </>
    );
  }

  if (!isLicenseValid) {
    return (
      <>
        <StatusBar style="light" />
        <LicenseActivationScreen onActivate={handleLicenseActivation} />
      </>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="auto" />
      <Stack.Navigator 
        initialRouteName={user ? "Main" : "Login"}
        screenOptions={() => ensureBooleanOptions({
          headerShown: false,
        })}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="History" component={HistoryStack} />
        <Stack.Screen name="Scanner" component={ScannerStack} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <LoadingOverlayProvider>
          <AppContent />
        </LoadingOverlayProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
