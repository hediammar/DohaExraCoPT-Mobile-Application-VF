import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NavigationBar } from '../../components/NavigationBar';
import { QatarColors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { rf } from '../../utils/responsive';

interface ScanHistoryItem {
  id: string;
  panel_id: string;
  panel_name: string;
  panel_status: string;
  facade_name: string;
  building_name: string;
  project_name: string;
  created_at: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  user_id: string;
  user_name?: string;
  user_username?: string;
}

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
}

// Request queue for location name requests to avoid rate limiting
type LocationRequest = {
  latitude: number;
  longitude: number;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
};

let locationRequestQueue: LocationRequest[] = [];
let isProcessingQueue = false;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds between requests to respect rate limits
const REQUEST_TIMEOUT = 10000; // 10 second timeout

const processLocationRequestQueue = async (
  getLocationCache: () => {[key: string]: string}, 
  setLocationCache: React.Dispatch<React.SetStateAction<{[key: string]: string}>>
) => {
  if (isProcessingQueue || locationRequestQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  while (locationRequestQueue.length > 0) {
    const request = locationRequestQueue.shift();
    if (!request) continue;

    const cacheKey = `${request.latitude.toFixed(6)},${request.longitude.toFixed(6)}`;
    const currentCache = getLocationCache();
    
    // Check cache first
    if (currentCache[cacheKey]) {
      request.resolve(currentCache[cacheKey]);
      continue;
    }

    // Wait if needed to respect rate limits
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      // Use OpenStreetMap Nominatim API for reverse geocoding (free)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${request.latitude}&lon=${request.longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'QatarPanels-Mobile-App/1.0'
          },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      lastRequestTime = Date.now();

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }
      
      const data = await response.json();
      
      if (data && data.display_name) {
        // Extract relevant parts of the address
        const address = data.address || {};
        const parts = [];
        
        // Build a readable address from available components
        if (address.road) parts.push(address.road);
        if (address.suburb || address.neighbourhood) parts.push(address.suburb || address.neighbourhood);
        if (address.city || address.town || address.village) parts.push(address.city || address.town || address.village);
        if (address.state) parts.push(address.state);
        if (address.country) parts.push(address.country);
        
        const locationName = parts.length > 0 ? parts.join(', ') : data.display_name;
        
        // Cache the result
        setLocationCache(prev => ({
          ...prev,
          [cacheKey]: locationName
        }));
        
        request.resolve(locationName);
      } else {
        const fallback = `Lat: ${request.latitude.toFixed(6)}, Lng: ${request.longitude.toFixed(6)}`;
        setLocationCache(prev => ({
          ...prev,
          [cacheKey]: fallback
        }));
        request.resolve(fallback);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      // Silently fail and return coordinates - don't log to avoid spam
      const fallback = `Lat: ${request.latitude.toFixed(6)}, Lng: ${request.longitude.toFixed(6)}`;
      setLocationCache(prev => ({
        ...prev,
        [cacheKey]: fallback
      }));
      request.resolve(fallback);
    }
  }

  isProcessingQueue = false;
};

export default function ViewScansScreen() {
  const [scans, setScans] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationCache, setLocationCache] = useState<{[key: string]: string}>({});
  const locationCacheRef = useRef<{[key: string]: string}>({});
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showUserFilter, setShowUserFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigation = useNavigation();
  const { user: currentUser } = useAuth();

  // Keep ref in sync with state
  useEffect(() => {
    locationCacheRef.current = locationCache;
  }, [locationCache]);

  useEffect(() => {
    loadScanHistory();
    if (isAdmin()) {
      loadUsers();
    }
  }, []);

  // Watch for changes in selectedUserId and reload scan history
  useEffect(() => {
    if (isAdmin()) {
      loadScanHistory();
    }
  }, [selectedUserId]);

  const isAdmin = () => {
    return currentUser?.role?.toLowerCase() === 'administrator';
  };

  const getLocationName = async (latitude: number, longitude: number): Promise<string> => {
    const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    
    // Check cache first (check both state and ref for immediate access)
    if (locationCache[cacheKey] || locationCacheRef.current[cacheKey]) {
      return locationCache[cacheKey] || locationCacheRef.current[cacheKey];
    }
    
    // Return coordinates immediately if already in cache as fallback
    const fallback = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
    
    // If coordinates are already in the location string, don't try to convert
    // This prevents unnecessary API calls
    return new Promise((resolve) => {
      locationRequestQueue.push({
        latitude,
        longitude,
        resolve,
        reject: () => resolve(fallback)
      });
      
      // Process queue asynchronously - pass a getter function to access current cache via ref
      processLocationRequestQueue(() => locationCacheRef.current, setLocationCache);
    });
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, username, email, role')
        .eq('status', 'active')
        .order('name');

      if (error) {
        console.error('Error loading users:', error);
        return;
      }

      setUsers(data || []);
    } catch (error) {
      console.error('Error in loadUsers:', error);
    }
  };

  const loadScanHistory = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('scan_history_with_details')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filtering based on user role and selection
      if (isAdmin()) {
        // Admin users: if a specific user is selected, show only their scans
        // if no user selected (selectedUserId is null), show all scans
        if (selectedUserId) {
          query = query.eq('user_id', selectedUserId);
        }
        // If selectedUserId is null, no additional filter - show all scans
      } else {
        // Non-admin users can only see their own scans
        query = query.eq('user_id', currentUser?.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading scan history:', error);
        Alert.alert('Error', 'Failed to load scan history');
        return;
      }

      setScans(data || []);
    } catch (error) {
      console.error('Error in loadScanHistory:', error);
      Alert.alert('Error', 'Failed to load scan history');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadScanHistory();
    setRefreshing(false);
  };

  const handleUserSelect = (userId: string | null) => {
    setSelectedUserId(userId);
    setShowUserFilter(false);
    // loadScanHistory will be called automatically by useEffect when selectedUserId changes
  };

  const getSelectedUserName = () => {
    if (!selectedUserId) return 'All Users';
    const user = users.find(u => u.id === selectedUserId);
    return user ? `${user.name} (${user.username})` : 'Unknown User';
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteScan = async (scanId: string) => {
    Alert.alert(
      'Delete Scan',
      'Are you sure you want to delete this scan record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('scan_history')
                .delete()
                .eq('id', scanId);

              if (error) {
                console.error('Error deleting scan:', error);
                Alert.alert('Error', 'Failed to delete scan');
                return;
              }

              // Remove from local state
              setScans(scans.filter(scan => scan.id !== scanId));
            } catch (error) {
              console.error('Error in deleteScan:', error);
              Alert.alert('Error', 'Failed to delete scan');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string | number) => {
    const statusNum = Number(status);
    switch (statusNum) {
      case 0: // Issued For Production
        return QatarColors.statusActive;
      case 1: // Produced
        return QatarColors.statusManufactured;
      case 2: // Proceed for Delivery
        return QatarColors.statusDelivered;
      case 3: // Delivered
        return QatarColors.statusDelivered;
      case 4: // Approved Material
        return QatarColors.statusComplete;
      case 5: // Rejected Material
        return QatarColors.statusRejected;
      case 6: // Installed
        return QatarColors.statusInstalled;
      case 7: // Inspected
        return QatarColors.statusInspected;
      case 8: // Approved Final
        return QatarColors.statusComplete;
      case 9: // On Hold
        return QatarColors.statusOnhold;
      case 10: // Cancelled
        return QatarColors.statusInactive;
      case 11: // Broken at Site
        return QatarColors.statusRejected;
      default:
        return QatarColors.muted;
    }
  };

  const getStatusText = (status: string | number) => {
    const statusNum = Number(status);
    switch (statusNum) {
      case 0:
        return 'Issued For Production';
      case 1:
        return 'Produced';
      case 2:
        return 'Proceed for Delivery';
      case 3:
        return 'Delivered';
      case 4:
        return 'Approved Material';
      case 5:
        return 'Rejected Material';
      case 6:
        return 'Installed';
      case 7:
        return 'Inspected';
      case 8:
        return 'Approved Final';
      case 9:
        return 'On Hold';
      case 10:
        return 'Cancelled';
      case 11:
        return 'Broken at Site';
      default:
        return 'Unknown';
    }
  };

  const LocationDisplay = ({ item }: { item: ScanHistoryItem }) => {
    const [displayLocation, setDisplayLocation] = useState(item.location);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [hasTriedConversion, setHasTriedConversion] = useState(false);

    useEffect(() => {
      const convertLocation = async () => {
        // Only convert if we have coordinates, location is in coordinate format, and we haven't tried yet
        if (
          item.latitude && 
          item.longitude && 
          item.location.includes('Lat:') && 
          !hasTriedConversion
        ) {
          setIsLoadingLocation(true);
          setHasTriedConversion(true);
          try {
            const locationName = await getLocationName(item.latitude, item.longitude);
            setDisplayLocation(locationName);
          } catch (error) {
            // Error is already handled in getLocationName, just keep the original location
            setDisplayLocation(item.location);
          } finally {
            setIsLoadingLocation(false);
          }
        } else if (!item.location.includes('Lat:')) {
          // Location is already converted, just use it
          setDisplayLocation(item.location);
        }
      };

      convertLocation();
    }, [item.latitude, item.longitude, item.location, hasTriedConversion]);

    return (
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color={QatarColors.mutedForeground} />
          <Text style={styles.detailText}>
            {isLoadingLocation ? 'Converting location...' : displayLocation}
          </Text>
        </View>
    );
  };

  const renderUserFilterModal = () => (
    <Modal
      visible={showUserFilter}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select User</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowUserFilter(false)}
          >
            <Ionicons name="close" size={24} color={QatarColors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={QatarColors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={QatarColors.mutedForeground}
          />
        </View>

        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.userItem,
                selectedUserId === item.id && styles.selectedUserItem
              ]}
              onPress={() => handleUserSelect(item.id)}
            >
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userDetails}>
                  @{item.username} • {item.email}
                </Text>
                <Text style={styles.userRole}>{item.role}</Text>
              </View>
              {selectedUserId === item.id && (
                <Ionicons name="checkmark-circle" size={24} color={QatarColors.primary} />
              )}
            </TouchableOpacity>
          )}
          ListHeaderComponent={() => (
            <TouchableOpacity
              style={[
                styles.userItem,
                !selectedUserId && styles.selectedUserItem
              ]}
              onPress={() => handleUserSelect(null)}
            >
              <View style={styles.userInfo}>
                <Text style={styles.userName}>All Users</Text>
                <Text style={styles.userDetails}>View scans from all users</Text>
              </View>
              {!selectedUserId && (
                <Ionicons name="checkmark-circle" size={24} color={QatarColors.primary} />
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );

  const renderScanItem = ({ item }: { item: ScanHistoryItem }) => (
    <View style={styles.scanItem}>
      <View style={styles.scanHeader}>
        <View style={styles.panelInfo}>
          <Text style={styles.panelNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {item.panel_name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.panel_status) }]}>
            <Text style={styles.statusText} numberOfLines={1}>{getStatusText(item.panel_status)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteScan(item.id)}
        >
          <Ionicons name="trash-outline" size={rf(18)} color={QatarColors.destructive} />
        </TouchableOpacity>
      </View>

      <View style={styles.scanDetails}>
        {isAdmin() && (
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={16} color={QatarColors.mutedForeground} />
            <Text style={styles.detailText}>
              {item.user_name || item.user_username || 'Unknown User'}
            </Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Ionicons name="business-outline" size={16} color={QatarColors.mutedForeground} />
          <Text style={styles.detailText}>{item.project_name}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="home-outline" size={16} color={QatarColors.mutedForeground} />
          <Text style={styles.detailText}>{item.building_name}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="layers-outline" size={16} color={QatarColors.mutedForeground} />
          <Text style={styles.detailText}>{item.facade_name}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={QatarColors.mutedForeground} />
          <Text style={styles.detailText}>{formatDate(item.created_at)}</Text>
        </View>
        
        {item.location && (
          <LocationDisplay item={item} />
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="qr-code-outline" size={64} color={QatarColors.mutedForeground} />
      <Text style={styles.emptyTitle}>No Scans Yet</Text>
      <Text style={styles.emptySubtitle}>
        Start scanning QR codes to see your scan history here
      </Text>
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => navigation.navigate('QRScanner' as never)}
      >
        <Ionicons name="qr-code-outline" size={20} color="white" />
        <Text style={styles.scanButtonText}>Start Scanning</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <NavigationBar title="Scan History" showBackButton={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={QatarColors.primary} />
          <Text style={styles.loadingText}>Loading scan history...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationBar title="Scan History" showBackButton={true} />
      
      {isAdmin() && (
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowUserFilter(true)}
          >
            <Ionicons name="people-outline" size={20} color={QatarColors.primary} />
            <Text style={styles.filterButtonText}>{getSelectedUserName()}</Text>
            <Ionicons name="chevron-down" size={16} color={QatarColors.primary} />
          </TouchableOpacity>
        </View>
      )}
      
      {scans.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={scans}
          keyExtractor={(item) => item.id}
          renderItem={renderScanItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[QatarColors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
      
      {renderUserFilterModal()}
    </View>
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
  loadingText: {
    marginTop: 16,
    fontSize: rf(14),
    color: QatarColors.mutedForeground,
  },
  listContainer: {
    padding: 16,
  },
  scanItem: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: QatarColors.foreground,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  panelNumber: {
    fontSize: rf(15),
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginRight: 8,
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 0,
  },
  statusText: {
    color: QatarColors.foreground,
    fontSize: rf(10),
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  scanDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: rf(12),
    color: QatarColors.foreground,
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: rf(22),
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: rf(14),
    color: QatarColors.mutedForeground,
    textAlign: 'center',
    lineHeight: rf(22),
    marginBottom: 32,
  },
  scanButton: {
    backgroundColor: QatarColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButtonText: {
    color: QatarColors.foreground,
    fontSize: rf(14),
    fontWeight: '600',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: QatarColors.background,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QatarColors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: QatarColors.border,
    gap: 8,
  },
  filterButtonText: {
    flex: 1,
    fontSize: rf(14),
    color: QatarColors.foreground,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: QatarColors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  modalTitle: {
    fontSize: rf(18),
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QatarColors.card,
    marginHorizontal: 16,
    marginVertical: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: QatarColors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: rf(14),
    color: QatarColors.foreground,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  selectedUserItem: {
    backgroundColor: QatarColors.primary + '10',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: rf(14),
    fontWeight: '600',
    color: QatarColors.foreground,
  },
  userDetails: {
    fontSize: rf(12),
    color: QatarColors.mutedForeground,
    marginTop: 2,
  },
  userRole: {
    fontSize: rf(11),
    color: QatarColors.primary,
    marginTop: 2,
    fontWeight: '500',
  },
});
