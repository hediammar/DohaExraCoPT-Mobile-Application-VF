import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PanelGroupsStackNavigationProp } from '../../types/navigation';
import { QatarColors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useToastContext } from '../../contexts/ToastContext';
import { useLoadingOverlay } from '../../contexts/LoadingOverlayContext';
import { NavigationBar } from '../../components/NavigationBar';
import { rf } from '../../utils/responsive';

interface PanelGroup {
  id: string;
  name: string;
  description: string;
  project_id: string;
  project_name: string;
  created_at: string;
}

interface Panel {
  id: string;
  name: string;
  status: string;
  panelTag: string;
  dwgNo: string;
  unitQty: number;
  unitRateQrM2: number;
  ifpQtyAreaSm: number;
  weight: number;
  building_name?: string;
  facade_name?: string;
}

interface PanelGroupDetailsScreenProps {
  navigation: PanelGroupsStackNavigationProp;
  route: {
    params: {
      groupId: string;
    };
  };
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

function mapPanelStatus(status: number): string {
  const statusMap: { [key: number]: string } = {
    0: "Issued For Production",
    1: "Produced",
    2: "Proceed for Delivery",
    3: "Delivered",
    4: "Approved Material",
    5: "Rejected Material",
    6: "Installed",
    7: "Inspected",
    8: "Approved Final",
    9: "On Hold",
    10: "Cancelled",
    11: "Broken at Site",
  };
  return statusMap[status] || "Issued For Production";
}

export default function PanelGroupDetailsScreen({ navigation, route }: PanelGroupDetailsScreenProps) {
  const { groupId } = route.params;
  const { showToast } = useToastContext();
  const { showLoadingOverlay, hideLoadingOverlay } = useLoadingOverlay();
  const [panelGroup, setPanelGroup] = useState<PanelGroup | null>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  useEffect(() => {
    loadPanelGroupDetails();
  }, [groupId]);

  const loadPanelGroupDetails = async () => {
    try {
      setLoading(true);

      // Fetch panel group details
      const { data: groupData, error: groupError } = await supabase
        .from('panel_groups')
        .select('id, name, description, project_id, created_at')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      if (!groupData) {
        showToast('Panel group not found', 'error');
        setLoading(false);
        hideLoadingOverlay();
        return;
      }

      // Fetch project name
      let projectName = 'Unknown Project';
      if (groupData.project_id) {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('name')
          .eq('id', groupData.project_id)
          .single();

        if (!projectError && projectData) {
          projectName = projectData.name;
        }
      }

      setPanelGroup({
        id: groupData.id,
        name: groupData.name,
        description: groupData.description || '',
        project_id: groupData.project_id || '',
        project_name: projectName,
        created_at: groupData.created_at,
      });

      // Fetch panel memberships for this group
      const { data: membershipData, error: membershipError } = await supabase
        .from('panel_group_memberships')
        .select('panel_id')
        .eq('panel_group_id', groupId);

      if (membershipError) throw membershipError;

      const panelIds = membershipData?.map(m => m.panel_id) || [];

      if (panelIds.length === 0) {
        setPanels([]);
        setLoading(false);
        hideLoadingOverlay();
        return;
      }

      // Fetch panel details with building and facade names
      const { data: panelsData, error: panelsError } = await supabase
        .from('panels')
        .select(`
          id,
          name,
          status,
          drawing_number,
          ifp_qty_nos,
          issue_transmittal_no,
          unit_rate_qr_m2,
          ifp_qty_area_sm,
          weight,
          building:buildings(name),
          facade:facades(name)
        `)
        .in('id', panelIds);

      if (panelsError) throw panelsError;

      const formattedPanels: Panel[] = panelsData?.map((panel: any) => ({
        id: panel.id,
        name: panel.name,
        status: mapPanelStatus(panel.status),
        panelTag: panel.issue_transmittal_no || `TAG-${panel.id.slice(0, 8)}`,
        dwgNo: panel.drawing_number || 'N/A',
        unitQty: panel.ifp_qty_nos || 0,
        unitRateQrM2: panel.unit_rate_qr_m2 || 0,
        ifpQtyAreaSm: panel.ifp_qty_area_sm || 0,
        weight: panel.weight || 0,
        building_name: panel.building?.name,
        facade_name: panel.facade?.name,
      })) || [];

      setPanels(formattedPanels);
    } catch (error) {
      console.error('Error loading panel group details:', error);
      showToast('Error loading panel group details', 'error');
    } finally {
      setLoading(false);
      hideLoadingOverlay();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPanelGroupDetails();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatQatarRiyal = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "QAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const filteredPanels = useMemo(() => {
    let result = panels;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(panel =>
        panel.name.toLowerCase().includes(q) ||
        (panel.building_name && panel.building_name.toLowerCase().includes(q)) ||
        (panel.facade_name && panel.facade_name.toLowerCase().includes(q)) ||
        panel.panelTag.toLowerCase().includes(q) ||
        panel.dwgNo.toLowerCase().includes(q)
      );
    }

    if (selectedStatus) {
      result = result.filter(panel => panel.status === selectedStatus);
    }

    return result;
  }, [panels, searchQuery, selectedStatus]);

  const activeStatuses = useMemo(() => {
    const statuses = new Set(panels.map(p => p.status));
    return PANEL_STATUSES.filter(s => statuses.has(s));
  }, [panels]);

  const calculateTotals = () => {
    const totalArea = panels.reduce((sum, panel) => sum + (panel.ifpQtyAreaSm || 0), 0);
    const totalAmount = panels.reduce((sum, panel) => {
      const area = panel.ifpQtyAreaSm || 0;
      const rate = panel.unitRateQrM2 || 0;
      return sum + (area * rate);
    }, 0);
    const totalWeight = panels.reduce((sum, panel) => sum + (panel.weight || 0), 0);
    return { totalArea, totalAmount, totalWeight };
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <NavigationBar title="Panel Group Details" showBackButton={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={QatarColors.primary} />
          <Text style={styles.loadingText}>Loading panel group details...</Text>
        </View>
      </View>
    );
  }

  if (!panelGroup) {
    return (
      <View style={styles.container}>
        <NavigationBar title="Panel Group Details" showBackButton={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={QatarColors.mutedForeground} />
          <Text style={styles.errorText}>Panel group not found</Text>
        </View>
      </View>
    );
  }

  const { totalArea, totalAmount, totalWeight } = calculateTotals();

  return (
    <View style={styles.container}>
      <NavigationBar title="Panel Group Details" showBackButton={true} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[QatarColors.primary]}
          />
        }
      >
        {/* Header Section */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <Ionicons name="layers" size={24} color={QatarColors.primary} />
              <Text style={styles.groupTitle}>{panelGroup.name}</Text>
            </View>
          </View>
          
          {panelGroup.project_name && (
            <View style={styles.projectBadge}>
              <Text style={styles.projectBadgeText}>{panelGroup.project_name}</Text>
            </View>
          )}

          {panelGroup.description ? (
            <Text style={styles.description}>{panelGroup.description}</Text>
          ) : (
            <Text style={styles.descriptionEmpty}>No description</Text>
          )}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="cube-outline" size={20} color={QatarColors.primary} />
            <Text style={styles.summaryValue}>{panels.length}</Text>
            <Text style={styles.summaryLabel}>Panels</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="calendar-outline" size={20} color={QatarColors.primary} />
            <Text style={styles.summaryValue}>{formatDate(panelGroup.created_at)}</Text>
            <Text style={styles.summaryLabel}>Created</Text>
          </View>
        </View>

        {/* Totals Card */}
        <View style={styles.totalsCard}>
          <Text style={styles.totalsTitle}>Group Totals</Text>
          <View style={styles.totalsRow}>
            <View style={styles.totalItem}>
              <Ionicons name="square-outline" size={rf(16)} color={QatarColors.mutedForeground} />
              <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
                {totalArea.toFixed(2)} m²
              </Text>
              <Text style={styles.totalLabel}>Total Area</Text>
            </View>
            <View style={styles.totalItem}>
              <Ionicons name="cash-outline" size={rf(16)} color={QatarColors.mutedForeground} />
              <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatQatarRiyal(totalAmount)}
              </Text>
              <Text style={styles.totalLabel}>Total Amount</Text>
            </View>
            <View style={styles.totalItem}>
              <Ionicons name="barbell-outline" size={rf(16)} color={QatarColors.mutedForeground} />
              <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
                {totalWeight.toFixed(2)} kg
              </Text>
              <Text style={styles.totalLabel}>Total Weight</Text>
            </View>
          </View>
        </View>

        {/* Panels Section */}
        <View style={styles.panelsSection}>
          <View style={styles.panelsHeader}>
            <Ionicons name="cube-outline" size={20} color={QatarColors.foreground} />
            <Text style={styles.panelsTitle}>
              Panels in this Group ({panels.length})
            </Text>
          </View>

          {panels.length > 0 && (
            <>
              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={rf(18)} color={QatarColors.mutedForeground} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name, building, facade, tag..."
                  placeholderTextColor={QatarColors.mutedForeground}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={rf(18)} color={QatarColors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Status Filter Chips */}
              {activeStatuses.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterScrollView}
                  contentContainerStyle={styles.filterContainer}
                >
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      !selectedStatus && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedStatus(null)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        !selectedStatus && styles.filterChipTextActive,
                      ]}
                    >
                      All ({panels.length})
                    </Text>
                  </TouchableOpacity>
                  {activeStatuses.map(status => {
                    const count = panels.filter(p => p.status === status).length;
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.filterChip,
                          selectedStatus === status && styles.filterChipActive,
                        ]}
                        onPress={() =>
                          setSelectedStatus(selectedStatus === status ? null : status)
                        }
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            selectedStatus === status && styles.filterChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {status} ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}

          {panels.length === 0 ? (
            <View style={styles.emptyPanels}>
              <Ionicons name="cube-outline" size={48} color={QatarColors.mutedForeground} />
              <Text style={styles.emptyText}>No panels assigned to this group</Text>
            </View>
          ) : filteredPanels.length === 0 ? (
            <View style={styles.emptyPanels}>
              <Ionicons name="search-outline" size={48} color={QatarColors.mutedForeground} />
              <Text style={styles.emptyText}>No panels match your search</Text>
            </View>
          ) : (
            <>
              {(searchQuery || selectedStatus) && (
                <Text style={styles.resultsCount}>
                  Showing {filteredPanels.length} of {panels.length} panels
                </Text>
              )}
              <View style={styles.panelsList}>
                {filteredPanels.map((panel) => (
                  <TouchableOpacity
                    key={panel.id}
                    style={styles.panelCard}
                    activeOpacity={0.7}
                    onPress={() => {
                    showLoadingOverlay();
                    navigation.navigate('PanelDetails', { panelId: panel.id });
                  }}
                  >
                    <View style={styles.panelHeader}>
                      <Text style={styles.panelName}>{panel.name}</Text>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{panel.status}</Text>
                      </View>
                    </View>
                    <View style={styles.panelDetails}>
                      <View style={styles.panelDetailRow}>
                        <Text style={styles.panelDetailLabel}>Building:</Text>
                        <Text style={styles.panelDetailValue}>{panel.building_name || '—'}</Text>
                      </View>
                      <View style={styles.panelDetailRow}>
                        <Text style={styles.panelDetailLabel}>Facade:</Text>
                        <Text style={styles.panelDetailValue}>{panel.facade_name || '—'}</Text>
                      </View>
                      <View style={styles.panelDetailRow}>
                        <Text style={styles.panelDetailLabel}>Area:</Text>
                        <Text style={styles.panelDetailValue}>
                          {panel.ifpQtyAreaSm != null ? `${panel.ifpQtyAreaSm} m²` : '—'}
                        </Text>
                      </View>
                      <View style={styles.panelDetailRow}>
                        <Text style={styles.panelDetailLabel}>Tag:</Text>
                        <Text style={styles.panelDetailValue}>{panel.panelTag}</Text>
                      </View>
                      <View style={styles.panelDetailRow}>
                        <Text style={styles.panelDetailLabel}>Drawing:</Text>
                        <Text style={styles.panelDetailValue}>{panel.dwgNo}</Text>
                      </View>
                      <View style={styles.panelDetailRow}>
                        <Text style={styles.panelDetailLabel}>Qty:</Text>
                        <Text style={styles.panelDetailValue}>{panel.unitQty}</Text>
                      </View>
                    </View>
                    <View style={styles.panelNavIndicator}>
                      <Ionicons name="chevron-forward" size={rf(16)} color={QatarColors.mutedForeground} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: rf(16),
    color: QatarColors.mutedForeground,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  groupTitle: {
    fontSize: rf(20),
    fontWeight: 'bold',
    color: QatarColors.foreground,
    flex: 1,
  },
  projectBadge: {
    backgroundColor: '#E11D48',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 12,
  },
  projectBadgeText: {
    color: 'white',
    fontSize: rf(11),
    fontWeight: '600',
  },
  description: {
    fontSize: rf(13),
    color: QatarColors.foreground,
    lineHeight: rf(19),
  },
  descriptionEmpty: {
    fontSize: rf(13),
    color: QatarColors.mutedForeground,
    fontStyle: 'italic',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  summaryValue: {
    fontSize: rf(18),
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: rf(11),
    color: QatarColors.mutedForeground,
  },
  totalsCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  totalsTitle: {
    fontSize: rf(15),
    fontWeight: '600',
    color: QatarColors.foreground,
    marginBottom: 12,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  totalItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  totalValue: {
    fontSize: rf(13),
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginTop: 6,
    marginBottom: 4,
    textAlign: 'center',
  },
  totalLabel: {
    fontSize: rf(10),
    color: QatarColors.mutedForeground,
    textAlign: 'center',
  },
  panelsSection: {
    marginBottom: 16,
  },
  panelsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  panelsTitle: {
    fontSize: rf(16),
    fontWeight: '600',
    color: QatarColors.foreground,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QatarColors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: rf(13),
    color: QatarColors.foreground,
    paddingVertical: 0,
  },
  filterScrollView: {
    marginBottom: 12,
    flexGrow: 0,
  },
  filterContainer: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: QatarColors.card,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  filterChipActive: {
    backgroundColor: QatarColors.primary,
    borderColor: QatarColors.primary,
  },
  filterChipText: {
    fontSize: rf(11),
    color: QatarColors.mutedForeground,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: 'white',
  },
  resultsCount: {
    fontSize: rf(11),
    color: QatarColors.mutedForeground,
    marginBottom: 8,
  },
  emptyPanels: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  emptyText: {
    marginTop: 12,
    fontSize: rf(13),
    color: QatarColors.mutedForeground,
    textAlign: 'center',
  },
  panelsList: {
    gap: 12,
  },
  panelCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelName: {
    fontSize: rf(14),
    fontWeight: 'bold',
    color: QatarColors.foreground,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    backgroundColor: QatarColors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: 'white',
    fontSize: rf(10),
    fontWeight: '600',
  },
  panelNavIndicator: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  panelDetails: {
    gap: 6,
  },
  panelDetailRow: {
    flexDirection: 'row',
    gap: 8,
  },
  panelDetailLabel: {
    fontSize: rf(12),
    color: QatarColors.mutedForeground,
    fontWeight: '500',
  },
  panelDetailValue: {
    fontSize: rf(12),
    color: QatarColors.foreground,
    flex: 1,
  },
});
