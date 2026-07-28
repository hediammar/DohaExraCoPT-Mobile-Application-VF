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
import Svg, { Path } from 'react-native-svg';
import { NotesStackNavigationProp } from '../../types/navigation';
import { QatarColors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { useLoadingOverlay } from '../../contexts/LoadingOverlayContext';
import { NavigationBar } from '../../components/NavigationBar';
import { rf } from '../../utils/responsive';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  created_by: string;
}

interface PanelGroup {
  id: string;
  name: string;
  description: string;
  project_id: string;
  project_name: string;
  total_panels: number;
  total_area: number;
  total_amount: number;
  total_weight: number;
  panel_names: string[];
}

interface NoteWithPanelGroups extends Note {
  panel_groups: PanelGroup[];
}

interface NoteDetailsScreenProps {
  navigation: NotesStackNavigationProp;
  route: {
    params: {
      noteId: string;
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

// Helpers to draw pie slices with SVG (same as ProjectDetailsScreen)
const degToRad = (deg: number) => (deg * Math.PI) / 180;
const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const a = degToRad(angle);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

const describeSlice = (
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) => {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
};

export default function NoteDetailsScreen({ navigation, route }: NoteDetailsScreenProps) {
  const { noteId } = route.params;
  const { user: currentUser } = useAuth();
  const { showToast } = useToastContext();
  const { showLoadingOverlay, hideLoadingOverlay } = useLoadingOverlay();
  const [note, setNote] = useState<NoteWithPanelGroups | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [panelStatusCounts, setPanelStatusCounts] = useState<Record<string, number>>({});
  const [totalPanels, setTotalPanels] = useState<number>(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupPanels, setGroupPanels] = useState<Record<string, any[]>>({});
  const [panelSearchQuery, setPanelSearchQuery] = useState('');
  const [selectedPanelStatus, setSelectedPanelStatus] = useState<string | null>(null);

  const statusMap: { [key: number]: string } = Object.fromEntries(
    PANEL_STATUSES.map((status, index) => [index, status])
  );

  useEffect(() => {
    loadNoteDetails();
  }, [noteId]);

  const loadNoteDetails = async () => {
    try {
      setLoading(true);

      // Fetch note details
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();

      if (noteError) throw noteError;

      if (!noteData) {
        showToast('Note not found', 'error');
        return;
      }

      // Fetch panel groups for this note
      const { data: notePanelGroupsData, error: notePanelGroupsError } = await supabase
        .from('note_panel_groups')
        .select('panel_group_id')
        .eq('note_id', noteId);

      if (notePanelGroupsError) throw notePanelGroupsError;

      if (!notePanelGroupsData || notePanelGroupsData.length === 0) {
        setNote({
          ...noteData,
          panel_groups: []
        });
        setLoading(false);
        hideLoadingOverlay();
        return;
      }

      // Get panel group details
      const panelGroupIds = notePanelGroupsData.map(item => item.panel_group_id);
      const { data: panelGroupsData, error: panelGroupsError } = await supabase
        .from('panel_groups')
        .select('id, name, description, project_id')
        .in('id', panelGroupIds);

      if (panelGroupsError) throw panelGroupsError;

      // Get project names
      const projectIds = panelGroupsData?.map(item => item.project_id).filter(Boolean) || [];
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);

      if (projectsError) throw projectsError;

      const projectsMap = new Map(projectsData?.map(p => [p.id, p.name]) || []);

      // Calculate totals for each panel group
      const panelGroupsWithTotals = await Promise.all(
        (panelGroupsData || []).map(async (panelGroup) => {
          // Get panel memberships for this group
          const { data: membershipData, error: membershipError } = await supabase
            .from('panel_group_memberships')
            .select('panel_id')
            .eq('panel_group_id', panelGroup.id);

          if (membershipError) {
            console.error('Error fetching panel group memberships:', panelGroup.id, membershipError);
            return {
              ...panelGroup,
              project_name: projectsMap.get(panelGroup.project_id) || 'Unknown Project',
              total_panels: 0,
              total_area: 0,
              total_amount: 0,
              total_weight: 0,
              panel_names: []
            };
          }

          const panelIds = membershipData?.map(m => m.panel_id) || [];

          if (panelIds.length === 0) {
            return {
              ...panelGroup,
              project_name: projectsMap.get(panelGroup.project_id) || 'Unknown Project',
              total_panels: 0,
              total_area: 0,
              total_amount: 0,
              total_weight: 0,
              panel_names: []
            };
          }

          // Get panel details
          const { data: panelsData, error: panelsError } = await supabase
            .from('panels')
            .select('name, ifp_qty_area_sm, unit_rate_qr_m2, weight, status')
            .in('id', panelIds);

          if (panelsError) {
            console.error('Error fetching panels for panel group:', panelGroup.id, panelsError);
            return {
              ...panelGroup,
              project_name: projectsMap.get(panelGroup.project_id) || 'Unknown Project',
              total_panels: 0,
              total_area: 0,
              total_amount: 0,
              total_weight: 0,
              panel_names: []
            };
          }

          const total_panels = panelsData?.length || 0;
          const total_area = panelsData?.reduce((sum, panel) => sum + (panel.ifp_qty_area_sm || 0), 0) || 0;
          const total_amount = panelsData?.reduce((sum, panel) => {
            const area = panel.ifp_qty_area_sm || 0;
            const rate = panel.unit_rate_qr_m2 || 0;
            return sum + (area * rate);
          }, 0) || 0;
          const total_weight = panelsData?.reduce((sum, panel) => sum + (panel.weight || 0), 0) || 0;
          const panel_names = (panelsData || [])
            .map(panel => panel.name)
            .filter((name): name is string => Boolean(name));

          return {
            ...panelGroup,
            project_name: projectsMap.get(panelGroup.project_id) || 'Unknown Project',
            total_panels,
            total_area,
            total_amount,
            total_weight,
            panel_names
          };
        })
      );

      // Calculate overall panel status counts
      const allPanelIds = new Set<string>();
      for (const group of panelGroupsWithTotals) {
        const { data: membershipData } = await supabase
          .from('panel_group_memberships')
          .select('panel_id')
          .eq('panel_group_id', group.id);
        
        membershipData?.forEach(m => allPanelIds.add(m.panel_id));
      }

      if (allPanelIds.size > 0) {
        const { data: allPanelsData } = await supabase
          .from('panels')
          .select('status')
          .in('id', Array.from(allPanelIds));

        const counts: Record<string, number> = {};
        for (const panel of allPanelsData || []) {
          const statusName = statusMap[panel.status] || "Unknown";
          counts[statusName] = (counts[statusName] || 0) + 1;
        }
        setPanelStatusCounts(counts);
        setTotalPanels(allPanelsData?.length || 0);
      } else {
        setPanelStatusCounts({});
        setTotalPanels(0);
      }

      setNote({
        ...noteData,
        panel_groups: panelGroupsWithTotals
      });
    } catch (error) {
      console.error('Error loading note details:', error);
      showToast('Failed to load note details', 'error');
    } finally {
      setLoading(false);
      hideLoadingOverlay();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNoteDetails();
    setRefreshing(false);
  };

  const toggleGroup = async (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
      // Load panels for this group if not already loaded
      if (!groupPanels[groupId]) {
        try {
          const { data: membershipData } = await supabase
            .from('panel_group_memberships')
            .select('panel_id')
            .eq('panel_group_id', groupId);

          const panelIds = membershipData?.map(m => m.panel_id) || [];

          if (panelIds.length > 0) {
            const { data: panelsData } = await supabase
              .from('panels')
              .select(`
                id, name, status, ifp_qty_area_sm, dimension, drawing_number,
                facade:facades(name, building:buildings(name)),
                building:buildings(name)
              `)
              .in('id', panelIds);

            const formattedPanels = panelsData?.map((panel: any) => {
              const buildingName = panel.building?.name ?? panel.facade?.building?.name ?? null;
              return {
                id: panel.id,
                name: panel.name,
                status: statusMap[panel.status] || 'Unknown',
                facadeName: panel.facade?.name || 'N/A',
                buildingName: buildingName || 'N/A',
                elevation: panel.dimension || panel.drawing_number || '—',
                area: panel.ifp_qty_area_sm || 0,
              };
            }) || [];

            setGroupPanels(prev => ({
              ...prev,
              [groupId]: formattedPanels
            }));
          } else {
            setGroupPanels(prev => ({
              ...prev,
              [groupId]: []
            }));
          }
        } catch (error) {
          console.error('Error loading group panels:', error);
        }
      }
    }
    setExpandedGroups(newExpanded);
  };

  const allLoadedPanelStatuses = useMemo(() => {
    const statuses = new Set<string>();
    Object.values(groupPanels).forEach(panels => {
      panels.forEach(p => statuses.add(p.status));
    });
    return PANEL_STATUSES.filter(s => statuses.has(s));
  }, [groupPanels]);

  const getFilteredPanelsForGroup = (groupId: string) => {
    const panels = groupPanels[groupId] || [];
    let result = panels;

    if (panelSearchQuery.trim()) {
      const q = panelSearchQuery.toLowerCase();
      result = result.filter(panel =>
        panel.name.toLowerCase().includes(q) ||
        (panel.facadeName && panel.facadeName.toLowerCase().includes(q)) ||
        (panel.buildingName && panel.buildingName.toLowerCase().includes(q)) ||
        (panel.elevation && panel.elevation.toLowerCase().includes(q))
      );
    }

    if (selectedPanelStatus) {
      result = result.filter(panel => panel.status === selectedPanelStatus);
    }

    return result;
  };

  const filteredPanelGroups = useMemo(() => {
    if (!note) return [];
    let groups = note.panel_groups;

    if (panelSearchQuery.trim()) {
      const q = panelSearchQuery.trim().toLowerCase();
      groups = groups.filter(group =>
        group.name.toLowerCase().includes(q) ||
        group.project_name.toLowerCase().includes(q) ||
        (group.description && group.description.toLowerCase().includes(q)) ||
        (group.panel_names || []).some(name => name.toLowerCase().includes(q)) ||
        (groupPanels[group.id] || []).some(panel =>
          (panel.name || '').toLowerCase().includes(q)
        )
      );
    }

    return groups;
  }, [note, panelSearchQuery, groupPanels]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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

  const getProgress = () => {
    if (totalPanels === 0) return 0;
    return Math.round(((panelStatusCounts["Installed"] || 0) / totalPanels) * 100);
  };

  // Calculate manufacturing pipeline progress (same as web)
  const getManufacturingProgress = (statuses: string[]) => {
    const count = statuses.reduce((sum, status) => sum + (panelStatusCounts[status] || 0), 0);
    return { count, percentage: totalPanels > 0 ? (count / totalPanels) * 100 : 0 };
  };

  const issuedProgress = getManufacturingProgress([
    'Issued For Production', 'Produced', 'Proceed for Delivery', 'Delivered', 
    'Approved Material', 'Rejected Material', 'Installed', 'Inspected', 'Approved Final'
  ]);

  const producedProgress = getManufacturingProgress([
    'Produced', 'Proceed for Delivery', 'Delivered', 'Approved Material', 
    'Rejected Material', 'Installed', 'Inspected', 'Approved Final'
  ]);

  const deliveryProgress = getManufacturingProgress([
    'Proceed for Delivery', 'Delivered', 'Approved Material', 
    'Rejected Material', 'Installed', 'Inspected', 'Approved Final'
  ]);

  const deliveredProgress = getManufacturingProgress([
    'Delivered', 'Approved Material', 'Rejected Material', 
    'Installed', 'Inspected', 'Approved Final'
  ]);

  const installationProgress = getManufacturingProgress([
    'Installed', 'Inspected', 'Approved Final'
  ]);

  const inspectedProgress = getManufacturingProgress([
    'Inspected', 'Approved Final'
  ]);

  const approvedFinalProgress = getManufacturingProgress(['Approved Final']);
  const onHoldProgress = getManufacturingProgress(['On Hold']);
  const brokenProgress = getManufacturingProgress(['Broken at Site']);

  // Calculate pie chart data
  const issuedForProduction = panelStatusCounts['Issued For Production'] || 0;
  const factoryStock = panelStatusCounts['Produced'] || 0;
  const siteStock = panelStatusCounts['Delivered'] || 0;
  const installed = panelStatusCounts['Installed'] || 0;
  const mainStatuses = ['Issued For Production', 'Produced', 'Delivered', 'Installed'];
  const mainStatusCount = mainStatuses.reduce((sum, status) => sum + (panelStatusCounts[status] || 0), 0);
  const restCount = totalPanels - mainStatusCount;

  if (loading) {
    return (
      <View style={styles.container}>
        <NavigationBar title="Note Details" showBackButton={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={QatarColors.primary} />
          <Text style={styles.loadingText}>Loading note details...</Text>
        </View>
      </View>
    );
  }

  if (!note) {
    return (
      <View style={styles.container}>
        <NavigationBar title="Note Details" showBackButton={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="document-text-outline" size={48} color={QatarColors.mutedForeground} />
          <Text style={styles.errorText}>Note not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back to Notes</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationBar title="Note Details" showBackButton={true} />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[QatarColors.primary]}
          />
        }
      >
        {/* Note Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{note.title}</Text>
            <Text style={styles.headerSubtitle}>NT-{note.id.slice(-4).toUpperCase()}</Text>
            <View style={styles.badgeContainer}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{note.panel_groups.length} panel groups</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Note Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>Content</Text>
              <Ionicons name="document-text-outline" size={16} color={QatarColors.mutedForeground} />
            </View>
            <Text style={styles.statCardValue}>
              {note.content ? 'Has content' : 'No content provided'}
            </Text>
            <Text style={styles.statCardSubtitle}>Note Details</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>Created By</Text>
              <Ionicons name="person-outline" size={16} color={QatarColors.mutedForeground} />
            </View>
            <Text style={styles.statCardValue}>{note.created_by || 'Unknown user'}</Text>
            <Text style={styles.statCardSubtitle}>Author</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>Panel Groups</Text>
              <Ionicons name="folder-outline" size={16} color={QatarColors.mutedForeground} />
            </View>
            <Text style={styles.statCardValue}>{note.panel_groups.length}</Text>
            <Text style={styles.statCardSubtitle}>Associated Groups</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>Created</Text>
              <Ionicons name="time-outline" size={16} color={QatarColors.mutedForeground} />
            </View>
            <Text style={styles.statCardValue}>{formatDate(note.created_at)}</Text>
            <Text style={styles.statCardSubtitle}>Creation Date</Text>
          </View>
        </View>

        {/* Main Content - Stacked Layout */}
        <View style={styles.mainContentStack}>
          {/* Manufacturing Pipeline */}
          <View style={styles.pipelineCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="trending-up" size={20} color={QatarColors.foreground} />
              <Text style={styles.cardTitle}>Manufacturing Pipeline</Text>
            </View>
            <View style={styles.pipelineContent}>
              {/* Issued For Production */}
              <View style={styles.pipelineItem}>
                <View style={styles.pipelineHeader}>
                  <Text style={styles.pipelineLabel}>Issued For Production</Text>
                  <Text style={styles.pipelineCount}>{issuedProgress.count} / {totalPanels}</Text>
                </View>
                <View style={styles.pipelineBar}>
                  <View
                    style={[
                      styles.pipelineFill,
                      { width: `${Math.min(100, issuedProgress.percentage)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.pipelinePercentage}>
                  {issuedProgress.percentage.toFixed(2)}% panels issued for production
                </Text>
              </View>

              {/* Produced Progress */}
              <View style={styles.pipelineItem}>
                <View style={styles.pipelineHeader}>
                  <Text style={styles.pipelineLabel}>Produced Progress</Text>
                  <Text style={styles.pipelineCount}>{producedProgress.count} / {totalPanels}</Text>
                </View>
                <View style={styles.pipelineBar}>
                  <View
                    style={[
                      styles.pipelineFill,
                      { width: `${Math.min(100, producedProgress.percentage)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.pipelinePercentage}>
                  {producedProgress.percentage.toFixed(2)}% panels produced
                </Text>
              </View>

              {/* Proceed for Delivery Progress */}
              <View style={styles.pipelineItem}>
                <View style={styles.pipelineHeader}>
                  <Text style={styles.pipelineLabel}>Proceed for Delivery Progress</Text>
                  <Text style={styles.pipelineCount}>{deliveryProgress.count} / {totalPanels}</Text>
                </View>
                <View style={styles.pipelineBar}>
                  <View
                    style={[
                      styles.pipelineFillRed,
                      { width: `${Math.min(100, deliveryProgress.percentage)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.pipelinePercentage}>
                  {deliveryProgress.percentage.toFixed(2)}% panels proceed for delivery
                </Text>
              </View>

              {/* Delivered Progress */}
              <View style={styles.pipelineItem}>
                <View style={styles.pipelineHeader}>
                  <Text style={styles.pipelineLabel}>Delivered Progress</Text>
                  <Text style={styles.pipelineCount}>{deliveredProgress.count} / {totalPanels}</Text>
                </View>
                <View style={styles.pipelineBar}>
                  <View
                    style={[
                      styles.pipelineFill,
                      { width: `${Math.min(100, deliveredProgress.percentage)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.pipelinePercentage}>
                  {deliveredProgress.percentage.toFixed(2)}% panels delivered
                </Text>
              </View>

              {/* Installation Progress */}
              <View style={styles.pipelineItem}>
                <View style={styles.pipelineHeader}>
                  <Text style={styles.pipelineLabel}>Installation Progress</Text>
                  <Text style={styles.pipelineCount}>{installationProgress.count} / {totalPanels}</Text>
                </View>
                <View style={styles.pipelineBar}>
                  <View
                    style={[
                      styles.pipelineFill,
                      { width: `${Math.min(100, installationProgress.percentage)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.pipelinePercentage}>
                  {installationProgress.percentage.toFixed(2)}% panels installed
                </Text>
              </View>

              {/* Inspected Progress */}
              <View style={styles.pipelineItem}>
                <View style={styles.pipelineHeader}>
                  <Text style={styles.pipelineLabel}>Inspected Progress</Text>
                  <Text style={styles.pipelineCount}>{inspectedProgress.count} / {totalPanels}</Text>
                </View>
                <View style={styles.pipelineBar}>
                  <View
                    style={[
                      styles.pipelineFill,
                      { width: `${Math.min(100, inspectedProgress.percentage)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.pipelinePercentage}>
                  {inspectedProgress.percentage.toFixed(2)}% panels inspected
                </Text>
              </View>

              {/* Approved Final Progress */}
              <View style={styles.pipelineItem}>
                <View style={styles.pipelineHeader}>
                  <Text style={styles.pipelineLabel}>Approved Final Progress</Text>
                  <Text style={styles.pipelineCount}>{approvedFinalProgress.count} / {totalPanels}</Text>
                </View>
                <View style={styles.pipelineBar}>
                  <View
                    style={[
                      styles.pipelineFillGreen,
                      { width: `${Math.min(100, approvedFinalProgress.percentage)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.pipelinePercentage}>
                  {approvedFinalProgress.percentage.toFixed(2)}% panels approved final
                </Text>
              </View>

              {/* On Hold Progress */}
              <View style={styles.pipelineItem}>
                <View style={styles.pipelineHeader}>
                  <Text style={styles.pipelineLabel}>On Hold Progress</Text>
                  <Text style={styles.pipelineCount}>{onHoldProgress.count} / {totalPanels}</Text>
                </View>
                <View style={styles.pipelineBar}>
                  <View
                    style={[
                      styles.pipelineFillOrange,
                      { width: `${Math.min(100, onHoldProgress.percentage)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.pipelinePercentage}>
                  {onHoldProgress.percentage.toFixed(2)}% panels on hold
                </Text>
              </View>

              {/* Broken at Site Progress */}
              <View style={styles.pipelineItem}>
                <View style={styles.pipelineHeader}>
                  <Text style={styles.pipelineLabel}>Broken at Site Progress</Text>
                  <Text style={styles.pipelineCount}>{brokenProgress.count} / {totalPanels}</Text>
                </View>
                <View style={styles.pipelineBar}>
                  <View
                    style={[
                      styles.pipelineFillRed,
                      { width: `${Math.min(100, brokenProgress.percentage)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.pipelinePercentage}>
                  {brokenProgress.percentage.toFixed(2)}% panels broken at site
                </Text>
              </View>
            </View>
          </View>

          {/* Progress Overview */}
          <View style={styles.progressOverviewCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="trending-up" size={20} color={QatarColors.foreground} />
              <Text style={styles.cardTitle}>Progress Overview</Text>
            </View>
            <View style={styles.progressOverviewContent}>
              {totalPanels === 0 ? (
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>No panels yet for this note</Text>
                </View>
              ) : (
                <View style={styles.progressOverviewData}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressSubtitle}>Status Distribution</Text>
                    <Text style={styles.progressPercentage}>{totalPanels} Total</Text>
                  </View>
                  <View style={styles.pieChartContainer}>
                    <View style={styles.pieChart}>
                      {totalPanels > 0 && (
                        <Svg width={120} height={120} viewBox="0 0 120 120" style={{ position: 'absolute' }}>
                          {(() => {
                            const cx = 60, cy = 60, r = 60;
                            const segments = [
                              { value: issuedForProduction, color: '#E11D48' },
                              { value: factoryStock, color: '#F59E0B' },
                              { value: siteStock, color: '#3B82F6' },
                              { value: installed, color: '#10B981' },
                              { value: restCount, color: '#6B7280' },
                            ].filter(s => s.value > 0);
                            let startAngle = -90;
                            return segments.map((seg, idx) => {
                              const sweep = (seg.value / totalPanels) * 360;
                              const path = describeSlice(cx, cy, r, startAngle, startAngle + sweep);
                              const el = (
                                <Path key={idx} d={path} fill={seg.color} />
                              );
                              startAngle += sweep;
                              return el;
                            });
                          })()}
                        </Svg>
                      )}
                      <View style={styles.pieChartCenter}>
                        <Text style={styles.pieChartText}>{totalPanels}</Text>
                        <Text style={styles.pieChartSubtext}>Total</Text>
                      </View>
                    </View>
                    <View style={styles.donutLegend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendIndicator, { backgroundColor: '#E11D48' }]} />
                        <Text style={styles.legendLabel}>Issued For Production</Text>
                        <Text style={styles.legendValue}>{issuedForProduction}</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendIndicator, { backgroundColor: '#F59E0B' }]} />
                        <Text style={styles.legendLabel}>Factory Stock</Text>
                        <Text style={styles.legendValue}>{factoryStock}</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendIndicator, { backgroundColor: '#3B82F6' }]} />
                        <Text style={styles.legendLabel}>Site Stock</Text>
                        <Text style={styles.legendValue}>{siteStock}</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendIndicator, { backgroundColor: '#10B981' }]} />
                        <Text style={styles.legendLabel}>Installed</Text>
                        <Text style={styles.legendValue}>{installed}</Text>
                      </View>
                      {restCount > 0 && (
                        <View style={styles.legendItem}>
                          <View style={[styles.legendIndicator, { backgroundColor: '#6B7280' }]} />
                          <Text style={styles.legendLabel}>Rest</Text>
                          <Text style={styles.legendValue}>{restCount}</Text>
                        </View>
                      )}
                      <View style={styles.legendTotals}>
                        <View style={styles.legendTotalItem}>
                          <Text style={styles.legendTotalLabel}>Total Panels</Text>
                          <Text style={styles.legendTotalValue}>{totalPanels}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Note Totals */}
          <View style={styles.projectTotalsCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={20} color={QatarColors.foreground} />
              <Text style={styles.cardTitle}>Note Totals</Text>
            </View>
            <View style={styles.projectTotalsContent}>
              <View style={styles.totalsGrid}>
                <View style={styles.totalItem}>
                  <View style={styles.totalItemHeader}>
                    <Ionicons name="square-outline" size={16} color={QatarColors.mutedForeground} />
                    <Text style={styles.totalItemLabel}>Total Area</Text>
                  </View>
                  <Text style={styles.totalItemValue}>
                    {note.panel_groups.reduce((sum, group) => sum + group.total_area, 0).toFixed(2)} m²
                  </Text>
                </View>
                <View style={styles.totalItem}>
                  <View style={styles.totalItemHeader}>
                    <Ionicons name="cash-outline" size={16} color={QatarColors.mutedForeground} />
                    <Text style={styles.totalItemLabel}>Total Amount</Text>
                  </View>
                  <Text style={styles.totalItemValue}>
                    {formatQatarRiyal(note.panel_groups.reduce((sum, group) => sum + group.total_amount, 0))}
                  </Text>
                </View>
                <View style={styles.totalItem}>
                  <View style={styles.totalItemHeader}>
                    <Ionicons name="scale-outline" size={16} color={QatarColors.mutedForeground} />
                    <Text style={styles.totalItemLabel}>Total Weight</Text>
                  </View>
                  <Text style={styles.totalItemValue}>
                    {note.panel_groups.reduce((sum, group) => sum + group.total_weight, 0).toFixed(2)} kg
                  </Text>
                </View>
                <View style={styles.totalItem}>
                  <View style={styles.totalItemHeader}>
                    <Ionicons name="cube-outline" size={16} color={QatarColors.mutedForeground} />
                    <Text style={styles.totalItemLabel}>Total Panels</Text>
                  </View>
                  <Text style={styles.totalItemValue}>{totalPanels}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Efficiency Metrics */}
          <View style={styles.efficiencyCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={20} color={QatarColors.foreground} />
              <Text style={styles.cardTitle}>Efficiency Metrics</Text>
            </View>
            <View style={styles.efficiencyContent}>
              <View style={styles.efficiencyItem}>
                <View style={styles.efficiencyLabelContainer}>
                  <View style={[styles.efficiencyIndicator, { backgroundColor: QatarColors.chart2 }]} />
                  <Text style={styles.efficiencyLabel}>Production Efficiency</Text>
                </View>
                <View style={styles.efficiencyBadge}>
                  <Text style={styles.efficiencyBadgeText}>
                    {producedProgress.percentage.toFixed(1)}%
                  </Text>
                </View>
              </View>
              <View style={styles.efficiencyItem}>
                <View style={styles.efficiencyLabelContainer}>
                  <View style={[styles.efficiencyIndicator, { backgroundColor: QatarColors.chart3 }]} />
                  <Text style={styles.efficiencyLabel}>Delivery Efficiency</Text>
                </View>
                <View style={styles.efficiencyBadge}>
                  <Text style={styles.efficiencyBadgeText}>
                    {deliveredProgress.percentage.toFixed(1)}%
                  </Text>
                </View>
              </View>
              <View style={styles.efficiencyItem}>
                <View style={styles.efficiencyLabelContainer}>
                  <View style={[styles.efficiencyIndicator, { backgroundColor: QatarColors.chart4 }]} />
                  <Text style={styles.efficiencyLabel}>Overall Completion</Text>
                </View>
                <View style={styles.efficiencyBadge}>
                  <Text style={styles.efficiencyBadgeText}>
                    {approvedFinalProgress.percentage.toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Panel Groups Section */}
          <View style={styles.panelGroupsSection}>
            <Text style={styles.sectionTitle}>Panel Groups</Text>

            {note.panel_groups.length > 0 && (
              <>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={rf(18)} color={QatarColors.mutedForeground} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search groups, projects, panels..."
                    placeholderTextColor={QatarColors.mutedForeground}
                    value={panelSearchQuery}
                    onChangeText={setPanelSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {panelSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setPanelSearchQuery('')}>
                      <Ionicons name="close-circle" size={rf(18)} color={QatarColors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Status Filter Chips */}
                {allLoadedPanelStatuses.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScrollView}
                    contentContainerStyle={styles.filterChipsContainer}
                  >
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        !selectedPanelStatus && styles.filterChipActive,
                      ]}
                      onPress={() => setSelectedPanelStatus(null)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          !selectedPanelStatus && styles.filterChipTextActive,
                        ]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>
                    {allLoadedPanelStatuses.map(status => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.filterChip,
                          selectedPanelStatus === status && styles.filterChipActive,
                        ]}
                        onPress={() =>
                          setSelectedPanelStatus(selectedPanelStatus === status ? null : status)
                        }
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            selectedPanelStatus === status && styles.filterChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {status}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {note.panel_groups.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="folder-outline" size={48} color={QatarColors.mutedForeground} />
                <Text style={styles.emptyText}>No panel groups</Text>
                <Text style={styles.emptySubtext}>
                  This note doesn't have any panel groups associated with it.
                </Text>
              </View>
            ) : filteredPanelGroups.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={QatarColors.mutedForeground} />
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptySubtext}>
                  Try adjusting your search query.
                </Text>
              </View>
            ) : (
              <>
                {(panelSearchQuery || selectedPanelStatus) && (
                  <Text style={styles.resultsCount}>
                    Showing {filteredPanelGroups.length} of {note.panel_groups.length} groups
                  </Text>
                )}
                {filteredPanelGroups.map((panelGroup) => {
                  const filtered = getFilteredPanelsForGroup(panelGroup.id);
                  const allPanels = groupPanels[panelGroup.id];

                  return (
                    <View key={panelGroup.id} style={styles.panelGroupCard}>
                      <TouchableOpacity
                        style={styles.panelGroupHeader}
                        onPress={() => toggleGroup(panelGroup.id)}
                      >
                        <View style={styles.panelGroupHeaderContent}>
                          <Ionicons
                            name={expandedGroups.has(panelGroup.id) ? "chevron-up" : "chevron-down"}
                            size={20}
                            color={QatarColors.foreground}
                          />
                          <View style={styles.panelGroupInfo}>
                            <Text style={styles.panelGroupName}>{panelGroup.name}</Text>
                            {panelGroup.description && (
                              <Text style={styles.panelGroupDescription}>{panelGroup.description}</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.panelGroupSummary}>
                        <View style={styles.panelGroupSummaryItem}>
                          <Ionicons name="cube-outline" size={16} color={QatarColors.mutedForeground} />
                          <Text style={styles.panelGroupSummaryText}>
                            {panelGroup.total_panels || 0} panels
                          </Text>
                        </View>
                        <View style={styles.panelGroupSummaryItem}>
                          <Ionicons name="folder-outline" size={16} color={QatarColors.mutedForeground} />
                          <Text style={styles.panelGroupSummaryText}>{panelGroup.project_name}</Text>
                        </View>
                      </View>

                      <View style={styles.panelGroupTotals}>
                        <Text style={styles.panelGroupTotalText}>
                          Total Area: {panelGroup.total_area.toFixed(2)} m²
                        </Text>
                        <Text style={styles.panelGroupTotalText}>
                          Total Amount: {formatQatarRiyal(panelGroup.total_amount)}
                        </Text>
                        <Text style={styles.panelGroupTotalText}>
                          Total Weight: {panelGroup.total_weight.toFixed(2)} kg
                        </Text>
                      </View>

                      {expandedGroups.has(panelGroup.id) && (
                        <View style={styles.panelGroupExpanded}>
                          <View style={styles.panelGroupExpandedHeader}>
                            <Ionicons name="cube-outline" size={16} color={QatarColors.foreground} />
                            <Text style={styles.panelGroupExpandedTitle}>
                              Panels in this Group ({allPanels?.length || 0})
                              {selectedPanelStatus && allPanels && filtered.length !== allPanels.length
                                ? ` · ${filtered.length} matched`
                                : ''}
                            </Text>
                          </View>
                          {!allPanels ? (
                            <View style={styles.loadingPanels}>
                              <ActivityIndicator size="small" color={QatarColors.primary} />
                              <Text style={styles.loadingPanelsText}>Loading panels...</Text>
                            </View>
                          ) : filtered.length === 0 ? (
                            <Text style={styles.noPanelsText}>
                              {allPanels.length === 0
                                ? 'No panels assigned to this group'
                                : 'No panels match the current filter'}
                            </Text>
                          ) : (
                            <View style={styles.panelsList}>
                              {filtered.map((panel) => (
                                <TouchableOpacity
                                  key={panel.id}
                                  style={styles.panelItem}
                                  activeOpacity={0.7}
                                  onPress={() => {
                                    showLoadingOverlay();
                                    navigation.navigate('PanelDetails', { panelId: panel.id });
                                  }}
                                >
                                  <View style={styles.panelItemContent}>
                                    <Text style={styles.panelItemName}>{panel.name}</Text>
                                    <View style={styles.panelItemDetails}>
                                      {panel.buildingName !== 'N/A' && (
                                        <Text style={styles.panelItemDetail}>Building: {panel.buildingName}</Text>
                                      )}
                                      <Text style={styles.panelItemDetail}>Facade: {panel.facadeName}</Text>
                                      <Text style={styles.panelItemDetail}>Elevation: {panel.elevation}</Text>
                                      <Text style={styles.panelItemDetail}>Area: {panel.area} m²</Text>
                                    </View>
                                  </View>
                                  <View style={styles.panelItemRight}>
                                    <View style={[styles.panelItemBadge, { backgroundColor: QatarColors.primary + '40' }]}>
                                      <Text style={[styles.panelItemBadgeText, { color: '#FFFFFF' }]}>
                                        {panel.status}
                                      </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={rf(14)} color={QatarColors.mutedForeground} />
                                  </View>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </View>
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
    marginTop: 10,
    fontSize: rf(14),
    color: QatarColors.mutedForeground,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: rf(16),
    color: QatarColors.foreground,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: QatarColors.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: rf(14),
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: rf(22),
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: rf(13),
    color: QatarColors.mutedForeground,
    marginBottom: 8,
  },
  badgeContainer: {
    marginTop: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
    backgroundColor: QatarColors.card,
  },
  badgeText: {
    fontSize: rf(11),
    color: QatarColors.foreground,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 20,
    gap: 12,
  },
  statCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
    width: '48%',
    minHeight: 100,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statCardTitle: {
    fontSize: rf(12),
    fontWeight: '500',
    color: QatarColors.mutedForeground,
  },
  statCardValue: {
    fontSize: rf(15),
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 4,
  },
  statCardSubtitle: {
    fontSize: rf(11),
    color: QatarColors.mutedForeground,
  },
  mainContentStack: {
    padding: 20,
    gap: 16,
  },
  pipelineCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: rf(16),
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  pipelineContent: {
    gap: 16,
  },
  pipelineItem: {
    marginBottom: 16,
  },
  pipelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pipelineLabel: {
    fontSize: rf(12),
    fontWeight: '500',
    color: QatarColors.foreground,
    flex: 1,
  },
  pipelineCount: {
    fontSize: rf(12),
    color: QatarColors.mutedForeground,
  },
  pipelineBar: {
    height: 8,
    backgroundColor: QatarColors.muted,
    borderRadius: 4,
    marginBottom: 4,
  },
  pipelineFill: {
    height: '100%',
    backgroundColor: QatarColors.primary,
    borderRadius: 4,
  },
  pipelineFillRed: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 4,
  },
  pipelineFillGreen: {
    height: '100%',
    backgroundColor: '#84CC16',
    borderRadius: 4,
  },
  pipelineFillOrange: {
    height: '100%',
    backgroundColor: '#F97316',
    borderRadius: 4,
  },
  pipelinePercentage: {
    fontSize: rf(11),
    color: QatarColors.mutedForeground,
  },
  progressOverviewCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  progressOverviewContent: {
    gap: 16,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: rf(13),
    color: QatarColors.mutedForeground,
    textAlign: 'center',
  },
  progressOverviewData: {
    gap: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressSubtitle: {
    fontSize: rf(13),
    color: QatarColors.mutedForeground,
  },
  progressPercentage: {
    fontSize: rf(14),
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  pieChartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pieChart: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  pieChartCenter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: QatarColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  pieChartText: {
    fontSize: rf(14),
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  pieChartSubtext: {
    fontSize: rf(10),
    color: QatarColors.mutedForeground,
    marginTop: 2,
  },
  donutLegend: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    fontSize: rf(12),
    color: QatarColors.mutedForeground,
  },
  legendValue: {
    fontSize: rf(12),
    fontWeight: '500',
    color: QatarColors.foreground,
  },
  legendTotals: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: QatarColors.border,
    gap: 4,
  },
  legendTotalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendTotalLabel: {
    fontSize: rf(12),
    color: QatarColors.mutedForeground,
  },
  legendTotalValue: {
    fontSize: rf(12),
    fontWeight: '500',
    color: QatarColors.foreground,
  },
  projectTotalsCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  projectTotalsContent: {
    gap: 16,
  },
  totalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: QatarColors.accent,
    borderRadius: 8,
  },
  totalItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  totalItemLabel: {
    fontSize: rf(10),
    fontWeight: '500',
    color: QatarColors.mutedForeground,
    textTransform: 'uppercase',
  },
  totalItemValue: {
    fontSize: rf(14),
    fontWeight: 'bold',
    color: QatarColors.foreground,
    textAlign: 'center',
  },
  efficiencyCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  efficiencyContent: {
    gap: 12,
  },
  efficiencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  efficiencyLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  efficiencyIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  efficiencyLabel: {
    fontSize: rf(13),
    color: QatarColors.foreground,
  },
  efficiencyBadge: {
    backgroundColor: QatarColors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  efficiencyBadgeText: {
    fontSize: rf(11),
    fontWeight: '500',
    color: QatarColors.foreground,
  },
  panelGroupsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: rf(16),
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 16,
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
  filterChipsContainer: {
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
  panelGroupCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  panelGroupHeader: {
    marginBottom: 12,
  },
  panelGroupHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  panelGroupInfo: {
    flex: 1,
  },
  panelGroupName: {
    fontSize: rf(16),
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 4,
  },
  panelGroupDescription: {
    fontSize: rf(12),
    color: QatarColors.mutedForeground,
  },
  panelGroupSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  panelGroupSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  panelGroupSummaryText: {
    fontSize: rf(12),
    color: QatarColors.mutedForeground,
    flexShrink: 1,
  },
  panelGroupTotals: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: QatarColors.border,
    gap: 4,
  },
  panelGroupTotalText: {
    fontSize: rf(12),
    color: QatarColors.mutedForeground,
  },
  panelGroupExpanded: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: QatarColors.border,
  },
  panelGroupExpandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  panelGroupExpandedTitle: {
    fontSize: rf(14),
    fontWeight: '600',
    color: QatarColors.foreground,
  },
  loadingPanels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingPanelsText: {
    fontSize: rf(13),
    color: QatarColors.mutedForeground,
  },
  noPanelsText: {
    fontSize: rf(13),
    color: QatarColors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 20,
  },
  panelsList: {
    gap: 8,
  },
  panelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: QatarColors.accent,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  panelItemContent: {
    flex: 1,
    marginRight: 8,
  },
  panelItemName: {
    fontSize: rf(14),
    fontWeight: '600',
    color: QatarColors.foreground,
    marginBottom: 4,
  },
  panelItemDetails: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  panelItemDetail: {
    fontSize: rf(11),
    color: QatarColors.mutedForeground,
  },
  panelItemRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  panelItemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  panelItemBadgeText: {
    fontSize: rf(11),
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: rf(14),
    color: QatarColors.mutedForeground,
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: rf(12),
    color: QatarColors.mutedForeground,
    marginTop: 8,
    textAlign: 'center',
  },
});
