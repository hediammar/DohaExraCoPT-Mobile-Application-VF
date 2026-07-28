import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { QatarColors, PanelStatusColors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToastContext } from '../contexts/ToastContext';
import {
  PANEL_STATUSES as VALIDATION_PANEL_STATUSES,
  validateStatusTransitionWithRole,
  getValidNextStatusesForRole,
  getValidStatusesFromOnHold,
} from '../utils/statusValidation';

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

interface StatusChangeDialogProps {
  panel: PanelModel | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged: () => void;
}

const PANEL_STATUSES = [
  'Issued For Production',
  'Produced',
  'Proceed for Delivery',
  'Delivered',
  'Approved Material',
  'Rejected Material',
  'Installed',
  'Inspected',
  'Approved Final',
  'On Hold',
  'Cancelled',
  'Broken at Site'
];

export function StatusChangeDialog({ panel, isOpen, onClose, onStatusChanged }: StatusChangeDialogProps) {
  const { user: currentUser } = useAuth();
  const { showToast } = useToastContext();
  const [newStatus, setNewStatus] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [previousStatus, setPreviousStatus] = useState<number | null>(null);
  const [statusChangeDate, setStatusChangeDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  // Get valid next statuses for the current panel status and user role
  const getValidStatuses = () => {
    if (!panel || !currentUser?.role) return [];
    
    // Use proper status validation logic
    let validStatusesForRole: number[] = [];
    
    if (currentUser.role === 'Administrator') {
      // Administrator can jump to any forward status
      const onHoldStatusIndex = VALIDATION_PANEL_STATUSES.indexOf('On Hold');
      
      if (panel.status === onHoldStatusIndex) {
        // From On Hold, allow previous status + special statuses
        validStatusesForRole = getValidStatusesFromOnHold(previousStatus);
      } else {
        // Administrator can jump to any forward status
        validStatusesForRole = getValidNextStatusesForRole(panel.status, currentUser.role);
      }
    } else if (currentUser.role === 'Data Entry') {
      // Data Entry can only move to next status in the flow
      const onHoldStatusIndex = VALIDATION_PANEL_STATUSES.indexOf('On Hold');
      
      if (panel.status === onHoldStatusIndex) {
        // From On Hold, allow previous status + special statuses
        validStatusesForRole = getValidStatusesFromOnHold(previousStatus);
      } else {
        // For other statuses, use the standard flow (forward-only)
        validStatusesForRole = getValidNextStatusesForRole(panel.status, currentUser.role);
      }
    } else {
      // For other roles, use the standard role-based restrictions (forward-only)
      validStatusesForRole = getValidNextStatusesForRole(panel.status, currentUser.role);
    }
    
    return validStatusesForRole.sort((a, b) => a - b);
  };

  // Reset form when panel changes
  useEffect(() => {
    if (panel) {
      setNewStatus(panel.status);
      setValidationError('');
      
      // Set default date to today at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setStatusChangeDate(today);
      
      // Fetch previous status if current status is "On Hold"
      const onHoldStatusIndex = VALIDATION_PANEL_STATUSES.indexOf('On Hold');
      if (panel.status === onHoldStatusIndex) {
        fetchPreviousStatus(panel.id).then(setPreviousStatus);
      } else {
        setPreviousStatus(null);
      }
    }
  }, [panel]);

  const handleImageSelect = async () => {
    try {
      // Show action sheet to choose between camera and gallery
      Alert.alert(
        'Select Image Source',
        'Choose how you want to add an image',
        [
          {
            text: 'Camera',
            onPress: () => handleCameraCapture(),
          },
          {
            text: 'Gallery',
            onPress: () => handleGallerySelect(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Error showing image source options:', error);
      showToast('Error showing image options', 'error');
    }
  };

  const handleCameraCapture = async () => {
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast('Permission to access camera is required!', 'error');
        return;
      }

      // Take picture
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      showToast('Error taking picture', 'error');
    }
  };

  const handleGallerySelect = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast('Permission to access camera roll is required!', 'error');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast('Error selecting image', 'error');
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage || !panel) return null;

    try {
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      
      const fileExt = selectedImage.split('.').pop() || 'jpg';
      const fileName = `${panel.id}_${Date.now()}.${fileExt}`;
      const filePath = `panel-status-images/${fileName}`;

      if (__DEV__) {
        console.log('Attempting to upload image to:', filePath);
      }

      const { data, error: uploadError } = await supabase.storage
        .from('panel-images')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        showToast(`Failed to upload image: ${uploadError.message}`, 'error');
        return null;
      }

      if (__DEV__) {
        console.log('Upload successful:', data);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('panel-images')
        .getPublicUrl(filePath);

      if (__DEV__) {
        console.log('Public URL:', publicUrl);
      }
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      showToast(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!panel || !currentUser?.role) return;

    // Validate status transition before proceeding
    const validation = validateStatusTransitionWithRole(panel.status, newStatus, currentUser.role);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid status transition');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload image if selected
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImage();
        if (!imageUrl) {
          setIsSubmitting(false);
          return;
        }
      }

      // Use selected date at midnight (UTC) for database storage
      const d = statusChangeDate;
      const createdAtISO = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)).toISOString();

      // Insert the status history record directly with the custom date
      const historyData = {
        panel_id: panel.id,
        status: newStatus,
        created_at: createdAtISO,
        user_id: currentUser.id,
        image_url: imageUrl,
        notes: notes.trim() || null
      };

      const { data: newHistory, error: historyError } = await supabase
        .from('panel_status_histories')
        .insert(historyData)
        .select()
        .single();

      if (historyError) {
        console.error('Error inserting status history:', historyError);
        showToast('Failed to create status history record', 'error');
        return;
      }

      // Update panel status
      const { error: updateError } = await supabase
        .from('panels')
        .update({ status: newStatus })
        .eq('id', panel.id);

      if (updateError) {
        console.error('Error updating panel status:', updateError);
        showToast('Failed to update panel status', 'error');
        return;
      }

      showToast('Panel status updated successfully', 'success');

      // Reset form
      setNewStatus(0);
      setNotes('');
      setSelectedImage(null);
      setValidationError('');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setStatusChangeDate(today);

      onStatusChanged();
      onClose();
    } catch (error) {
      console.error('Error updating panel status:', error);
      showToast('Failed to update panel status', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNewStatus(0);
    setNotes('');
    setSelectedImage(null);
    setValidationError('');
    setPreviousStatus(null);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setStatusChangeDate(today);
    onClose();
  };

  const validStatuses = getValidStatuses();

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={QatarColors.foreground} />
          </TouchableOpacity>
          <Text style={styles.title}>Update Panel Status</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Panel Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Panel Information</Text>
            <View style={styles.panelInfoCard}>
              <Text style={styles.panelName}>{panel?.name}</Text>
              <Text style={styles.panelId}>Panel ID: {panel?.id.slice(-4).toUpperCase()}</Text>
            </View>
          </View>

          {/* Current Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Status</Text>
            <View style={styles.statusContainer}>
              <View style={[
                styles.statusBadge,
                { backgroundColor: PanelStatusColors[panel?.status || 0]?.background || QatarColors.muted }
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  { color: PanelStatusColors[panel?.status || 0]?.foreground || QatarColors.mutedForeground }
                ]}>
                  {panel ? VALIDATION_PANEL_STATUSES[panel.status] : 'Unknown'}
                </Text>
              </View>
            </View>
          </View>

          {/* New Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>New Status *</Text>
            <View style={styles.statusOptions}>
              {validStatuses.map((statusIndex) => {
                const statusName = VALIDATION_PANEL_STATUSES[statusIndex] || 'Unknown';
                const isSelected = newStatus === statusIndex;
                const statusColors = PanelStatusColors[statusIndex];
                
                return (
                  <TouchableOpacity
                    key={statusIndex}
                    style={[
                      styles.statusOption,
                      isSelected && styles.selectedStatusOption,
                      { 
                        backgroundColor: isSelected 
                          ? (statusColors?.background || QatarColors.primary)
                          : QatarColors.card,
                        borderColor: isSelected 
                          ? (statusColors?.background || QatarColors.primary)
                          : QatarColors.border
                      }
                    ]}
                    onPress={() => {
                      setNewStatus(statusIndex);
                      setValidationError(''); // Clear validation error when selecting a new status
                    }}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      { 
                        color: isSelected 
                          ? (statusColors?.foreground || QatarColors.primaryForeground)
                          : QatarColors.foreground
                      }
                    ]}>
                      {statusName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {validStatuses.length === 0 && (
              <Text style={styles.noStatusText}>
                No valid status transitions available for current status.
              </Text>
            )}
            {validationError ? (
              <Text style={styles.validationErrorText}>
                {validationError}
              </Text>
            ) : null}
          </View>

          {/* Status Change Date */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status Change Date</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar" size={20} color={QatarColors.mutedForeground} style={styles.inputIcon} />
              <Text style={styles.dateInput}>
                {statusChangeDate.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })}
              </Text>
            </TouchableOpacity>
            <Modal
              visible={showDatePicker}
              transparent
              animationType="fade"
              onRequestClose={() => setShowDatePicker(false)}
            >
              <TouchableOpacity
                style={styles.datePickerOverlay}
                activeOpacity={1}
                onPress={() => setShowDatePicker(false)}
              >
                <View style={styles.datePickerContainer} onStartShouldSetResponder={() => true}>
                  <View style={styles.datePickerHeader}>
                    <Text style={styles.datePickerTitle}>Select date</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                      <Text style={styles.datePickerDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={statusChangeDate}
                    mode="date"
                    display="spinner"
                    onChange={(event: { type: string }, date: Date | undefined) => {
                      if (event.type === 'set' && date) {
                        date.setHours(0, 0, 0, 0);
                        setStatusChangeDate(date);
                      }
                    }}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
            <Text style={styles.inputHelpText}>
              Leave as today or pick a date; the time is set to midnight
            </Text>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add any notes about this status change..."
              placeholderTextColor={QatarColors.mutedForeground}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Image Upload */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Image (Optional)</Text>
            {!selectedImage ? (
              <TouchableOpacity style={styles.imageUploadButton} onPress={handleImageSelect}>
                <Ionicons name="camera" size={32} color={QatarColors.mutedForeground} />
                <Text style={styles.imageUploadText}>Tap to add image</Text>
                <Text style={styles.imageUploadSubtext}>Camera or Gallery • Max 5MB, JPG, PNG, GIF</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                  <Ionicons name="close-circle" size={24} color={QatarColors.destructive} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.changeImageButton} onPress={handleImageSelect}>
                  <Ionicons name="camera" size={20} color={QatarColors.primary} />
                  <Text style={styles.changeImageText}>Change</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (isSubmitting || newStatus === panel?.status || !!validationError) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || newStatus === panel?.status || !!validationError}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={QatarColors.primaryForeground} />
            ) : (
              <Text style={styles.submitButtonText}>Update Status</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QatarColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 12,
  },
  panelInfoCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  panelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 4,
  },
  panelId: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: '45%',
  },
  selectedStatusOption: {
    borderWidth: 2,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  noStatusText: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  validationErrorText: {
    fontSize: 14,
    color: QatarColors.destructive,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QatarColors.input,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  inputIcon: {
    marginRight: 8,
  },
  dateInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: QatarColors.foreground,
  },
  inputHelpText: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
    marginTop: 4,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  datePickerContainer: {
    backgroundColor: QatarColors.background,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 340,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: QatarColors.foreground,
  },
  datePickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: QatarColors.primary,
  },
  notesInput: {
    backgroundColor: QatarColors.input,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
    fontSize: 16,
    color: QatarColors.foreground,
    minHeight: 100,
  },
  imageUploadButton: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: QatarColors.border,
    borderStyle: 'dashed',
  },
  imageUploadText: {
    fontSize: 16,
    color: QatarColors.foreground,
    marginTop: 8,
    fontWeight: '500',
  },
  imageUploadSubtext: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
    marginTop: 4,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: QatarColors.background,
    borderRadius: 12,
  },
  changeImageButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: QatarColors.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeImageText: {
    fontSize: 12,
    color: QatarColors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: QatarColors.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: QatarColors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: QatarColors.foreground,
    fontWeight: '500',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: QatarColors.primary,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: QatarColors.muted,
  },
  submitButtonText: {
    fontSize: 16,
    color: QatarColors.primaryForeground,
    fontWeight: 'bold',
  },
});
