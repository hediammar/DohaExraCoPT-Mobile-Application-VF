import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { QatarColors, PanelStatusColors } from '../constants/colors';
import { PANEL_STATUSES } from '../utils/statusValidation';

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

interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  previousStatus?: string;
  user?: {
    name: string;
    username: string;
  };
  notes?: string;
  image_url?: string;
}

interface PanelHistoryDialogProps {
  panel: PanelModel | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PanelHistoryDialog({ panel, isOpen, onClose }: PanelHistoryDialogProps) {
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  // Map integer status from database to human-readable status
  const statusMap: { [key: number]: string } = Object.fromEntries(
    PANEL_STATUSES.map((status, index) => [index, status])
  );

  // Fetch status history from Supabase
  useEffect(() => {
    if (!panel || !isOpen) return;

    async function fetchStatusHistory() {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('panel_status_histories')
          .select(`
            status, 
            created_at,
            user_id,
            notes,
            image_url,
            users!panel_status_histories_user_id_fkey(id, name, username)
          `)
          .eq('panel_id', panel?.id)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        if (__DEV__) {
          console.log('Raw status history data:', data);
        }
        
        const history: StatusHistoryEntry[] = data.map((entry, index, arr) => {
          if (__DEV__) {
            console.log('Processing entry:', entry);
          }
          
          // Handle user data - try different possible structures
          let user = undefined;
          if (entry.users) {
            if (Array.isArray(entry.users) && entry.users.length > 0) {
              user = {
                name: entry.users[0]?.name || 'Unknown User',
                username: entry.users[0]?.username || 'unknown'
              };
            } else if (typeof entry.users === 'object' && 'name' in entry.users) {
              user = {
                name: (entry.users as any).name || 'Unknown User',
                username: (entry.users as any).username || 'unknown'
              };
            }
          }
          
          if (__DEV__) {
            console.log('Extracted user:', user);
          }
          
          return {
            status: statusMap[entry.status] || 'Unknown',
            timestamp: entry.created_at,
            previousStatus: index < arr.length - 1 ? statusMap[arr[index + 1].status] || 'Unknown' : undefined,
            user: user,
            notes: entry.notes,
            image_url: entry.image_url,
          };
        });
        
        if (__DEV__) {
          console.log('Processed history:', history);
        }
        setStatusHistory(history);
      } catch (err) {
        setError('Failed to fetch status history');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchStatusHistory();
  }, [panel?.id, isOpen]);

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, { background: string; foreground: string }> = {
      'Produced': { background: QatarColors.statusManufactured, foreground: QatarColors.statusManufacturedForeground },
      "Issued For Production": { background: QatarColors.statusActive, foreground: QatarColors.statusActiveForeground },
      'Inspected': { background: QatarColors.statusInspected, foreground: QatarColors.statusInspectedForeground },
      'Approved Material': { background: QatarColors.statusComplete, foreground: QatarColors.statusCompleteForeground },
      'Rejected Material': { background: QatarColors.statusRejected, foreground: QatarColors.statusRejectedForeground },
      'Issued': { background: QatarColors.statusActive, foreground: QatarColors.statusActiveForeground },
      'Proceed for Delivery': { background: QatarColors.statusDelivered, foreground: QatarColors.statusDeliveredForeground },
      'Delivered': { background: QatarColors.statusDelivered, foreground: QatarColors.statusDeliveredForeground },
      'Installed': { background: QatarColors.statusInstalled, foreground: QatarColors.statusInstalledForeground },
      'Approved Final': { background: QatarColors.statusComplete, foreground: QatarColors.statusCompleteForeground },
      'Broken at Site': { background: QatarColors.statusRejected, foreground: QatarColors.statusRejectedForeground },
      'On Hold': { background: QatarColors.statusOnhold, foreground: QatarColors.statusOnholdForeground },
      'Cancelled': { background: QatarColors.statusInactive, foreground: QatarColors.statusInactiveForeground },
    };

    return statusColors[status] || { background: QatarColors.muted, foreground: QatarColors.mutedForeground };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Issued For Production':
        return 'cube-outline';
      case 'Produced':
        return 'cube-outline';
      case 'Inspected':
        return 'checkmark-circle-outline';
      case 'Approved Material':
        return 'checkmark-circle';
      case 'Rejected Material':
        return 'close-circle';
      case 'Issued':
        return 'cube-outline';
      case 'Proceed for Delivery':
        return 'car-outline';
      case 'Delivered':
        return 'car';
      case 'Installed':
        return 'checkmark-circle';
      case 'Approved Final':
        return 'checkmark-circle';
      case 'Broken at Site':
        return 'close-circle';
      case 'On Hold':
        return 'pause-circle';
      case 'Cancelled':
        return 'ban';
      default:
        return 'time-outline';
    }
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
  };

  const handleImageClick = (imageUrl: string) => {
    if (__DEV__) {
      console.log('Image clicked:', imageUrl);
    }
    setSelectedImage(imageUrl);
    setIsImageModalOpen(true);
    setImageLoading(true);
  };

  const handleClose = () => {
    setStatusHistory([]);
    setError(null);
    setSelectedImage(null);
    setIsImageModalOpen(false);
    setImageLoading(false);
    onClose();
  };

  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  return (
    <>
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
            <Text style={styles.title}>Panel History</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={QatarColors.primary} />
                <Text style={styles.loadingText}>Loading status history...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={48} color={QatarColors.destructive} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : statusHistory.length > 0 ? (
              <View style={styles.timelineContainer}>
                {statusHistory.map((entry, index) => {
                  const { date, time } = formatDateTime(entry.timestamp);
                  const isLatest = index === 0;
                  const statusColors = getStatusColor(entry.status);

                  return (
                    <View key={index} style={styles.timelineItem}>
                      <View style={styles.timelineLeft}>
                        <View style={[
                          styles.timelineIcon,
                          { backgroundColor: isLatest ? QatarColors.primary : QatarColors.muted }
                        ]}>
                          <Ionicons 
                            name={getStatusIcon(entry.status) as any} 
                            size={12} 
                            color={QatarColors.foreground} 
                          />
                        </View>
                        {index < statusHistory.length - 1 && (
                          <View style={styles.timelineLine} />
                        )}
                      </View>

                      <View style={styles.timelineContent}>
                        <View style={styles.timelineHeader}>
                          <View style={[
                            styles.statusBadge,
                            { backgroundColor: statusColors.background }
                          ]}>
                            <Text style={[
                              styles.statusBadgeText,
                              { color: statusColors.foreground }
                            ]}>
                              {entry.status}
                            </Text>
                          </View>
                          <Text style={styles.timelineDate}>
                            {date} at {time}
                          </Text>
                        </View>

                        <View style={styles.timelineDetails}>
                          {entry.previousStatus && entry.user && (
                            <Text style={styles.timelineDescription}>
                              Changed from {entry.previousStatus} to {entry.status} by {entry.user.name}
                            </Text>
                          )}
                          {entry.previousStatus && !entry.user && (
                            <Text style={styles.timelineDescription}>
                              Changed from {entry.previousStatus} to {entry.status}
                            </Text>
                          )}
                          {!entry.previousStatus && entry.user && (
                            <Text style={styles.timelineDescription}>
                              Status set to {entry.status} by {entry.user.name}
                            </Text>
                          )}
                          
                          {entry.notes && (
                            <View style={styles.notesContainer}>
                              <Text style={styles.notesLabel}>Notes:</Text>
                              <Text style={styles.notesText}>{entry.notes}</Text>
                            </View>
                          )}
                          
                          {entry.image_url && (
                            <View style={styles.imageContainer}>
                              <Text style={styles.imageLabel}>Attached Image:</Text>
                              <TouchableOpacity
                                style={styles.imageThumbnail}
                                onPress={() => handleImageClick(entry.image_url!)}
                              >
                                <Image
                                  source={{ uri: entry.image_url }}
                                  style={styles.thumbnailImage}
                                  resizeMode="cover"
                                />
                                <View style={styles.imageOverlay}>
                                  <Ionicons name="eye" size={16} color={QatarColors.foreground} />
                                </View>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="time-outline" size={48} color={QatarColors.mutedForeground} />
                <Text style={styles.emptyText}>No status history available</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={isImageModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsImageModalOpen(false)}
      >
        <View style={styles.imageModalContainer}>
          <View style={styles.imageModalContent}>
            <View style={styles.imageModalHeader}>
              <Text style={styles.imageModalTitle}>Status Change Documentation</Text>
              <TouchableOpacity
                style={styles.imageModalCloseButton}
                onPress={() => setIsImageModalOpen(false)}
              >
                <Ionicons name="close" size={24} color={QatarColors.foreground} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.imageModalBody}>
              {selectedImage && (
                <View style={styles.imageFullContainer}>
                  {imageLoading && (
                    <View style={styles.imageLoadingOverlay}>
                      <ActivityIndicator size="large" color={QatarColors.primary} />
                      <Text style={styles.imageLoadingText}>Loading image...</Text>
                    </View>
                  )}
                  <Image
                    source={{ uri: selectedImage }}
                    style={styles.fullImage}
                    resizeMode="contain"
                    onLoad={() => setImageLoading(false)}
                    onError={() => setImageLoading(false)}
                  />
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
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
    paddingVertical: 40,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: QatarColors.destructive,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: QatarColors.mutedForeground,
    textAlign: 'center',
  },
  timelineContainer: {
    paddingVertical: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    height: 20,
    backgroundColor: QatarColors.border,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 2,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  timelineDate: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
  },
  timelineDetails: {
    marginTop: 4,
  },
  timelineDescription: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
    marginBottom: 8,
    lineHeight: 16,
  },
  notesContainer: {
    backgroundColor: QatarColors.card,
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: QatarColors.mutedForeground,
    marginBottom: 2,
  },
  notesText: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
    lineHeight: 16,
  },
  imageContainer: {
    marginTop: 8,
  },
  imageLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: QatarColors.mutedForeground,
    marginBottom: 4,
  },
  imageThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '95%',
    height: '95%',
    backgroundColor: QatarColors.background,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  imageModalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  imageModalCloseButton: {
    padding: 4,
  },
  imageModalBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imageFullContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  imageLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: QatarColors.mutedForeground,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
