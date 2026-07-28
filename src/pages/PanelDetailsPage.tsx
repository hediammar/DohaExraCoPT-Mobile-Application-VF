import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Edit, Trash2, Square, DollarSign, Weight, Calendar, FileText, QrCode, RefreshCw, Building2, Layers, MapPin } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { DateInput } from "../components/ui/date-input";
import { supabase } from "../lib/supabase";
import { StatusChangeDialog } from "../components/StatusChangeDialog";
import { QRCodeModal } from "../components/QRCodeModal";
import { useAuth } from "../contexts/AuthContext";
import { hasPermission, UserRole } from "../utils/rolePermissions";
import { useToastContext } from "../contexts/ToastContext";
import { crudOperations } from "../utils/userTracking";
import { createPanelStatusHistory } from "../utils/panelStatusHistory";
import { PanelModel } from "../components/project-details/PanelsSection";
import { PANEL_STATUSES, validateStatusTransition, getValidNextStatuses, isSpecialStatus } from "../utils/statusValidation";

const PANEL_TYPES = [
  "GRC", "GRG", "GRP", "EIFS", "UHPC"
] as const;

interface Panel {
  id: string;
  name: string;
  type: number;
  status: number;
  project_id: string;
  building_id?: string;
  facade_id?: string;
  issue_transmittal_no?: string;
  drawing_number?: string;
  unit_rate_qr_m2?: number;
  ifp_qty_area_sm?: number;
  ifp_qty_nos?: number;
  weight?: number;
  dimension?: string;
  issued_for_production_date?: string;
  created_at: string;
  updated_at: string;
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

interface Facade {
  id: string;
  name: string;
  building_id: string;
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

export function PanelDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const { user: currentUser } = useAuth();
  
  const [panel, setPanel] = useState<Panel | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [facade, setFacade] = useState<Facade | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [isStatusChangeDialogOpen, setIsStatusChangeDialogOpen] = useState(false);
  const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSavingPanel, setIsSavingPanel] = useState(false);
  const [newPanelModel, setNewPanelModel] = useState({
    name: "",
    type: 0,
    status: 0,
    building_id: undefined as string | undefined,
    facade_id: undefined as string | undefined,
    issue_transmittal_no: undefined as string | undefined,
    drawing_number: undefined as string | undefined,
    unit_rate_qr_m2: undefined as number | undefined,
    ifp_qty_area_sm: undefined as number | undefined,
    ifp_qty_nos: undefined as number | undefined,
    weight: undefined as number | undefined,
    dimension: undefined as string | undefined,
    issued_for_production_date: undefined as string | undefined,
  });

  const canEditPanels = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panels', 'canUpdate') : false;
  const canDeletePanels = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panels', 'canDelete') : false;

  // Map database integers to UI strings
  const typeMap: { [key: number]: string } = PANEL_TYPES.reduce((acc, type, index) => ({ ...acc, [index]: type }), {});
  const statusMap: { [key: number]: string } = PANEL_STATUSES.reduce((acc, status, index) => ({ ...acc, [index]: status }), {});
  const typeReverseMap = Object.fromEntries(Object.entries(typeMap).map(([k, v]) => [v, parseInt(k)]));
  const statusReverseMap = Object.fromEntries(Object.entries(statusMap).map(([k, v]) => [v, parseInt(k)]));

  useEffect(() => {
    if (id) {
      loadPanelDetails(id);
    }
  }, [id]);

  const loadPanelDetails = async (panelId: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`Loading panel details for ID: ${panelId}`);

      // Fetch panel with all related data
      const { data: panelData, error: panelError } = await supabase
        .from('panels')
        .select(`
          *,
          projects (
            *,
            customers (id, name, email, phone, created_at, updated_at)
          ),
          buildings (
            id, name, project_id, status, description, created_at, updated_at
          ),
          facades (
            id, name, building_id, status, description, created_at, updated_at
          )
        `)
        .eq('id', panelId)
        .single();

      if (panelError) {
        throw panelError;
      }

      if (panelData) {
        setPanel(panelData);
        setProject(panelData.projects);
        setCustomer(panelData.projects.customers);
        setBuilding(panelData.buildings);
        setFacade(panelData.facades);
        console.log("Panel details loaded successfully:", panelData.name);
      } else {
        setError("Panel not found");
      }
    } catch (err) {
      console.error("Error loading panel details:", err);
      setError("Failed to load panel details");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!panel) return;

    try {
      await crudOperations.delete('panels', panel.id);
      showToast('Panel deleted successfully', 'success');
      navigate(`/projects/${panel.project_id}`);
    } catch (error) {
      console.error('Error deleting panel:', error);
      showToast('Error deleting panel', 'error');
    }
  };

  const handleStatusChange = () => {
    setIsStatusChangeDialogOpen(true);
  };

  const handleStatusChanged = () => {
    // Reload panel details to get updated status
    if (panel) {
      loadPanelDetails(panel.id);
    }
  };

  const handleViewQRCode = () => {
    setIsQRCodeModalOpen(true);
  };

  const startEditPanel = () => {
    if (!panel) return;
    
    setNewPanelModel({
      name: panel.name,
      type: panel.type,
      status: panel.status,
      building_id: panel.building_id,
      facade_id: panel.facade_id,
      issue_transmittal_no: panel.issue_transmittal_no,
      drawing_number: panel.drawing_number,
      unit_rate_qr_m2: panel.unit_rate_qr_m2,
      ifp_qty_area_sm: panel.ifp_qty_area_sm,
      ifp_qty_nos: panel.ifp_qty_nos,
      weight: panel.weight,
      dimension: panel.dimension,
      issued_for_production_date: panel.issued_for_production_date,
    });
    setIsEditDialogOpen(true);
  };

  const handleSavePanel = async () => {
    if (!panel || isSavingPanel) return;
    
    if (newPanelModel.name.trim() === "") {
      showToast("Panel name is required", "error");
      return;
    }

    // Validate status transition if status has changed
    if (panel.status !== newPanelModel.status) {
      const validation = validateStatusTransition(panel.status, newPanelModel.status);
      if (!validation.isValid) {
        showToast(validation.error || "Invalid status transition", "error");
        return;
      }
    }

    setIsSavingPanel(true);

    const panelData = {
      name: newPanelModel.name,
      type: newPanelModel.type,
      status: newPanelModel.status,
      project_id: panel.project_id,
      building_id: newPanelModel.building_id || null,
      facade_id: newPanelModel.facade_id || null,
      issue_transmittal_no: newPanelModel.issue_transmittal_no || null,
      drawing_number: newPanelModel.drawing_number || null,
      unit_rate_qr_m2: newPanelModel.unit_rate_qr_m2 || null,
      ifp_qty_area_sm: newPanelModel.ifp_qty_area_sm || null,
      ifp_qty_nos: newPanelModel.ifp_qty_nos || null,
      weight: newPanelModel.weight || null,
      dimension: newPanelModel.dimension || null,
      issued_for_production_date: newPanelModel.issued_for_production_date || null,
    };

    try {
      // Check if status changed
      const statusChanged = panel.status !== newPanelModel.status;
      
      // Update panel with user tracking
      await crudOperations.update("panels", panel.id, panelData);
      
      // Create status history record manually when status changes (since triggers are disabled)
      if (statusChanged && currentUser) {
        const { error: historyError } = await createPanelStatusHistory(
          panel.id,
          newPanelModel.status,
          currentUser.id,
          `Status changed from ${PANEL_STATUSES[panel.status]} to ${PANEL_STATUSES[newPanelModel.status]}`
        );
        
        if (historyError) {
          console.error('Error creating status history:', historyError);
          showToast('Panel updated but failed to create status history', 'error');
        }
      }
      
      // Reload panel details to get updated data
      await loadPanelDetails(panel.id);
      
      showToast("Panel updated successfully", "success");
    } catch (error) {
      console.error("Error updating panel:", error);
      showToast("Error updating panel", "error");
    } finally {
      setIsSavingPanel(false);
      setIsEditDialogOpen(false);
    }
  };

  const getValidStatuses = (currentStatus: number) => {
    const validNextStatuses = getValidNextStatuses(currentStatus);
    const allStatuses = PANEL_STATUSES.map((_, index) => index);
    
    // Include special statuses (On Hold, Cancelled) that can be set from any status
    const specialStatuses = allStatuses.filter(status => isSpecialStatus(status));
    
    // Combine valid next statuses with special statuses, removing duplicates
    const validStatuses = Array.from(new Set([...validNextStatuses, ...specialStatuses]));
    
    return validStatuses.sort((a, b) => a - b);
  };

  const getStatusBadge = (status: number) => {
    const statusString = PANEL_STATUSES[status] || "Unknown";
    const statusConfig = {
      "Produced": {
        variant: "default" as const,
        label: "Produced",
        color: "bg-status-active text-status-active-foreground",
      },
      "In Production": {
        variant: "secondary" as const,
        label: "In Production",
        color: "bg-status-complete text-status-complete-foreground",
      },
      "Delivered": {
        variant: "outline" as const,
        label: "Delivered",
        color: "bg-status-inactive text-status-inactive-foreground",
      },
      "Installed": {
        variant: "default" as const,
        label: "Installed",
        color: "bg-status-active text-status-active-foreground",
      },
      "On Hold": {
        variant: "destructive" as const,
        label: "On Hold",
        color: "bg-status-onhold text-status-onhold-foreground",
      },
      "Cancelled": {
        variant: "destructive" as const,
        label: "Cancelled",
        color: "bg-destructive text-destructive-foreground",
      },
    };

    const config = statusConfig[statusString as keyof typeof statusConfig] || {
      variant: "secondary" as const,
      label: statusString,
      color: "bg-secondary text-secondary-foreground",
    };

    return (
      <Badge className={`text-xs ${config.color}`}>
        {config.label}
      </Badge>
    );
  };

  const getTypeBadge = (type: number) => {
    const typeString = PANEL_TYPES[type] || "Unknown";
    return (
      <Badge variant="outline" className="text-xs">
        {typeString}
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading panel details...</p>
        </div>
      </div>
    );
  }

  if (error || !panel) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Panel not found</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => navigate("/projects")}>
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  // Convert panel to PanelModel for StatusChangeDialog
  const panelModel: PanelModel = {
    id: panel.id,
    name: panel.name,
    type: panel.type,
    status: panel.status,
    project_id: panel.project_id,
    project_name: project?.name,
    building_id: panel.building_id,
    building_name: building?.name,
    facade_id: panel.facade_id,
    facade_name: facade?.name,
    issue_transmittal_no: panel.issue_transmittal_no,
    drawing_number: panel.drawing_number,
    unit_rate_qr_m2: panel.unit_rate_qr_m2,
    ifp_qty_area_sm: panel.ifp_qty_area_sm,
    ifp_qty_nos: panel.ifp_qty_nos,
    weight: panel.weight,
    dimension: panel.dimension,
    issued_for_production_date: panel.issued_for_production_date,
  };

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (facade) {
              navigate(`/facades/${facade.id}`);
            } else if (building) {
              navigate(`/buildings/${building.id}`);
            } else {
              navigate(`/projects/${panel.project_id}`);
            }
          }}
          className="hover:bg-accent h-9 text-xs sm:text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
          <span className="hidden sm:inline">Back to {facade ? 'Facade' : building ? 'Building' : 'Project'}</span>
          <span className="sm:hidden">Back</span>
        </Button>
      </div>

      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{panel.name}</h1>
            {getStatusBadge(panel.status)}
            {getTypeBadge(panel.type)}
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            {panel.issue_transmittal_no || `PNL-${panel.id.slice(-4).toUpperCase()}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewQRCode}
            className="hover:bg-accent h-9 w-9 sm:h-10 sm:w-10 p-0"
            title="View QR Code"
          >
            <QrCode className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          {canEditPanels && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStatusChange}
              className="hover:bg-accent h-9 w-9 sm:h-10 sm:w-10 p-0"
              title="Change Status"
            >
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          )}
          {canEditPanels && (
            <Button
              variant="outline"
              size="sm"
              onClick={startEditPanel}
              className="hover:bg-accent h-9 w-9 sm:h-10 sm:w-10 p-0"
              title="Edit Panel"
            >
              <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          )}
          {canDeletePanels && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="border-red-400/50 text-red-400 hover:bg-red-400/10 h-9 w-9 sm:h-10 sm:w-10 p-0"
              title="Delete Panel"
            >
              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Panel Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Project Card */}
        <Card className="qatar-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Project</CardTitle>
            <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold truncate">{project?.name || 'No Project'}</div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {customer?.name || 'No Customer'}
            </p>
          </CardContent>
        </Card>

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

        {/* Facade Card */}
        <Card className="qatar-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Facade</CardTitle>
            <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold truncate">{facade?.name || 'No Facade'}</div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {building?.name || 'No Building'}
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
      </div>

      {/* Panel Details Grid - 2x2 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left Column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Panel Information */}
          <Card className="qatar-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                Panel Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div>
                <h4 className="font-medium mb-2 text-sm sm:text-base">Drawing Number</h4>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {panel.drawing_number || "Not specified"}
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2 text-sm sm:text-base">Issue Transmittal Number</h4>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {panel.issue_transmittal_no || "Not specified"}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2 text-sm sm:text-base">Panel Type</h4>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {PANEL_TYPES[panel.type] || "Unknown"}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2 text-sm sm:text-base">Current Status</h4>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {PANEL_STATUSES[panel.status] || "Unknown"}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2 text-sm sm:text-base">Issued for Production</h4>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {panel.issued_for_production_date ? formatDate(panel.issued_for_production_date) : "Not set"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Information */}
          
        </div>

        {/* Right Column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Panel Totals */}
          <Card className="qatar-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                Panel Specifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Square className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Area</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {(panel.ifp_qty_area_sm || 0).toFixed(2)} m²
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Unit Rate</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {formatQatarRiyal(panel.unit_rate_qr_m2 || 0)}/m²
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Amount</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {formatQatarRiyal((panel.ifp_qty_area_sm || 0) * (panel.unit_rate_qr_m2 || 0))}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Weight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Weight</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {(panel.weight || 0).toFixed(2)} kg
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Quantity</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {panel.ifp_qty_nos || 0}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Dimension</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {panel.dimension || "N/A"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      

      {/* Status Change Dialog */}
      <StatusChangeDialog
        panel={panelModel}
        isOpen={isStatusChangeDialogOpen}
        onClose={() => setIsStatusChangeDialogOpen(false)}
        onStatusChanged={handleStatusChanged}
      />

      {/* QR Code Modal */}
      <QRCodeModal
        panel={panelModel}
        isOpen={isQRCodeModalOpen}
        onClose={() => setIsQRCodeModalOpen(false)}
      />

      {/* Edit Panel Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:w-full sm:mx-0 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Edit Panel</DialogTitle>
            <DialogDescription className="text-sm">Update panel information for {panel?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm font-medium">Panel Name *</Label>
              <Input
                id="edit-name"
                value={newPanelModel.name}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, name: e.target.value })}
                placeholder="Enter panel name"
                className="w-full h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type" className="text-sm font-medium">Panel Type *</Label>
              <Select
                value={typeMap[newPanelModel.type]}
                onValueChange={(value) => setNewPanelModel({ ...newPanelModel, type: typeReverseMap[value] })}
              >
                <SelectTrigger className="w-full h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PANEL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status" className="text-sm font-medium">Status *</Label>
              <Select
                value={statusMap[newPanelModel.status]}
                onValueChange={(value) => setNewPanelModel({ ...newPanelModel, status: statusReverseMap[value] })}
              >
                <SelectTrigger className="w-full h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {panel ? getValidStatuses(panel.status).map((statusIndex) => {
                    const statusName = statusMap[statusIndex];
                    const isSpecial = isSpecialStatus(statusIndex);
                    return (
                      <SelectItem key={statusIndex} value={statusName}>
                        <div className="flex items-center gap-2">
                          <span>{statusName}</span>
                          {isSpecial && (
                            <Badge variant="outline" className="text-xs">
                              Special
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  }) : PANEL_STATUSES.map((status, index) => {
                    const isSpecial = isSpecialStatus(index);
                    return (
                      <SelectItem key={status} value={status}>
                        <div className="flex items-center gap-2">
                          <span>{status}</span>
                          {isSpecial && (
                            <Badge variant="outline" className="text-xs">
                              Special
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <DateInput
                id="edit-issued_for_production_date"
                label="Issued for Production Date"
                value={newPanelModel.issued_for_production_date}
                onChange={(value) => setNewPanelModel({ ...newPanelModel, issued_for_production_date: value || undefined })}
                placeholder="Select date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-issue_transmittal_no" className="text-sm font-medium">Issue/Transmittal Number</Label>
              <Input
                id="edit-issue_transmittal_no"
                value={newPanelModel.issue_transmittal_no || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, issue_transmittal_no: e.target.value || undefined })}
                placeholder="Enter issue/transmittal number"
                className="w-full h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-drawing_number" className="text-sm font-medium">Drawing Number</Label>
              <Input
                id="edit-drawing_number"
                value={newPanelModel.drawing_number || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, drawing_number: e.target.value || undefined })}
                placeholder="Enter drawing number"
                className="w-full h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-unit_rate_qr_m2" className="text-sm font-medium">Unit Rate QR/m²</Label>
              <Input
                id="edit-unit_rate_qr_m2"
                type="number"
                min="0"
                value={newPanelModel.unit_rate_qr_m2 || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, unit_rate_qr_m2: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Enter unit rate"
                className="w-full h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ifp_qty_area_sm" className="text-sm font-medium">IFP Qty Area SM</Label>
              <Input
                id="edit-ifp_qty_area_sm"
                type="number"
                min="0"
                value={newPanelModel.ifp_qty_area_sm || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, ifp_qty_area_sm: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Enter IFP qty area"
                className="w-full h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ifp_qty_nos" className="text-sm font-medium">IFP Qty Nos</Label>
              <Input
                id="edit-ifp_qty_nos"
                type="number"
                min="0"
                value={newPanelModel.ifp_qty_nos || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, ifp_qty_nos: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="Enter IFP qty nos"
                className="w-full h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-weight" className="text-sm font-medium">Weight (kg)</Label>
              <Input
                id="edit-weight"
                type="number"
                min="0"
                step="0.1"
                value={newPanelModel.weight || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, weight: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Enter weight in kg"
                className="w-full h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dimension" className="text-sm font-medium">Dimension</Label>
              <Input
                id="edit-dimension"
                value={newPanelModel.dimension || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, dimension: e.target.value || undefined })}
                placeholder="Enter dimension (e.g., 2.5m x 1.2m)"
                className="w-full h-11"
              />
            </div>
          </div>
          <DialogFooter className="pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button onClick={handleSavePanel} disabled={isSavingPanel} className="w-full sm:w-auto">
              {isSavingPanel ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
