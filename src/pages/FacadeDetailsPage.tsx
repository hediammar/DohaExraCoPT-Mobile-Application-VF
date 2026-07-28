import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Layers, Edit, Trash2, Building2, FolderOpen, TrendingUp, Clock, User, MapPin, Square, DollarSign, Weight, Package } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { supabase } from "../lib/supabase";
import { PanelsSection } from "../components/project-details/PanelsSection";
import { FacadeModalTrigger } from "../components/FacadeModal";
import { useAuth } from "../contexts/AuthContext";
import { hasPermission, UserRole } from "../utils/rolePermissions";
import { useToastContext } from "../contexts/ToastContext";
import { crudOperations } from "../utils/userTracking";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface Facade {
  id: string;
  name: string;
  building_id: string;
  status: number;
  description?: string;
  created_at: string;
  updated_at: string;
  totalArea: number;
  totalAmount: number;
  totalWeight: number;
}

interface Building {
  id: string;
  name: string;
  project_id: string;
  status: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
  customer_id: string;
  location: string;
  start_date: string;
  end_date: string;
  status: number;
  estimated_cost: number;
  estimated_panels: number;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export function FacadeDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const { user: currentUser } = useAuth();
  
  const [facade, setFacade] = useState<Facade | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("panels");
  const [panelStatusCounts, setPanelStatusCounts] = useState<Record<string, number>>({});
  const [totalPanels, setTotalPanels] = useState<number>(0);

  const canEditFacades = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'facades', 'canUpdate') : false;
  const canDeleteFacades = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'facades', 'canDelete') : false;

  // Panel status domain used across the app
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
  ] as const;

  const statusMap: { [key: number]: string } = Object.fromEntries(
    PANEL_STATUSES.map((status, index) => [index, status])
  );

  // Color palette per status
  const STATUS_COLORS: Record<string, string> = {
    "Issued For Production": "#E11D48",
    Produced: "#F59E0B",
    Inspected: "#8B5CF6",
    "Approved Material": "#22C55E",
    "Rejected Material": "#EF4444",
    Issued: "#2563EB",
    "Proceed for Delivery": "#06B6D4",
    Delivered: "#3B82F6",
    Installed: "#10B981",
    "Approved Final": "#84CC16",
    "Broken at Site": "#F97316",
    "On Hold": "#A3A3A3",
    Cancelled: "#475569",
  };

  useEffect(() => {
    if (id) {
      loadFacadeDetails(id);
    }
  }, [id]);

  const loadFacadeDetails = async (facadeId: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`Loading facade details for ID: ${facadeId}`);

      // Fetch facade with building, project and customer data
      const { data: facadeData, error: facadeError } = await supabase
        .from('facades')
        .select(`
          *,
          buildings (
            *,
            projects (
              *,
              customers (id, name, email, phone, created_at, updated_at)
            )
          )
        `)
        .eq('id', facadeId)
        .single();

      if (facadeError) {
        throw facadeError;
      }

      if (facadeData) {
        // Calculate totals from panels and get status counts
        const { data: panelsData, error: panelsError } = await supabase
          .from('panels')
          .select('ifp_qty_area_sm, unit_rate_qr_m2, weight, status')
          .eq('facade_id', facadeId);

        if (panelsError) {
          console.error('Error fetching panels for totals:', panelsError);
        }

        const totals = {
          totalArea: panelsData?.reduce((sum, panel) => sum + (panel.ifp_qty_area_sm || 0), 0) || 0,
          totalAmount: panelsData?.reduce((sum, panel) => sum + ((panel.ifp_qty_area_sm || 0) * (panel.unit_rate_qr_m2 || 0)), 0) || 0,
          totalWeight: panelsData?.reduce((sum, panel) => sum + (panel.weight || 0), 0) || 0,
        };

        // Calculate panel status counts
        const counts: Record<string, number> = {};
        for (const panel of panelsData || []) {
          const statusName = statusMap[panel.status] || "Unknown";
          counts[statusName] = (counts[statusName] || 0) + 1;
        }
        setPanelStatusCounts(counts);
        setTotalPanels(panelsData?.length || 0);

        setFacade({
          ...facadeData,
          ...totals
        });
        setBuilding(facadeData.buildings);
        setProject(facadeData.buildings.projects);
        setCustomer(facadeData.buildings.projects.customers);
        console.log("Facade details loaded successfully:", facadeData.name);
        console.log("Facade ID:", facadeData.id);
        console.log("Building:", facadeData.buildings.name);
        console.log("Building ID:", facadeData.buildings.id);
      } else {
        setError("Facade not found");
      }
    } catch (err) {
      console.error("Error loading facade details:", err);
      setError("Failed to load facade details");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!facade) return;

    try {
      await crudOperations.delete('facades', facade.id);
      showToast('Facade deleted successfully', 'success');
      navigate(`/buildings/${facade.building_id}`);
    } catch (error) {
      console.error('Error deleting facade:', error);
      showToast('Error deleting facade', 'error');
    }
  };

  const getStatusBadge = (status: number) => {
    const statusMap: { [key: number]: string } = {
      0: "inactive",
      1: "active",
      2: "on-hold",
      3: "completed"
    };

    const statusString = statusMap[status] || "inactive";
    const statusConfig = {
      active: {
        variant: "default",
        label: "Active",
        color: "bg-status-active text-status-active-foreground",
      },
      completed: {
        variant: "secondary",
        label: "Completed",
        color: "bg-status-complete text-status-complete-foreground",
      },
      "on-hold": {
        variant: "destructive",
        label: "On Hold",
        color: "bg-status-onhold text-status-onhold-foreground",
      },
      inactive: {
        variant: "outline",
        label: "Inactive",
        color: "bg-status-inactive text-status-inactive-foreground",
      },
    };

    const config = statusConfig[statusString as keyof typeof statusConfig] || {
      variant: "secondary",
      label: statusString,
      color: "bg-secondary text-secondary-foreground",
    };

    return (
      <Badge className={`text-xs ${config.color}`}>
        {config.label}
      </Badge>
    );
  };

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
    if (!project || !project.estimated_panels || project.estimated_panels === 0)
      return 0;
    return Math.round(((panelStatusCounts["Installed"] || 0) / project.estimated_panels) * 100);
  };

  const pieData = Object.entries(panelStatusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ name: status, value: count }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading facade details...</p>
        </div>
      </div>
    );
  }

  if (error || !facade) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Facade not found</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => navigate("/projects")}>
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  // Debug logging
  console.log("Passing to PanelsSection - facadeId:", facade?.id, "facadeName:", facade?.name, "building:", building?.name);

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/buildings/${facade.building_id}`)}
          className="hover:bg-accent h-9 text-xs sm:text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
          <span className="hidden sm:inline">Back to Building</span>
          <span className="sm:hidden">Back</span>
        </Button>
      </div>

      {/* Facade Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{facade.name}</h1>
            {getStatusBadge(facade.status)}
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            FCD-{facade.id.slice(-4).toUpperCase()}
          </p>
        </div>
        <div className="flex gap-2">
          {canEditFacades && (
            <FacadeModalTrigger
              onSubmit={async (data) => {
                const { error } = await supabase
                  .from('facades')
                  .update({
                    name: data.name,
                    building_id: data.building_id,
                    status: data.status,
                    description: data.description,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', facade.id);

                if (error) {
                  console.error('Error updating facade:', error);
                  showToast('Error updating facade', 'error');
                  return;
                }

                setFacade({ ...facade, ...data, updated_at: new Date().toISOString() });
                showToast('Facade updated successfully', 'success');
              }}
              editingFacade={facade}
              currentProject={project ? {
                id: project.id,
                name: project.name,
                customer: customer?.name
              } : undefined}
              currentBuilding={building ? {
                id: building.id,
                name: building.name
              } : undefined}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
          )}
          {canDeleteFacades && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="border-red-400/50 text-red-400 hover:bg-red-400/10 h-9 w-9 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Facade Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Building Card */}
        <Card className="qatar-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Building</CardTitle>
            <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold truncate">{building?.name || 'No Building'}</div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {project?.name || 'No Project'}
            </p>
          </CardContent>
        </Card>

        {/* Location Card */}
        <Card className="qatar-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Location</CardTitle>
            <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold truncate">{project?.location || 'Unknown'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Project Site
            </p>
          </CardContent>
        </Card>

        {/* Description Card */}
        <Card className="qatar-card">
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Description</CardTitle>
            <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xs sm:text-sm font-medium line-clamp-2">
              {facade.description || "No description provided"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Facade Details
            </p>
          </CardContent>
        </Card>

        {/* Estimated Panels Card */}
        <Card className="qatar-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Estimated Panels</CardTitle>
            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold">
              {project?.estimated_panels || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total Panels
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Facade Details Grid - 2x2 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left Column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Manufacturing Pipeline */}
          <Card className="qatar-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                Manufacturing Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs sm:text-sm font-medium text-card-foreground">Issued For Production</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {(panelStatusCounts['Issued For Production'] || 0) + (panelStatusCounts['Produced'] || 0) + 
                     (panelStatusCounts['Proceed for Delivery'] || 0) + (panelStatusCounts['Delivered'] || 0) + 
                     (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                     (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                     (panelStatusCounts['Approved Final'] || 0) } / {project?.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project && project.estimated_panels && project.estimated_panels > 0 ? 
                        Math.min(100, (((panelStatusCounts['Issued For Production'] || 0) + (panelStatusCounts['Produced'] || 0) + 
                         (panelStatusCounts['Proceed for Delivery'] || 0) + (panelStatusCounts['Delivered'] || 0) + 
                         (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                         (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                         (panelStatusCounts['Approved Final'] || 0) ) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project && project.estimated_panels && project.estimated_panels > 0 ? 
                    ((((panelStatusCounts['Issued For Production'] || 0) + (panelStatusCounts['Produced'] || 0) + 
                      (panelStatusCounts['Proceed for Delivery'] || 0) + (panelStatusCounts['Delivered'] || 0) + 
                      (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                      (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                      (panelStatusCounts['Approved Final'] || 0) ) / project.estimated_panels) * 100).toFixed(2) : 0}% panels issued for production
                </p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs sm:text-sm font-medium text-card-foreground">Produced Progress</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {(panelStatusCounts['Produced'] || 0) + (panelStatusCounts['Proceed for Delivery'] || 0) + 
                     (panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                     (panelStatusCounts['Rejected Material'] || 0) + (panelStatusCounts['Installed'] || 0) + 
                     (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)} / {project?.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project && project.estimated_panels && project.estimated_panels > 0 ? 
                        Math.min(100, (((panelStatusCounts['Produced'] || 0) + (panelStatusCounts['Proceed for Delivery'] || 0) + 
                         (panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                         (panelStatusCounts['Rejected Material'] || 0) + (panelStatusCounts['Installed'] || 0) + 
                         (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project && project.estimated_panels && project.estimated_panels > 0 ? 
                    ((((panelStatusCounts['Produced'] || 0) + (panelStatusCounts['Proceed for Delivery'] || 0) + 
                      (panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                      (panelStatusCounts['Rejected Material'] || 0) + (panelStatusCounts['Installed'] || 0) + 
                      (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100).toFixed(2) : 0}% panels produced
                </p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs sm:text-sm font-medium text-card-foreground">Proceed for Delivery Progress</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {(panelStatusCounts['Proceed for Delivery'] || 0) + (panelStatusCounts['Delivered'] || 0) + 
                     (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                     (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                     (panelStatusCounts['Approved Final'] || 0) } / {project?.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project && project.estimated_panels && project.estimated_panels > 0 ? 
                        Math.min(100, (((panelStatusCounts['Proceed for Delivery'] || 0) + (panelStatusCounts['Delivered'] || 0) + 
                        (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                        (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                        (panelStatusCounts['Approved Final'] || 0) ) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project && project.estimated_panels && project.estimated_panels > 0 ? 
                     ((((panelStatusCounts['Proceed for Delivery'] || 0) + (panelStatusCounts['Delivered'] || 0) + 
                     (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                     (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                     (panelStatusCounts['Approved Final'] || 0) ) / project.estimated_panels) * 100).toFixed(2) : 0}% panels proceed for delivery
                </p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs sm:text-sm font-medium text-card-foreground">Delivered Progress</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                      {(panelStatusCounts['Delivered'] || 0) + 
                     (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                     (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                     (panelStatusCounts['Approved Final'] || 0) } / {project?.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project && project.estimated_panels && project.estimated_panels > 0 ? 
                        Math.min(100, (((panelStatusCounts['Delivered'] || 0) + 
                        (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                        (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                        (panelStatusCounts['Approved Final'] || 0) ) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project && project.estimated_panels && project.estimated_panels > 0 ? 
                      ((((panelStatusCounts['Delivered'] || 0) + 
                     (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                     (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                     (panelStatusCounts['Approved Final'] || 0) ) / project.estimated_panels) * 100).toFixed(2) : 0}% panels delivered
                </p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs sm:text-sm font-medium text-card-foreground">Installation Progress</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {(panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)} / {project?.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project && project.estimated_panels && project.estimated_panels > 0 ? 
                        Math.min(100, (((panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project && project.estimated_panels && project.estimated_panels > 0 ? 
                    ((((panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100).toFixed(2) : 0}% panels installed
                </p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs sm:text-sm font-medium text-card-foreground">Inspected Progress</span>
                  <span className="text-muted-foreground">
                    {(panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)} / {project?.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project && project.estimated_panels && project.estimated_panels > 0 ? 
                        Math.min(100, ((
                         (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project && project.estimated_panels && project.estimated_panels > 0 ? 
                      ((((panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100).toFixed(2) : 0}% panels inspected
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs sm:text-sm font-medium text-card-foreground">Approved Final Progress</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {panelStatusCounts['Approved Final'] || 0} / {project?.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project && project.estimated_panels && project.estimated_panels > 0 ? 
                        Math.min(100, ((panelStatusCounts['Approved Final'] || 0) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project && project.estimated_panels && project.estimated_panels > 0 ? 
                    (((panelStatusCounts['Approved Final'] || 0) / project.estimated_panels) * 100).toFixed(2) : 0}% panels approved final
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs sm:text-sm font-medium text-card-foreground">On Hold Progress</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {panelStatusCounts['On Hold'] || 0} / {project?.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project && project.estimated_panels && project.estimated_panels > 0 ? 
                        Math.min(100, ((panelStatusCounts['On Hold'] || 0) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project && project.estimated_panels && project.estimated_panels > 0 ? 
                    (((panelStatusCounts['On Hold'] || 0) / project.estimated_panels) * 100).toFixed(2) : 0}% panels on hold
                </p>
              </div>

              
            </CardContent>
          </Card>

          {/* Efficiency Metrics */}
          <Card className="qatar-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                Efficiency Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></div>
                  <span className="text-xs sm:text-sm text-card-foreground">Production Efficiency</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {project && project.estimated_panels && project.estimated_panels > 0 ? 
                    ((((panelStatusCounts['Produced'] || 0) + (panelStatusCounts['Proceed for Delivery'] || 0) + 
                      (panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                      (panelStatusCounts['Rejected Material'] || 0) + (panelStatusCounts['Installed'] || 0) + 
                      (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100).toFixed(1) : 0}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                  <span className="text-xs sm:text-sm text-card-foreground">Delivery Efficiency</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {project && project.estimated_panels && project.estimated_panels > 0 ? 
                    (((panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                      (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                      (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels * 100).toFixed(1) : 0}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0"></div>
                  <span className="text-xs sm:text-sm text-card-foreground">Overall Completion</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {project && project.estimated_panels && project.estimated_panels > 0 ? 
                    (((panelStatusCounts['Approved Final'] || 0) / (project.estimated_panels || 1)) * 100).toFixed(1) : 0}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Progress Overview */}
          <Card className="qatar-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                Progress Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {totalPanels === 0 ? (
                <div className="text-center text-xs sm:text-sm text-muted-foreground py-8 sm:py-10">
                  No panels yet for this facade
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">Installed vs Estimated</span>
                    <span className="font-medium text-sm sm:text-base">{getProgress()}%</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="h-48 sm:h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                            {pieData.map((entry) => (
                              <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#999999"} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any, name: any) => [`${value} (${Math.round(((value as number) / totalPanels) * 100)}%)`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {[
                        { key: 'Issued For Production', label: 'Issued For Production' },
                        { key: 'Produced', label: 'Factory Stock' },
                        { key: 'Delivered', label: 'Site Stock' },
                        { key: 'Installed', label: 'Installed' }
                      ].map(({ key, label }) => {
                        const count = panelStatusCounts[key] || 0;
                        return (
                          <div key={key} className="flex items-center justify-between text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                              <span className="inline-block h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[key] || "#999999" }} />
                              <span className="text-muted-foreground truncate">{label}</span>
                            </div>
                            <span className="font-medium text-foreground">{count}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t">
                        <span className="text-muted-foreground">Total Panels</span>
                        <span className="font-medium text-foreground">{totalPanels}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-muted-foreground">Estimated Panels</span>
                        <span className="font-medium text-foreground">{project?.estimated_panels || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Facade Totals */}
          <Card className="qatar-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Layers className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                Facade Totals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Square className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Area</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {(facade.totalArea || 0).toFixed(2)} m²
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Amount</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {formatQatarRiyal(facade.totalAmount || 0)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Weight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Weight</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {(facade.totalWeight || 0).toFixed(2)} kg
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Panels</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {totalPanels}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabbed Sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-1 h-auto">
          <TabsTrigger value="panels" className="text-xs sm:text-sm px-2 py-2 sm:px-3 sm:py-2">Panels</TabsTrigger>
        </TabsList>

        <TabsContent value="panels" className="space-y-4 sm:space-y-6">
          <PanelsSection
            projectId={building?.project_id || ""}
            projectName={project?.name || ""}
            facadeId={facade.id}
            facadeName={facade.name}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
