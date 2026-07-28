import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { MainTabScreenNavigationProp, RootStackNavigationProp } from '../../types/navigation';
import { QatarColors } from '../../constants/colors';
import { NavigationBar } from '../../components/NavigationBar';
import { canAccessNavigation, UserRole } from '../../utils/rolePermissions';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<MainTabScreenNavigationProp>();
  const rootNavigation = useNavigation<RootStackNavigationProp>();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            // Navigation will be handled automatically by App.tsx based on auth state
          },
        },
      ]
    );
  };

  const handleViewHistory = () => {
    rootNavigation.navigate('History');
  };

  const canViewHistory = user?.role ? canAccessNavigation(user.role as UserRole, 'history') : false;

  return (
    <View style={styles.container}>
      <NavigationBar title="Profile" showBackButton={false} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Ionicons name="person-circle" size={80} color={QatarColors.primary} />
          <Text style={styles.title}>Profile</Text>
        </View>

        {user && (
          <View style={styles.userInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Name:</Text>
              <Text style={styles.value}>{user.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Username:</Text>
              <Text style={styles.value}>{user.username}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Role:</Text>
              <Text style={styles.value}>{user.role}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{user.email}</Text>
            </View>
          </View>
        )}

        {canViewHistory && (
          <TouchableOpacity style={styles.historyButton} onPress={handleViewHistory}>
            <Ionicons name="time-outline" size={20} color="white" />
            <Text style={styles.historyButtonText}>View Scan History</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="white" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QatarColors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginTop: 20,
  },
  userInfo: {
    backgroundColor: QatarColors.card,
    borderRadius: 10,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  label: {
    fontSize: 16,
    color: QatarColors.mutedForeground,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: QatarColors.foreground,
    flex: 1,
    textAlign: 'right',
  },
  logoutButton: {
    backgroundColor: QatarColors.destructive,
    borderRadius: 10,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutButtonText: {
    color: QatarColors.destructiveForeground,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  historyButton: {
    backgroundColor: QatarColors.primary,
    borderRadius: 10,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  historyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});