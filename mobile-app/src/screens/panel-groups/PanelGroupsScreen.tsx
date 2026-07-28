import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationBar } from '../../components/NavigationBar';
import { QatarColors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useToastContext } from '../../contexts/ToastContext';
import { useLoadingOverlay } from '../../contexts/LoadingOverlayContext';
import { PanelGroupsStackNavigationProp } from '../../types/navigation';
import { useNavigation } from '@react-navigation/native';

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
  'Broken at Site',
];

const PANEL_TYPES = ['GRC', 'GRG', 'GRP', 'EIFS', 'UHPC'];

type FilterValue = string;

interface FilterOption {
  value: FilterValue;
  label: string;
}

interface PanelInfo {
  id: string;
  name: string;
  status: string;
  type: string;
  project_id: string;
  project_name: string;
  building_id?: string;
  building_name?: string;
  facade_id?: string;
  facade_name?: string;
  issue_transmittal_no?: string;
  drawing_number?: string;
}

interface PanelGroup {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  project: string;
  project_id: string;
  panels: PanelInfo[];
  totalPanelCount: number;
}

interface FilteredPanelGroup extends PanelGroup {
  filteredPanels: PanelInfo[];
  matchedPanelCount: number;
}

function mapPanelStatus(status: number): string {
  const statusMap: Record<number, string> = {
    0: 'Issued For Production',
    1: 'Produced',
    2: 'Proceed for Delivery',
    3: 'Delivered',
    4: 'Approved Material',
    5: 'Rejected Material',
    6: 'Installed',
    7: 'Inspected',
    8: 'Approved Final',
    9: 'On Hold',
    10: 'Cancelled',
    11: 'Broken at Site',
  };
  return statusMap[status] || 'Issued For Production';
}

function mapPanelType(typeValue: number | null | undefined): string {
  if (typeValue === null || typeValue === undefined) {
    return 'Unknown';
  }
  return PANEL_TYPES[typeValue] || `Type ${typeValue}`;
}

function panelMatchesSearch(panel: PanelInfo, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();

  return (
    (panel.name || '').toLowerCase().includes(q) ||
    (panel.issue_transmittal_no || '').toLowerCase().includes(q) ||
    (panel.drawing_number || '').toLowerCase().includes(q) ||
    (panel.project_name || '').toLowerCase().includes(q) ||
    (panel.building_name || '').toLowerCase().includes(q) ||
    (panel.facade_name || '').toLowerCase().includes(q)
  );
}

function groupMatchesSearch(group: PanelGroup, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (group.name || '').toLowerCase().includes(q) || (group.description || '').toLowerCase().includes(q);
}

const STATUS_COLORS: Record<string, string> = {
  'Issued For Production': '#3B82F6',
  Produced: '#8B5CF6',
  'Proceed for Delivery': '#F59E0B',
  Delivered: '#10B981',
  'Approved Material': '#059669',
  'Rejected Material': '#EF4444',
  Installed: '#06B6D4',
  Inspected: '#6366F1',
  'Approved Final': '#22C55E',
  'On Hold': '#F97316',
  Cancelled: '#6B7280',
  'Broken at Site': '#DC2626',
};

const GroupCard = React.memo(function GroupCard({
  item,
  isExpanded,
  onOpenGroup,
  onOpenPanel,
  onToggleExpand,
  formatDate,
  showMatchedCount,
}: {
  item: FilteredPanelGroup;
  isExpanded: boolean;
  onOpenGroup: (group: PanelGroup) => void;
  onOpenPanel: (panelId: string) => void;
  onToggleExpand: (groupId: string) => void;
  formatDate: (dateString: string) => string;
  showMatchedCount: boolean;
}) {
  const panelsToShow = item.filteredPanels;
  const panelCountLabel = showMatchedCount
    ? `${item.matchedPanelCount} of ${item.totalPanelCount} panel${item.totalPanelCount !== 1 ? 's' : ''}`
    : `${item.totalPanelCount} panel${item.totalPanelCount !== 1 ? 's' : ''}`;

  return (
    <View style={groupCardStyles.groupCard}>
      <TouchableOpacity onPress={() => onOpenGroup(item)} activeOpacity={0.7}>
        <View style={groupCardStyles.groupHeader}>
          <View style={groupCardStyles.groupTitleContainer}>
            <Ionicons name="layers-outline" size={20} color={QatarColors.primary} />
            <Text style={groupCardStyles.groupTitle} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <View style={groupCardStyles.projectBadge}>
            <Text style={groupCardStyles.projectBadgeText} numberOfLines={1}>
              {item.project}
            </Text>
          </View>
        </View>
        {item.description ? (
          <Text style={groupCardStyles.groupDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : (
          <Text style={groupCardStyles.groupDescriptionEmpty}>No description</Text>
        )}
      </TouchableOpacity>

      <View style={groupCardStyles.groupStats}>
        <View style={groupCardStyles.statItem}>
          <Ionicons name="cube-outline" size={16} color={QatarColors.mutedForeground} />
          <Text style={groupCardStyles.statText}>{panelCountLabel}</Text>
        </View>
        <View style={groupCardStyles.statItem}>
          <Ionicons name="calendar-outline" size={16} color={QatarColors.mutedForeground} />
          <Text style={groupCardStyles.statText}>{formatDate(item.createdAt)}</Text>
        </View>
        {panelsToShow.length > 0 && (
          <TouchableOpacity
            style={groupCardStyles.expandButton}
            onPress={() => onToggleExpand(item.id)}
            activeOpacity={0.7}
          >
            <Text style={groupCardStyles.expandButtonText}>{isExpanded ? 'Collapse' : 'Expand'}</Text>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={QatarColors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {isExpanded && panelsToShow.length > 0 && (
        <View style={groupCardStyles.panelListContainer}>
          {panelsToShow.map((panel) => {
            const statusColor = STATUS_COLORS[panel.status] || QatarColors.mutedForeground;
            return (
              <TouchableOpacity
                key={panel.id}
                style={groupCardStyles.panelItem}
                onPress={() => onOpenPanel(panel.id)}
                activeOpacity={0.7}
              >
                <View style={groupCardStyles.panelItemLeft}>
                  <Ionicons name="cube" size={18} color={QatarColors.primary} />
                  <View style={groupCardStyles.panelItemInfo}>
                    <Text style={groupCardStyles.panelItemName} numberOfLines={1}>
                      {panel.name}
                    </Text>
                    {(panel.building_name || panel.facade_name) && (
                      <Text style={groupCardStyles.panelItemLocation} numberOfLines={1}>
                        {[panel.building_name, panel.facade_name].filter(Boolean).join(' • ')}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={groupCardStyles.panelItemRight}>
                  <View style={[groupCardStyles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                    <View style={[groupCardStyles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[groupCardStyles.statusText, { color: statusColor }]} numberOfLines={1}>
                      {panel.status}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={QatarColors.mutedForeground} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
});

const groupCardStyles = StyleSheet.create({
  groupCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  groupTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  groupTitle: { fontSize: 16, fontWeight: '600', color: QatarColors.foreground, flex: 1 },
  projectBadge: { backgroundColor: QatarColors.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  projectBadgeText: { fontSize: 12, color: QatarColors.foreground, maxWidth: 120 },
  groupDescription: { fontSize: 13, color: QatarColors.mutedForeground, marginBottom: 12 },
  groupDescriptionEmpty: { fontSize: 13, color: QatarColors.mutedForeground, marginBottom: 12, fontStyle: 'italic' },
  groupStats: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: QatarColors.mutedForeground },
  expandButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  expandButtonText: { fontSize: 12, color: QatarColors.primary, fontWeight: '500' },
  panelListContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: QatarColors.border, gap: 8 },
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: QatarColors.accent,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  panelItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  panelItemInfo: { flex: 1 },
  panelItemName: { fontSize: 14, fontWeight: '600', color: QatarColors.foreground },
  panelItemLocation: { fontSize: 11, color: QatarColors.mutedForeground, marginTop: 2 },
  panelItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '500' },
});

export default function PanelGroupsScreen() {
  const [panelGroups, setPanelGroups] = useState<PanelGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToastContext();
  const { showLoadingOverlay } = useLoadingOverlay();
  const navigation = useNavigation<PanelGroupsStackNavigationProp>();
  const listRef = useRef<FlatList<FilteredPanelGroup>>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');
  const [typeFilter, setTypeFilter] = useState<FilterValue>('all');
  const [projectFilter, setProjectFilter] = useState<FilterValue>('all');
  const [buildingFilter, setBuildingFilter] = useState<FilterValue>('all');
  const [facadeFilter, setFacadeFilter] = useState<FilterValue>('all');

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showFacadeModal, setShowFacadeModal] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPanelGroups();
  }, []);

  const fetchPanelGroups = async () => {
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('panel_groups')
        .select('id, name, description, created_at, project_id')
        .order('name', { ascending: true });

      if (groupsError) throw groupsError;

      const groupRows = groupsData || [];
      const projectIds = Array.from(new Set(groupRows.map((group) => group.project_id).filter(Boolean)));

      let projectsMap = new Map<string, string>();
      if (projectIds.length > 0) {
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIds);

        if (!projectsError && projectsData) {
          projectsMap = new Map(projectsData.map((project) => [project.id, project.name]));
        }
      }

      // Keep the original fetching pattern (per-group memberships) because it is
      // more robust for large datasets and avoids oversized IN-list requests.
      const groupsWithPanels: PanelGroup[] = await Promise.all(
        groupRows.map(async (group) => {
          const { data: membershipData, error: membershipError } = await supabase
            .from('panel_group_memberships')
            .select('panel_id')
            .eq('panel_group_id', group.id);

          if (membershipError) {
            console.error('Error fetching memberships for group:', group.id, membershipError);
            return {
              id: group.id,
              name: group.name,
              description: group.description || '',
              createdAt: new Date(group.created_at).toISOString(),
              project: projectsMap.get(group.project_id || '') || 'Unknown Project',
              project_id: group.project_id || '',
              panels: [] as PanelInfo[],
              totalPanelCount: 0,
            };
          }

          const panelIds = (membershipData || []).map((membership) => membership.panel_id);
          let panels: PanelInfo[] = [];

          if (panelIds.length > 0) {
            const { data: panelsData, error: panelsError } = await supabase
              .from('panels')
              .select(`
                id,
                name,
                status,
                type,
                project_id,
                building_id,
                facade_id,
                issue_transmittal_no,
                drawing_number,
                building:buildings(name),
                facade:facades(name)
              `)
              .in('id', panelIds);

            if (panelsError) {
              console.error('Error fetching panels for group:', group.id, panelsError);
            } else {
              panels =
                (panelsData || []).map((panel: any) => {
                  const projectId = panel.project_id || '';
                  return {
                    id: panel.id,
                    name: panel.name || `Panel ${String(panel.id).slice(0, 8)}`,
                    status: mapPanelStatus(panel.status),
                    type: mapPanelType(panel.type),
                    project_id: projectId,
                    project_name: projectsMap.get(projectId) || 'Unknown Project',
                    building_id: panel.building_id || undefined,
                    building_name: panel.building?.name || undefined,
                    facade_id: panel.facade_id || undefined,
                    facade_name: panel.facade?.name || undefined,
                    issue_transmittal_no: panel.issue_transmittal_no || undefined,
                    drawing_number: panel.drawing_number || undefined,
                  };
                }) || [];
            }
          }

          return {
            id: group.id,
            name: group.name,
            description: group.description || '',
            createdAt: new Date(group.created_at).toISOString(),
            project: projectsMap.get(group.project_id || '') || 'Unknown Project',
            project_id: group.project_id || '',
            panels,
            totalPanelCount: panels.length,
          };
        })
      );

      setPanelGroups(groupsWithPanels);
    } catch (error) {
      console.error('Error fetching panel groups:', error);
      showToast('Error fetching panel groups', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPanelGroups();
    setRefreshing(false);
  };

  const allPanels = useMemo(() => panelGroups.flatMap((group) => group.panels), [panelGroups]);

  const sortedDedupeOptions = useCallback((input: FilterOption[]): FilterOption[] => {
    const seen = new Map<string, string>();
    input.forEach((option) => {
      if (!option.value || seen.has(option.value)) return;
      seen.set(option.value, option.label);
    });
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const projectOptions = useMemo(() => {
    const source = allPanels.map((panel) => ({
      value: panel.project_id,
      label: panel.project_name || 'Unknown Project',
    }));
    return sortedDedupeOptions(source);
  }, [allPanels, sortedDedupeOptions]);

  const buildingOptions = useMemo(() => {
    const scopedPanels = allPanels.filter(
      (panel) => projectFilter === 'all' || panel.project_id === projectFilter
    );
    const source = scopedPanels
      .filter((panel) => panel.building_id)
      .map((panel) => ({
        value: panel.building_id as string,
        label: panel.building_name || 'Unknown Building',
      }));
    return sortedDedupeOptions(source);
  }, [allPanels, projectFilter, sortedDedupeOptions]);

  const facadeOptions = useMemo(() => {
    const scopedPanels = allPanels.filter((panel) => {
      if (projectFilter !== 'all' && panel.project_id !== projectFilter) return false;
      if (buildingFilter !== 'all' && panel.building_id !== buildingFilter) return false;
      return true;
    });
    const source = scopedPanels
      .filter((panel) => panel.facade_id)
      .map((panel) => ({
        value: panel.facade_id as string,
        label: panel.facade_name || 'Unknown Facade',
      }));
    return sortedDedupeOptions(source);
  }, [allPanels, projectFilter, buildingFilter, sortedDedupeOptions]);

  const statusOptions = useMemo<FilterOption[]>(
    () => PANEL_STATUSES.map((status) => ({ value: status, label: status })),
    []
  );
  const typeOptions = useMemo<FilterOption[]>(
    () => PANEL_TYPES.map((type) => ({ value: type, label: type })),
    []
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const hasNonSearchPanelFilters =
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    projectFilter !== 'all' ||
    buildingFilter !== 'all' ||
    facadeFilter !== 'all';

  const hasPanelLevelFilters = hasNonSearchPanelFilters || normalizedSearch.length > 0;

  const filteredPanelGroups = useMemo<FilteredPanelGroup[]>(() => {
    return panelGroups
      .map((group) => {
        const panelsAfterPanelFilters = group.panels.filter((panel) => {
          if (statusFilter !== 'all' && panel.status !== statusFilter) return false;
          if (typeFilter !== 'all' && panel.type !== typeFilter) return false;
          if (projectFilter !== 'all' && panel.project_id !== projectFilter) return false;
          if (buildingFilter !== 'all' && panel.building_id !== buildingFilter) return false;
          if (facadeFilter !== 'all' && panel.facade_id !== facadeFilter) return false;
          return true;
        });

        const groupSearchMatch = normalizedSearch ? groupMatchesSearch(group, normalizedSearch) : true;
        const panelsMatchingSearch = normalizedSearch
          ? panelsAfterPanelFilters.filter((panel) => panelMatchesSearch(panel, normalizedSearch))
          : panelsAfterPanelFilters;

        const shouldIncludeGroup = (() => {
          if (hasNonSearchPanelFilters && panelsAfterPanelFilters.length === 0) {
            return false;
          }
          if (normalizedSearch) {
            return groupSearchMatch || panelsMatchingSearch.length > 0;
          }
          return true;
        })();

        const panelsForDisplay = normalizedSearch
          ? groupSearchMatch
            ? panelsAfterPanelFilters
            : panelsMatchingSearch
          : panelsAfterPanelFilters;

        return {
          ...group,
          filteredPanels: panelsForDisplay,
          matchedPanelCount: hasPanelLevelFilters ? panelsForDisplay.length : group.totalPanelCount,
          _include: shouldIncludeGroup,
        };
      })
      .filter((group) => group._include)
      .map(({ _include, ...group }) => group);
  }, [
    panelGroups,
    normalizedSearch,
    statusFilter,
    typeFilter,
    projectFilter,
    buildingFilter,
    facadeFilter,
    hasNonSearchPanelFilters,
    hasPanelLevelFilters,
  ]);

  const activeFiltersCount = [
    normalizedSearch,
    statusFilter !== 'all' ? statusFilter : '',
    typeFilter !== 'all' ? typeFilter : '',
    projectFilter !== 'all' ? projectFilter : '',
    buildingFilter !== 'all' ? buildingFilter : '',
    facadeFilter !== 'all' ? facadeFilter : '',
  ].filter(Boolean).length;

  const hasActiveFilters = activeFiltersCount > 0;
  const buildingDisabled = projectFilter === 'all';
  const facadeDisabled = projectFilter === 'all' || buildingFilter === 'all';

  const resetListPosition = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setProjectFilter('all');
    setBuildingFilter('all');
    setFacadeFilter('all');
    resetListPosition();
  }, [resetListPosition]);

  const handleProjectFilterChange = useCallback((value: FilterValue) => {
    setProjectFilter(value);
    setBuildingFilter('all');
    setFacadeFilter('all');
    resetListPosition();
  }, [resetListPosition]);

  const handleBuildingFilterChange = useCallback((value: FilterValue) => {
    setBuildingFilter(value);
    setFacadeFilter('all');
    resetListPosition();
  }, [resetListPosition]);

  const handleStatusFilterChange = useCallback((value: FilterValue) => {
    setStatusFilter(value);
    resetListPosition();
  }, [resetListPosition]);

  const handleTypeFilterChange = useCallback((value: FilterValue) => {
    setTypeFilter(value);
    resetListPosition();
  }, [resetListPosition]);

  const handleFacadeFilterChange = useCallback((value: FilterValue) => {
    setFacadeFilter(value);
    resetListPosition();
  }, [resetListPosition]);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const handleOpenGroup = useCallback(
    (group: PanelGroup) => {
      showLoadingOverlay();
      navigation.navigate('PanelGroupDetails', { groupId: group.id });
    },
    [showLoadingOverlay, navigation]
  );

  const handleOpenPanel = useCallback(
    (panelId: string) => {
      showLoadingOverlay();
      navigation.navigate('PanelDetails', { panelId });
    },
    [showLoadingOverlay, navigation]
  );

  const handleToggleExpand = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const renderGroupItem = useCallback(
    ({ item }: { item: FilteredPanelGroup }) => (
      <GroupCard
        item={item}
        isExpanded={expandedGroups.has(item.id)}
        onOpenGroup={handleOpenGroup}
        onOpenPanel={handleOpenPanel}
        onToggleExpand={handleToggleExpand}
        formatDate={formatDate}
        showMatchedCount={hasPanelLevelFilters}
      />
    ),
    [expandedGroups, handleOpenGroup, handleOpenPanel, handleToggleExpand, formatDate, hasPanelLevelFilters]
  );

  const renderFilterModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    options: FilterOption[],
    selectedValue: FilterValue,
    onSelect: (value: FilterValue) => void
  ) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={QatarColors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            <TouchableOpacity
              style={[styles.modalOption, selectedValue === 'all' && styles.modalOptionSelected]}
              onPress={() => {
                onSelect('all');
                onClose();
              }}
            >
              <Text style={[styles.modalOptionText, selectedValue === 'all' && styles.modalOptionTextSelected]}>
                All
              </Text>
              {selectedValue === 'all' && <Ionicons name="checkmark" size={20} color={QatarColors.primary} />}
            </TouchableOpacity>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.modalOption, selectedValue === option.value && styles.modalOptionSelected]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <Text
                  style={[styles.modalOptionText, selectedValue === option.value && styles.modalOptionTextSelected]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
                {selectedValue === option.value && <Ionicons name="checkmark" size={20} color={QatarColors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const getFilterLabel = (value: FilterValue, fallback: string, options: FilterOption[]) => {
    if (value === 'all') return fallback;
    return options.find((option) => option.value === value)?.label || fallback;
  };

  const renderFilterButton = (
    icon: keyof typeof Ionicons.glyphMap,
    value: FilterValue,
    defaultLabel: string,
    options: FilterOption[],
    onPress: () => void,
    disabled = false
  ) => {
    const active = value !== 'all';
    return (
      <TouchableOpacity
        style={[
          styles.filterButton,
          active && styles.filterButtonActive,
          disabled && styles.filterButtonDisabled,
        ]}
        onPress={onPress}
        activeOpacity={disabled ? 1 : 0.7}
        disabled={disabled}
      >
        <Ionicons
          name={icon}
          size={16}
          color={active ? QatarColors.primary : disabled ? QatarColors.mutedForeground : QatarColors.mutedForeground}
        />
        <Text
          style={[
            styles.filterButtonText,
            active && styles.filterButtonTextActive,
            disabled && styles.filterButtonTextDisabled,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {getFilterLabel(value, defaultLabel, options)}
        </Text>
        <Ionicons
          name="chevron-down"
          size={14}
          color={active ? QatarColors.primary : disabled ? QatarColors.mutedForeground : QatarColors.mutedForeground}
        />
      </TouchableOpacity>
    );
  };

  const renderFilterBar = () => (
    <View style={styles.filterContainer}>
      <View style={styles.filtersHeader}>
        <Text style={styles.filtersHeaderText}>Filters</Text>
        {activeFiltersCount > 0 && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{activeFiltersCount}</Text>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
        {renderFilterButton('flag-outline', statusFilter, 'Status', statusOptions, () => setShowStatusModal(true))}
        {renderFilterButton('cube-outline', typeFilter, 'Type', typeOptions, () => setShowTypeModal(true))}
        {renderFilterButton('folder-outline', projectFilter, 'Project', projectOptions, () => setShowProjectModal(true))}
        {renderFilterButton(
          'business-outline',
          buildingFilter,
          'Building',
          buildingOptions,
          () => setShowBuildingModal(true),
          buildingDisabled
        )}
        {renderFilterButton(
          'grid-outline',
          facadeFilter,
          'Facade',
          facadeOptions,
          () => setShowFacadeModal(true),
          facadeDisabled
        )}

        {hasActiveFilters && (
          <TouchableOpacity style={styles.clearFilterButton} onPress={clearFilters}>
            <Ionicons name="close-circle" size={16} color={QatarColors.destructive} />
            <Text style={styles.clearFilterText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <NavigationBar title="Panel Groups" showBackButton={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={QatarColors.primary} />
          <Text style={styles.loadingText}>Loading panel groups...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationBar title="Panel Groups" showBackButton={false} />

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={QatarColors.mutedForeground} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search groups or panels..."
          placeholderTextColor={QatarColors.mutedForeground}
          value={searchTerm}
          onChangeText={(value) => {
            setSearchTerm(value);
            resetListPosition();
          }}
          autoCorrect={false}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={QatarColors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {renderFilterBar()}

      {filteredPanelGroups.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[QatarColors.primary]} />
          }
        >
          <View style={styles.emptyState}>
            <Ionicons
              name={hasActiveFilters ? 'search-outline' : 'layers-outline'}
              size={64}
              color={QatarColors.mutedForeground}
            />
            <Text style={styles.emptyTitle}>{hasActiveFilters ? 'No Results Found' : 'No Panel Groups Found'}</Text>
            <Text style={styles.emptySubtitle}>
              {hasActiveFilters
                ? 'No panel groups match the current filters'
                : 'Panel groups will appear here when they are created'}
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={filteredPanelGroups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroupItem}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={10}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[QatarColors.primary]} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {renderFilterModal(
        showStatusModal,
        () => setShowStatusModal(false),
        'Select Status',
        statusOptions,
        statusFilter,
        handleStatusFilterChange
      )}
      {renderFilterModal(
        showTypeModal,
        () => setShowTypeModal(false),
        'Select Type',
        typeOptions,
        typeFilter,
        handleTypeFilterChange
      )}
      {renderFilterModal(
        showProjectModal,
        () => setShowProjectModal(false),
        'Select Project',
        projectOptions,
        projectFilter,
        handleProjectFilterChange
      )}
      {renderFilterModal(
        showBuildingModal,
        () => setShowBuildingModal(false),
        'Select Building',
        buildingOptions,
        buildingFilter,
        handleBuildingFilterChange
      )}
      {renderFilterModal(
        showFacadeModal,
        () => setShowFacadeModal(false),
        'Select Facade',
        facadeOptions,
        facadeFilter,
        handleFacadeFilterChange
      )}
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
    fontSize: 16,
    color: QatarColors.mutedForeground,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QatarColors.input,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: QatarColors.foreground,
    height: '100%',
    padding: 0,
  },
  filterContainer: {
    backgroundColor: QatarColors.card,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
    paddingTop: 10,
    paddingBottom: 12,
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  filtersHeaderText: {
    fontSize: 13,
    color: QatarColors.mutedForeground,
    fontWeight: '600',
  },
  activeBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: QatarColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  activeBadgeText: {
    color: QatarColors.primaryForeground,
    fontSize: 11,
    fontWeight: '700',
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: QatarColors.muted,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: QatarColors.border,
    maxWidth: 180,
    overflow: 'hidden',
  },
  filterButtonActive: {
    backgroundColor: `${QatarColors.primary}15`,
    borderColor: QatarColors.primary,
  },
  filterButtonDisabled: {
    opacity: 0.55,
  },
  filterButtonText: {
    fontSize: 13,
    color: QatarColors.mutedForeground,
    flexShrink: 1,
  },
  filterButtonTextActive: {
    color: QatarColors.primary,
    fontWeight: '600',
  },
  filterButtonTextDisabled: {
    color: QatarColors.mutedForeground,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearFilterText: {
    fontSize: 13,
    color: QatarColors.destructive,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: QatarColors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: QatarColors.foreground,
  },
  modalScroll: {
    paddingBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  modalOptionSelected: {
    backgroundColor: `${QatarColors.primary}10`,
  },
  modalOptionText: {
    fontSize: 16,
    color: QatarColors.foreground,
    flex: 1,
    marginRight: 12,
  },
  modalOptionTextSelected: {
    color: QatarColors.primary,
    fontWeight: '600',
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: QatarColors.primary,
    borderRadius: 8,
  },
  clearFiltersButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
  },
  listContainer: {
    paddingVertical: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: QatarColors.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
  },
});
