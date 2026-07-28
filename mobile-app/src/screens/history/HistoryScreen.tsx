import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { QatarColors } from '../../constants/colors';
import { NavigationBar } from '../../components/NavigationBar';
import { HistoryStackNavigationProp } from '../../types/navigation';

export default function HistoryScreen() {
  const navigation = useNavigation<HistoryStackNavigationProp>();

  return (
    <View style={styles.container}>
      <NavigationBar title="Scan History" showBackButton={false} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="time" size={60} color={QatarColors.primary} />
          <Text style={styles.title}>Scan History</Text>
          <Text style={styles.subtitle}>View and manage your panel scan history</Text>
        </View>
        
        <TouchableOpacity
          style={styles.viewScansButton}
          onPress={() => navigation.navigate('ViewScans')}
        >
          <Ionicons name="list-outline" size={24} color="white" />
          <Text style={styles.viewScansButtonText}>View All Scans</Text>
        </TouchableOpacity>
      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: QatarColors.mutedForeground,
    textAlign: 'center',
    marginBottom: 40,
  },
  viewScansButton: {
    backgroundColor: QatarColors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  viewScansButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});