import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLoadingOverlay } from '../../contexts/LoadingOverlayContext';
import { PANEL_STATUSES } from '../../utils/statusValidation';
import { ScannerScreenNavigationProp } from '../../types/navigation';
import { QatarColors, PanelStatusColors } from '../../constants/colors';
import { StatusChangeDialog } from '../../components/StatusChangeDialog';
import { PanelHistoryDialog } from '../../components/PanelHistoryDialog';
import { NavigationBar } from '../../components/NavigationBar';
import { isCustomerRole, UserRole } from '../../utils/rolePermissions';

interface PanelModel {
  id: string;
  name: string;
  type: number;
  status: number;
  project_id: string;
  project_name?: string;
  building_id?: string;
  building_name?: string;
  facade_id?: string;
  facade_name?: string;
  issue_transmittal_no?: string;
  drawing_number?: string;
  unit_rate_qr_m2?: number;
  ifp_qty_area_sm?: number;
  ifp_qty_nos?: number;
  weight?: number;
  dimension?: string;
  issued_for_production_date?: string;
}

export default function PanelDetailsScreen() {
  const [panel, setPanel] = useState<PanelModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const route = useRoute();
  const navigation = useNavigation<ScannerScreenNavigationProp>();
  const { user } = useAuth();
  const { hideLoadingOverlay } = useLoadingOverlay();

  const { panelId } = route.params as { panelId: string };

  useEffect(() => {
    fetchPanelDetails();
  }, [panelId]);

  const fetchPanelDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('panels')
        .select(`
          *,
          project:projects(name),
          building:buildings(name),
          facade:facades(name)
        `)
        .eq('id', panelId)
        .single();

      if (error) {
        Alert.alert('Error', 'Failed to fetch panel details');
        return;
      }

      setPanel({
        ...data,
        project_name: data.project?.name,
        building_name: data.building?.name,
        facade_name: data.facade?.name,
      });
    } catch (error) {
      Alert.alert('Error', 'An error occurred while fetching panel details');
    } finally {
      setLoading(false);
      hideLoadingOverlay();
    }
  };

  const handleStatusUpdate = () => {
    if (panel) {
      setIsStatusDialogOpen(true);
    }
  };

  const handleStatusChanged = () => {
    // Refresh panel details when status is changed
    fetchPanelDetails();
  };

  const handleHistoryOpen = () => {
    setIsHistoryDialogOpen(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading panel details...</Text>
      </View>
    );
  }

  if (!panel) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Panel not found</Text>
      </View>
    );
  }

  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={styles.container}>
      <NavigationBar title={panel.name} />
      <ScrollView style={[styles.scrollView, { maxHeight: screenHeight - 120 }]}>
        <View style={styles.header}>
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Status:</Text>
            <View style={[styles.statusBadge, { backgroundColor: PanelStatusColors[panel.status]?.background || QatarColors.muted }]}>
              <Text style={[styles.statusValue, { color: PanelStatusColors[panel.status]?.foreground || QatarColors.mutedForeground }]}>
                {PANEL_STATUSES[panel.status]}
              </Text>
            </View>
          </View>
        </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Panel Information</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Panel:</Text>
          <Text style={styles.value}>{panel.name}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Project:</Text>
          <Text style={styles.value}>{panel.project_name || 'N/A'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Building:</Text>
          <Text style={styles.value}>{panel.building_name || 'N/A'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Facade:</Text>
          <Text style={styles.value}>{panel.facade_name || 'N/A'}</Text>
        </View>
        
        {panel.drawing_number && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Drawing Number:</Text>
            <Text style={styles.value}>{panel.drawing_number}</Text>
          </View>
        )}
        
        {panel.dimension && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Dimension:</Text>
            <Text style={styles.value}>{panel.dimension}</Text>
          </View>
        )}
        
        {panel.weight && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Weight:</Text>
            <Text style={styles.value}>{panel.weight} kg</Text>
          </View>
        )}
      </View>

        {/* Action buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.historyButton} onPress={handleHistoryOpen}>
            <Ionicons name="time-outline" size={20} color={QatarColors.primary} />
            <Text style={styles.historyButtonText}>View History</Text>
          </TouchableOpacity>
          
          {/* Only show update status button for non-customer users */}
          {!isCustomerRole(user?.role as UserRole) && (
            <TouchableOpacity style={styles.updateButton} onPress={handleStatusUpdate}>
              <Ionicons name="create-outline" size={20} color="white" />
              <Text style={styles.updateButtonText}>Update Status</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Status Change Dialog - Only show for non-customer users */}
      {!isCustomerRole(user?.role as UserRole) && (
        <StatusChangeDialog
          panel={panel}
          isOpen={isStatusDialogOpen}
          onClose={() => setIsStatusDialogOpen(false)}
          onStatusChanged={handleStatusChanged}
        />
      )}

      {/* Panel History Dialog */}
      <PanelHistoryDialog
        panel={panel}
        isOpen={isHistoryDialogOpen}
        onClose={() => setIsHistoryDialogOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QatarColors.background,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QatarColors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: QatarColors.mutedForeground,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QatarColors.background,
  },
  errorText: {
    fontSize: 18,
    color: QatarColors.mutedForeground,
  },
  header: {
    backgroundColor: QatarColors.card,
    padding: 16,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    color: QatarColors.mutedForeground,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: QatarColors.card,
    marginVertical: 8,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  label: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: QatarColors.foreground,
    flex: 2,
    textAlign: 'right',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 16,
  },
  historyButton: {
    flex: 1,
    backgroundColor: QatarColors.card,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: QatarColors.primary,
  },
  historyButtonText: {
    color: QatarColors.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  updateButton: {
    flex: 1,
    backgroundColor: QatarColors.primary,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateButtonText: {
    color: QatarColors.primaryForeground,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});