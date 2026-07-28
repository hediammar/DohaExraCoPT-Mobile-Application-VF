import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { ProjectScreenNavigationProp } from '../../types/navigation';
import { QatarColors, PanelStatusColors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { useLoadingOverlay } from '../../contexts/LoadingOverlayContext';
import { NavigationBar } from '../../components/NavigationBar';

interface Building {
  id: string;
  name: string;
  project_id: string;
  project_name: string;
  customer_name: string;
  location: string;
  status: number;
  description?: string;
  total_area: number;
  total_amount: number;
  total_weight: number;
  total_panels: number;
  facade_count: number;
}

interface Facade {
  id: string;
  name: string;
  building_id: string;
  panel_count: number;
  total_area: number;
  total_amount: number;
  total_weight: number;
  status: number;
  description?: string;
}

interface Panel {
  id: string;
  name: string;
  type: number;
  status: number;
  project_id: string;
  building_id?: string;
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

interface BuildingDetailsScreenProps {
  navigation: ProjectScreenNavigationProp;
  route: {
    params: {
      buildingId: string;
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

// Helpers to draw pie slices with SVG
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

export default function BuildingDetailsScreen({ navigation, route }: BuildingDetailsScreenProps) {
  const { buildingId } = route.params;
  const { user: currentUser } = useAuth();
  const { showToast } = useToastContext();
  const { showLoadingOverlay, hideLoadingOverlay } = useLoadingOverlay();
  const [building, setBuilding] = useState<Building | null>(null);
  const [facades, setFacades] = useState<Facade[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'facades' | 'panels'>('overview');
  
  // Panel status counts for charts
  const [panelStatusCounts, setPanelStatusCounts] = useState<Record<string, number>>({});
  const [totalPanels, setTotalPanels] = useState<number>(0);
  
  // Calculated totals
  const [calculatedTotals, setCalculatedTotals] = useState({
    total_area: 0,
    total_amount: 0,
    total_weight: 0,
    total_panels: 0
  });

  useEffect(() => {
    fetchBuildingDetails();
  }, [buildingId]);

  const fetchBuildingDetails = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchBuilding(),
        fetchFacades(),
        fetchPanels(),
        fetchPanelStatusCounts()
      ]);
    } catch (error) {
      console.error('Error fetching building details:', error);
      showToast('Error loading building details', 'error');
    } finally {
      setLoading(false);
      hideLoadingOverlay();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBuildingDetails();
    setRefreshing(false);
  };

  const fetchBuilding = async () => {
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select(`
          *,
          projects (
            name,
            location,
            estimated_panels,
            customers (name)
          )
        `)
        .eq('id', buildingId)
        .single();

      if (error) {
        console.error('Error fetching building:', error);
        return;
      }

      setBuilding({
        id: data.id,
        name: data.name,
        project_id: data.project_id,
        project_name: data.projects?.name || 'No Project',
        customer_name: data.projects?.customers?.name || 'No Customer',
        location: data.projects?.location || 'Unknown',
        status: data.status || 0,
        description: data.description,
        total_area: 0, // Will be calculated from panels
        total_amount: 0, // Will be calculated from panels
        total_weight: 0, // Will be calculated from panels
        total_panels: 0, // Will be calculated from panels
        facade_count: 0 // Will be calculated from facades
      });
    } catch (error) {
      console.error('Error fetching building:', error);
    }
  };

  const fetchPanelStatusCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('panels')
        .select('status')
        .eq('building_id', buildingId);

      if (error) {
        console.error('Error fetching panel statuses:', error);
        return;
      }

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        const statusName = PANEL_STATUSES[row.status] || 'Unknown';
        counts[statusName] = (counts[statusName] || 0) + 1;
      }
      setPanelStatusCounts(counts);
      setTotalPanels(data?.length || 0);
    } catch (error) {
      console.error('Error fetching panel status counts:', error);
    }
  };

  const fetchFacades = async () => {
    try {
      const { data, error } = await supabase
        .from('facades')
        .select(`
          id,
          name,
          building_id,
          status,
          description,
          panels (id, ifp_qty_area_sm, unit_rate_qr_m2, weight)
        `)
        .eq('building_id', buildingId);

      if (error) {
        console.error('Error fetching facades:', error);
        return;
      }

      const facadesWithCounts = data?.map(facade => {
        const panels = facade.panels || [];
        const total_area = panels.reduce((sum: number, panel: any) => sum + (panel.ifp_qty_area_sm || 0), 0);
        const total_amount = panels.reduce((sum: number, panel: any) => {
          const area = panel.ifp_qty_area_sm || 0;
          const rate = panel.unit_rate_qr_m2 || 0;
          return sum + (area * rate);
        }, 0);
        const total_weight = panels.reduce((sum: number, panel: any) => sum + (panel.weight || 0), 0);

        return {
          id: facade.id,
          name: facade.name,
          building_id: facade.building_id,
          status: facade.status || 0,
          description: facade.description,
          panel_count: panels.length,
          total_area,
          total_amount,
          total_weight
        };
      }) || [];

      setFacades(facadesWithCounts);
    } catch (error) {
      console.error('Error fetching facades:', error);
    }
  };

  const fetchPanels = async () => {
    try {
      const { data, error } = await supabase
        .from('panels')
        .select(`
          id,
          name,
          type,
          status,
          project_id,
          building_id,
          facade_id,
          facades (name),
          issue_transmittal_no,
          drawing_number,
          unit_rate_qr_m2,
          ifp_qty_area_sm,
          ifp_qty_nos,
          weight,
          dimension,
          issued_for_production_date
        `)
        .eq('building_id', buildingId)
        .order('name');

      if (error) {
        console.error('Error fetching panels:', error);
        return;
      }

      const panelsWithNames = data?.map(panel => ({
        id: panel.id,
        name: panel.name,
        type: panel.type,
        status: panel.status,
        project_id: panel.project_id,
        building_id: panel.building_id,
        facade_id: panel.facade_id,
        facade_name: (panel.facades as any)?.name,
        issue_transmittal_no: panel.issue_transmittal_no,
        drawing_number: panel.drawing_number,
        unit_rate_qr_m2: panel.unit_rate_qr_m2,
        ifp_qty_area_sm: panel.ifp_qty_area_sm,
        ifp_qty_nos: panel.ifp_qty_nos,
        weight: panel.weight,
        dimension: panel.dimension,
        issued_for_production_date: panel.issued_for_production_date
      })) || [];

      setPanels(panelsWithNames);

      // Calculate building totals
      const total_area = panelsWithNames.reduce((sum, panel) => sum + (panel.ifp_qty_area_sm || 0), 0);
      const total_amount = panelsWithNames.reduce((sum, panel) => {
        const area = panel.ifp_qty_area_sm || 0;
        const rate = panel.unit_rate_qr_m2 || 0;
        return sum + (area * rate);
      }, 0);
      const total_weight = panelsWithNames.reduce((sum, panel) => sum + (panel.weight || 0), 0);
      const total_panels = panelsWithNames.length;

      // Update calculated totals state
      setCalculatedTotals({
        total_area,
        total_amount,
        total_weight,
        total_panels
      });

      setBuilding(prev => prev ? {
        ...prev,
        total_area,
        total_amount,
        total_weight,
        total_panels,
        facade_count: facades.length
      } : null);
    } catch (error) {
      console.error('Error fetching panels:', error);
    }
  };

  const getStatusBadge = (status: number) => {
    const statusConfig = {
      0: { color: QatarColors.muted, label: "Inactive" },
      1: { color: QatarColors.chart1, label: "Active" },
      2: { color: QatarColors.chart4, label: "On Hold" },
      3: { color: QatarColors.chart2, label: "Completed" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { color: QatarColors.muted, label: "Unknown" };

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
        <Text style={styles.statusBadgeText}>{config.label}</Text>
      </View>
    );
  };

  const getPanelStatusBadge = (status: number) => {
    const statusColors = {
      0: QatarColors.chart1, // Issued For Production
      1: QatarColors.chart2, // Produced
      2: QatarColors.chart3, // Proceed for Delivery
      3: QatarColors.chart3, // Delivered
      4: QatarColors.chart2, // Approved Material
      5: QatarColors.destructive, // Rejected Material
      6: QatarColors.chart2, // Installed
      7: QatarColors.chart4, // Inspected
      8: QatarColors.chart2, // Approved Final
      9: QatarColors.chart4, // On Hold
      10: QatarColors.muted, // Cancelled
      11: QatarColors.destructive, // Broken at Site
    };

    const color = statusColors[status as keyof typeof statusColors] || QatarColors.muted;
    const statusName = PANEL_STATUSES[status] || 'Unknown';

    return (
      <View style={[styles.panelStatusBadge, { backgroundColor: color }]}>
        <Text style={styles.panelStatusBadgeText}>{statusName}</Text>
      </View>
    );
  };

  const formatQatarRiyal = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "QAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const handlePanelPress = (panel: Panel) => {
    showLoadingOverlay();
    navigation.navigate('PanelDetails', { panelId: panel.id });
  };

  const handleFacadePress = (facade: Facade) => {
    showLoadingOverlay();
    navigation.navigate('FacadeDetails', { facadeId: facade.id });
  };

  const renderOverview = () => {
    if (!building) return null;

    // Calculate the main status categories for the donut chart
    const issuedForProduction = panelStatusCounts['Issued For Production'] || 0;
    const factoryStock = panelStatusCounts['Produced'] || 0;
    const siteStock = panelStatusCounts['Delivered'] || 0;
    const installed = panelStatusCounts['Installed'] || 0;
    
    // Calculate "Rest" - all other statuses not in the main 4 categories
    const mainStatuses = ['Issued For Production', 'Produced', 'Delivered', 'Installed'];
    const mainStatusCount = mainStatuses.reduce((sum, status) => sum + (panelStatusCounts[status] || 0), 0);
    const restCount = totalPanels - mainStatusCount;

    // Calculate manufacturing pipeline progress
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

    const approvedFinalProgress = getManufacturingProgress([
      'Approved Final'
    ]);

    const onHoldProgress = getManufacturingProgress(['On Hold']);

    return (
      <View style={styles.tabContent}>
        {/* Building Header */}
        <View style={styles.buildingHeader}>
          <View style={styles.buildingTitleContainer}>
            <Text style={styles.buildingTitle}>{building.name}</Text>
            {getStatusBadge(building.status)}
          </View>
        </View>

        {/* Building Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Project Card */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>Project</Text>
              <Ionicons name="business" size={16} color={QatarColors.mutedForeground} />
            </View>
            <Text style={styles.statCardValue}>{building.project_name}</Text>
            <Text style={styles.statCardSubtitle}>{building.customer_name}</Text>
          </View>

          {/* Location Card */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>Location</Text>
              <Ionicons name="location" size={16} color={QatarColors.mutedForeground} />
            </View>
            <Text style={styles.statCardValue}>{building.location}</Text>
            <Text style={styles.statCardSubtitle}>Project Site</Text>
          </View>

          {/* Description Card */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>Description</Text>
              <Ionicons name="document-text" size={16} color={QatarColors.mutedForeground} />
            </View>
            <Text style={styles.statCardValue}>
              {building.description || "No description provided"}
            </Text>
            <Text style={styles.statCardSubtitle}>Building Details</Text>
          </View>

          {/* Facades Count Card */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>Facades</Text>
              <Ionicons name="layers" size={16} color={QatarColors.mutedForeground} />
            </View>
            <Text style={styles.statCardValue}>{building.facade_count}</Text>
            <Text style={styles.statCardSubtitle}>Total Facades</Text>
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
                  <Text style={styles.pipelineCount}>
                    {issuedProgress.count} / {totalPanels}
                  </Text>
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
                  <Text style={styles.pipelineCount}>
                    {producedProgress.count} / {totalPanels}
                  </Text>
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
                  <Text style={styles.pipelineCount}>
                    {deliveryProgress.count} / {totalPanels}
                  </Text>
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
                  <Text style={styles.pipelineCount}>
                    {deliveredProgress.count} / {totalPanels}
                  </Text>
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
                  <Text style={styles.pipelineCount}>
                    {installationProgress.count} / {totalPanels}
                  </Text>
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
                  <Text style={styles.pipelineCount}>
                    {inspectedProgress.count} / {totalPanels}
                  </Text>
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
                  <Text style={styles.pipelineCount}>
                    {approvedFinalProgress.count} / {totalPanels}
                  </Text>
                </View>
                <View style={styles.pipelineBar}>
                  <View
                    style={[
                      styles.pipelineFill,
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
                  <Text style={styles.pipelineCount}>
                    {onHoldProgress.count} / {totalPanels}
                  </Text>
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
                  <Text style={styles.noDataText}>No panels yet for this building</Text>
                </View>
              ) : (
                <View style={styles.progressOverviewData}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressSubtitle}>Status Distribution</Text>
                    <Text style={styles.progressPercentage}>{totalPanels} Total</Text>
                  </View>
                  <View style={styles.pieChartContainer}>
                    {/* Simple Pie Chart with Status Distribution */}
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
                            let startAngle = -90; // start at top
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
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Building Totals */}
          <View style={styles.buildingTotalsCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="business" size={20} color={QatarColors.foreground} />
              <Text style={styles.cardTitle}>Building Totals</Text>
            </View>
            <View style={styles.buildingTotalsContent}>
              <View style={styles.totalsGrid}>
                <View style={styles.totalItem}>
                  <View style={styles.totalItemHeader}>
                    <Ionicons name="square" size={16} color={QatarColors.mutedForeground} />
                    <Text style={styles.totalItemLabel}>Total Area</Text>
                  </View>
                  <Text style={styles.totalItemValue}>
                    {calculatedTotals.total_area.toFixed(2)} m²
                  </Text>
                </View>
                <View style={styles.totalItem}>
                  <View style={styles.totalItemHeader}>
                    <Ionicons name="cash" size={16} color={QatarColors.mutedForeground} />
                    <Text style={styles.totalItemLabel}>Total Amount</Text>
                  </View>
                  <Text style={styles.totalItemValue}>
                    {formatQatarRiyal(calculatedTotals.total_amount)}
                  </Text>
                </View>
                <View style={styles.totalItem}>
                  <View style={styles.totalItemHeader}>
                    <Ionicons name="scale" size={16} color={QatarColors.mutedForeground} />
                    <Text style={styles.totalItemLabel}>Total Weight</Text>
                  </View>
                  <Text style={styles.totalItemValue}>
                    {calculatedTotals.total_weight.toFixed(2)} kg
                  </Text>
                </View>
                <View style={styles.totalItem}>
                  <View style={styles.totalItemHeader}>
                    <Ionicons name="cube" size={16} color={QatarColors.mutedForeground} />
                    <Text style={styles.totalItemLabel}>Total Panels</Text>
                  </View>
                  <Text style={styles.totalItemValue}>{calculatedTotals.total_panels}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Efficiency Metrics */}
          <View style={styles.efficiencyCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="time" size={20} color={QatarColors.foreground} />
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
        </View>
      </View>
    );
  };

  const renderFacades = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Facades ({facades.length})</Text>
      {facades.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="layers" size={48} color={QatarColors.mutedForeground} />
          <Text style={styles.emptyText}>No facades found</Text>
        </View>
      ) : (
        facades.map((facade) => (
          <TouchableOpacity key={facade.id} style={styles.facadeCard} onPress={() => handleFacadePress(facade)}>
            <View style={styles.facadeHeader}>
              <Text style={styles.facadeName}>{facade.name}</Text>
              {facade.description && (
                <Text style={styles.facadeDescription}>{facade.description}</Text>
              )}
            </View>
            <View style={styles.facadeInfo}>
              <View style={styles.facadeStat}>
                <Ionicons name="cube" size={16} color={QatarColors.mutedForeground} />
                <Text style={styles.facadeStatText}>{facade.panel_count} Panels</Text>
              </View>
            </View>
            <View style={styles.facadeTotals}>
              <View style={styles.facadeTotalItem}>
                <Ionicons name="square" size={14} color={QatarColors.primary} />
                <Text style={styles.facadeTotalLabel}>Area</Text>
                <Text style={styles.facadeTotalValue}>{(facade.total_area || 0).toFixed(1)} m²</Text>
              </View>
              <View style={styles.facadeTotalItem}>
                <Ionicons name="cash" size={14} color={QatarColors.chart2} />
                <Text style={styles.facadeTotalLabel}>Amount</Text>
                <Text style={styles.facadeTotalValue}>{formatQatarRiyal(facade.total_amount || 0)}</Text>
              </View>
              <View style={styles.facadeTotalItem}>
                <Ionicons name="scale" size={14} color={QatarColors.chart4} />
                <Text style={styles.facadeTotalLabel}>Weight</Text>
                <Text style={styles.facadeTotalValue}>{(facade.total_weight || 0).toFixed(1)} kg</Text>
              </View>
            </View>
            <View style={styles.facadeNavigation}>
              <Ionicons name="chevron-forward" size={16} color={QatarColors.mutedForeground} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderPanels = () => {
    return (
      <View style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Panels ({panels.length})</Text>
        
        {panels.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube" size={48} color={QatarColors.mutedForeground} />
            <Text style={styles.emptyText}>No panels found</Text>
          </View>
        ) : (
          panels.map((panel) => (
            <TouchableOpacity key={panel.id} style={styles.panelCard} onPress={() => handlePanelPress(panel)}>
              <View style={styles.panelHeader}>
                <View style={styles.panelHeaderContent}>
                  <Text style={styles.panelName}>{panel.name}</Text>
                  {getPanelStatusBadge(panel.status)}
                </View>
                <Ionicons name="chevron-forward" size={16} color={QatarColors.mutedForeground} />
              </View>
              
              <View style={styles.panelInfo}>
                {panel.facade_name ? (
                  <Text style={styles.panelLocation}>Facade: {panel.facade_name}</Text>
                ) : null}
                {panel.dimension ? (
                  <Text style={styles.panelDimension}>Dimension: {panel.dimension}</Text>
                ) : null}
                {panel.ifp_qty_area_sm ? (
                  <Text style={styles.panelDimension}>Area: {panel.ifp_qty_area_sm} m²</Text>
                ) : null}
                {panel.weight ? (
                  <Text style={styles.panelDimension}>Weight: {panel.weight} kg</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={QatarColors.primary} />
        <Text style={styles.loadingText}>Loading building details...</Text>
      </View>
    );
  }

  if (!building) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={QatarColors.destructive} />
        <Text style={styles.errorText}>Building not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.errorText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={QatarColors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{building.name}</Text>
          <Text style={styles.headerSubtitle}>BLD-{building.id.slice(-4).toUpperCase()}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'facades' && styles.activeTab]}
            onPress={() => setActiveTab('facades')}
          >
            <Text style={[styles.tabText, activeTab === 'facades' && styles.activeTabText]}>
              Facades ({facades.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'panels' && styles.activeTab]}
            onPress={() => setActiveTab('panels')}
          >
            <Text style={[styles.tabText, activeTab === 'panels' && styles.activeTabText]}>
              Panels ({panels.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[QatarColors.primary]}
            tintColor={QatarColors.primary}
          />
        }
      >
        {activeTab === 'overview' ? renderOverview() : null}
        {activeTab === 'facades' ? renderFacades() : null}
        {activeTab === 'panels' ? renderPanels() : null}
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
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: QatarColors.foreground,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50, // Add extra space for status bar
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  headerSubtitle: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
    marginTop: 2,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: QatarColors.primary,
  },
  tabText: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
    fontWeight: '500',
  },
  activeTabText: {
    color: QatarColors.primary,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: QatarColors.foreground,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: QatarColors.mutedForeground,
    marginTop: 12,
    textAlign: 'center',
  },
  facadeCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  facadeHeader: {
    marginBottom: 8,
  },
  facadeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  facadeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  facadeStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  facadeStatText: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
    marginLeft: 4,
  },
  facadeDescription: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
    marginTop: 4,
    fontStyle: 'italic',
  },
  facadeTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: QatarColors.border,
  },
  facadeTotalItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: QatarColors.accent,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  facadeTotalLabel: {
    fontSize: 10,
    color: QatarColors.mutedForeground,
    marginTop: 2,
    marginBottom: 2,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  facadeTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    textAlign: 'center',
  },
  facadeNavigation: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -8 }],
  },
  panelCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  panelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    flex: 1,
  },
  panelStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  panelStatusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: QatarColors.foreground,
  },
  panelInfo: {
    marginTop: 4,
  },
  panelLocation: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
    marginBottom: 2,
  },
  panelDimension: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
  },
  panelHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // New styles for enhanced UI matching web app
  buildingHeader: {
    marginBottom: 24,
  },
  buildingTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  buildingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
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
    fontSize: 14,
    fontWeight: '500',
    color: QatarColors.mutedForeground,
  },
  statCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 4,
  },
  statCardSubtitle: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
  },
  mainContentStack: {
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
    fontSize: 18,
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
    fontSize: 14,
    fontWeight: '500',
    color: QatarColors.foreground,
    flex: 1,
  },
  pipelineCount: {
    fontSize: 14,
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
  pipelineFillOrange: {
    height: '100%',
    backgroundColor: '#F97316',
    borderRadius: 4,
  },
  pipelinePercentage: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
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
    fontSize: 14,
    color: QatarColors.foreground,
  },
  efficiencyBadge: {
    backgroundColor: QatarColors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  efficiencyBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: QatarColors.foreground,
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
    fontSize: 14,
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
    fontSize: 14,
    color: QatarColors.mutedForeground,
  },
  progressPercentage: {
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  pieChartSubtext: {
    fontSize: 12,
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
    fontSize: 14,
    color: QatarColors.mutedForeground,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '500',
    color: QatarColors.foreground,
  },
  buildingTotalsCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  buildingTotalsContent: {
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
    fontSize: 12,
    fontWeight: '500',
    color: QatarColors.mutedForeground,
    textTransform: 'uppercase',
  },
  totalItemValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    textAlign: 'center',
  },
});
