import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  InteractionManager,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { ProjectScreenNavigationProp } from '../../types/navigation';
import { QatarColors, PanelStatusColors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { useLoadingOverlay } from '../../contexts/LoadingOverlayContext';
import { StatusChangeDialog } from '../../components/StatusChangeDialog';
import { NavigationBar } from '../../components/NavigationBar';
import { isCustomerRole, UserRole } from '../../utils/rolePermissions';

interface Project {
  id: string;
  name: string;
  customer_id: string | null;
  customer_name: string;
  location: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "completed" | "on-hold";
  estimated_cost: number;
  estimated_panels: number;
  actual_panels: number;
  total_area: number;
  total_amount: number;
  total_weight: number;
}

interface Building {
  id: string;
  name: string;
  project_id: string;
  facade_count: number;
  panel_count: number;
  total_area: number;
  total_amount: number;
  total_weight: number;
  status: number;
  description?: string;
}

interface Facade {
  id: string;
  name: string;
  building_id: string;
  building_name: string;
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

interface ProjectDetailsScreenProps {
  navigation: ProjectScreenNavigationProp;
  route: {
    params: {
      projectId: string;
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

const PANEL_TYPES = ['GRC', 'GRG', 'GRP', 'EIFS', 'UHPC'];

type FilterValue = string;

interface FilterOption {
  value: FilterValue;
  label: string;
}

const mapPanelType = (typeValue: number): string => {
  return PANEL_TYPES[typeValue] || `Type ${typeValue}`;
};

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

export default function ProjectDetailsScreen({ navigation, route }: ProjectDetailsScreenProps) {
  const { projectId } = route.params;
  const { user: currentUser } = useAuth();
  const { showToast } = useToastContext();
  const { showLoadingOverlay, hideLoadingOverlay } = useLoadingOverlay();
  const [project, setProject] = useState<Project | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [facades, setFacades] = useState<Facade[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'buildings' | 'facades' | 'panels'>('overview');
  
  // Panel status counts for charts
  const [panelStatusCounts, setPanelStatusCounts] = useState<Record<string, number>>({});
  const [totalPanels, setTotalPanels] = useState<number>(0);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');
  const [typeFilter, setTypeFilter] = useState<FilterValue>('all');
  const [projectFilter, setProjectFilter] = useState<FilterValue>('all');
  const [buildingFilter, setBuildingFilter] = useState<FilterValue>('all');
  const [facadeFilter, setFacadeFilter] = useState<FilterValue>('all');
  
  // Status change dialog
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null);
  const [showStatusFilterModal, setShowStatusFilterModal] = useState(false);
  const [showTypeFilterModal, setShowTypeFilterModal] = useState(false);
  const [showProjectFilterModal, setShowProjectFilterModal] = useState(false);
  const [showBuildingFilterModal, setShowBuildingFilterModal] = useState(false);
  const [showFacadeFilterModal, setShowFacadeFilterModal] = useState(false);

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchProject(),
        fetchBuildings(),
        fetchFacades(),
        fetchPanels(),
        fetchPanelStatusCounts()
      ]);
    } catch (error) {
      console.error('Error fetching project details:', error);
      showToast('Error loading project details', 'error');
    } finally {
      setLoading(false);
      hideLoadingOverlay();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProjectDetails();
    setRefreshing(false);
  };

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          customers (name)
        `)
        .eq('id', projectId)
        .single();

      if (error) {
        console.error('Error fetching project:', error);
        return;
      }

      // Calculate totals from panels data
      const panelQuery = supabase
        .from('panels')
        .select('unit_rate_qr_m2, ifp_qty_area_sm, weight')
        .eq('project_id', projectId);

      const { data: panelsData, error: panelError } = await panelQuery;

      if (panelError) {
        console.error('Error fetching panel data for project:', projectId, panelError);
      }

      const total_area = panelsData?.reduce((sum, panel) => sum + (panel.ifp_qty_area_sm || 0), 0) || 0;
      const total_amount = panelsData?.reduce((sum, panel) => {
        const area = panel.ifp_qty_area_sm || 0;
        const rate = panel.unit_rate_qr_m2 || 0;
        return sum + (area * rate);
      }, 0) || 0;
      const total_weight = panelsData?.reduce((sum, panel) => sum + (panel.weight || 0), 0) || 0;
      const actual_panels = panelsData?.length || 0;

      setProject({
        id: data.id,
        name: data.name,
        customer_id: data.customer_id,
        customer_name: data.customers?.name || 'No Customer',
        location: data.location,
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status,
        estimated_cost: data.estimated_cost,
        estimated_panels: data.estimated_panels,
        actual_panels,
        total_area,
        total_amount,
        total_weight
      });
    } catch (error) {
      console.error('Error fetching project:', error);
    }
  };

  const fetchPanelStatusCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('panels')
        .select('status')
        .eq('project_id', projectId);

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

  const fetchBuildings = async () => {
    try {
      // Check if current user is a customer and implement data filtering
      const isCustomer = currentUser?.role ? isCustomerRole(currentUser.role as UserRole) : false;
      
      let query = supabase
        .from('buildings')
        .select(`
          id,
          name,
          project_id,
          status,
          description,
          facades (id),
          panels (id, ifp_qty_area_sm, unit_rate_qr_m2, weight)
        `)
        .eq('project_id', projectId);
      
      // For customer users, we need to ensure they can only see buildings from their own projects
      // This is already filtered by project_id, but we add an extra check for security
      if (isCustomer && currentUser?.customer_id) {
        // First check if the project belongs to the customer
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('customer_id')
          .eq('id', projectId)
          .single();
        
        if (projectError || !projectData || projectData.customer_id !== currentUser.customer_id) {
          console.log('Customer trying to access project not belonging to them');
          return;
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching buildings:', error);
        return;
      }

      const buildingsWithCounts = data?.map(building => {
        const panels = building.panels || [];
        const total_area = panels.reduce((sum: number, panel: any) => sum + (panel.ifp_qty_area_sm || 0), 0);
        const total_amount = panels.reduce((sum: number, panel: any) => {
          const area = panel.ifp_qty_area_sm || 0;
          const rate = panel.unit_rate_qr_m2 || 0;
          return sum + (area * rate);
        }, 0);
        const total_weight = panels.reduce((sum: number, panel: any) => sum + (panel.weight || 0), 0);

        return {
          id: building.id,
          name: building.name,
          project_id: building.project_id,
          status: building.status || 0,
          description: building.description,
          facade_count: building.facades?.length || 0,
          panel_count: panels.length,
          total_area,
          total_amount,
          total_weight
        };
      }) || [];

      setBuildings(buildingsWithCounts);
    } catch (error) {
      console.error('Error fetching buildings:', error);
    }
  };

  const fetchFacades = async () => {
    try {
      // Check if current user is a customer and implement data filtering
      const isCustomer = currentUser?.role ? isCustomerRole(currentUser.role as UserRole) : false;
      
      let query = supabase
        .from('facades')
        .select(`
          id,
          name,
          building_id,
          status,
          description,
          buildings!inner (name, project_id),
          panels (id, ifp_qty_area_sm, unit_rate_qr_m2, weight)
        `)
        .eq('buildings.project_id', projectId);
      
      // For customer users, we need to ensure they can only see facades from their own projects
      if (isCustomer && currentUser?.customer_id) {
        // First check if the project belongs to the customer
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('customer_id')
          .eq('id', projectId)
          .single();
        
        if (projectError || !projectData || projectData.customer_id !== currentUser.customer_id) {
          console.log('Customer trying to access project not belonging to them');
          return;
        }
      }

      const { data, error } = await query;

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
          building_name: (facade.buildings as any)?.name || 'Unknown Building',
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
      // Check if current user is a customer and implement data filtering
      const isCustomer = currentUser?.role ? isCustomerRole(currentUser.role as UserRole) : false;
      
      let query = supabase
        .from('panels')
        .select(`
          id,
          name,
          type,
          status,
          project_id,
          building_id,
          buildings (name),
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
        .eq('project_id', projectId)
        .order('name');
      
      // For customer users, we need to ensure they can only see panels from their own projects
      if (isCustomer && currentUser?.customer_id) {
        // First check if the project belongs to the customer
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('customer_id')
          .eq('id', projectId)
          .single();
        
        if (projectError || !projectData || projectData.customer_id !== currentUser.customer_id) {
          console.log('Customer trying to access project not belonging to them');
          return;
        }
      }

      const { data, error } = await query;

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
        building_name: (panel.buildings as any)?.name,
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
    } catch (error) {
      console.error('Error fetching panels:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: QatarColors.chart1, label: "Active" },
      completed: { color: QatarColors.chart2, label: "Completed" },
      "on-hold": { color: QatarColors.chart4, label: "On Hold" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { color: QatarColors.muted, label: status };

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

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return `QAR ${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0)}`;
  };

  const formatQatarRiyal = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "QAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const handlePanelPress = useCallback((panel: Panel) => {
    showLoadingOverlay();
    // Defer navigation so overlay has time to render first
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        navigation.navigate('PanelDetails', { panelId: panel.id });
      }, 80);
    });
  }, [showLoadingOverlay, navigation]);

  const handleBuildingPress = useCallback((building: Building) => {
    showLoadingOverlay();
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => navigation.navigate('BuildingDetails', { buildingId: building.id }), 80);
    });
  }, [showLoadingOverlay, navigation]);

  const handleFacadePress = useCallback((facade: Facade) => {
    showLoadingOverlay();
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => navigation.navigate('FacadeDetails', { facadeId: facade.id }), 80);
    });
  }, [showLoadingOverlay, navigation]);

  const handleStatusChange = (panel: Panel) => {
    setSelectedPanel(panel);
    setIsStatusDialogOpen(true);
  };

  const handleStatusChanged = () => {
    // Refresh all data when status is changed
    fetchProjectDetails();
  };

  const panelRows = useMemo(() => {
    return panels.map((panel) => ({
      ...panel,
      statusLabel: PANEL_STATUSES[panel.status] || 'Unknown',
      typeLabel: mapPanelType(panel.type),
      projectName: project?.name || 'Unknown Project',
    }));
  }, [panels, project?.name]);

  const sortedDedupeOptions = useCallback((options: FilterOption[]) => {
    const seen = new Map<string, string>();
    options.forEach((option) => {
      if (!option.value || seen.has(option.value)) return;
      seen.set(option.value, option.label);
    });
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const statusOptions = useMemo<FilterOption[]>(
    () => PANEL_STATUSES.map((status) => ({ value: status, label: status })),
    []
  );

  const typeOptions = useMemo<FilterOption[]>(
    () => PANEL_TYPES.map((type) => ({ value: type, label: type })),
    []
  );

  const projectOptions = useMemo(() => {
    const source = panelRows.map((panel) => ({
      value: panel.project_id,
      label: panel.projectName,
    }));
    return sortedDedupeOptions(source);
  }, [panelRows, sortedDedupeOptions]);

  const buildingOptions = useMemo(() => {
    const scoped = panelRows.filter((panel) => projectFilter === 'all' || panel.project_id === projectFilter);
    const source = scoped
      .filter((panel) => panel.building_id)
      .map((panel) => ({
        value: panel.building_id as string,
        label: panel.building_name || 'Unknown Building',
      }));
    return sortedDedupeOptions(source);
  }, [panelRows, projectFilter, sortedDedupeOptions]);

  const facadeOptions = useMemo(() => {
    const scoped = panelRows.filter((panel) => {
      if (projectFilter !== 'all' && panel.project_id !== projectFilter) return false;
      if (buildingFilter !== 'all' && panel.building_id !== buildingFilter) return false;
      return true;
    });
    const source = scoped
      .filter((panel) => panel.facade_id)
      .map((panel) => ({
        value: panel.facade_id as string,
        label: panel.facade_name || 'Unknown Facade',
      }));
    return sortedDedupeOptions(source);
  }, [panelRows, projectFilter, buildingFilter, sortedDedupeOptions]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const hasActiveFilters = [
    normalizedSearch,
    statusFilter !== 'all' ? statusFilter : '',
    typeFilter !== 'all' ? typeFilter : '',
    projectFilter !== 'all' ? projectFilter : '',
    buildingFilter !== 'all' ? buildingFilter : '',
    facadeFilter !== 'all' ? facadeFilter : '',
  ].filter(Boolean).length > 0;
  const activeFiltersCount = [
    normalizedSearch,
    statusFilter !== 'all' ? statusFilter : '',
    typeFilter !== 'all' ? typeFilter : '',
    projectFilter !== 'all' ? projectFilter : '',
    buildingFilter !== 'all' ? buildingFilter : '',
    facadeFilter !== 'all' ? facadeFilter : '',
  ].filter(Boolean).length;

  const buildingDisabled = projectFilter === 'all';
  const facadeDisabled = projectFilter === 'all' || buildingFilter === 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setProjectFilter('all');
    setBuildingFilter('all');
    setFacadeFilter('all');
  };

  const handleProjectFilterChange = (value: FilterValue) => {
    setProjectFilter(value);
    setBuildingFilter('all');
    setFacadeFilter('all');
  };

  const handleBuildingFilterChange = (value: FilterValue) => {
    setBuildingFilter(value);
    setFacadeFilter('all');
  };

  const renderOverview = () => {
    if (!project) return null;

    // Calculate the main status categories for the donut chart (matching web app structure)
    const issuedForProduction = panelStatusCounts['Issued For Production'] || 0;
    const factoryStock = panelStatusCounts['Produced'] || 0;
    const siteStock = panelStatusCounts['Delivered'] || 0;
    const installed = panelStatusCounts['Installed'] || 0;
    
    // Calculate "Rest" - all other statuses not in the main 4 categories
    const mainStatuses = ['Issued For Production', 'Produced', 'Delivered', 'Installed'];
    const mainStatusCount = mainStatuses.reduce((sum, status) => sum + (panelStatusCounts[status] || 0), 0);
    const restCount = totalPanels - mainStatusCount;

    // Calculate progress percentages
    const getProgress = () => {
      if (!project || !project.estimated_panels || project.estimated_panels === 0) return 0;
      return Math.round((installed / project.estimated_panels) * 100);
    };

    const progress = getProgress();

    // Calculate manufacturing pipeline progress
    const getManufacturingProgress = (statuses: string[]) => {
      const count = statuses.reduce((sum, status) => sum + (panelStatusCounts[status] || 0), 0);
      const percentage = project.estimated_panels > 0 ? (count / project.estimated_panels) * 100 : 0;
      return { count, percentage };
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
        {/* Project Header */}
        <View style={styles.projectHeader}>
          <View style={styles.projectTitleContainer}>
            <Text style={styles.projectTitle}>{project.name}</Text>
            {getStatusBadge(project.status)}
          </View>
        </View>

        {/* Project Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Customer Card */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>Customer</Text>
              <Ionicons name="person" size={16} color={QatarColors.mutedForeground} />
            </View>
            <Text style={styles.statCardValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{project.customer_name || 'No Customer'}</Text>
            <Text style={styles.statCardSubtitle}>Project Customer</Text>
          </View>

          {/* Location Card */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>Location</Text>
              <Ionicons name="location" size={16} color={QatarColors.mutedForeground} />
            </View>
            <Text style={styles.statCardValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{project.location}</Text>
            <Text style={styles.statCardSubtitle}>Project Site</Text>
          </View>

          {/* Budget Card */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>Budget</Text>
              <Ionicons name="cash" size={16} color={QatarColors.mutedForeground} />
            </View>
            <Text style={styles.statCardValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatCurrency(project.estimated_cost)}</Text>
            <Text style={styles.statCardSubtitle}>Estimated Cost</Text>
          </View>

          {/* Estimated Panels Card */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>Estimated Panels</Text>
              <Ionicons name="cube" size={16} color={QatarColors.mutedForeground} />
            </View>
            <Text style={styles.statCardValue}>{project.estimated_panels || 0}</Text>
            <Text style={styles.statCardSubtitle}>Total Panels</Text>
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
                    {issuedProgress.count} / {project.estimated_panels || 0}
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
                    {producedProgress.count} / {project.estimated_panels || 0}
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
                    {deliveryProgress.count} / {project.estimated_panels || 0}
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
                    {deliveredProgress.count} / {project.estimated_panels || 0}
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
                    {installationProgress.count} / {project.estimated_panels || 0}
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
                    {inspectedProgress.count} / {project.estimated_panels || 0}
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
                    {approvedFinalProgress.count} / {project.estimated_panels || 0}
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
                    {onHoldProgress.count} / {project.estimated_panels || 0}
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
                  <Text style={styles.noDataText}>No panels yet for this project</Text>
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
                        <Text style={styles.legendLabel}>Under Production</Text>
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
                        <View style={styles.legendTotalItem}>
                          <Text style={styles.legendTotalLabel}>Estimated Panels</Text>
                          <Text style={styles.legendTotalValue}>{project.estimated_panels}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Project Totals */}
          <View style={styles.projectTotalsCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="business" size={20} color={QatarColors.foreground} />
              <Text style={styles.cardTitle}>Project Totals</Text>
            </View>
            <View style={styles.projectTotalsContent}>
              <View style={styles.totalsGrid}>
                <View style={styles.totalItem}>
                  <View style={styles.totalItemHeader}>
                    <Ionicons name="square" size={16} color={QatarColors.mutedForeground} />
                    <Text style={styles.totalItemLabel}>Total Area</Text>
                  </View>
                  <Text style={styles.totalItemValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {(project.total_area || 0).toFixed(2)} m²
                  </Text>
                </View>
                <View style={styles.totalItem}>
                  <View style={styles.totalItemHeader}>
                    <Ionicons name="cash" size={16} color={QatarColors.mutedForeground} />
                    <Text style={styles.totalItemLabel}>Total Amount</Text>
                  </View>
                  <Text style={styles.totalItemValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {formatQatarRiyal(project.total_amount || 0)}
                  </Text>
                </View>
                <View style={styles.totalItem}>
                  <View style={styles.totalItemHeader}>
                    <Ionicons name="scale" size={16} color={QatarColors.mutedForeground} />
                    <Text style={styles.totalItemLabel}>Total Weight</Text>
                  </View>
                  <Text style={styles.totalItemValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {(project.total_weight || 0).toFixed(2)} kg
                  </Text>
                </View>
                <View style={styles.totalItem}>
                  <View style={styles.totalItemHeader}>
                    <Ionicons name="cube" size={16} color={QatarColors.mutedForeground} />
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

  const renderBuildings = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Buildings ({buildings.length})</Text>
      {buildings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="business" size={48} color={QatarColors.mutedForeground} />
          <Text style={styles.emptyText}>No buildings found</Text>
        </View>
      ) : (
        buildings.map((building) => (
          <TouchableOpacity key={building.id} style={styles.buildingCard} onPress={() => handleBuildingPress(building)}>
            <View style={styles.buildingHeader}>
              <Text style={styles.buildingName}>{building.name}</Text>
              {building.description && (
                <Text style={styles.buildingDescription}>{building.description}</Text>
              )}
            </View>
            <View style={styles.buildingStats}>
              <View style={styles.buildingStat}>
                <Ionicons name="layers" size={16} color={QatarColors.mutedForeground} />
                <Text style={styles.buildingStatText}>{building.facade_count} Facades</Text>
              </View>
              <View style={styles.buildingStat}>
                <Ionicons name="cube" size={16} color={QatarColors.mutedForeground} />
                <Text style={styles.buildingStatText}>{building.panel_count} Panels</Text>
              </View>
            </View>
            <View style={styles.buildingTotals}>
              <View style={styles.buildingTotalItem}>
                <Ionicons name="square" size={14} color={QatarColors.primary} />
                <Text style={styles.buildingTotalLabel}>Area</Text>
                <Text style={styles.buildingTotalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{(building.total_area || 0).toFixed(1)} m²</Text>
              </View>
              <View style={styles.buildingTotalItem}>
                <Ionicons name="cash" size={14} color={QatarColors.chart2} />
                <Text style={styles.buildingTotalLabel}>Amount</Text>
                <Text style={styles.buildingTotalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatQatarRiyal(building.total_amount || 0)}</Text>
              </View>
              <View style={styles.buildingTotalItem}>
                <Ionicons name="scale" size={14} color={QatarColors.chart4} />
                <Text style={styles.buildingTotalLabel}>Weight</Text>
                <Text style={styles.buildingTotalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{(building.total_weight || 0).toFixed(1)} kg</Text>
              </View>
            </View>
            <View style={styles.buildingNavigation}>
              <Ionicons name="chevron-forward" size={16} color={QatarColors.mutedForeground} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

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
              <Text style={styles.facadeBuilding}>{facade.building_name}</Text>
              <View style={styles.facadeStat}>
                <Ionicons name="cube" size={16} color={QatarColors.mutedForeground} />
                <Text style={styles.facadeStatText}>{facade.panel_count} Panels</Text>
              </View>
            </View>
            <View style={styles.facadeTotals}>
              <View style={styles.facadeTotalItem}>
                <Ionicons name="square" size={14} color={QatarColors.primary} />
                <Text style={styles.facadeTotalLabel}>Area</Text>
                <Text style={styles.facadeTotalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{(facade.total_area || 0).toFixed(1)} m²</Text>
              </View>
              <View style={styles.facadeTotalItem}>
                <Ionicons name="cash" size={14} color={QatarColors.chart2} />
                <Text style={styles.facadeTotalLabel}>Amount</Text>
                <Text style={styles.facadeTotalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatQatarRiyal(facade.total_amount || 0)}</Text>
              </View>
              <View style={styles.facadeTotalItem}>
                <Ionicons name="scale" size={14} color={QatarColors.chart4} />
                <Text style={styles.facadeTotalLabel}>Weight</Text>
                <Text style={styles.facadeTotalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{(facade.total_weight || 0).toFixed(1)} kg</Text>
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

  const filteredPanels = useMemo(() => {
    return panelRows.filter((panel) => {
      if (statusFilter !== 'all' && panel.statusLabel !== statusFilter) return false;
      if (typeFilter !== 'all' && panel.typeLabel !== typeFilter) return false;
      if (projectFilter !== 'all' && panel.project_id !== projectFilter) return false;
      if (buildingFilter !== 'all' && panel.building_id !== buildingFilter) return false;
      if (facadeFilter !== 'all' && panel.facade_id !== facadeFilter) return false;

      if (normalizedSearch) {
        const matches =
          (panel.name || '').toLowerCase().includes(normalizedSearch) ||
          (panel.issue_transmittal_no || '').toLowerCase().includes(normalizedSearch) ||
          (panel.drawing_number || '').toLowerCase().includes(normalizedSearch) ||
          (panel.projectName || '').toLowerCase().includes(normalizedSearch) ||
          (panel.building_name || '').toLowerCase().includes(normalizedSearch) ||
          (panel.facade_name || '').toLowerCase().includes(normalizedSearch);
        if (!matches) return false;
      }

      return true;
    });
  }, [
    panelRows,
    normalizedSearch,
    statusFilter,
    typeFilter,
    projectFilter,
    buildingFilter,
    facadeFilter,
  ]);

  const renderFilterModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    options: FilterOption[],
    selectedValue: FilterValue,
    onSelect: (value: FilterValue) => void
  ) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.statusModalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.statusModalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.statusModalHeader}>
            <Text style={styles.statusModalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={QatarColors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.statusModalScroll}>
            <TouchableOpacity
              style={[styles.statusModalOption, selectedValue === 'all' && styles.statusModalOptionSelected]}
              onPress={() => {
                onSelect('all');
                onClose();
              }}
            >
              <Text style={[styles.statusModalOptionText, selectedValue === 'all' && styles.statusModalOptionTextSelected]}>
                All
              </Text>
              {selectedValue === 'all' && <Ionicons name="checkmark" size={20} color={QatarColors.primary} />}
            </TouchableOpacity>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.statusModalOption, selectedValue === option.value && styles.statusModalOptionSelected]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <Text
                  style={[styles.statusModalOptionText, selectedValue === option.value && styles.statusModalOptionTextSelected]}
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
    fallback: string,
    options: FilterOption[],
    onPress: () => void,
    disabled = false
  ) => (
    <TouchableOpacity
      style={[
        styles.panelFilterButton,
        value !== 'all' && styles.panelFilterButtonActive,
        disabled && styles.panelFilterButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <Ionicons
        name={icon}
        size={16}
        color={value !== 'all' ? QatarColors.primary : QatarColors.mutedForeground}
      />
      <Text
        style={[
          styles.panelFilterButtonText,
          value !== 'all' && styles.panelFilterButtonTextActive,
        ]}
        numberOfLines={1}
      >
        {getFilterLabel(value, fallback, options)}
      </Text>
      <Ionicons
        name="chevron-down"
        size={14}
        color={value !== 'all' ? QatarColors.primary : QatarColors.mutedForeground}
      />
    </TouchableOpacity>
  );

  const renderPanels = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Panels ({filteredPanels.length})</Text>

      <View style={styles.panelsFiltersContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color={QatarColors.mutedForeground} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search panels..."
            placeholderTextColor={QatarColors.mutedForeground}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={18} color={QatarColors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.panelFiltersHeaderRow}>
          <Text style={styles.panelFiltersHeaderText}>Filters</Text>
          {activeFiltersCount > 0 && (
            <View style={styles.panelActiveBadge}>
              <Text style={styles.panelActiveBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.panelFilterRow}>
          {renderFilterButton('flag-outline', statusFilter, 'Status', statusOptions, () => setShowStatusFilterModal(true))}
          {renderFilterButton('cube-outline', typeFilter, 'Type', typeOptions, () => setShowTypeFilterModal(true))}
          {renderFilterButton('folder-outline', projectFilter, 'Project', projectOptions, () => setShowProjectFilterModal(true))}
          {renderFilterButton(
            'business-outline',
            buildingFilter,
            'Building',
            buildingOptions,
            () => setShowBuildingFilterModal(true),
            buildingDisabled
          )}
          {renderFilterButton(
            'grid-outline',
            facadeFilter,
            'Facade',
            facadeOptions,
            () => setShowFacadeFilterModal(true),
            facadeDisabled
          )}
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearInlineFiltersButton} onPress={clearFilters}>
              <Ionicons name="close-circle" size={16} color={QatarColors.destructive} />
              <Text style={styles.clearInlineFiltersText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {filteredPanels.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cube" size={48} color={QatarColors.mutedForeground} />
          <Text style={styles.emptyText}>
            {panels.length === 0 ? 'No panels found' : hasActiveFilters ? 'No panels match the current filters' : 'No panels found'}
          </Text>
        </View>
      ) : (
        filteredPanels.map((panel) => (
          <View key={panel.id} style={styles.panelCard}>
            <TouchableOpacity style={styles.panelHeader} onPress={() => handlePanelPress(panel)}>
              <View style={styles.panelHeaderContent}>
                <Text style={styles.panelName}>{panel.name}</Text>
                {getPanelStatusBadge(panel.status)}
              </View>
              <Ionicons name="chevron-forward" size={16} color={QatarColors.mutedForeground} />
            </TouchableOpacity>
            <View style={styles.panelInfo}>
              {panel.building_name ? <Text style={styles.panelLocation}>Building: {panel.building_name}</Text> : null}
              {panel.facade_name ? <Text style={styles.panelLocation}>Facade: {panel.facade_name}</Text> : null}
              {panel.dimension ? <Text style={styles.panelDimension}>Dimension: {panel.dimension}</Text> : null}
              {panel.ifp_qty_area_sm ? <Text style={styles.panelDimension}>Area: {panel.ifp_qty_area_sm} m²</Text> : null}
              {panel.weight ? <Text style={styles.panelDimension}>Weight: {panel.weight} kg</Text> : null}
            </View>
            {!isCustomerRole(currentUser?.role as UserRole) && (
              <View style={styles.panelActions}>
                <TouchableOpacity style={styles.statusChangeButton} onPress={() => handleStatusChange(panel)}>
                  <Ionicons name="create-outline" size={16} color={QatarColors.foreground} />
                  <Text style={styles.statusChangeButtonText}>Change Status</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))
      )}

      {renderFilterModal(
        showStatusFilterModal,
        () => setShowStatusFilterModal(false),
        'Filter by status',
        statusOptions,
        statusFilter,
        setStatusFilter
      )}
      {renderFilterModal(
        showTypeFilterModal,
        () => setShowTypeFilterModal(false),
        'Filter by type',
        typeOptions,
        typeFilter,
        setTypeFilter
      )}
      {renderFilterModal(
        showProjectFilterModal,
        () => setShowProjectFilterModal(false),
        'Filter by project',
        projectOptions,
        projectFilter,
        handleProjectFilterChange
      )}
      {renderFilterModal(
        showBuildingFilterModal,
        () => setShowBuildingFilterModal(false),
        'Filter by building',
        buildingOptions,
        buildingFilter,
        handleBuildingFilterChange
      )}
      {renderFilterModal(
        showFacadeFilterModal,
        () => setShowFacadeFilterModal(false),
        'Filter by facade',
        facadeOptions,
        facadeFilter,
        setFacadeFilter
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={QatarColors.primary} />
        <Text style={styles.loadingText}>Loading project details...</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={QatarColors.destructive} />
        <Text style={styles.errorText}>Project not found</Text>
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
      <NavigationBar title={project?.name || "Project Details"} />
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{project.name}</Text>
            <Text style={styles.headerSubtitle}>PRJ-{project.id.slice(-4).toUpperCase()}</Text>
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
            style={[styles.tab, activeTab === 'buildings' && styles.activeTab]}
            onPress={() => setActiveTab('buildings')}
          >
            <Text style={[styles.tabText, activeTab === 'buildings' && styles.activeTabText]}>
              Buildings ({buildings.length})
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
        {activeTab === 'buildings' ? renderBuildings() : null}
        {activeTab === 'facades' ? renderFacades() : null}
        {activeTab === 'panels' ? renderPanels() : null}
      </ScrollView>

      {/* Status Change Dialog - Only show for non-customer users */}
      {!isCustomerRole(currentUser?.role as UserRole) && (
        <StatusChangeDialog
          panel={selectedPanel}
          isOpen={isStatusDialogOpen}
          onClose={() => {
            setIsStatusDialogOpen(false);
            setSelectedPanel(null);
          }}
          onStatusChanged={handleStatusChanged}
        />
      )}
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
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 20,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: QatarColors.foreground,
    flex: 1,
    textAlign: 'right',
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
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
    marginTop: 4,
    textAlign: 'center',
  },
  statSubLabel: {
    fontSize: 10,
    color: QatarColors.mutedForeground,
    marginTop: 2,
  },
  progressCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  progressBar: {
    height: 8,
    backgroundColor: QatarColors.muted,
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: QatarColors.primary,
    borderRadius: 4,
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
  buildingCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  buildingHeader: {
    marginBottom: 8,
  },
  buildingName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  buildingStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buildingStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buildingStatText: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
    marginLeft: 4,
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
  facadeBuilding: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
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
  // New styles for enhanced UI
  statusDistributionCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  statusDistributionItem: {
    marginBottom: 16,
  },
  statusDistributionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusDistributionLabel: {
    flex: 1,
    fontSize: 14,
    color: QatarColors.foreground,
    fontWeight: '500',
  },
  statusDistributionCount: {
    fontSize: 14,
    color: QatarColors.foreground,
    fontWeight: 'bold',
  },
  statusDistributionBar: {
    height: 6,
    backgroundColor: QatarColors.muted,
    borderRadius: 3,
    marginBottom: 4,
  },
  statusDistributionFill: {
    height: '100%',
    borderRadius: 3,
  },
  statusDistributionPercentage: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
    textAlign: 'right',
  },
  buildingDescription: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
    marginTop: 4,
    fontStyle: 'italic',
  },
  buildingTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: QatarColors.border,
  },
  buildingTotalItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: QatarColors.accent,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  buildingTotalLabel: {
    fontSize: 10,
    color: QatarColors.mutedForeground,
    marginTop: 2,
    marginBottom: 2,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  buildingTotalValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  buildingNavigation: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -8 }],
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
    fontSize: 11,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  facadeNavigation: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -8 }],
  },
  panelsFiltersContainer: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QatarColors.input,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 14,
    color: QatarColors.foreground,
  },
  panelFiltersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  panelFiltersHeaderText: {
    fontSize: 13,
    color: QatarColors.mutedForeground,
    fontWeight: '600',
  },
  panelActiveBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: QatarColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  panelActiveBadgeText: {
    color: QatarColors.primaryForeground,
    fontSize: 11,
    fontWeight: '700',
  },
  panelFilterRow: {
    gap: 8,
  },
  panelFilterButton: {
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
  panelFilterButtonActive: {
    backgroundColor: `${QatarColors.primary}15`,
    borderColor: QatarColors.primary,
  },
  panelFilterButtonDisabled: {
    opacity: 0.55,
  },
  panelFilterButtonText: {
    fontSize: 13,
    color: QatarColors.mutedForeground,
    flexShrink: 1,
  },
  panelFilterButtonTextActive: {
    color: QatarColors.primary,
    fontWeight: '600',
  },
  clearInlineFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearInlineFiltersText: {
    fontSize: 13,
    color: QatarColors.destructive,
    fontWeight: '500',
  },
  filtersRow: {
    marginBottom: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    fontSize: 12,
    color: QatarColors.foreground,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: QatarColors.primaryForeground,
  },
  statusModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  statusModalContent: {
    backgroundColor: QatarColors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  statusModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  statusModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: QatarColors.foreground,
  },
  statusModalScroll: {
    maxHeight: 400,
  },
  statusModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: QatarColors.border,
  },
  statusModalOptionSelected: {
    backgroundColor: QatarColors.primary + '20',
  },
  statusModalOptionText: {
    fontSize: 14,
    color: QatarColors.foreground,
    flex: 1,
  },
  statusModalOptionTextSelected: {
    color: QatarColors.primary,
    fontWeight: '600',
  },
  panelHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: QatarColors.border,
  },
  statusChangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: QatarColors.accent,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: QatarColors.primary,
  },
  statusChangeButtonText: {
    fontSize: 12,
    color: QatarColors.foreground,
    fontWeight: '500',
    marginLeft: 4,
  },
  // New styles for enhanced overview matching web app
  projectHeader: {
    marginBottom: 24,
  },
  projectTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  projectTitle: {
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
  pieChartSegments: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  pieSegment: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 120,
    height: 120,
    borderRadius: 60,
    transformOrigin: 'center',
    zIndex: 1,
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
    fontSize: 14,
    color: QatarColors.mutedForeground,
  },
  legendTotalValue: {
    fontSize: 14,
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
    fontSize: 12,
    fontWeight: '500',
    color: QatarColors.mutedForeground,
    textTransform: 'uppercase',
  },
  totalItemValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
});
