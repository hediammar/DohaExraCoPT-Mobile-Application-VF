import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  PANEL_STATUSES,
  validateStatusTransitionWithRole,
  getValidNextStatusesForRole,
  getValidStatusesFromOnHold,
} from '../../utils/statusValidation';
import { ScannerScreenNavigationProp } from '../../types/navigation';
import { QatarColors, PanelStatusColors } from '../../constants/colors';
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

export default function StatusUpdateScreen() {
  const [panel, setPanel] = useState<PanelModel | null>(null);
  const [newStatus, setNewStatus] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validStatuses, setValidStatuses] = useState<number[]>([]);
  const [previousStatus, setPreviousStatus] = useState<number | null>(null);
  
  const route = useRoute();
  const navigation = useNavigation<ScannerScreenNavigationProp>();
  const { user } = useAuth();

  const { panelId } = route.params as { panelId: string };

  // Fetch previous status from panel status history
  const fetchPreviousStatus = async (panelId: string) => {
    try {
      const { data, error } = await supabase
        .from('panel_status_histories')
        .select('status')
        .eq('panel_id', panelId)
        .order('created_at', { ascending: false })
        .limit(2); // Get the last 2 statuses

      if (error) {
        console.error('Error fetching panel status history:', error);
        return null;
      }

      // If we have at least 2 statuses, the second one is the previous status
      if (data && data.length >= 2) {
        return data[1].status;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching previous status:', error);
      return null;
    }
  };

  useEffect(() => {
    // Check if user is a customer and redirect them away
    if (isCustomerRole(user?.role as UserRole)) {
      navigation.goBack();
      return;
    }
    
    fetchPanelDetails();
  }, [panelId, user?.role]);

  useEffect(() => {
    if (panel && user?.role) {
      setNewStatus(panel.status);
      
      // Get valid statuses based on role and current status
      let validStatusesForRole: number[] = [];
      
      if (user.role === 'Administrator') {
        // Administrator can jump to any forward status
        const onHoldStatusIndex = PANEL_STATUSES.indexOf('On Hold');
        
        if (panel.status === onHoldStatusIndex) {
          // From On Hold, allow previous status + special statuses
          validStatusesForRole = getValidStatusesFromOnHold(previousStatus);
        } else {
          // Administrator can jump to any forward status
          validStatusesForRole = getValidNextStatusesForRole(panel.status, user.role);
        }
      } else if (user.role === 'Data Entry') {
        // Data Entry can only move to next status in the flow
        const onHoldStatusIndex = PANEL_STATUSES.indexOf('On Hold');
        
        if (panel.status === onHoldStatusIndex) {
          // From On Hold, allow previous status + special statuses
          validStatusesForRole = getValidStatusesFromOnHold(previousStatus);
        } else {
          // For other statuses, use the standard flow (forward-only)
          validStatusesForRole = getValidNextStatusesForRole(panel.status, user.role);
        }
      } else {
        // For other roles, use the standard role-based restrictions (forward-only)
        validStatusesForRole = getValidNextStatusesForRole(panel.status, user.role);
      }
      
      setValidStatuses(validStatusesForRole);
    }
  }, [panel, user, previousStatus]);

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

      // Fetch previous status if current status is "On Hold"
      const onHoldStatusIndex = PANEL_STATUSES.indexOf('On Hold');
      if (data.status === onHoldStatusIndex) {
        const prevStatus = await fetchPreviousStatus(panelId);
        setPreviousStatus(prevStatus);
      } else {
        setPreviousStatus(null);
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while fetching panel details');
    }
  };

  const handleImagePicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to upload images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage || !panel) return null;

    try {
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      
      const fileExt = selectedImage.split('.').pop() || 'jpg';
      const fileName = `${panel.id}_${Date.now()}.${fileExt}`;
      const filePath = `panel-status-images/${fileName}`;

      const { data, error } = await supabase.storage
        .from('panel-images')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Error uploading image:', error);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('panel-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!panel || !user) return;

    // Enhanced validation for Administrator and Data Entry when coming from On Hold
    if (user.role === 'Administrator' || user.role === 'Data Entry') {
      const onHoldStatusIndex = PANEL_STATUSES.indexOf('On Hold');
      
      let isValidTransition = false;
      if (panel.status === onHoldStatusIndex) {
        // From On Hold, check if newStatus is in allowed statuses
        const allowedStatuses = getValidStatusesFromOnHold(previousStatus);
        isValidTransition = allowedStatuses.includes(newStatus);
      } else {
        // For other statuses, use the standard validation
        const validation = validateStatusTransitionWithRole(panel.status, newStatus, user.role);
        isValidTransition = validation.isValid;
      }

      if (!isValidTransition) {
        Alert.alert('Invalid Status Transition', 'Cannot change to this status');
        return;
      }
    } else {
      // Standard validation for other roles
      const validation = validateStatusTransitionWithRole(panel.status, newStatus, user.role);
      if (!validation.isValid) {
        Alert.alert('Invalid Status Transition', validation.error || 'Cannot change to this status');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Upload image if selected
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImage();
      }

      // Create status history record
      const historyData = {
        panel_id: panel.id,
        status: newStatus,
        user_id: user.id,
        image_url: imageUrl,
        notes: notes.trim() || null,
      };

      const { error: historyError } = await supabase
        .from('panel_status_histories')
        .insert(historyData);

      if (historyError) {
        Alert.alert('Error', 'Failed to create status history record');
        return;
      }

      // Update panel status
      const { error: updateError } = await supabase
        .from('panels')
        .update({ status: newStatus })
        .eq('id', panel.id);

      if (updateError) {
        Alert.alert('Error', 'Failed to update panel status');
        return;
      }

      Alert.alert('Success', 'Panel status updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'An error occurred while updating the status');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!panel) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Update Status</Text>
        <Text style={styles.subtitle}>{panel.name}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Status</Text>
        <View style={[styles.statusBadge, { backgroundColor: PanelStatusColors[panel.status]?.background || QatarColors.muted }]}>
          <Text style={[styles.currentStatus, { color: PanelStatusColors[panel.status]?.foreground || QatarColors.mutedForeground }]}>
            {PANEL_STATUSES[panel.status]}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>New Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.statusOptions}>
            {validStatuses.map((statusIndex) => (
              <TouchableOpacity
                key={statusIndex}
                style={[
                  styles.statusOption,
                  newStatus === statusIndex && styles.selectedStatusOption,
                  { backgroundColor: newStatus === statusIndex ? PanelStatusColors[statusIndex]?.background || QatarColors.primary : QatarColors.card }
                ]}
                onPress={() => setNewStatus(statusIndex)}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    { color: newStatus === statusIndex ? PanelStatusColors[statusIndex]?.foreground || QatarColors.primaryForeground : QatarColors.foreground }
                  ]}
                >
                  {PANEL_STATUSES[statusIndex]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add any notes about this status change..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Image (Optional)</Text>
        <TouchableOpacity style={styles.imageButton} onPress={handleImagePicker}>
          <Ionicons name="camera-outline" size={24} color="#3B82F6" />
          <Text style={styles.imageButtonText}>
            {selectedImage ? 'Change Image' : 'Add Image'}
          </Text>
        </TouchableOpacity>
        {selectedImage && (
          <View style={styles.imagePreview}>
            <Text style={styles.imagePreviewText}>Image selected</Text>
            <TouchableOpacity onPress={() => setSelectedImage(null)}>
              <Ionicons name="close-circle" size={20} color="#ff4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting || newStatus === panel.status}
      >
        {isSubmitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color="white" />
            <Text style={styles.submitButtonText}>Update Status</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QatarColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: QatarColors.card,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  subtitle: {
    fontSize: 16,
    color: QatarColors.mutedForeground,
    marginTop: 5,
  },
  section: {
    backgroundColor: QatarColors.card,
    margin: 10,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  currentStatus: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusOptions: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  statusOption: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  selectedStatusOption: {
    borderColor: QatarColors.primary,
  },
  statusOptionText: {
    fontSize: 14,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: QatarColors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
    backgroundColor: QatarColors.input,
    color: QatarColors.foreground,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: QatarColors.border,
    borderRadius: 8,
    borderStyle: 'dashed',
    backgroundColor: QatarColors.input,
  },
  imageButtonText: {
    marginLeft: 10,
    fontSize: 16,
    color: QatarColors.primary,
  },
  imagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    padding: 10,
    backgroundColor: QatarColors.accent,
    borderRadius: 8,
  },
  imagePreviewText: {
    fontSize: 14,
    color: QatarColors.accentForeground,
  },
  submitButton: {
    backgroundColor: QatarColors.primary,
    margin: 20,
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: QatarColors.muted,
  },
  submitButtonText: {
    color: QatarColors.primaryForeground,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});