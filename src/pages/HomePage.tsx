import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { 
  Users, 
  FolderOpen, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  MapPin,
  Building2,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Target,
  Activity,
  BarChart3,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Layers,
  Factory,
  Truck,
  Wrench,
  GanttChart,
  PieChart as PieChartIcon,
  TrendingUp as TrendingUpIcon,
  CalendarDays,
  Globe,
  Zap,
  Award,
  Target as TargetIcon,
  Plus,
  X
} from "lucide-react";
import { useState, useRef, useMemo, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Upload, FileSpreadsheet, Trash2, Download, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import * as XLSX from 'xlsx';
import { supabase } from "../lib/supabase";

// Enhanced status constants with grouping
const PRIMARY_STATUSES = [
  "Issued For Production",
  "Produced", 
  "Delivered", 
  "Installed"
];

const SECONDARY_STATUSES = [
  "Proceed for Delivery",
  "Approved Material",
  "Rejected Material",
  "Inspected",
  "Approved Final",
  "On Hold",
  "Cancelled",
  "Broken at Site"
];

type PrimaryStatus = typeof PRIMARY_STATUSES[number];
type SecondaryStatus = typeof SECONDARY_STATUSES[number];
type AllStatus = PrimaryStatus | SecondaryStatus;
type ChartStatus = AllStatus | 'Rest';

// Status mapping function to convert integer status codes to string values
const mapStatusToString = (statusCode: number): AllStatus => {
  switch (statusCode) {
    case 0: return 'Issued For Production';
    case 1: return 'Produced';
    case 2: return 'Proceed for Delivery';
    case 3: return 'Delivered';
    case 4: return 'Approved Material';
    case 5: return 'Rejected Material';
    case 6: return 'Installed';
    case 7: return 'Inspected';
    case 8: return 'Approved Final';
    case 9: return 'On Hold';
    case 10: return 'Cancelled';
    case 11: return 'Broken at Site';
    default: return 'Issued For Production';
  }
};

interface DashboardProps {
  customers: any[];
  projects: any[];
  panels: any[];
  buildings?: any[];
  facades?: any[];
}

interface FilterState {
  selectedProject: string;
  selectedBuilding: string;
  selectedFacade: string;
  dateRange: string;
  statusFilter: string;
  locationFilter: string;
}

export function Dashboard({ customers, projects, panels, buildings = [], facades = [] }: DashboardProps) {
  // Data fetching state
  const [dashboardData, setDashboardData] = useState({
    customers: [] as any[],
    projects: [] as any[],
    panels: [] as any[],
    buildings: [] as any[],
    facades: [] as any[]
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Independent section filters - each section has its own state
  const [projectFilters, setProjectFilters] = useState({
    selectedProjects: [] as string[],
    searchTerm: ''
  });

  const [buildingFilters, setBuildingFilters] = useState({
    selectedBuildings: [] as string[],
    searchTerm: ''
  });

  const [facadeFilters, setFacadeFilters] = useState({
    selectedFacades: [] as string[],
    searchTerm: ''
  });

  const [pieChartView, setPieChartView] = useState<'primary' | 'secondary'>('primary');
  const [showFilters, setShowFilters] = useState(true);
  const [activeSection, setActiveSection] = useState<'projects' | 'buildings' | 'facades'>('projects');

  // Data fetching functions
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Dashboard: Starting data fetch...');
      
      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (customersError) throw customersError;
      
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name');
      
      if (projectsError) throw projectsError;
      
      // Fetch buildings with project information
      const { data: buildingsData, error: buildingsError } = await supabase
        .from('buildings')
        .select(`
          *,
          projects!inner(name)
        `)
        .order('name');
      
      if (buildingsError) throw buildingsError;
      
      // Fetch facades with project information
      const { data: facadesData, error: facadesError } = await supabase
        .from('facades')
        .select(`
          *,
          buildings!inner(
            name,
            projects!inner(name)
          )
        `)
        .order('name');
      
      if (facadesError) throw facadesError;
      
      // Fetch panels using pagination to get all panels
      let allPanels: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('panels')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;

        if (data && data.length > 0) {
          allPanels = [...allPanels, ...data];
          console.log(`🔍 Dashboard: Fetched page ${page + 1}: ${data.length} panels (total so far: ${allPanels.length})`);
          
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      const panelsData = allPanels;
      console.log(`🔍 Dashboard: Total panels fetched: ${panelsData.length}`);
      
      // Fetch panel status histories separately for better performance
      const { data: statusHistoriesData, error: statusError } = await supabase
        .from('panel_status_histories')
        .select('panel_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10000);
      
      if (statusError) {
        console.warn('⚠️ Dashboard: Warning - Could not fetch status histories:', statusError);
        // Continue without status histories, panels will use default status
      }
      
      // Process panels to get current status
      const processedPanels = panelsData?.map(panel => {
        // Find the most recent status for this panel
        const panelStatuses = statusHistoriesData?.filter(
          status => status.panel_id === panel.id
        ) || [];
        
        // Get the most recent status, or use the panel's default status
        const currentStatus = panelStatuses.length > 0 
          ? panelStatuses[0].status 
          : panel.status || 1; // Default to status 1 (Produced)
        
        // Map status integer to string for display
        const statusString = mapStatusToString(currentStatus);
        
        // Debug logging for status processing
        console.log(`🔍 Panel ${panel.name}: statusCode=${currentStatus}, mappedStatus=${statusString}`);
        
        return {
          ...panel,
          status: statusString,
          statusCode: currentStatus,
          // Add fallback values for missing data
          projectId: panel.project_id,
          buildingId: panel.building_id,
          facadeId: panel.facade_id
        };
      }) || [];
      
      console.log('✅ Dashboard: Data fetched successfully');
      console.log('📊 Dashboard: Customers:', customersData?.length || 0);
      console.log('📊 Dashboard: Projects:', projectsData?.length || 0);
      console.log('📊 Dashboard: Buildings:', buildingsData?.length || 0);
      console.log('📊 Dashboard: Facades:', facadesData?.length || 0);
      console.log('📊 Dashboard: Panels:', processedPanels.length || 0);
      console.log('📊 Dashboard: Status Histories:', statusHistoriesData?.length || 0);
      
      // Log sample panel data for debugging
      if (processedPanels.length > 0) {
        console.log('🔍 Dashboard: Sample panel:', {
          id: processedPanels[0].id,
          name: processedPanels[0].name,
          status: processedPanels[0].status,
          statusCode: processedPanels[0].statusCode
        });
      }
      
      setDashboardData({
        customers: customersData || [],
        projects: projectsData || [],
        panels: processedPanels,
        buildings: buildingsData || [],
        facades: facadesData || []
      });
      
    } catch (error) {
      console.error('❌ Dashboard: Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Section-independent data filtering and aggregation
  const projectData = useMemo(() => {
    let filteredPanels = dashboardData.panels;
    let filteredProjects = dashboardData.projects;

    // Apply project-specific filters
    if (projectFilters.selectedProjects.length > 0) {
      filteredPanels = filteredPanels.filter(p => projectFilters.selectedProjects.includes(p.projectId));
      filteredProjects = filteredProjects.filter(p => projectFilters.selectedProjects.includes(p.id));
    }

    return { panels: filteredPanels, projects: filteredProjects };
  }, [dashboardData, projectFilters]);

  const buildingData = useMemo(() => {
    let filteredPanels = dashboardData.panels;
    let filteredBuildings = dashboardData.buildings;

    // Apply building-specific filters
    if (buildingFilters.selectedBuildings.length > 0) {
      filteredPanels = filteredPanels.filter(p => buildingFilters.selectedBuildings.includes(p.buildingId));
      filteredBuildings = filteredBuildings.filter(b => buildingFilters.selectedBuildings.includes(b.id));
    }

    return { panels: filteredPanels, buildings: filteredBuildings };
  }, [dashboardData, buildingFilters]);

  const facadeData = useMemo(() => {
    let filteredPanels = dashboardData.panels;
    let filteredFacades = dashboardData.facades;

    // Apply facade-specific filters
    if (facadeFilters.selectedFacades.length > 0) {
      filteredPanels = filteredPanels.filter(p => facadeFilters.selectedFacades.includes(p.facadeId));
      filteredFacades = filteredFacades.filter(f => facadeFilters.selectedFacades.includes(f.id));
    }

    return { panels: filteredPanels, facades: filteredFacades };
  }, [dashboardData, facadeFilters]);

  // Get current section data based on active section
  const currentSectionData = useMemo(() => {
    switch (activeSection) {
      case 'projects': return { panels: projectData.panels, projects: projectData.projects, buildings: [], facades: [] };
      case 'buildings': return { panels: buildingData.panels, projects: [], buildings: buildingData.buildings, facades: [] };
      case 'facades': return { panels: facadeData.panels, projects: [], buildings: [], facades: facadeData.facades };
      default: return { panels: projectData.panels, projects: projectData.projects, buildings: [], facades: [] };
    }
  }, [activeSection, projectData, buildingData, facadeData]);

  // Calculate enhanced metrics for current section
  const metrics = useMemo(() => {
    const { panels: filteredPanels, projects: filteredProjects, buildings: filteredBuildings, facades: filteredFacades } = currentSectionData;
    
    const totalCustomers = dashboardData.customers.length;
    const totalProjects = filteredProjects?.length || 0;
    const totalPanels = filteredPanels?.length || 0;
    const totalBuildings = filteredBuildings?.length || 0;
    const totalFacades = filteredFacades?.length || 0;
    
    // Project metrics
    const onHoldProjects = filteredProjects.filter(p => p.status === 'on-hold').length;
    
    // Financial metrics
    const projectsToProcess: Array<any> = filteredProjects || [];
    const totalEstimatedValue = projectsToProcess.reduce((sum: number, project: any) => sum + (project.estimated_cost || 0), 0);
    const totalEstimatedPanels = projectsToProcess.reduce((sum: number, project: any) => sum + (project.estimated_panels || 0), 0);
    const averageProjectValue = totalProjects > 0 ? totalEstimatedValue / totalProjects : 0;
  
    // Panel status metrics
    const panelStatusCounts = [...PRIMARY_STATUSES, ...SECONDARY_STATUSES].reduce((acc, status) => {
      acc[status] = filteredPanels.filter(p => p.status === status).length;
      return acc;
    }, {} as Record<AllStatus, number>);

    // Primary status metrics
    const primaryStatusCounts = PRIMARY_STATUSES.reduce((acc, status) => {
      acc[status] = panelStatusCounts[status];
      return acc;
    }, {} as Record<PrimaryStatus, number>);

    // Secondary status metrics
    const secondaryStatusCounts = SECONDARY_STATUSES.reduce((acc, status) => {
      acc[status] = panelStatusCounts[status];
      return acc;
    }, {} as Record<SecondaryStatus, number>);

    // Completion metrics
    const completedPanelsCount = panelStatusCounts['Installed'] + panelStatusCounts['Delivered'];
    const panelCompletionRate = totalEstimatedPanels > 0 ? (completedPanelsCount / totalEstimatedPanels) * 100 : 0;
    const projectProgress = totalEstimatedPanels > 0 ? (totalPanels / totalEstimatedPanels) * 100 : 0;
    
    // Efficiency metrics
    // Production Efficiency: panels with status "Produced" or later statuses
    const productionEfficiency = totalEstimatedPanels > 0 ? 
      ((panelStatusCounts['Produced'] + panelStatusCounts['Proceed for Delivery'] + panelStatusCounts['Delivered'] + 
        panelStatusCounts['Approved Material'] + panelStatusCounts['Rejected Material'] + panelStatusCounts['Installed'] + 
        panelStatusCounts['Inspected'] + panelStatusCounts['Approved Final']) / totalEstimatedPanels) * 100 : 0;
    
    // Delivery Efficiency: panels with status "Delivered" or later statuses
    const deliveryEfficiency = totalEstimatedPanels > 0 ? 
      ((panelStatusCounts['Delivered'] + panelStatusCounts['Approved Material'] + panelStatusCounts['Installed'] + 
        panelStatusCounts['Inspected'] + panelStatusCounts['Approved Final']) / totalEstimatedPanels) * 100 : 0;
    
    // Overall Completion: only panels with status "Approved Final"
    const overallCompletion = totalEstimatedPanels > 0 ? 
      (panelStatusCounts['Approved Final'] / totalEstimatedPanels) * 100 : 0;
    
    // Location metrics
    const locationData = projectsToProcess.reduce((acc: Record<string, number>, project: any) => {
      const location = project.location || 'Unknown';
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      counts: {
        customers: totalCustomers,
        projects: totalProjects,
        panels: totalPanels,
        buildings: totalBuildings,
        facades: totalFacades,
        onHoldProjects
      },
      financial: {
        totalEstimatedValue,
        totalEstimatedPanels,
        averageProjectValue
      },
      status: {
        primary: primaryStatusCounts,
        secondary: secondaryStatusCounts,
        all: panelStatusCounts
      },
      efficiency: {
        panelCompletionRate,
        projectProgress,
        productionEfficiency,
        deliveryEfficiency,
        overallCompletion
      },
      location: locationData
    };
  }, [currentSectionData, dashboardData.customers]);

  // Enhanced chart data preparation for current section
  const chartData = useMemo(() => {
    const { status, location } = metrics;
    
    // Pie chart data based on current view
    const pieChartData: Array<{ status: ChartStatus; count: number; percentage: number }> = pieChartView === 'primary' 
      ? PRIMARY_STATUSES.map(statusName => ({
          status: statusName,
          count: status.primary[statusName as PrimaryStatus],
          percentage: metrics.counts.panels > 0 ? 
            (status.primary[statusName as PrimaryStatus] / metrics.counts.panels) * 100 : 0
        })).filter(item => item.count > 0)
      : SECONDARY_STATUSES.map(statusName => ({
          status: statusName,
          count: status.secondary[statusName as SecondaryStatus],
          percentage: metrics.counts.panels > 0 ? 
            (status.secondary[statusName as SecondaryStatus] / metrics.counts.panels) * 100 : 0
        })).filter(item => item.count > 0);

    // Add "Rest" slice for pie chart
    if (pieChartView === 'primary') {
      const restCount = Object.values(status.secondary).reduce((sum, count) => sum + count, 0);
      if (restCount > 0) {
        pieChartData.push({
          status: 'Rest',
          count: restCount,
          percentage: (restCount / metrics.counts.panels) * 100
        });
      }
    } else {
      const restCount = Object.values(status.primary).reduce((sum, count) => sum + count, 0);
      if (restCount > 0) {
        pieChartData.push({
          status: 'Rest',
          count: restCount,
          percentage: (restCount / metrics.counts.panels) * 100
        });
      }
    }

    // Location chart data
    const locationChartData = Object.entries(location)
    .map(([location, count]) => ({ location, count: count as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

    // Timeline data for manufacturing pipeline
    const timelineData = [
      { stage: 'Issued For Production', count: status.all['Issued For Production'] || 0, cumulative: status.all['Issued For Production'] || 0 },
      { stage: 'Produced', count: status.all['Produced'] || 0, cumulative: (status.all['Issued For Production'] || 0) + (status.all['Produced'] || 0) },
      { stage: 'Delivered', count: status.all['Delivered'] || 0, cumulative: (status.all['Issued For Production'] || 0) + (status.all['Produced'] || 0) + (status.all['Delivered'] || 0) },
      { stage: 'Installed', count: status.all['Installed'] || 0, cumulative: (status.all['Issued For Production'] || 0) + (status.all['Produced'] || 0) + (status.all['Delivered'] || 0) + (status.all['Installed'] || 0) },
      { stage: 'Approved Material', count: status.all['Approved Material'] || 0, cumulative: (status.all['Issued For Production'] || 0) + (status.all['Produced'] || 0) + (status.all['Delivered'] || 0) + (status.all['Installed'] || 0) + (status.all['Approved Material'] || 0) },
      { stage: 'Inspected', count: status.all['Inspected'] || 0, cumulative: (status.all['Issued For Production'] || 0) + (status.all['Produced'] || 0) + (status.all['Delivered'] || 0) + (status.all['Installed'] || 0) + (status.all['Approved Material'] || 0) + (status.all['Inspected'] || 0) },
      { stage: 'Approved Final', count: status.all['Approved Final'] || 0, cumulative: (status.all['Issued For Production'] || 0) + (status.all['Produced'] || 0) + (status.all['Delivered'] || 0) + (status.all['Installed'] || 0) + (status.all['Approved Material'] || 0) + (status.all['Inspected'] || 0) + (status.all['Approved Final'] || 0) }
    ];

    // Efficiency radar chart data
    const efficiencyData = [
      { metric: 'Production', value: metrics.efficiency.productionEfficiency },
      { metric: 'Delivery', value: metrics.efficiency.deliveryEfficiency },
      { metric: 'Completion', value: metrics.efficiency.overallCompletion },
      { metric: 'Progress', value: metrics.efficiency.projectProgress }
    ];

    return {
      pieChart: pieChartData,
      location: locationChartData,
      timeline: timelineData,
      efficiency: efficiencyData
    };
  }, [metrics, pieChartView]);

  // Enhanced color schemes
  const STATUS_COLORS: Record<AllStatus, string> = {
    'Issued For Production': '#F59E0B',   // Amber
    'Produced': '#10B981',                // Emerald
    'Delivered': '#3B82F6',               // Blue
    'Installed': '#059669',               // Green
    'Proceed for Delivery': '#F97316',    // Orange
    'Approved Material': '#8B5CF6',       // Purple
    'Rejected Material': '#EF4444',       // Red
    'Inspected': '#06B6D4',               // Cyan
    'Approved Final': '#84CC16',          // Lime
    'On Hold': '#F59E0B',                 // Amber
    'Cancelled': '#6B7280',               // Gray
    'Broken at Site': '#DC2626'           // Red
  };

  const CHART_COLORS = {
    primary: '#DC2626',
    secondary: '#059669',
    accent: '#7C3AED',
    warning: '#D97706',
    info: '#2563EB',
    success: '#059669',
    danger: '#DC2626',
    muted: '#6B7280',
    gradientStart: '#DC2626',
    gradientEnd: '#7C2D12'
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getStatusIcon = (status: AllStatus) => {
    const iconStyle = "h-4 w-4";
    switch (status) {
      case 'Issued For Production': return <Factory className={`${iconStyle} text-amber-400`} />;
      case 'Produced': return <CheckCircle className={`${iconStyle} text-emerald-400`} />;
      case 'Delivered': return <Truck className={`${iconStyle} text-blue-400`} />;
      case 'Installed': return <Wrench className={`${iconStyle} text-green-400`} />;
      case 'Proceed for Delivery': return <Truck className={`${iconStyle} text-orange-400`} />;
      case 'Approved Material': return <CheckCircle className={`${iconStyle} text-purple-400`} />;
      case 'Rejected Material': return <AlertCircle className={`${iconStyle} text-red-400`} />;
      case 'Inspected': return <CheckCircle className={`${iconStyle} text-cyan-400`} />;
      case 'Approved Final': return <Award className={`${iconStyle} text-lime-400`} />;
      case 'On Hold': return <Clock className={`${iconStyle} text-amber-400`} />;
      case 'Cancelled': return <X className={`${iconStyle} text-gray-400`} />;
      case 'Broken at Site': return <AlertCircle className={`${iconStyle} text-red-600`} />;
      default: return <Package className={`${iconStyle} text-gray-400`} />;
    }
  };

  const handlePieChartClick = (entry: { status: string }) => {
    if (entry.status === 'Rest') {
      setPieChartView(pieChartView === 'primary' ? 'secondary' : 'primary');
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-xl max-w-xs">
          <p className="text-gray-900 font-semibold mb-2 text-sm sm:text-base">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs sm:text-sm text-gray-700">
                {entry.dataKey}: <span className="font-medium">{entry.value}</span>
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const updateProjectFilter = (key: keyof typeof projectFilters, value: any) => {
    setProjectFilters(prev => ({ ...prev, [key]: value }));
  };

  const updateBuildingFilter = (key: keyof typeof buildingFilters, value: any) => {
    setBuildingFilters(prev => ({ ...prev, [key]: value }));
  };

  const updateFacadeFilter = (key: keyof typeof facadeFilters, value: any) => {
    setFacadeFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Enhanced Header with Filters Toggle - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Data-driven insights across Projects, Buildings, and Facades</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button 
            variant="outline" 
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full sm:w-auto"
            size="sm"
          >
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh Data'}</span>
            <span className="sm:hidden">{loading ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-center gap-2 w-full sm:w-auto"
            size="sm"
          >
            {showFilters ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="hidden sm:inline">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            <span className="sm:hidden">{showFilters ? 'Hide' : 'Show'}</span>
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <Card className="qatar-card">
          <CardContent className="p-12 text-center">
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Activity className="h-8 w-8 text-primary animate-spin" />
      </div>
              <div className="space-y-2">
                <h3 className="text-xl font-medium">Loading Dashboard Data...</h3>
                <p className="text-muted-foreground">Please wait while we fetch the latest information</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !loading && (
        <Alert className="border-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>Error loading dashboard data: {error}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchDashboardData}
                className="ml-4"
              >
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Dashboard Content - Only show when not loading and no errors */}
      {!loading && !error && (
        <>
          {/* Navigation Tabs for Three Main Axes - Mobile Responsive */}
          <Card className="qatar-card">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row border-b">
                <button
                  onClick={() => setActiveSection('projects')}
                  className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors ${
                    activeSection === 'projects'
                      ? 'border-b-2 sm:border-b-2 border-r-0 sm:border-r-0 border-primary text-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-1 sm:gap-2 justify-center">
                    <FolderOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline">Projects</span>
                    <span className="xs:hidden">Proj</span>
                    <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                      {metrics.counts.projects}
                    </Badge>
                  </div>
                </button>
                <button
                  onClick={() => setActiveSection('buildings')}
                  className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors ${
                    activeSection === 'buildings'
                      ? 'border-b-2 sm:border-b-2 border-r-0 sm:border-r-0 border-primary text-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-1 sm:gap-2 justify-center">
                    <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline">Buildings</span>
                    <span className="xs:hidden">Bldg</span>
                    <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                      {metrics.counts.buildings}
                    </Badge>
                  </div>
                </button>
                <button
                  onClick={() => setActiveSection('facades')}
                  className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors ${
                    activeSection === 'facades'
                      ? 'border-b-2 sm:border-b-2 border-r-0 sm:border-r-0 border-primary text-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-1 sm:gap-2 justify-center">
                    <Layers className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline">Facades</span>
                    <span className="xs:hidden">Fac</span>
                    <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                      {metrics.counts.facades}
                    </Badge>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

      {/* Section-Specific Filter Panel */}
      {showFilters && (
        <Card className="qatar-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {activeSection === 'projects' && 'Project Filters'}
              {activeSection === 'buildings' && 'Building Filters'}
              {activeSection === 'facades' && 'Facade Filters'}
            </CardTitle>
            <CardDescription>
              {activeSection === 'projects' && 'Filter panels and projects by specific criteria'}
              {activeSection === 'buildings' && 'Filter panels and buildings by specific criteria'}
              {activeSection === 'facades' && 'Filter panels and facades by specific criteria'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeSection === 'projects' && (
              <div className="space-y-6">
                {/* Project Selection - Enhanced Multi-select */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Projects</Label>
                    {projectFilters.selectedProjects.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateProjectFilter('selectedProjects', [])}
                        className="text-xs"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  
                  {/* Search and Selection Area - Mobile Responsive */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Available Projects with Search */}
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search projects..."
                          className="pl-10 text-sm"
                          value={projectFilters.searchTerm || ''}
                          onChange={(e) => updateProjectFilter('searchTerm', e.target.value)}
                        />
                      </div>
                      
                      <div className="border rounded-lg p-2 sm:p-3 bg-muted/30 max-h-48 sm:max-h-64 overflow-y-auto">
                        <div className="space-y-1 sm:space-y-2">
                          {dashboardData.projects
                            .filter(project => 
                              !projectFilters.selectedProjects.includes(project.id) &&
                              (!projectFilters.searchTerm || 
                               project.name.toLowerCase().includes(projectFilters.searchTerm.toLowerCase()))
                            )
                            .map((project) => (
                              <div
                                key={project.id}
                                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => {
                                  if (!projectFilters.selectedProjects.includes(project.id)) {
                                    updateProjectFilter('selectedProjects', [...projectFilters.selectedProjects, project.id]);
                                  }
                                }}
                              >
                                <span className="text-xs sm:text-sm font-medium truncate">{project.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 sm:h-6 sm:w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          {dashboardData.projects.filter(project => 
                            !projectFilters.selectedProjects.includes(project.id) &&
                            (!projectFilters.searchTerm || 
                             project.name.toLowerCase().includes(projectFilters.searchTerm.toLowerCase()))
                          ).length === 0 && (
                            <div className="text-center text-xs sm:text-sm text-muted-foreground py-4">
                              {projectFilters.searchTerm ? 'No projects found' : 'All projects selected'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Selected Projects */}
                    <div className="space-y-3">
                      <Label className="text-xs sm:text-sm font-medium text-muted-foreground">
                        Selected Projects ({projectFilters.selectedProjects.length})
                      </Label>
                      
                      <div className="border rounded-lg p-2 sm:p-3 bg-muted/30 max-h-48 sm:max-h-64 overflow-y-auto">
                        {projectFilters.selectedProjects.length > 0 ? (
                          <div className="space-y-1 sm:space-y-2">
                            {projectFilters.selectedProjects.map((projectId) => {
                              const project = dashboardData.projects.find(p => p.id === projectId);
                              return project ? (
                                <div key={projectId} className="flex items-center justify-between p-2 rounded-md bg-primary/10 border border-primary/20">
                                  <span className="text-xs sm:text-sm font-medium truncate">{project.name}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => updateProjectFilter('selectedProjects', 
                                      projectFilters.selectedProjects.filter(id => id !== projectId)
                                    )}
                                    className="px-1 sm:px-2 py-1 text-xs text-white hover:text-destructive hover:bg-destructive/10 rounded flex-shrink-0"
                                  >
                                    <span className="hidden sm:inline">Clear</span>
                                    <X className="h-3 w-3 sm:hidden" />
                                  </Button>
                                </div>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <div className="text-center text-xs sm:text-sm text-muted-foreground py-4">
                            No projects selected
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'buildings' && (
              <div className="space-y-6">
                {/* Building Selection - Enhanced Multi-select */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Buildings</Label>
                    {buildingFilters.selectedBuildings.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateBuildingFilter('selectedBuildings', [])}
                        className="text-xs"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  
                  {/* Search and Selection Area */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Available Buildings with Search */}
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search buildings..."
                          className="pl-10"
                          value={buildingFilters.searchTerm || ''}
                          onChange={(e) => updateBuildingFilter('searchTerm', e.target.value)}
                        />
                      </div>
                      
                      <div className="border rounded-lg p-3 bg-muted/30 max-h-64 overflow-y-auto">
                        <div className="space-y-2">
                          {dashboardData.buildings
                            .filter(building => 
                              !buildingFilters.selectedBuildings.includes(building.id) &&
                              (!buildingFilters.searchTerm || 
                               building.name.toLowerCase().includes(buildingFilters.searchTerm.toLowerCase()) ||
                               building.projects?.name.toLowerCase().includes(buildingFilters.searchTerm.toLowerCase()))
                            )
                            .map((building) => (
                              <div
                                key={building.id}
                                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => {
                                  if (!buildingFilters.selectedBuildings.includes(building.id)) {
                                    updateBuildingFilter('selectedBuildings', [...buildingFilters.selectedBuildings, building.id]);
                                  }
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{building.name}</span>
                                  <span className="text-xs text-muted-foreground">{building.projects?.name}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          {dashboardData.buildings.filter(building => 
                            !buildingFilters.selectedBuildings.includes(building.id) &&
                            (!buildingFilters.searchTerm || 
                             building.name.toLowerCase().includes(buildingFilters.searchTerm.toLowerCase()) ||
                             building.projects?.name.toLowerCase().includes(buildingFilters.searchTerm.toLowerCase()))
                          ).length === 0 && (
                            <div className="text-center text-sm text-muted-foreground py-4">
                              {buildingFilters.searchTerm ? 'No buildings found' : 'All buildings selected'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Selected Buildings */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Selected Buildings ({buildingFilters.selectedBuildings.length})
                      </Label>
                      
                      <div className="border rounded-lg p-3 bg-muted/30 max-h-64 overflow-y-auto">
                        {buildingFilters.selectedBuildings.length > 0 ? (
                          <div className="space-y-2">
                            {buildingFilters.selectedBuildings.map((buildingId) => {
                              const building = dashboardData.buildings.find(b => b.id === buildingId);
                              return building ? (
                                <div key={buildingId} className="flex items-center justify-between p-2 rounded-md bg-primary/10 border border-primary/20">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">{building.name}</span>
                                    <span className="text-xs text-muted-foreground">{building.projects?.name}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => updateBuildingFilter('selectedBuildings', 
                                      buildingFilters.selectedBuildings.filter(id => id !== buildingId)
                                    )}
                                    className="px-2 py-1 text-xs text-white hover:text-destructive hover:bg-destructive/10 rounded"
                                  >
                                    Clear
                                  </Button>
                                </div>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <div className="text-center text-sm text-muted-foreground py-4">
                            No buildings selected
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'facades' && (
              <div className="space-y-6">
                {/* Facade Selection - Enhanced Multi-select */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Facades</Label>
                    {facadeFilters.selectedFacades.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateFacadeFilter('selectedFacades', [])}
                        className="text-xs"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  
                  {/* Search and Selection Area */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Available Facades with Search */}
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search facades..."
                          className="pl-10"
                          value={facadeFilters.searchTerm || ''}
                          onChange={(e) => updateFacadeFilter('searchTerm', e.target.value)}
                        />
                      </div>
                      
                      <div className="border rounded-lg p-3 bg-muted/30 max-h-64 overflow-y-auto">
                        <div className="space-y-2">
                          {dashboardData.facades
                            .filter(facade => 
                              !facadeFilters.selectedFacades.includes(facade.id) &&
                              (!facadeFilters.searchTerm || 
                               facade.name.toLowerCase().includes(facadeFilters.searchTerm.toLowerCase()) ||
                               facade.buildings?.projects?.name.toLowerCase().includes(facadeFilters.searchTerm.toLowerCase()))
                            )
                            .map((facade) => (
                              <div
                                key={facade.id}
                                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => {
                                  if (!facadeFilters.selectedFacades.includes(facade.id)) {
                                    updateFacadeFilter('selectedFacades', [...facadeFilters.selectedFacades, facade.id]);
                                  }
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{facade.name}</span>
                                  <span className="text-xs text-muted-foreground">{facade.buildings?.projects?.name}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          {dashboardData.facades.filter(facade => 
                            !facadeFilters.selectedFacades.includes(facade.id) &&
                            (!facadeFilters.searchTerm || 
                             facade.name.toLowerCase().includes(facadeFilters.searchTerm.toLowerCase()) ||
                             facade.buildings?.projects?.name.toLowerCase().includes(facadeFilters.searchTerm.toLowerCase()))
                          ).length === 0 && (
                            <div className="text-center text-sm text-muted-foreground py-4">
                              {facadeFilters.searchTerm ? 'No facades found' : 'All facades selected'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Selected Facades */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Selected Facades ({facadeFilters.selectedFacades.length})
                      </Label>
                      
                      <div className="border rounded-lg p-3 bg-muted/30 max-h-64 overflow-y-auto">
                        {facadeFilters.selectedFacades.length > 0 ? (
                          <div className="space-y-2">
                            {facadeFilters.selectedFacades.map((facadeId) => {
                              const facade = dashboardData.facades.find(f => f.id === facadeId);
                              return facade ? (
                                <div key={facadeId} className="flex items-center justify-between p-2 rounded-md bg-primary/10 border border-primary/20">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">{facade.name}</span>
                                    <span className="text-xs text-muted-foreground">{facade.buildings?.projects?.name}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => updateFacadeFilter('selectedFacades', 
                                      facadeFilters.selectedFacades.filter(id => id !== facadeId)
                                    )}
                                    className="px-2 py-1 text-xs text-white hover:text-destructive hover:bg-destructive/10 rounded"
                                  >
                                    Clear
                                  </Button>
                                </div>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <div className="text-center text-sm text-muted-foreground py-4">
                            No facades selected
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enhanced Key Metrics Cards - Mobile Responsive */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
        <Card className="qatar-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-card-foreground">Total Panels</CardTitle>
            <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-card-foreground">{formatNumber(metrics.counts.panels)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.efficiency.panelCompletionRate.toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card className="qatar-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-card-foreground">Project Value</CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-card-foreground">{formatCurrency(metrics.financial.totalEstimatedValue)}</div>
            <p className="text-xs text-muted-foreground">
              <span className="hidden sm:inline">Avg: {formatCurrency(metrics.financial.averageProjectValue)} per project</span>
              <span className="sm:hidden">Avg: {formatCurrency(metrics.financial.averageProjectValue)}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Panel Status Overview - Mobile Responsive */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {PRIMARY_STATUSES.map((status) => (
          <Card key={status} className="qatar-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-card-foreground truncate">
                <span className="hidden sm:inline">{status}</span>
                <span className="sm:hidden">
                  {status === 'Issued For Production' ? 'Issued' :
                   status === 'Proceed for Delivery' ? 'Delivery' :
                   status}
                </span>
              </CardTitle>
              <div className="flex-shrink-0">
                {getStatusIcon(status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-card-foreground">{metrics.status.primary[status]}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.counts.panels > 0 ? ((metrics.status.primary[status] / metrics.counts.panels) * 100).toFixed(1) : 0}% of total
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Enhanced Progress and Analytics - Mobile Responsive */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="qatar-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-card-foreground">
              <Target className="h-5 w-5" />
              Manufacturing Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-card-foreground">Issued For Production</span>
                <span className="text-muted-foreground">
                  {metrics.status.primary['Issued For Production'] + metrics.status.primary['Produced'] + 
                   metrics.status.primary['Delivered'] + metrics.status.primary['Installed'] + 
                   metrics.status.secondary['Proceed for Delivery'] + metrics.status.secondary['Approved Material'] + 
                   metrics.status.secondary['Rejected Material'] + metrics.status.secondary['Inspected'] + 
                   metrics.status.secondary['Approved Final'] + metrics.status.secondary['On Hold'] + 
                   metrics.status.secondary['Cancelled'] + metrics.status.secondary['Broken at Site']} / {metrics.financial.totalEstimatedPanels}
                </span>
              </div>
              <Progress value={((metrics.status.primary['Issued For Production'] + metrics.status.primary['Produced'] + 
                   metrics.status.primary['Delivered'] + metrics.status.primary['Installed'] + 
                   metrics.status.secondary['Proceed for Delivery'] + metrics.status.secondary['Approved Material'] + 
                   metrics.status.secondary['Rejected Material'] + metrics.status.secondary['Inspected'] + 
                   metrics.status.secondary['Approved Final'] + metrics.status.secondary['On Hold'] + 
                   metrics.status.secondary['Cancelled'] + metrics.status.secondary['Broken at Site']) / metrics.financial.totalEstimatedPanels) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {(((metrics.status.primary['Issued For Production'] + metrics.status.primary['Produced'] + 
                   metrics.status.primary['Delivered'] + metrics.status.primary['Installed'] + 
                   metrics.status.secondary['Proceed for Delivery'] + metrics.status.secondary['Approved Material'] + 
                   metrics.status.secondary['Rejected Material'] + metrics.status.secondary['Inspected'] + 
                   metrics.status.secondary['Approved Final'] + metrics.status.secondary['On Hold'] + 
                   metrics.status.secondary['Cancelled'] + metrics.status.secondary['Broken at Site']) / metrics.financial.totalEstimatedPanels) * 100).toFixed(1)}% panels issued for production
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-card-foreground">Delivered Progress</span>
                <span className="text-muted-foreground">
                  {metrics.status.primary['Delivered'] + metrics.status.primary['Installed'] + 
                   metrics.status.secondary['Approved Material'] + metrics.status.secondary['Rejected Material'] + 
                   metrics.status.secondary['Inspected'] + metrics.status.secondary['Approved Final']} / {metrics.financial.totalEstimatedPanels}
                </span>
              </div>
              <Progress value={((metrics.status.primary['Delivered'] + metrics.status.primary['Installed'] + 
                   metrics.status.secondary['Approved Material'] + metrics.status.secondary['Rejected Material'] + 
                   metrics.status.secondary['Inspected'] + metrics.status.secondary['Approved Final']) / metrics.financial.totalEstimatedPanels) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {(((metrics.status.primary['Delivered'] + metrics.status.primary['Installed'] + 
                   metrics.status.secondary['Approved Material'] + metrics.status.secondary['Rejected Material'] + 
                   metrics.status.secondary['Inspected'] + metrics.status.secondary['Approved Final']) / metrics.financial.totalEstimatedPanels) * 100).toFixed(1)}% panels delivered
              </p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-card-foreground">Production Progress</span>
                <span className="text-muted-foreground">
                  {metrics.status.primary['Produced'] + metrics.status.primary['Delivered'] + 
                   metrics.status.primary['Installed'] + metrics.status.secondary['Approved Material'] + metrics.status.secondary['Rejected Material'] + 
                   metrics.status.secondary['Inspected'] + metrics.status.secondary['Approved Final']} / {metrics.financial.totalEstimatedPanels}
                </span>
              </div>
              <Progress value={metrics.efficiency.productionEfficiency} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.efficiency.productionEfficiency.toFixed(1)}% panels produced
              </p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-card-foreground">Produced Progress</span>
                <span className="text-muted-foreground">
                  {metrics.status.primary['Produced'] + metrics.status.primary['Delivered'] + 
                   metrics.status.primary['Installed'] + metrics.status.secondary['Approved Material'] + metrics.status.secondary['Rejected Material'] + 
                   metrics.status.secondary['Inspected'] + metrics.status.secondary['Approved Final']} / {metrics.financial.totalEstimatedPanels}
                </span>
              </div>
              <Progress value={metrics.efficiency.productionEfficiency} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.efficiency.productionEfficiency.toFixed(1)}% panels produced
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-card-foreground">Installation Progress</span>
                <span className="text-sm text-muted-foreground">
                  {metrics.status.primary['Installed']} / {metrics.financial.totalEstimatedPanels}
                </span>
              </div>
              <Progress value={metrics.financial.totalEstimatedPanels > 0 ? (metrics.status.primary['Installed'] / metrics.financial.totalEstimatedPanels) * 100 : 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.financial.totalEstimatedPanels > 0 ? ((metrics.status.primary['Installed'] / metrics.financial.totalEstimatedPanels) * 100).toFixed(1) : 0}% panels installed
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-card-foreground">On Hold Progress</span>
                <span className="text-sm text-muted-foreground">
                  {metrics.status.secondary['On Hold']} / {metrics.financial.totalEstimatedPanels}
                </span>
              </div>
              <Progress value={metrics.status.secondary['On Hold'] > 0 ? (metrics.status.secondary['On Hold'] / metrics.financial.totalEstimatedPanels) * 100 : 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.status.secondary['On Hold'] > 0 ? ((metrics.status.secondary['On Hold'] / metrics.financial.totalEstimatedPanels) * 100).toFixed(1) : 0}% panels on hold
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-card-foreground">Cancelled Progress</span>
                <span className="text-sm text-muted-foreground">
                  {metrics.status.secondary['Cancelled']} / {metrics.financial.totalEstimatedPanels}
                </span>
              </div>
              <Progress value={metrics.status.secondary['Cancelled'] > 0 ? (metrics.status.secondary['Cancelled'] / metrics.financial.totalEstimatedPanels) * 100 : 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.status.secondary['Cancelled'] > 0 ? ((metrics.status.secondary['Cancelled'] / metrics.financial.totalEstimatedPanels) * 100).toFixed(1) : 0}% panels cancelled
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-card-foreground">Broken at Site Progress</span>
                <span className="text-sm text-muted-foreground">
                  {metrics.status.secondary['Broken at Site']} / {metrics.financial.totalEstimatedPanels}
                </span>
              </div>
              <Progress value={metrics.status.secondary['Broken at Site'] > 0 ? (metrics.status.secondary['Broken at Site'] / metrics.financial.totalEstimatedPanels) * 100 : 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.status.secondary['Broken at Site'] > 0 ? ((metrics.status.secondary['Broken at Site'] / metrics.financial.totalEstimatedPanels) * 100).toFixed(1) : 0}% panels broken at site
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="qatar-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-card-foreground">
              <Activity className="h-5 w-5" />
              Efficiency Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-sm text-card-foreground">Production Efficiency</span>
              </div>
              <Badge variant="secondary">
                {metrics.efficiency.productionEfficiency.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-sm text-card-foreground">Delivery Efficiency</span>
              </div>
              <Badge variant="secondary">{metrics.efficiency.deliveryEfficiency.toFixed(1)}%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span className="text-sm text-card-foreground">Overall Completion</span>
              </div>
              <Badge variant="secondary">{metrics.efficiency.overallCompletion.toFixed(1)}%</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="qatar-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-card-foreground">
              <BarChart3 className="h-5 w-5" />
              Key Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-card-foreground">Avg Project Value</span>
              <span className="text-sm font-medium text-card-foreground">{formatCurrency(metrics.financial.averageProjectValue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-card-foreground">Avg Panels/Project</span>
              <span className="text-sm font-medium text-card-foreground">
                {metrics.counts.projects > 0 ? Math.round(metrics.financial.totalEstimatedPanels / metrics.counts.projects) : 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-card-foreground">Manufacturing Rate</span>
              <span className="text-sm font-medium text-card-foreground">
                {metrics.efficiency.projectProgress.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-card-foreground">Installation Progress</span>
              <span className="text-sm font-medium text-card-foreground">
                {metrics.financial.totalEstimatedPanels > 0 ? ((metrics.status.primary['Installed'] / metrics.financial.totalEstimatedPanels) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Charts Section - Mobile Responsive */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Interactive Panel Status Distribution */}
        <Card className="qatar-card">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg text-card-foreground flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Panel Status Distribution</span>
              <span className="sm:hidden">Status Distribution</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPieChartView(pieChartView === 'primary' ? 'secondary' : 'primary')}
                className="ml-auto h-6 px-2 text-xs"
              >
                <span className="hidden sm:inline">{pieChartView === 'primary' ? 'Show Details' : 'Show Overview'}</span>
                <span className="sm:hidden">{pieChartView === 'primary' ? 'Details' : 'Overview'}</span>
              </Button>
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs sm:text-sm">
              {pieChartView === 'primary' 
                ? 'Primary statuses with grouped secondary statuses' 
                : 'Detailed breakdown of secondary statuses'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-white/10 rounded-lg p-3 sm:p-4 backdrop-blur-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Chart Container */}
                <div className="h-64 sm:h-80 flex items-center justify-center">
                  {chartData.pieChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData.pieChart}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          innerRadius={50}
                          outerRadius={90}
                          fill={CHART_COLORS.primary}
                          dataKey="count"
                          nameKey="status"
                          stroke="#ffffff"
                          strokeWidth={2}
                          paddingAngle={3}
                          onClick={handlePieChartClick}
                          style={{ cursor: 'pointer' }}
                        >
                          {chartData.pieChart.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.status === 'Rest' ? '#6B7280' : STATUS_COLORS[entry.status as AllStatus] || '#9CA3AF'} 
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any, name: any) => [`${name} : ${value}`, 'Count']}
                          contentStyle={{
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted/20 flex items-center justify-center mb-3">
                        <PieChartIcon className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                      </div>
                      <p className="text-sm sm:text-base text-muted-foreground">No data available</p>
                      <p className="text-xs text-muted-foreground mt-1">Charts will appear when panel data is loaded</p>
                    </div>
                  )}
                </div>
                
                {/* Legend Container */}
                <div className="space-y-2 sm:space-y-3">
                  {chartData.pieChart.length > 0 ? (
                    <>
                      <div className="space-y-1 sm:space-y-2">
                        {chartData.pieChart.map((item) => (
                          <div key={item.status} className="flex items-center justify-between text-xs sm:text-sm">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span 
                                className="inline-block h-3 w-3 sm:h-4 sm:w-4 rounded-sm flex-shrink-0" 
                                style={{ 
                                  backgroundColor: item.status === 'Rest' ? '#6B7280' : STATUS_COLORS[item.status as AllStatus] || '#9CA3AF' 
                                }} 
                              />
                              <span className="text-muted-foreground truncate text-xs sm:text-sm">{item.status}</span>
                            </div>
                            <span className="font-medium text-foreground text-xs sm:text-sm ml-2 flex-shrink-0">
                              {item.count} ({Math.round((item.count / metrics.counts.panels) * 100)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Total Summary */}
                      <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-white/20">
                        <span className="text-muted-foreground font-medium">Total Panels</span>
                        <span className="font-bold text-foreground">{metrics.counts.panels}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs sm:text-sm text-muted-foreground">No panel data to display</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manufacturing Timeline */}
        <Card className="qatar-card">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg text-card-foreground">
              <span className="hidden sm:inline">Manufacturing Pipeline</span>
              <span className="sm:hidden">Pipeline</span>
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs sm:text-sm">Panel progression through production stages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-white/10 rounded-lg p-2 sm:p-4 backdrop-blur-sm">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={chartData.timeline}>
                  <defs>
                    <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis 
                    dataKey="stage" 
                    tick={{ fill: '#ffffff80', fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fill: '#ffffff80', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="cumulative" 
                    stroke={CHART_COLORS.success}
                    fill="url(#colorArea)"
                    strokeWidth={2}
                  />
                  <Bar 
                    dataKey="count" 
                    fill={CHART_COLORS.warning}
                    radius={[2, 2, 0, 0]}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Location Distribution */}
        <Card className="qatar-card">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg text-card-foreground">
              <span className="hidden sm:inline">Projects by Location</span>
              <span className="sm:hidden">By Location</span>
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs sm:text-sm">Geographic distribution of projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-white/10 rounded-lg p-2 sm:p-4 backdrop-blur-sm">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart layout="vertical" data={chartData.location}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis 
                    type="number" 
                    tick={{ fill: '#ffffff80', fontSize: 10 }}
                  />
                  <YAxis 
                    dataKey="location" 
                    type="category" 
                    width={80}
                    tick={{ fill: '#ffffff80', fontSize: 10 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="count" 
                    fill={CHART_COLORS.info}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Efficiency Radar Chart */}
        <Card className="qatar-card">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg text-card-foreground">
              <span className="hidden sm:inline">Efficiency Overview</span>
              <span className="sm:hidden">Efficiency</span>
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs sm:text-sm">Multi-dimensional performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-white/10 rounded-lg p-2 sm:p-4 backdrop-blur-sm">
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={chartData.efficiency}>
                  <PolarGrid stroke="#ffffff20" />
                  <PolarAngleAxis 
                    dataKey="metric" 
                    tick={{ fill: '#ffffff80', fontSize: 10 }}
                  />
                  <PolarRadiusAxis 
                    tick={{ fill: '#ffffff80', fontSize: 10 }}
                    domain={[0, 100]}
                  />
                  <Radar
                    name="Efficiency"
                    dataKey="value"
                    stroke={CHART_COLORS.primary}
                    fill={CHART_COLORS.primary}
                    fillOpacity={0.3}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section-Specific Content */}
      {activeSection === 'projects' && (
      <Card className="qatar-card">
        <CardHeader>
            <CardTitle className="text-lg text-card-foreground">Project Insights & Analytics</CardTitle>
            <CardDescription className="text-muted-foreground">Comprehensive project performance and financial metrics</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Project Financial Overview */}
          <div className="space-y-4">
                <h4 className="font-medium text-card-foreground">Financial Performance</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                    <span className="text-sm text-muted-foreground">Total Project Value</span>
                    <span className="font-semibold text-card-foreground">{formatCurrency(metrics.financial.totalEstimatedValue)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                    <span className="text-sm text-muted-foreground">Average Project Value</span>
                    <span className="font-semibold text-card-foreground">{formatCurrency(metrics.financial.averageProjectValue)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                    <span className="text-sm text-muted-foreground">Total Estimated Panels</span>
                    <span className="font-semibold text-card-foreground">{formatNumber(metrics.financial.totalEstimatedPanels)}</span>
                  </div>
                </div>
              </div>
              
              {/* Project Overview */}
              <div className="space-y-4">
                <h4 className="font-medium text-card-foreground">Project Overview</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-orange-500/20">
                    <span className="text-sm text-orange-700 dark:text-orange-300">On Hold Projects</span>
                    <Badge variant="secondary" className="bg-orange-500 text-white">{metrics.counts.onHoldProjects}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === 'buildings' && (
        <Card className="qatar-card">
          <CardHeader>
            <CardTitle className="text-lg text-card-foreground">Building Infrastructure Insights</CardTitle>
            <CardDescription className="text-muted-foreground">Building performance, capacity, and operational metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Building Overview */}
              <div className="space-y-4">
                <h4 className="font-medium text-card-foreground">Building Overview</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                    <span className="text-sm text-muted-foreground">Total Buildings</span>
                    <span className="font-semibold text-card-foreground">{formatNumber(metrics.counts.buildings)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                    <span className="text-sm text-muted-foreground">Buildings per Project</span>
                    <span className="font-semibold text-card-foreground">
                      {metrics.counts.projects > 0 ? (metrics.counts.buildings / metrics.counts.projects).toFixed(1) : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                    <span className="text-sm text-muted-foreground">Panels per Building</span>
                    <span className="font-semibold text-card-foreground">
                      {metrics.counts.buildings > 0 ? (metrics.counts.panels / metrics.counts.buildings).toFixed(1) : 0}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Building Performance */}
              <div className="space-y-4">
                <h4 className="font-medium text-card-foreground">Performance Metrics</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-purple-500/20">
                    <span className="text-sm text-purple-700 dark:text-purple-300">Installation Efficiency</span>
                    <Badge variant="secondary" className="bg-purple-500 text-white">
                      {metrics.efficiency.panelCompletionRate.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-cyan-500/20">
                    <span className="text-sm text-cyan-700 dark:text-cyan-300">Production Rate</span>
                    <Badge variant="secondary" className="bg-cyan-500 text-white">
                      {metrics.efficiency.projectProgress.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === 'facades' && (
        <Card className="qatar-card">
          <CardHeader>
            <CardTitle className="text-lg text-card-foreground">Facade Engineering Insights</CardTitle>
            <CardDescription className="text-muted-foreground">Facade design, manufacturing, and installation analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Facade Overview */}
              <div className="space-y-4">
                <h4 className="font-medium text-card-foreground">Facade Overview</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                    <span className="text-sm text-muted-foreground">Total Facades</span>
                    <span className="font-semibold text-card-foreground">{formatNumber(metrics.counts.facades)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                    <span className="text-sm text-muted-foreground">Facades per Building</span>
                    <span className="font-semibold text-card-foreground">
                      {metrics.counts.buildings > 0 ? (metrics.counts.facades / metrics.counts.buildings).toFixed(1) : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                    <span className="text-sm text-muted-foreground">Panels per Facade</span>
                    <span className="font-semibold text-card-foreground">
                      {metrics.counts.facades > 0 ? (metrics.counts.panels / metrics.counts.facades).toFixed(1) : 0}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Manufacturing Pipeline */}
              <div className="space-y-4">
                <h4 className="font-medium text-card-foreground">Manufacturing Pipeline</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-amber-500/20">
                    <span className="text-sm text-amber-700 dark:text-amber-300">Issued for Production</span>
                    <Badge variant="secondary" className="bg-amber-500 text-white">
                      {metrics.status.primary['Issued for Production']}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/20">
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">Produced</span>
                    <Badge variant="secondary" className="bg-emerald-500 text-white">
                      {metrics.status.primary['Produced']}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-blue-500/20">
                    <span className="text-sm text-blue-700 dark:text-blue-300">Delivered</span>
                    <Badge variant="secondary" className="bg-blue-500 text-white">
                      {metrics.status.primary['Delivered']}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Recent Projects Activity - Mobile Responsive */}
      <Card className="qatar-card">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg text-card-foreground">
            {activeSection === 'projects' && (
              <>
                <span className="hidden sm:inline">Recent Projects</span>
                <span className="sm:hidden">Recent Projects</span>
              </>
            )}
            {activeSection === 'buildings' && (
              <>
                <span className="hidden sm:inline">Recent Building Updates</span>
                <span className="sm:hidden">Building Updates</span>
              </>
            )}
            {activeSection === 'facades' && (
              <>
                <span className="hidden sm:inline">Recent Facade Activities</span>
                <span className="sm:hidden">Facade Activities</span>
              </>
            )}
          </CardTitle>
          <CardDescription className="text-muted-foreground text-xs sm:text-sm">
            {activeSection === 'projects' && 'Latest project activity and updates'}
            {activeSection === 'buildings' && 'Latest building construction and modification updates'}
            {activeSection === 'facades' && 'Latest facade design and installation updates'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            {dashboardData.projects.slice(0, 5).map((project) => (
              <div key={project.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg border border-border/50 bg-white/5 backdrop-blur-sm gap-3 sm:gap-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 flex-shrink-0">
                    <FolderOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-card-foreground text-sm sm:text-base truncate">{project.name}</h4>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{project.customer}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{project.location}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{formatCurrency(project.estimated_cost || 0)}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2">
                  <div className="flex items-center gap-2">
                    {project.status === 'active' && <Badge className="status-active text-xs">Active</Badge>}
                    {project.status === 'completed' && <Badge className="status-complete text-xs">Completed</Badge>}
                    {project.status === 'on-hold' && <Badge className="status-onhold text-xs">On Hold</Badge>}
                    {project.status === 'inactive' && <Badge className="status-inactive text-xs">Inactive</Badge>}
                  </div>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {project.estimatedPanels || 0} panels
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}

interface BulkImportPageProps {
  customers: any[];
  onImportProjects: (projects: any[]) => Promise<void>;
  onNavigateBack: () => void;
}

interface ImportedProject {
  id: string;
  name: string;
  customer: string;
  customerId: string;
  location: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'on-hold';
  estimatedCost: number;
  estimatedPanels: number;
  isValid: boolean;
  errors: string[];
}

export function BulkImportPage({ customers, onImportProjects, onNavigateBack }: BulkImportPageProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [projects, setProjects] = useState<ImportedProject[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState({ successful: 0, failed: 0 });
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter states for preview table
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [validityFilter, setValidityFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const resetImport = () => {
    setStep('upload');
    setFile(null);
    setProjects([]);
    setImporting(false);
    setImportProgress(0);
    setImportResults({ successful: 0, failed: 0 });
    setErrors([]);
    // Reset filters
    setSearchTerm('');
    setCustomerFilter('all');
    setStatusFilter('all');
    setLocationFilter('all');
    setValidityFilter('all');
    setDateRangeFilter('all');
    setCurrentPage(1);
  };

  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCustomerFilter('all');
    setStatusFilter('all');
    setLocationFilter('all');
    setValidityFilter('all');
    setDateRangeFilter('all');
    setCurrentPage(1);
  };

  // Calculate active filters count
  const activeFiltersCount = [
    searchTerm,
    customerFilter !== 'all' ? customerFilter : '',
    statusFilter !== 'all' ? statusFilter : '',
    locationFilter !== 'all' ? locationFilter : '',
    validityFilter !== 'all' ? validityFilter : '',
    dateRangeFilter !== 'all' ? dateRangeFilter : ''
  ].filter(Boolean).length;

  // Get unique values for filters
  const uniqueCustomers = Array.from(new Set(projects.map(p => p.customer).filter(Boolean))).sort();
  const uniqueLocations = Array.from(new Set(projects.map(p => p.location).filter(Boolean))).sort();

  // Filter projects based on all criteria
  const filteredProjects = projects.filter(project => {
    const matchesSearch = searchTerm === '' || 
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCustomer = customerFilter === 'all' || project.customer === customerFilter;
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesLocation = locationFilter === 'all' || project.location === locationFilter;
    const matchesValidity = validityFilter === 'all' || 
      (validityFilter === 'valid' && project.isValid) ||
      (validityFilter === 'invalid' && !project.isValid);
    
    const matchesDateRange = (() => {
      if (dateRangeFilter === 'all') return true;
      if (!project.startDate) return false;
      
      const startDate = new Date(project.startDate);
      const now = new Date();
      
      switch (dateRangeFilter) {
        case 'this-month': {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          return startDate >= monthStart && startDate <= monthEnd;
        }
        case 'this-quarter': {
          const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
          return startDate >= quarterStart && startDate <= quarterEnd;
        }
        case 'this-year': {
          const yearStart = new Date(now.getFullYear(), 0, 1);
          const yearEnd = new Date(now.getFullYear(), 11, 31);
          return startDate >= yearStart && startDate <= yearEnd;
        }
        case 'next-year': {
          const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
          const nextYearEnd = new Date(now.getFullYear() + 1, 11, 31);
          return startDate >= nextYearStart && startDate <= nextYearEnd;
        }
        default: return true;
      }
    })();
    
    return matchesSearch && matchesCustomer && matchesStatus && matchesLocation && matchesValidity && matchesDateRange;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredProjects.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

  const handleFileUpload = async (selectedFile: File) => {
    if (!selectedFile) return;

    try {
      setFile(selectedFile);
      setErrors([]);
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      if (jsonData.length === 0) {
        setErrors(['The Excel file appears to be empty or invalid.']);
        return;
      }

      // Parse and validate the imported data
      const parsedProjects: ImportedProject[] = jsonData.map((row: any, index: number) => {
        const project: ImportedProject = {
          id: `import-${Date.now()}-${index}`,
          name: row['Project Name'] || row['Name'] || row['project_name'] || '',
          customer: row['Customer'] || row['customer'] || '',
          customerId: '',
          location: row['Location'] || row['location'] || '',
          startDate: formatDate(row['Start Date'] || row['StartDate'] || row['start_date']),
          endDate: formatDate(row['End Date'] || row['EndDate'] || row['end_date']),
          status: normalizeStatus(row['Status'] || row['status'] || 'active'),
          estimatedCost: parseNumber(row['Estimated Cost'] || row['EstimatedCost'] || row['estimated_cost'] || 0),
          estimatedPanels: parseInt(row['Estimated Panels'] || row['EstimatedPanels'] || row['estimated_panels'] || '0') || 0,
          isValid: true,
          errors: []
        };

        // Validate the project
        validateProject(project);
        
        // Try to match customer
        const matchedCustomer = customers.find(c => 
          c.name.toLowerCase().trim() === project.customer.toLowerCase().trim()
        );
        
        if (matchedCustomer) {
          project.customerId = matchedCustomer.id;
        } else if (project.customer) {
          project.errors.push(`Customer "${project.customer}" not found`);
          project.isValid = false;
        }

        return project;
      });

      setProjects(parsedProjects);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      setErrors(['Failed to parse Excel file. Please ensure it\'s a valid .xlsx file.']);
    }
  };

  const formatDate = (dateValue: any): string => {
    if (!dateValue) return '';
    
    // Handle Excel date serial numbers
    if (typeof dateValue === 'number') {
      const date = new Date((dateValue - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    // Handle string dates
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    return '';
  };

  const parseNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[,$]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const normalizeStatus = (status: string): 'active' | 'completed' | 'on-hold' => {
    const normalized = status.toLowerCase().trim();
    if (normalized.includes('complete')) return 'completed';
    if (normalized.includes('hold') || normalized.includes('pause')) return 'on-hold';
    return 'active';
  };

  const validateProject = (project: ImportedProject) => {
    const errors: string[] = [];

    if (!project.name.trim()) {
      errors.push('Project name is required');
    }

    if (!project.customer.trim()) {
      errors.push('Customer is required');
    }

    if (!project.location.trim()) {
      errors.push('Location is required');
    }

    if (!project.startDate) {
      errors.push('Start date is required');
    }

    if (!project.endDate) {
      errors.push('End date is required');
    }

    if (project.startDate && project.endDate && new Date(project.startDate) >= new Date(project.endDate)) {
      errors.push('End date must be after start date');
    }

    if (project.estimatedCost < 0) {
      errors.push('Estimated cost cannot be negative');
    }

    if (project.estimatedPanels < 0) {
      errors.push('Estimated panels cannot be negative');
    }

    project.errors = errors;
    project.isValid = errors.length === 0;
  };

  const updateProject = (index: number, field: keyof ImportedProject, value: any) => {
    const actualIndex = projects.findIndex(p => p.id === paginatedProjects[index].id);
    const updatedProjects = [...projects];
    (updatedProjects[actualIndex] as any)[field] = value;
    
    // Re-validate after update
    validateProject(updatedProjects[actualIndex]);
    
    // Update customer ID if customer name changed
    if (field === 'customer') {
      const matchedCustomer = customers.find(c => 
        c.name.toLowerCase().trim() === value.toLowerCase().trim()
      );
      updatedProjects[actualIndex].customerId = matchedCustomer?.id || '';
    }
    
    setProjects(updatedProjects);
  };

  const removeProject = (index: number) => {
    const projectToRemove = paginatedProjects[index];
    setProjects(prev => prev.filter(p => p.id !== projectToRemove.id));
  };

  const handleImport = async () => {
    const validProjects = projects.filter(p => p.isValid);
    if (validProjects.length === 0) {
      setErrors(['No valid projects to import. Please fix the errors and try again.']);
      return;
    }

    try {
      setImporting(true);
      setStep('importing');
      setImportProgress(0);

      let successful = 0;
      let failed = 0;

      for (let i = 0; i < validProjects.length; i++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to show progress
          successful++;
        } catch (error) {
          console.error('Error importing project:', error);
          failed++;
        }

        setImportProgress(((i + 1) / validProjects.length) * 100);
      }

      // Call the parent import function with all valid projects
      await onImportProjects(validProjects.map(p => ({
        name: p.name,
        customer: p.customer,
        customerId: p.customerId,
        location: p.location,
        startDate: p.startDate,
        endDate: p.endDate,
        status: p.status,
        estimatedCost: p.estimatedCost,
        estimatedPanels: p.estimatedPanels
      })));

      setImportResults({ successful, failed });
      setStep('complete');
    } catch (error) {
      console.error('Bulk import error:', error);
      setErrors(['Failed to import projects. Please try again.']);
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Project Name': 'Sample Project 1',
        'Customer': 'ACME Corporation',
        'Location': 'New York, NY',
        'Start Date': '2024-01-15',
        'End Date': '2024-06-30',
        'Status': 'active',
        'Estimated Cost': 50000,
        'Estimated Panels': 25
      },
      {
        'Project Name': 'Sample Project 2',
        'Customer': 'TechCorp Inc',
        'Location': 'San Francisco, CA',
        'Start Date': '2024-02-01',
        'End Date': '2024-08-15',
        'Status': 'active',
        'Estimated Cost': 75000,
        'Estimated Panels': 40
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Projects Template');
    XLSX.writeFile(wb, 'projects_import_template.xlsx');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'on-hold': return 'destructive';
      default: return 'secondary';
    }
  };

  const validProjectsCount = projects.filter(p => p.isValid).length;
  const invalidProjectsCount = projects.length - validProjectsCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            Bulk Import Projects
          </h1>
          <p className="text-muted-foreground">Import multiple projects from an Excel file (.xlsx)</p>
        </div>
        
        {step === 'upload' && (
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
        )}
      </div>

      {/* Progress Indicator */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-primary' : step === 'preview' || step === 'importing' || step === 'complete' ? 'text-green-600' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${step === 'upload' ? 'border-primary' : step === 'preview' || step === 'importing' || step === 'complete' ? 'border-green-600 bg-green-600 text-white' : 'border-muted-foreground'}`}>
                  {step === 'preview' || step === 'importing' || step === 'complete' ? <CheckCircle className="h-4 w-4" /> : '1'}
                </div>
                <span>Upload File</span>
              </div>
              
              <div className={`flex items-center gap-2 ${step === 'preview' ? 'text-primary' : step === 'importing' || step === 'complete' ? 'text-green-600' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${step === 'preview' ? 'border-primary' : step === 'importing' || step === 'complete' ? 'border-green-600 bg-green-600 text-white' : 'border-muted-foreground'}`}>
                  {step === 'importing' || step === 'complete' ? <CheckCircle className="h-4 w-4" /> : '2'}
                </div>
                <span>Preview & Edit</span>
              </div>
              
              <div className={`flex items-center gap-2 ${step === 'importing' ? 'text-primary' : step === 'complete' ? 'text-green-600' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${step === 'importing' ? 'border-primary' : step === 'complete' ? 'border-green-600 bg-green-600 text-white' : 'border-muted-foreground'}`}>
                  {step === 'complete' ? <CheckCircle className="h-4 w-4" /> : '3'}
                </div>
                <span>Import</span>
              </div>
              
              <div className={`flex items-center gap-2 ${step === 'complete' ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${step === 'complete' ? 'border-primary' : 'border-muted-foreground'}`}>
                  {step === 'complete' ? <CheckCircle className="h-4 w-4" /> : '4'}
                </div>
                <span>Complete</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Step */}
      {step === 'upload' && (
        <div className="space-y-6">
          {errors.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Upload Excel File</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files);
                    const excelFile = files.find(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
                    if (excelFile) handleFileUpload(excelFile);
                  }}
                >
                  <Upload className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
                  <h4 className="text-xl font-medium mb-3">Drop your Excel file here</h4>
                  <p className="text-muted-foreground mb-4">or click to browse files</p>
                  <p className="text-sm text-muted-foreground">
                    Supports .xlsx files with the required project columns
                  </p>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Import Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Excel file must be in .xlsx format</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Required columns: Project Name, Customer, Location, Start Date, End Date</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Customer names must match existing customers exactly</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Dates should be in YYYY-MM-DD format or Excel date format</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Optional columns: Status, Estimated Cost, Estimated Panels</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Preview Import Data</h3>
              <p className="text-sm text-muted-foreground">
                Review and edit the imported projects before completing the import
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="secondary">
                {validProjectsCount} Valid
              </Badge>
              {invalidProjectsCount > 0 && (
                <Badge variant="destructive">
                  {invalidProjectsCount} Invalid
                </Badge>
              )}
            </div>
          </div>

          {/* Filters & Search */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Filters & Search</CardTitle>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="h-5 w-5 p-0 text-xs">
                    {activeFiltersCount}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* First row - Mobile Responsive */}
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                  {/* Search */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search projects..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          handleFilterChange();
                        }}
                        className="pl-7 sm:pl-8 text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* Customer Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Customer</Label>
                    <Select value={customerFilter} onValueChange={(value) => {
                      setCustomerFilter(value);
                      handleFilterChange();
                    }}>
                      <SelectTrigger className="text-xs sm:text-sm">
                        <SelectValue placeholder="All customers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All customers</SelectItem>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Status</Label>
                    <Select value={statusFilter} onValueChange={(value) => {
                      setStatusFilter(value);
                      handleFilterChange();
                    }}>
                      <SelectTrigger className="text-xs sm:text-sm">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="on-hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Location Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Location</Label>
                    <Select value={locationFilter} onValueChange={(value) => {
                      setLocationFilter(value);
                      handleFilterChange();
                    }}>
                      <SelectTrigger className="text-xs sm:text-sm">
                        <SelectValue placeholder="All locations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All locations</SelectItem>
                        {uniqueLocations.map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Page Size */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Items per page</Label>
                    <Select value={pageSize.toString()} onValueChange={(value) => {
                      setPageSize(parseInt(value));
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 per page</SelectItem>
                        <SelectItem value="25">25 per page</SelectItem>
                        <SelectItem value="50">50 per page</SelectItem>
                        <SelectItem value="100">100 per page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Second row - Mobile Responsive */}
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Validity Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Validation Status</Label>
                    <Select value={validityFilter} onValueChange={(value) => {
                      setValidityFilter(value);
                      handleFilterChange();
                    }}>
                      <SelectTrigger className="text-xs sm:text-sm">
                        <SelectValue placeholder="All items" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All items</SelectItem>
                        <SelectItem value="valid">Valid only</SelectItem>
                        <SelectItem value="invalid">Invalid only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Range Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Start Date Range</Label>
                    <Select value={dateRangeFilter} onValueChange={(value) => {
                      setDateRangeFilter(value);
                      handleFilterChange();
                    }}>
                      <SelectTrigger className="text-xs sm:text-sm">
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any time</SelectItem>
                        <SelectItem value="this-month">This month</SelectItem>
                        <SelectItem value="this-quarter">This quarter</SelectItem>
                        <SelectItem value="this-year">This year</SelectItem>
                        <SelectItem value="next-year">Next year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t gap-3 sm:gap-0">
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredProjects.length)} of {filteredProjects.length} projects
                </div>
                <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs sm:text-sm">
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data Table - Mobile Responsive */}
          {filteredProjects.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-6 sm:w-8"></TableHead>
                        <TableHead className="min-w-[150px] sm:min-w-[200px]">Project Name</TableHead>
                        <TableHead className="min-w-[120px] sm:min-w-[150px]">Customer</TableHead>
                        <TableHead className="min-w-[100px] sm:min-w-[120px]">Location</TableHead>
                        <TableHead className="min-w-[100px] sm:min-w-[120px]">Start Date</TableHead>
                        <TableHead className="min-w-[100px] sm:min-w-[120px]">End Date</TableHead>
                        <TableHead className="min-w-[80px] sm:min-w-[100px]">Status</TableHead>
                        <TableHead className="min-w-[100px] sm:min-w-[120px]">Est. Cost</TableHead>
                        <TableHead className="min-w-[80px] sm:min-w-[100px]">Est. Panels</TableHead>
                        <TableHead className="w-8 sm:w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProjects.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2">
                              <FileSpreadsheet className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                              <p className="text-muted-foreground text-sm sm:text-base">
                                No projects match your search criteria
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedProjects.map((project, index) => (
                          <TableRow key={project.id} className={!project.isValid ? 'bg-destructive/5' : ''}>
                            <TableCell>
                              {project.isValid ? (
                                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                value={project.name}
                                onChange={(e) => updateProject(index, 'name', e.target.value)}
                                className={`text-xs sm:text-sm ${project.errors.some(e => e.includes('name')) ? 'border-destructive' : ''}`}
                                placeholder="Enter project name"
                              />
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={project.customerId} 
                                onValueChange={(value) => {
                                  const customer = customers.find(c => c.id === value);
                                  updateProject(index, 'customer', customer?.name || '');
                                  updateProject(index, 'customerId', value);
                                }}
                              >
                                <SelectTrigger className={`text-xs sm:text-sm ${project.errors.some(e => e.includes('Customer')) ? 'border-destructive' : ''}`}>
                                  <SelectValue placeholder="Select customer" />
                                </SelectTrigger>
                                <SelectContent>
                                  {customers.map((customer) => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                      {customer.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={project.location}
                                onChange={(e) => updateProject(index, 'location', e.target.value)}
                                className={`text-xs sm:text-sm ${project.errors.some(e => e.includes('location')) ? 'border-destructive' : ''}`}
                                placeholder="Enter location"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={project.startDate}
                                onChange={(e) => updateProject(index, 'startDate', e.target.value)}
                                className={`text-xs sm:text-sm ${project.errors.some(e => e.includes('Start')) ? 'border-destructive' : ''}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={project.endDate}
                                onChange={(e) => updateProject(index, 'endDate', e.target.value)}
                                className={`text-xs sm:text-sm ${project.errors.some(e => e.includes('End')) ? 'border-destructive' : ''}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Select value={project.status} onValueChange={(value: any) => updateProject(index, 'status', value)}>
                                <SelectTrigger className="text-xs sm:text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="on-hold">On Hold</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="100"
                                value={project.estimatedCost}
                                onChange={(e) => updateProject(index, 'estimatedCost', parseInt(e.target.value) || 0)}
                                className={`text-xs sm:text-sm ${project.errors.some(e => e.includes('cost')) ? 'border-destructive' : ''}`}
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={project.estimatedPanels}
                                onChange={(e) => updateProject(index, 'estimatedPanels', parseInt(e.target.value) || 0)}
                                className={`text-xs sm:text-sm ${project.errors.some(e => e.includes('panels')) ? 'border-destructive' : ''}`}
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeProject(index)}
                                className="h-6 w-6 sm:h-8 sm:w-8 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination - Mobile Responsive */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between p-3 sm:p-4 border-t gap-3 sm:gap-0">
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      <span className="text-xs sm:text-sm px-2">
                        {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {invalidProjectsCount > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {invalidProjectsCount} project(s) have validation errors. Please fix them before importing.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep('upload')}>
              Back to Upload
            </Button>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={resetImport}>
                Start Over
              </Button>
              <Button onClick={handleImport} disabled={validProjectsCount === 0}>
                Import {validProjectsCount} Project{validProjectsCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Importing Step */}
      {step === 'importing' && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="space-y-6">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-medium">Importing Projects...</h3>
                <p className="text-muted-foreground">Please wait while we process your data</p>
              </div>
              <div className="space-y-4 max-w-md mx-auto">
                <Progress value={importProgress} className="w-full" />
                <p className="text-sm text-muted-foreground">
                  {Math.round(importProgress)}% complete
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Step */}
      {step === 'complete' && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="space-y-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-medium">Import Complete!</h3>
                <p className="text-muted-foreground">
                  {importResults.successful} projects have been imported successfully.
                </p>
              </div>
              <div className="flex items-center justify-center gap-4">
                <Button onClick={resetImport}>
                  Import More Projects
                </Button>
                <Button variant="outline" onClick={onNavigateBack}>
                  Back to Projects
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Main HomePage component that combines Dashboard and BulkImportPage
interface HomePageProps {
  customers?: any[];
  projects?: any[];
  panels?: any[];
  buildings?: any[];
  facades?: any[];
}

export function HomePage({ customers = [], projects = [], panels = [], buildings = [], facades = [] }: HomePageProps) {
  const [currentView, setCurrentView] = useState<'dashboard' | 'bulk-import'>('dashboard');
  const [importedProjects, setImportedProjects] = useState<any[]>([]);

  const handleImportProjects = async (projects: any[]) => {
    // Simulate importing projects
    setImportedProjects(prev => [...prev, ...projects]);
    // In a real app, this would call an API
    return Promise.resolve();
  };

  const handleNavigateBack = () => {
    setCurrentView('dashboard');
  };

  return (
    <div className="container mx-auto p-6">
      {currentView === 'dashboard' ? (
        <div>
          <div className="flex items-center justify-between mb-6">
            
            {/* <Button onClick={() => setCurrentView('bulk-import')}>
              Bulk Import Projects
            </Button> */}
          </div>
          <Dashboard customers={customers} projects={projects} panels={panels} buildings={buildings} facades={facades} />
        </div>
      ) : (
        <BulkImportPage 
          customers={customers}
          onImportProjects={handleImportProjects}
          onNavigateBack={handleNavigateBack}
        />
      )}
    </div>
  );
}