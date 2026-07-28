import {
  AlertCircle,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronRightIcon,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Edit,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FolderPlus,
  Hash,
  History,
  Layers,
  Package,
  Plus,
  QrCode,
  Search,
  Square,
  Trash2,
  Upload,
  Users,
  X,
  RefreshCw
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { QRCodeModal } from "../QRCodeModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { supabase } from "../../lib/supabase";
import { Textarea } from "../ui/textarea";
import { Timeline } from "../Timeline";
import { useToastContext } from "../../contexts/ToastContext";
import { DateInput } from "../ui/date-input";
import { crudOperations } from "../../utils/userTracking";
import { createPanelStatusHistory, createBulkPanelStatusHistory } from "../../utils/panelStatusHistory";
import { StatusChangeDialog } from "../StatusChangeDialog";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission, UserRole } from "../../utils/rolePermissions";
import { 
  PANEL_STATUSES, 
  PanelStatus,
  validateStatusTransition, 
  validateStatusTransitionWithRole,
  getValidNextStatuses,
  getValidNextStatusesForRole,
  isSpecialStatus 
} from "../../utils/statusValidation";


const PANEL_TYPES = [
"GRC","GRG","GRP","EIFS","UHPC"
] as const;

type PanelType = (typeof PANEL_TYPES)[number];

interface Building {
  id: string;
  name: string;
}

interface Facade {
  id: string;
  name: string;
  building_id?: string;
}

export interface PanelModel {
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

interface ImportedPanel {
  id: string;
  name: string;
  type: number;
  status: number;
  project_id: string;
  project_name: string;
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
  isValid: boolean;
  errors: string[];
}

interface PanelsSectionProps {
  projectId: string;
  projectName: string;
  facadeId?: string;
  facadeName?: string;
}

interface QRCodeModalProps {
  panelId: string;
  panelName: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PanelsSection({ projectId, projectName, facadeId, facadeName }: PanelsSectionProps) {
  const { user: currentUser } = useAuth();
  const { showToast } = useToastContext();
  const navigate = useNavigate();
  const [panels, setPanels] = useState<PanelModel[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [facades, setFacades] = useState<Facade[]>([]);
  const [allFacades, setAllFacades] = useState<Facade[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [buildingFilter, setBuildingFilter] = useState<string>("all");
  const [facadeFilter, setFacadeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddPanelDialogOpen, setIsAddPanelDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [panelToDelete, setPanelToDelete] = useState<PanelModel | null>(null);
  const [editingPanel, setEditingPanel] = useState<PanelModel | null>(null);
  const [selectedPanelForQR, setSelectedPanelForQR] = useState<PanelModel | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandAllRows, setExpandAllRows] = useState(false);
  const [isBulkImportMode, setIsBulkImportMode] = useState(false);
  const [bulkImportStep, setBulkImportStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [importedPanels, setImportedPanels] = useState<ImportedPanel[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState({ successful: 0, failed: 0 });
  const [bulkImportErrors, setBulkImportErrors] = useState<string[]>([]);
  const [bulkImportCurrentPage, setBulkImportCurrentPage] = useState(1);
  const [bulkImportPageSize] = useState(25);
  const [bulkImportSearchTerm, setBulkImportSearchTerm] = useState("");
  const [bulkImportStatusFilter, setBulkImportStatusFilter] = useState<string>("all");
  const [bulkImportTypeFilter, setBulkImportTypeFilter] = useState<string>("all");
  const [bulkImportValidityFilter, setBulkImportValidityFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPanels, setSelectedPanels] = useState<Set<string>>(new Set());
  const [isAddToGroupDialogOpen, setIsAddToGroupDialogOpen] = useState(false);
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [selectedPanelForTimeline, setSelectedPanelForTimeline] = useState<PanelModel | null>(null);
  const [isBulkStatusDialogOpen, setIsBulkStatusDialogOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<number | null>(null); // Will be set when dialog opens
  const [isStatusChangeDialogOpen, setIsStatusChangeDialogOpen] = useState(false);
  const [selectedPanelForStatusChange, setSelectedPanelForStatusChange] = useState<PanelModel | null>(null);
  const [isSavingPanel, setIsSavingPanel] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<number | null>(null);
  const [isBulkStatusUpdating, setIsBulkStatusUpdating] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isAddingToGroup, setIsAddingToGroup] = useState(false);
  const [isImportingPanels, setIsImportingPanels] = useState(false);
  const [panelGroups, setPanelGroups] = useState<Array<{id: string, name: string, description: string}>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [parentBuildingId, setParentBuildingId] = useState<string | undefined>(undefined);
  const [existingPanels, setExistingPanels] = useState<{ [key: string]: any }>({});
  const canCreatePanels = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panels', 'canCreate') : false;
  const canUpdatePanels = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panels', 'canUpdate') : false;
  const canDeletePanels = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panels', 'canDelete') : false;
  const canBulkImportPanels = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panels', 'canBulkImport') : false;
  const canChangePanelStatus = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panels', 'canChangeStatus') : false;

  // Fetch previous status from panel status history
  const fetchPreviousStatus = async (panelId: string) => {
    try {
      const { data, error } = await supabase
        .from('panel_status_histories')
        .select('status')
        .eq('panel_id', panelId)
        .order('created_at', { ascending: false })
        .limit(2); // Get the last 2 statuses

      if (error) {
        console.error('Error fetching panel status history:', error);
        return null;
      }

      // If we have at least 2 statuses, the second one is the previous status
      if (data && data.length >= 2) {
        return data[1].status;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching previous status:', error);
      return null;
    }
  };

  // Get all forward statuses from current status (for admin skip functionality)
  const getAllForwardStatuses = (currentStatus: number): number[] => {
    const visited = new Set<number>();
    const forwardStatuses = new Set<number>();
    
    const traverse = (status: number) => {
      if (visited.has(status)) return;
      visited.add(status);
      
      const nextStatuses = getValidNextStatuses(status);
      for (const nextStatus of nextStatuses) {
        // Only include statuses that are forward in the main workflow (higher index)
        // Exclude special statuses and rework paths (like Rejected Material -> Issued For Production)
        if (!isSpecialStatus(nextStatus) && nextStatus > status) {
          forwardStatuses.add(nextStatus);
          traverse(nextStatus);
        }
      }
    };
    
    traverse(currentStatus);
    return Array.from(forwardStatuses).sort((a, b) => a - b);
  };

  // Helper function to get valid statuses for a given current status
  const getValidStatuses = (currentStatus: number) => {
    if (currentUser?.role === 'Administrator') {
      const onHoldStatusIndex = PANEL_STATUSES.indexOf('On Hold');
      const cancelledStatusIndex = PANEL_STATUSES.indexOf('Cancelled');
      const brokenAtSiteStatusIndex = PANEL_STATUSES.indexOf('Broken at Site');

      let allowedStatuses: number[] = [];

      if (currentStatus === onHoldStatusIndex) {
        // From On Hold, admins can go to:
        // 1. Previous status (if available)
        // 2. Other special statuses (Cancelled, Broken at Site)
        allowedStatuses = [cancelledStatusIndex, brokenAtSiteStatusIndex];
        
        // Add previous status if available
        if (previousStatus !== null) {
          allowedStatuses.push(previousStatus);
        }
      } else {
        // For other statuses, use the forward traversal logic + special statuses
        const forwardStatuses = getAllForwardStatuses(currentStatus);
        const specialStatuses = [onHoldStatusIndex, cancelledStatusIndex, brokenAtSiteStatusIndex];
        allowedStatuses = Array.from(new Set([...forwardStatuses, ...specialStatuses]));
      }
      
      // Exclude the current status itself from the options
      return allowedStatuses.filter(status => status !== currentStatus).sort((a, b) => a - b);
    }
    
    const validNextStatuses = getValidNextStatuses(currentStatus);
    const allStatuses = PANEL_STATUSES.map((_, index) => index);
    
    // Include special statuses (On Hold, Cancelled) that can be set from any status
    const specialStatuses = allStatuses.filter(status => isSpecialStatus(status));
    
    // Combine valid next statuses with special statuses, removing duplicates
    const validStatuses = Array.from(new Set([...validNextStatuses, ...specialStatuses]));
    
    return validStatuses.sort((a, b) => a - b);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 10;

  // Map database integers to UI strings
  const typeMap: { [key: number]: PanelType } = PANEL_TYPES.reduce((acc, type, index) => ({ ...acc, [index]: type }), {});
  const statusMap: { [key: number]: PanelStatus } = PANEL_STATUSES.reduce((acc, status, index) => ({ ...acc, [index]: status }), {});
  const typeReverseMap = Object.fromEntries(Object.entries(typeMap).map(([k, v]) => [v, parseInt(k)]));
  const statusReverseMap = Object.fromEntries(Object.entries(statusMap).map(([k, v]) => [v, parseInt(k)]));

  const [newPanelModel, setNewPanelModel] = useState({
    name: "",
    type: 0,
    status: 0, // Default to "Issued For Production"
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
  const [newPanelGroupModel, setNewPanelGroupModel] = useState({
    name: "",
    description: "",
  });

  const handleCreateGroup = async () => {
    if (isCreatingGroup) return; // Prevent double submission
    
    try {
      if (!newPanelGroupModel.name.trim()) {
        alert("Group name is required");
        return;
      }

      setIsCreatingGroup(true);

      const panelIds = Array.from(selectedPanels);

      const { data, error } = await supabase.rpc('create_panel_group_from_panels', {
        panel_ids: panelIds,
        name: newPanelGroupModel.name || null,
        description: newPanelGroupModel.description || null,
        project_id: projectId,
      });

      if (error) {
        console.error('Error creating panel group:', error);
        alert('Failed to create panel group');
        return;
      }

      setNewPanelGroupModel({
        name: "",
        description: "",
      });
      setIsCreateGroupDialogOpen(false);

      console.log('New panel group created with ID:', data);
      
      // Refresh the panels data to reflect the new group
      await fetchData();
      setSelectedPanels(new Set());
      setIsSelectionMode(false);
      showToast('Panel group created successfully', 'success');
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('An unexpected error occurred');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const fetchPanelGroups = async () => {
    try {
      // Only fetch panel groups that belong to the current project
      const { data, error } = await supabase
        .from('panel_groups')
        .select('id, name, description, project_id')
        .eq('project_id', projectId)
        .order('name');

      if (error) {
        console.error('Error fetching panel groups:', error);
        return;
      }

      setPanelGroups(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };

  const handleAddToExistingGroup = async () => {
    if (isAddingToGroup) return;
    
    try {
      if (!selectedGroupId) {
        alert("Please select a group");
        return;
      }

      setIsAddingToGroup(true);
      const panelIds = Array.from(selectedPanels);

      const { error } = await supabase.rpc('add_panels_to_group', {
        group_id: selectedGroupId,
        panel_ids: panelIds
      });

      if (error) {
        console.error('Error adding panels to group:', error);
        alert('Failed to add panels to group');
        return;
      }

      // Refresh the panels data to reflect the changes
      await fetchData();
      setSelectedPanels(new Set());
      setIsSelectionMode(false);
      setSelectedGroupId("");
      setIsAddToGroupDialogOpen(false);
      showToast('Panels added to group successfully', 'success');
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('An unexpected error occurred');
    } finally {
      setIsAddingToGroup(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (isBulkStatusUpdating) return; // Prevent double submission
    
    if (selectedPanels.size === 0) {
      showToast("No panels selected", "error");
      return;
    }

    if (bulkStatusValue === null) {
      showToast("Please select a status", "error");
      return;
    }

    if (!currentUser?.role) {
      showToast("User role not found", "error");
      return;
    }

    setIsBulkStatusUpdating(true);

    try {
      const panelIds = Array.from(selectedPanels);
      const selectedPanelObjects = panels.filter(panel => selectedPanels.has(panel.id));
      
      // Check if all selected panels have the same status
      const uniqueStatuses = new Set(selectedPanelObjects.map(panel => panel.status));
      if (uniqueStatuses.size > 1) {
        const statusNames = Array.from(uniqueStatuses).map(status => statusMap[status]).join(", ");
        showToast(`Cannot update panels with different statuses: ${statusNames}. Please select panels with the same status.`, "error");
        return;
      }
      
      // Validate status transitions for all selected panels with role-based restrictions
      for (const panel of selectedPanelObjects) {
        const validation = validateStatusTransitionWithRole(panel.status, bulkStatusValue, currentUser.role);
        if (!validation.isValid) {
          showToast(`Cannot update panel "${panel.name}": ${validation.error}`, "error");
          return;
        }
      }
      
      // Update each panel individually to track user changes
      for (const panelId of panelIds) {
        console.log('Bulk updating panel:', panelId, 'with status:', bulkStatusValue);
        await crudOperations.update("panels", panelId, { status: bulkStatusValue as number });
        
        // Create status history record manually (since triggers are disabled)
        if (currentUser) {
          const { error: historyError } = await createPanelStatusHistory(
            panelId,
            bulkStatusValue as number,
            currentUser.id,
            `Bulk status update to ${statusMap[bulkStatusValue as number]}`
          );
          
          if (historyError) {
            console.error('Error creating status history for panel:', panelId, historyError);
          }
        }
      }

      // Update local state
      setPanels(panels.map(panel => 
        selectedPanels.has(panel.id) 
           ? { ...panel, status: bulkStatusValue as number }
          : panel
      ));

      showToast(`Successfully updated status for ${selectedPanels.size} panel(s)`, "success");
      setIsBulkStatusDialogOpen(false);
      setSelectedPanels(new Set());
      setIsSelectionMode(false);
      setBulkStatusValue(null);
    } catch (error) {
      console.error("Unexpected error:", error);
      showToast("An unexpected error occurred", "error");
    } finally {
      setIsBulkStatusUpdating(false);
    }
  };
  const fetchData = async () => {
    setLoading(true);

    const { data: buildingData, error: buildingError } = await supabase
      .from("buildings")
      .select("id, name")
      .eq("project_id", projectId);
    if (buildingError) {
      console.error("Error fetching buildings:", buildingError);
    } else {
      setBuildings(buildingData || []);
    }

    const { data: facadeData, error: facadeError } = await supabase
      .from("facades")
      .select(`
        id,
        name,
        building_id,
        buildings!inner(project_id)
      `)
      .eq("buildings.project_id", projectId);
    if (facadeError) {
      console.error("Error fetching facades:", facadeError);
    } else {
      setAllFacades(facadeData || []);
      setFacades(facadeData || []);
      
      // If facadeId is provided, find the parent building
      if (facadeId) {
        const currentFacade = facadeData?.find(f => f.id === facadeId);
        if (currentFacade) {
          setParentBuildingId(currentFacade.building_id);
        }
      }
    }

    let panelQuery = supabase
      .from("panels")
      .select(`
        *,
        projects!inner(name),
        buildings(name),
        facades(name)
      `)
      .eq("project_id", projectId);

    // If facadeId is provided, filter panels by that specific facade
    if (facadeId) {
      console.log(`Filtering panels by facade_id: ${facadeId}`);
      panelQuery = panelQuery.eq("facade_id", facadeId);
    }

    const { data, error } = await panelQuery;

    if (error) {
      console.error("Error fetching panels:", error);
    } else {
      const formattedData = data?.map((panel) => ({
        ...panel,
        project_name: panel.projects?.name,
        building_name: panel.buildings?.name,
        facade_name: panel.facades?.name,
      })) || [];
      console.log(`Fetched ${formattedData.length} panels for facade ${facadeId}:`, formattedData.map(p => ({ name: p.name, facade_id: p.facade_id, building_name: p.building_name })));
      setPanels(formattedData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    fetchPanelGroups();
  }, [projectId]);

  // Set building and facade when facadeId is provided
  useEffect(() => {
    if (facadeId && parentBuildingId) {
      setNewPanelModel(prev => ({
        ...prev,
        building_id: parentBuildingId,
        facade_id: facadeId
      }));
    }
  }, [facadeId, parentBuildingId]);

  // Filter panels
  const filteredPanels = panels.filter((panel) => {
    const matchesSearch =
      searchTerm === "" ||
      panel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (panel.building_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (panel.facade_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (panel.drawing_number?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (panel.issue_transmittal_no?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || statusMap[panel.status] === statusFilter;
    const matchesType = typeFilter === "all" || typeMap[panel.type] === typeFilter;
    const matchesBuilding = buildingFilter === "all" || panel.building_name === buildingFilter;
    const matchesFacade = facadeFilter === "all" || panel.facade_name === facadeFilter;
    return matchesSearch && matchesStatus && matchesType && matchesBuilding && matchesFacade;
  });

  const totalPages = Math.ceil(filteredPanels.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPanels = filteredPanels.slice(startIndex, startIndex + itemsPerPage);

  const activeFiltersCount = [
    searchTerm !== "",
    statusFilter !== "all",
    typeFilter !== "all",
    buildingFilter !== "all",
    facadeFilter !== "all",
  ].filter(Boolean).length;

  // Function to filter facades based on selected building
  const filterFacadesByBuilding = (buildingId: string | undefined) => {
    if (!buildingId) {
      setFacades(allFacades);
      return;
    }
    const filteredFacades = allFacades.filter(facade => facade.building_id === buildingId);
    setFacades(filteredFacades);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTypeFilter("all");
    setBuildingFilter("all");
    setFacadeFilter("all");
    setCurrentPage(1);
  };

  const handleViewQRCode = (panel: PanelModel) => {
    setSelectedPanelForQR(panel);
  };

  const handleDeletePanel = (panel: PanelModel) => {
    setPanelToDelete(panel);
    setIsDeleteDialogOpen(true);
  };

  const handleOpenTimeline = (panel: PanelModel) => {
    setSelectedPanelForTimeline(panel);
    setIsTimelineOpen(true);
  };

  const handleStatusChange = (panel: PanelModel) => {
    setSelectedPanelForStatusChange(panel);
    setIsStatusChangeDialogOpen(true);
  };

  const handlePanelClick = (panel: PanelModel) => {
    navigate(`/panels/${panel.id}`);
  };

  const handleStatusChanged = () => {
    // Refresh the panels data
    fetchData();
  };

  const confirmDeletePanel = async () => {
    if (panelToDelete) {
      try {
        await crudOperations.delete("panels", panelToDelete.id);
        setPanels(panels.filter((p) => p.id !== panelToDelete.id));
        showToast("Panel deleted successfully", "success");
      } catch (error) {
        console.error("Error deleting panel:", error);
        showToast("Error deleting panel", "error");
      }
      setIsDeleteDialogOpen(false);
      setPanelToDelete(null);
    }
  };

  const startEditPanel = (panel: PanelModel) => {
    setEditingPanel(panel);
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
      issued_for_production_date: panel.issued_for_production_date,
      dimension: panel.dimension,
    });
    
    // Fetch previous status if current status is "On Hold"
    const onHoldStatusIndex = PANEL_STATUSES.indexOf('On Hold');
    if (panel.status === onHoldStatusIndex) {
      fetchPreviousStatus(panel.id).then(setPreviousStatus);
    } else {
      setPreviousStatus(null);
    }
    
    // Filter facades based on the panel's building
    filterFacadesByBuilding(panel.building_id);
    setIsEditDialogOpen(true);
  };

  const handleSavePanel = async () => {
    if (isSavingPanel) return; // Prevent double submission
    
    if (newPanelModel.name.trim() === "") {
      showToast("Panel name is required", "error");
      return;
    }

    // Validate status transition if editing an existing panel and status has changed
    if (editingPanel && editingPanel.status !== newPanelModel.status) {
      if (currentUser?.role === 'Administrator') {
        const onHoldStatusIndex = PANEL_STATUSES.indexOf('On Hold');
        const cancelledStatusIndex = PANEL_STATUSES.indexOf('Cancelled');
        const brokenAtSiteStatusIndex = PANEL_STATUSES.indexOf('Broken at Site');
        
        let isValidAdminTransition = false;
        if (editingPanel.status === onHoldStatusIndex) {
          // From On Hold, check if newStatus is in allowed statuses
          const allowedStatuses = [cancelledStatusIndex, brokenAtSiteStatusIndex];
          if (previousStatus !== null) {
            allowedStatuses.push(previousStatus);
          }
          isValidAdminTransition = allowedStatuses.includes(newPanelModel.status);
        } else {
          // For other statuses, check if newStatus is a forward status or a special status
          const forwardStatuses = getAllForwardStatuses(editingPanel.status);
          const specialStatuses = [onHoldStatusIndex, cancelledStatusIndex, brokenAtSiteStatusIndex];
          const allowedStatuses = Array.from(new Set([...forwardStatuses, ...specialStatuses]));
          isValidAdminTransition = allowedStatuses.includes(newPanelModel.status);
        }

        if (!isValidAdminTransition) {
          showToast('Invalid status transition for Administrator', 'error');
          return;
        }
      } else {
      const validation = validateStatusTransition(editingPanel.status, newPanelModel.status);
      if (!validation.isValid) {
        showToast(validation.error || "Invalid status transition", "error");
        return;
        }
      }
    }

    setIsSavingPanel(true);

    const panelData = {
      name: newPanelModel.name,
      type: newPanelModel.type,
      status: newPanelModel.status,
      project_id: projectId,
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
      if (editingPanel) {
        // Check if status changed
        const statusChanged = editingPanel.status !== panelData.status;
        console.log(`Updating panel ${editingPanel.id}:`, {
          oldStatus: editingPanel.status,
          newStatus: panelData.status,
          statusChanged
        });
        
        // Update panel with user tracking
        console.log('Calling crudOperations.update with panelData:', panelData);
        await crudOperations.update("panels", editingPanel.id, panelData);
        console.log('crudOperations.update completed');
        
        // Create status history record manually when status changes (since triggers are disabled)
        if (statusChanged && currentUser) {
          console.log(`Status changed from ${editingPanel.status} to ${panelData.status}, creating history record`);
          const { error: historyError } = await createPanelStatusHistory(
            editingPanel.id,
            panelData.status,
            currentUser.id,
            `Status changed from ${statusMap[editingPanel.status]} to ${statusMap[panelData.status]}`
          );
          
          if (historyError) {
            console.error('Error creating status history:', historyError);
            showToast('Panel updated but failed to create status history', 'error');
          }
        } else {
          console.log(`Status unchanged (${panelData.status}), no history needed`);
        }
        
        setPanels(
          panels.map((p) =>
            p.id === editingPanel.id
              ? { 
                  ...p, 
                  ...panelData, 
                  project_name: projectName, 
                  building_name: buildings.find(b => b.id === panelData.building_id)?.name, 
                  facade_name: facades.find(e => e.id === panelData.facade_id)?.name,
                  building_id: panelData.building_id || undefined,
                  facade_id: panelData.facade_id || undefined,
                  issue_transmittal_no: panelData.issue_transmittal_no || undefined,
                  drawing_number: panelData.drawing_number || undefined,
                  unit_rate_qr_m2: panelData.unit_rate_qr_m2 || undefined,
                  ifp_qty_area_sm: panelData.ifp_qty_area_sm || undefined,
                  ifp_qty_nos: panelData.ifp_qty_nos || undefined,
                  weight: panelData.weight || undefined,
                  issued_for_production_date: panelData.issued_for_production_date || undefined,
                  dimension: panelData.dimension || undefined,
                }
              : p
          )
        );
        showToast("Panel updated successfully", "success");
      } else {
        // Create panel with user tracking
        console.log('Calling crudOperations.create with panelData:', panelData);
        const newPanel = await crudOperations.create("panels", panelData);
        
        // Database triggers will automatically add initial status history
        console.log(`Panel created with status ${panelData.status}, database triggers will handle initial history`);
        
        // Fetch the complete panel data with relations
        const { data, error } = await supabase
          .from("panels")
          .select(`
            *,
            projects!inner(name),
            buildings(name),
            facades(name)
          `)
          .eq("id", newPanel.id)
          .single();
          
        if (error) {
          console.error("Error fetching complete panel data:", error);
        } else {
          setPanels([
            ...panels,
            {
              ...data,
              project_name: data.projects?.name,
              building_name: data.buildings?.name,
              facade_name: data.facades?.name,
            },
          ]);
        }
        showToast("Panel added successfully", "success");
      }
    } catch (error) {
      console.error("Error saving panel:", error);
      showToast("Error saving panel", "error");
    } finally {
      setIsSavingPanel(false);
      setIsAddPanelDialogOpen(false);
      setIsEditDialogOpen(false);
      setEditingPanel(null);
      setNewPanelModel({
        name: "",
        type: 0,
        status: 0, // Default to "Issued For Production"
        building_id: facadeId ? parentBuildingId : undefined,
        facade_id: facadeId || undefined,
        issue_transmittal_no: undefined,
        drawing_number: undefined,
        unit_rate_qr_m2: undefined,
        ifp_qty_area_sm: undefined,
        ifp_qty_nos: undefined,
        weight: undefined,
        dimension: undefined,
        issued_for_production_date: undefined,
      });
      // Reset facades to show all
      setFacades(allFacades);
    }
  };

  const normalizeType = (type: string): number => {
    if (!type) return 0;
    const normalized = type.trim().toUpperCase().replace(/\./g, "");
    // Match against PANEL_TYPES exactly or common variants
    if (normalized === "GRC") return PANEL_TYPES.indexOf("GRC");
    if (normalized === "GRG") return PANEL_TYPES.indexOf("GRG");
    if (normalized === "GRP") return PANEL_TYPES.indexOf("GRP");
    if (normalized === "EIFS") return PANEL_TYPES.indexOf("EIFS");
    if (normalized === "UHPC") return PANEL_TYPES.indexOf("UHPC");
    // Fallback to first type
    return 0;
  };

  const normalizeStatus = (status: string): number => {
    if (!status) return 0;
    const normalized = status.toLowerCase().trim();

    if (normalized.includes("issued for production")) return PANEL_STATUSES.indexOf("Issued For Production");
    if (normalized.includes("manufactur") || normalized.includes("produce")) return PANEL_STATUSES.indexOf("Produced");
    if (normalized.includes("proceed")) return PANEL_STATUSES.indexOf("Proceed for Delivery");
    if (normalized.includes("deliver")) return PANEL_STATUSES.indexOf("Delivered");
    if (normalized.includes("approved material") || (normalized.includes("approve") && !normalized.includes("final"))) return PANEL_STATUSES.indexOf("Approved Material");
    if (normalized.includes("reject")) return PANEL_STATUSES.indexOf("Rejected Material");
    if (normalized.includes("install")) return PANEL_STATUSES.indexOf("Installed");
    if (normalized.includes("inspect")) return PANEL_STATUSES.indexOf("Inspected");
    if (normalized.includes("approved final")) return PANEL_STATUSES.indexOf("Approved Final");
    if (normalized.includes("on hold") || normalized === "hold") return PANEL_STATUSES.indexOf("On Hold");
    if (normalized.includes("cancel")) return PANEL_STATUSES.indexOf("Cancelled");
    if (normalized.includes("broken")) return PANEL_STATUSES.indexOf("Broken at Site");

    return 0;
  };


  const validatePanel = (panel: ImportedPanel) => {
    const errors: string[] = [];
    if (!panel.name.trim()) errors.push("Panel name is required");
    if (panel.unit_rate_qr_m2 && panel.unit_rate_qr_m2 < 0) errors.push("Unit rate cannot be negative");
    if (panel.ifp_qty_area_sm && panel.ifp_qty_area_sm < 0) errors.push("IFP qty area cannot be negative");
    if (panel.ifp_qty_nos && panel.ifp_qty_nos < 0) errors.push("IFP qty nos cannot be negative");
    // Note: Building and facade validation errors are removed since they will be created automatically during import
    panel.errors = errors;
    panel.isValid = errors.length === 0;
  };

  const normalizeName = (value?: string) => (value || "").trim().toLowerCase();

  // New function to find existing panel by name within the same project
  const findExistingPanelByName = async (panelName: string): Promise<any | null> => {
    if (!panelName?.trim()) return null;
    
    try {
      const { data, error } = await supabase
        .from('panels')
        .select(`
          *,
          projects!inner(name),
          buildings(name),
          facades(name)
        `)
        .eq('name', panelName.trim())
        .eq('project_id', projectId) // Only search within the current project
        .limit(1);

      if (error) {
        console.error('Error finding existing panel:', error);
        return null;
      }

      // Return the first result if found, otherwise null
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error finding existing panel:', error);
      return null;
    }
  };

  const findBuildingIdByName = (name?: string): string | undefined => {
    if (!name) return undefined;
    const target = normalizeName(name);
    const match = buildings.find((b) => normalizeName(b.name) === target);
    return match?.id;
  };

  const findFacadeIdByName = (name?: string, buildingId?: string): string | undefined => {
    if (!name) return undefined;
    const target = normalizeName(name);
    const match = facades.find((f) => 
      normalizeName(f.name) === target && 
      (!buildingId || f.building_id === buildingId)
    );
    return match?.id;
  };

  // New helper functions for creating buildings and facades
  const createBuildingIfNotExists = async (buildingName: string): Promise<string | null> => {
    if (!buildingName) return null;
    
    // First check if building already exists
    const existingBuildingId = findBuildingIdByName(buildingName);
    if (existingBuildingId) {
      return existingBuildingId;
    }

    // Create new building
    try {
      const buildingData = {
        name: buildingName,
        project_id: projectId,
        status: 0, // Default status
        description: `Building created during bulk import for ${projectName}`,
      };

      console.log('Creating new building:', buildingData);
      const newBuilding = await crudOperations.create("buildings", buildingData);
      
      // Add to local state
      setBuildings(prev => [...prev, { id: newBuilding.id, name: buildingName }]);
      
      console.log('Building created successfully:', newBuilding.id);
      return newBuilding.id;
    } catch (error) {
      console.error('Error creating building:', error);
      throw new Error(`Failed to create building "${buildingName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const createFacadeIfNotExists = async (facadeName: string, buildingId: string): Promise<string | null> => {
    if (!facadeName || !buildingId) return null;
    
    // First check if facade already exists in this building
    const existingFacadeId = findFacadeIdByName(facadeName, buildingId);
    if (existingFacadeId) {
      return existingFacadeId;
    }

    // Create new facade
    try {
      const facadeData = {
        name: facadeName,
        building_id: buildingId,
        status: 0, // Default status
        description: `Facade created during bulk import for building ${buildingId}`,
      };

      console.log('Creating new facade:', facadeData);
      const newFacade = await crudOperations.create("facades", facadeData);
      
      // Add to local state
      setFacades(prev => [...prev, { id: newFacade.id, name: facadeName, building_id: buildingId }]);
      
      console.log('Facade created successfully:', newFacade.id);
      return newFacade.id;
    } catch (error) {
      console.error('Error creating facade:', error);
      throw new Error(`Failed to create facade "${facadeName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const resolveBuildingAndFacadeIds = async (panel: ImportedPanel): Promise<{ building_id?: string, facade_id?: string }> => {
    let resolvedBuildingId = panel.building_id;
    let resolvedFacadeId = panel.facade_id;

    // If building name is provided but no building ID, try to find or create building
    if (panel.building_name && !resolvedBuildingId) {
      try {
        const buildingId = await createBuildingIfNotExists(panel.building_name);
        resolvedBuildingId = buildingId || undefined;
      } catch (error) {
        console.error('Error resolving building:', error);
        throw error;
      }
    }

    // If facade name is provided but no facade ID, try to find or create facade
    if (panel.facade_name && !resolvedFacadeId) {
      if (!resolvedBuildingId) {
        throw new Error(`Cannot create facade "${panel.facade_name}" without a building`);
      }
      
      try {
        const facadeId = await createFacadeIfNotExists(panel.facade_name, resolvedBuildingId);
        resolvedFacadeId = facadeId || undefined;
      } catch (error) {
        console.error('Error resolving facade:', error);
        throw error;
      }
    }

    return {
      building_id: resolvedBuildingId,
      facade_id: resolvedFacadeId,
    };
  };

  const formatDateToISO = (d: Date) => {
    const year = d.getFullYear();
    const month = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Helper function to parse date in different formats (same as BulkImportPanelsPage)
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr.trim()) return null;
    
    const str = dateStr.trim();
    
    // Handle 0000-00-00 format - convert to earliest valid date
    if (str === '0000-00-00' || str === '00/00/0000' || str === '00.00.0000') {
      return new Date('1900-01-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
    }
    
    try {
      // Try different date formats
      if (str.includes('/')) {
        // Format: DD/MM/YYYY
        const parts = str.split('/');
        if (parts.length === 3) {
          // Check for invalid date parts (00/00/YYYY or DD/00/YYYY or DD/MM/0000)
          if (parts[0] === '00' || parts[1] === '00' || parts[2] === '0000') {
            return new Date('1900-01-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
          }
          const year = parseInt(parts[2]);
          const month = parseInt(parts[1]) - 1;
          const day = parseInt(parts[0]);
          
          // Create date using UTC to avoid timezone issues
          const date = new Date(Date.UTC(year, month, day));
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      } else if (str.includes('.')) {
        // Format: DD.MM.YYYY
        const parts = str.split('.');
        if (parts.length === 3) {
          // Check for invalid date parts (00.00.YYYY or DD.00.YYYY or DD.MM.0000)
          if (parts[0] === '00' || parts[1] === '00' || parts[2] === '0000') {
            return new Date('1900-01-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
          }
          const year = parseInt(parts[2]);
          const month = parseInt(parts[1]) - 1;
          const day = parseInt(parts[0]);
          
          // Create date using UTC to avoid timezone issues
          const date = new Date(Date.UTC(year, month, day));
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      } else if (str.includes('-')) {
        // Format: YYYY-MM-DD
        const parts = str.split('-');
        if (parts.length === 3) {
          // Check for invalid date parts (0000-MM-DD or YYYY-00-DD or YYYY-MM-00)
          if (parts[0] === '0000' || parts[1] === '00' || parts[2] === '00') {
            return new Date('1900-01-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
          }
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const day = parseInt(parts[2]);
          
          // Create date using UTC to avoid timezone issues
          const date = new Date(Date.UTC(year, month, day));
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      
      // Try parsing as ISO string
      const parsedDate = new Date(str);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
      
      // If all else fails, return 1900-01-01
      return new Date('1900-01-01T00:00:00.000Z');
    } catch (error) {
      // If any error occurs, return 1900-01-01
      return new Date('1900-01-01T00:00:00.000Z');
    }
  };

  const parseExcelDateToISO = (value: any): string | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) return formatDateToISO(value);
    if (typeof value === "number") {
      try {
        const parsed = (XLSX as any).SSF?.parse_date_code?.(value);
        if (parsed && parsed.y && parsed.m && parsed.d) {
          return formatDateToISO(new Date(parsed.y, parsed.m - 1, parsed.d));
        }
      } catch (_) {
        // ignore parsing errors
      }
    }
    if (typeof value === "string") {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return formatDateToISO(d);
    }
    return undefined;
  };

  const handleFileUpload = async (selectedFile: File) => {
    if (!selectedFile) return;

    try {
      setBulkImportFile(selectedFile);
      setBulkImportErrors([]);
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      if (jsonData.length === 0) {
        setBulkImportErrors(["The Excel file appears to be empty or invalid."]);
        return;
      }

      const parsedPanels: ImportedPanel[] = jsonData.map((row: any, index: number) => {
        const buildingNameFromRow = row["Building Name"] || row["building_name"] || undefined;
        const facadeNameFromRow = row["Facade Name"] || row["facade_name"] || undefined;
        const resolvedBuildingId = row["Building ID"] || row["building_id"] || findBuildingIdByName(buildingNameFromRow);
        const resolvedFacadeId = row["Facade ID"] || row["facade_id"] || findFacadeIdByName(facadeNameFromRow, resolvedBuildingId);
        const issuedForProductionRaw = row["Issued for Production Date"] || row["issued_for_production_date"] || undefined;
        const issuedForProductionISO = parseExcelDateToISO(issuedForProductionRaw);
        const panel: ImportedPanel = {
          id: `import-${Date.now()}-${index}`,
          name: row["Panel Name"] || row["Name"] || row["panel_name"] || "",
          type: normalizeType(row["Type"] || row["Panel Type"] || row["type"] || "GRC"),
          status: normalizeStatus(row["Status"] || row["status"] || "Issued For Production"),
          project_id: projectId,
          project_name: projectName,
          building_id: resolvedBuildingId || undefined,
          building_name: buildingNameFromRow || undefined,
          facade_id: resolvedFacadeId || undefined,
          facade_name: facadeNameFromRow || undefined,
          issue_transmittal_no: row["Issue Transmittal No"] || row["IssueTransmittalNo"] || row["issue_transmittal_no"] || undefined,
          drawing_number: row["Drawing Number"] || row["DrawingNumber"] || row["drawing_number"] || undefined,
          unit_rate_qr_m2: parseFloat(row["Unit Rate QR/m2"] || row["unit_rate_qr_m2"] || "0") || undefined,
          ifp_qty_area_sm: parseFloat(row["IFP Qty Area SM"] || row["ifp_qty_area_sm"] || "0") || undefined,
          ifp_qty_nos: parseInt(row["IFP Qty Nos"] || row["ifp_qty_nos"] || "0") || undefined,
          weight: parseFloat(row["Weight"] || row["weight"] || "0") || undefined,
          dimension: row["Dimension"] || row["dimension"] || undefined,
          issued_for_production_date: issuedForProductionISO,
          isValid: true,
          errors: [],
        };

        validatePanel(panel);
        return panel;
      });

      // Check for existing panels within the same project
      const existingPanelsMap: { [key: string]: any } = {};
      for (const panel of parsedPanels) {
        if (panel.name?.trim()) {
          const existingPanel = await findExistingPanelByName(panel.name);
          if (existingPanel) {
            existingPanelsMap[panel.name.trim()] = existingPanel;
          }
        }
      }

      setExistingPanels(existingPanelsMap);
      setImportedPanels(parsedPanels);
      setBulkImportStep("preview");
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      setBulkImportErrors(["Failed to parse Excel file. Please ensure it's a valid .xlsx file."]);
    }
  };

  const updateImportedPanel = (index: number, field: keyof ImportedPanel, value: any) => {
    const actualIndex = importedPanels.findIndex((p) => p.id === filteredImportedPanels[index].id);
    const updatedPanels = [...importedPanels];
    (updatedPanels[actualIndex] as any)[field] = value;
    
    // Update building_name when building_id changes
    if (field === 'building_id') {
      if (value) {
        const building = buildings.find(b => b.id === value);
        (updatedPanels[actualIndex] as any).building_name = building?.name || undefined;
      } else {
        (updatedPanels[actualIndex] as any).building_name = undefined;
      }
    }
    
    // Update facade_name when facade_id changes
    if (field === 'facade_id') {
      if (value) {
        const facade = facades.find(f => f.id === value);
        (updatedPanels[actualIndex] as any).facade_name = facade?.name || undefined;
      } else {
        (updatedPanels[actualIndex] as any).facade_name = undefined;
      }
    }
    
    validatePanel(updatedPanels[actualIndex]);
    setImportedPanels(updatedPanels);
  };

  const removeImportedPanel = (index: number) => {
    const panelToRemove = filteredImportedPanels[index];
    setImportedPanels((prev) => prev.filter((p) => p.id !== panelToRemove.id));
  };

  const handleImportPanels = async () => {
    if (isImportingPanels) return; // Prevent double submission
    
    const validPanels = importedPanels.filter((p) => p.isValid);
    if (validPanels.length === 0) {
      setBulkImportErrors(["No valid panels to import. Please fix the errors and try again."]);
      return;
    }

    setIsImportingPanels(true);

    try {
      setBulkImportStep("importing");
      setImportProgress(0);

      // Create local caches for the import session to avoid state update issues
      const localBuildings = [...buildings];
      const localFacades = [...facades];

      const results: { success: boolean; message: string; data?: any; errors?: string[] }[] = [];
      let successCount = 0;
      let errorCount = 0;
      let processedCount = 0;
      
      for (const panel of validPanels) {
        try {
          console.log('Processing panel:', panel.name);
          
          // Check if panel already exists within the same project
          const existingPanel = await findExistingPanelByName(panel.name);

          // Helper functions that work with local caches
          const findBuildingIdByNameLocal = (name?: string): string | undefined => {
            if (!name) return undefined;
            const target = normalizeName(name);
            const match = localBuildings.find((b) => normalizeName(b.name) === target);
            return match?.id;
          };

          const findFacadeIdByNameLocal = (name?: string, buildingId?: string): string | undefined => {
            if (!name) return undefined;
            const target = normalizeName(name);
            const match = localFacades.find((f) => 
              normalizeName(f.name) === target && 
              (!buildingId || f.building_id === buildingId)
            );
            return match?.id;
          };

          // Resolve building and facade IDs using local caches
          let resolvedBuildingId = panel.building_id;
          let resolvedFacadeId = panel.facade_id;
          console.log(`Initial values for panel ${panel.name}: resolvedFacadeId=${resolvedFacadeId}, facadeId=${facadeId}`);
          
          // Note: Removed facade context override to allow proper building → facade lookup

          // If building name is provided but no building ID, try to find or create building
          if (panel.building_name && !resolvedBuildingId) {
            try {
              console.log(`Looking for building "${panel.building_name}" in project ${projectId}`);
              console.log(`Available buildings in project ${projectId}:`, localBuildings.map(b => ({ name: b.name, id: b.id })));
              // First check if building already exists in local cache
              const existingBuildingId = findBuildingIdByNameLocal(panel.building_name);
              console.log(`Found building ID: ${existingBuildingId}`);
              if (existingBuildingId) {
                resolvedBuildingId = existingBuildingId;
              } else {
                // Create new building
                const buildingData = {
                  name: panel.building_name,
                  project_id: projectId,
                  status: 0, // Default status
                  description: `Building created during bulk import for ${projectName}`,
                };

                console.log('Creating new building:', buildingData);
                const newBuilding = await crudOperations.create("buildings", buildingData);
                localBuildings.push({ id: newBuilding.id, name: panel.building_name });
                resolvedBuildingId = newBuilding.id;
              }
            } catch (error) {
              console.error('Error resolving building:', error);
              throw error;
            }
          }

          // If facade name is provided but no facade ID, try to find or create facade
          if (panel.facade_name && !resolvedFacadeId) {
            if (!resolvedBuildingId) {
              throw new Error(`Cannot create facade "${panel.facade_name}" without a building`);
            }
            
            try {
              // First check if facade already exists in local cache for the specific building
              console.log(`Looking for facade "${panel.facade_name}" in building ${resolvedBuildingId}`);
              console.log(`Available facades in building ${resolvedBuildingId}:`, localFacades.filter(f => f.building_id === resolvedBuildingId).map(f => ({ name: f.name, id: f.id })));
              const existingFacadeId = findFacadeIdByNameLocal(panel.facade_name, resolvedBuildingId);
              console.log(`Found facade ID: ${existingFacadeId}`);
              if (existingFacadeId) {
                resolvedFacadeId = existingFacadeId;
              } else {
                // Create new facade
                const facadeData = {
                  name: panel.facade_name,
                  building_id: resolvedBuildingId,
                  status: 0, // Default status
                  description: `Facade created during bulk import for building ${resolvedBuildingId}`,
                };

                console.log('Creating new facade:', facadeData);
                const newFacade = await crudOperations.create("facades", facadeData);
                localFacades.push({ id: newFacade.id, name: panel.facade_name, building_id: resolvedBuildingId });
                resolvedFacadeId = newFacade.id;
              }
            } catch (error) {
              console.error('Error resolving facade:', error);
              throw error;
            }
          }
          
          console.log(`Creating panel ${panel.name} with facade_id: ${resolvedFacadeId}, building_id: ${resolvedBuildingId}`);
          const panelData = {
            name: panel.name,
            type: panel.type,
            status: panel.status,
            project_id: projectId,
            building_id: resolvedBuildingId || null,
            facade_id: resolvedFacadeId || null,
            issue_transmittal_no: panel.issue_transmittal_no || null,
            drawing_number: panel.drawing_number || null,
            unit_rate_qr_m2: panel.unit_rate_qr_m2 || null,
            ifp_qty_area_sm: panel.ifp_qty_area_sm || null,
            ifp_qty_nos: panel.ifp_qty_nos || null,
            weight: panel.weight || null,
            dimension: panel.dimension || null,
            issued_for_production_date: panel.issued_for_production_date || null,
          };

          if (existingPanel) {
            console.log(`Panel "${panel.name}" already exists in this project. Updating...`);
            
            // Check if status has changed for status history tracking
            const statusChanged = existingPanel.status !== panel.status;
            const previousStatus = existingPanel.status;
            
            // Update existing panel
            const { data: updatedPanel, error: updateError } = await supabase
              .from('panels')
              .update(panelData)
              .eq('id', existingPanel.id)
              .select()
              .single();

            if (updateError) {
              results.push({
                success: false,
                message: `Failed to update panel "${panel.name}". ${updateError.message}`,
                errors: [updateError.message]
              });
              errorCount++;
            } else {
              // Create status history record if status changed
              if (statusChanged && currentUser) {
                try {
                  console.log(`Status changed from ${previousStatus} to ${panel.status}, creating history record`);
                  const { error: historyError } = await createPanelStatusHistory(
                    existingPanel.id,
                    panel.status,
                    currentUser.id,
                    `Bulk import: Status changed from ${statusMap[previousStatus]} to ${statusMap[panel.status]}`
                  );
                  
                  if (historyError) {
                    console.error('Error creating status history:', historyError);
                    // Don't fail the import for history errors, just log them
                  }
                } catch (historyError) {
                  console.error('Error creating status history:', historyError);
                  // Don't fail the import for history errors, just log them
                }
              }
              
              results.push({
                success: true,
                message: `Successfully updated panel "${panel.name}"${statusChanged ? ` (status: ${statusMap[previousStatus]} → ${statusMap[panel.status]})` : ''}`,
                data: updatedPanel
              });
              successCount++;
            }
          } else {
            console.log('Creating new panel (or panel exists in different project):', panelData);
            
            // Create new panel
            const newPanel = await crudOperations.create("panels", panelData);
            // Database triggers will automatically add status history
            results.push({
              success: true,
              message: `Successfully created new panel "${panel.name}"`,
              data: newPanel
            });
            successCount++;
          }
          
          // Update progress
          processedCount++;
          setImportProgress((processedCount / validPanels.length) * 100);
          
        } catch (error) {
          console.error("Error importing panel:", error);
          results.push({
            success: false,
            message: `Failed to import "${panel.name}"`,
            errors: [error instanceof Error ? error.message : 'Unknown error']
          });
          errorCount++;
          processedCount++;
          setImportProgress((processedCount / validPanels.length) * 100);
        }
      }

      // Update the global state with the local caches
      setBuildings(localBuildings);
      setFacades(localFacades);

      // Refresh the panels data to reflect all changes
      await fetchData();

      setImportResults({ successful: successCount, failed: errorCount });
      setBulkImportStep("complete");
    } catch (error) {
      console.error("Bulk import error:", error);
      setBulkImportErrors(["Failed to import panels. Please try again."]);
    } finally {
      setImportProgress(100);
      setIsImportingPanels(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        "Panel Name": "Sample Panel 1",
        "Type": "GRC",
        "Status": "Issued For Production",
        "Building Name": "Sample Building",
        "Facade Name": "Sample Facade",
        "Issue Transmittal No": "T-001",
        "Drawing Number": "DWG-001-A1",
        "Unit Rate QR/m2": 100.5,
        "IFP Qty Area SM": 50.25,
        "IFP Qty Nos": 1,
        "Weight": 25.5,
        "Dimension": "2.5m x 1.2m",
        "Issued for Production Date": "2024-01-15",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Panels Template");
    XLSX.writeFile(wb, "panels_import_template.xlsx");
  };

  const handleExportPanelsToExcel = async () => {
    if (panels.length === 0) {
      showToast("No panels to export", "error");
      return;
    }

    try {
      showToast("Exporting panels to Excel...", "success");

      // Fetch detailed panel data for export
      const { data: panelsData, error: panelsError } = await supabase
        .from('panels')
        .select(`
          id,
          name,
          type,
          status,
          project_id,
          building_id,
          facade_id,
          issue_transmittal_no,
          drawing_number,
          unit_rate_qr_m2,
          ifp_qty_area_sm,
          ifp_qty_nos,
          weight,
          dimension,
          issued_for_production_date,
          buildings(name),
          facades(name),
          projects(name)
        `)
        .eq('project_id', projectId);

      if (panelsError) {
        console.error("Database error:", panelsError);
        throw panelsError;
      }

      if (!panelsData || panelsData.length === 0) {
        showToast("No panel data found to export", "error");
        return;
      }

      // Format data to match the bulk import template structure
      const exportData = panelsData.map(panel => ({
        "Panel Name": panel.name || "",
        "Type": typeMap[panel.type] || "Unknown",
        "Status": statusMap[panel.status] || "Unknown",
        "Building Name": (panel.buildings as any)?.name || "",
        "Facade Name": (panel.facades as any)?.name || "",
        "Issue Transmittal No": panel.issue_transmittal_no || "",
        "Drawing Number": panel.drawing_number || "",
        "Unit Rate QR/m2": panel.unit_rate_qr_m2 || 0,
        "IFP Qty Area SM": panel.ifp_qty_area_sm || 0,
        "IFP Qty Nos": panel.ifp_qty_nos || 0,
        "Weight": panel.weight || 0,
        "Dimension": panel.dimension || "",
        "Issued for Production Date": panel.issued_for_production_date ? 
          new Date(panel.issued_for_production_date).toISOString().split('T')[0] : "",
      }));

      // Create Excel workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Panels");

      // Generate filename with project name and current date
      const sanitizedProjectName = (projectName || 'panels').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `project_${sanitizedProjectName}_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Save the file
      XLSX.writeFile(wb, fileName);
      
      showToast(`Successfully exported ${exportData.length} panels to ${fileName}`, "success");
    } catch (error) {
      console.error("Error exporting panels to Excel:", error);
      showToast(`Error exporting panels: ${error instanceof Error ? error.message : 'Unknown error'}`, "error");
    }
  };

  const handleExportPanelHistoryToExcel = async () => {
    try {
      showToast("Exporting panel history to Excel...", "success");

      // First, get all panel IDs for this project
      const { data: projectPanels, error: panelsError } = await supabase
        .from('panels')
        .select('id')
        .eq('project_id', projectId);

      if (panelsError) {
        console.error("Error fetching project panels:", panelsError);
        throw panelsError;
      }

      if (!projectPanels || projectPanels.length === 0) {
        showToast("No panels found in this project", "error");
        return;
      }

      const panelIds = projectPanels.map(p => p.id);

      // Fetch panel status histories for panels in this project
      const { data: historyData, error: historyError } = await supabase
        .from('panel_status_histories')
        .select(`
          id,
          panel_id,
          status,
          created_at,
          user_id,
          notes,
          panels(
            id,
            name
          ),
          users!panel_status_histories_user_id_fkey(
            id,
            name,
            email
          )
        `)
        .in('panel_id', panelIds)
        .order('created_at', { ascending: false });

      if (historyError) {
        console.error("Database error:", historyError);
        throw historyError;
      }

      if (!historyData || historyData.length === 0) {
        showToast("No panel history found to export", "error");
        return;
      }

      // Group history by panel_id and sort by date for each panel
      const historyByPanel = new Map();
      historyData.forEach(history => {
        if (!historyByPanel.has(history.panel_id)) {
          historyByPanel.set(history.panel_id, []);
        }
        historyByPanel.get(history.panel_id).push(history);
      });

      // Sort each panel's history by date (oldest first)
      historyByPanel.forEach((panelHistory, panelId) => {
        panelHistory.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });

      // Create export data with proper old status logic
      const exportDataWithOldStatus = historyData.map((history) => {
        const panel = history.panels as any;
        const user = history.users as any;
        
        // Get the panel's history in chronological order
        const panelHistory = historyByPanel.get(history.panel_id) || [];
        const currentIndex = panelHistory.findIndex((h: any) => h.id === history.id);
        
        // Determine old status
        let oldStatus = " ";
        if (currentIndex > 0) {
          // Get the previous status in the timeline
          const previousHistory = panelHistory[currentIndex - 1];
          oldStatus = statusMap[previousHistory.status] || "Unknown";
        }

        return {
          "Panel Name": panel?.name || "Unknown Panel",
          "Old Status": oldStatus,
          "New Status": statusMap[history.status] || "Unknown",
          "Changed By": user?.name || user?.email || "Unknown User",
          "Date of Change": history.created_at ? 
            new Date(history.created_at).toLocaleString() : "",
          "Notes": history.notes || "",
          // Keep original data for sorting
          panelName: panel?.name || "Unknown Panel",
          createdAt: history.created_at
        };
      });

      // Sort by panel name first, then by date (oldest to newest within each panel)
      const exportData = exportDataWithOldStatus.sort((a, b) => {
        // First sort by panel name
        if (a.panelName !== b.panelName) {
          return a.panelName.localeCompare(b.panelName);
        }
        // Then sort by date (oldest to newest)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      // Remove the temporary sorting fields
      const finalExportData = exportData.map(({ panelName, createdAt, ...rest }) => rest);

      // Create Excel workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(finalExportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Panel History");

      // Generate filename with project name and current date
      const sanitizedProjectName = (projectName || 'panels').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `project_${sanitizedProjectName}_history_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Save the file
      XLSX.writeFile(wb, fileName);
      
      showToast(`Successfully exported ${finalExportData.length} history records to ${fileName}`, "success");
    } catch (error) {
      console.error("Error exporting panel history to Excel:", error);
      showToast(`Error exporting panel history: ${error instanceof Error ? error.message : 'Unknown error'}`, "error");
    }
  };

  // Bulk import filters
  const filteredImportedPanels = importedPanels.filter((panel) => {
    const matchesSearch =
      bulkImportSearchTerm === "" ||
      panel.name.toLowerCase().includes(bulkImportSearchTerm.toLowerCase()) ||
      (panel.building_name?.toLowerCase().includes(bulkImportSearchTerm.toLowerCase()) ?? false) ||
      (panel.drawing_number?.toLowerCase().includes(bulkImportSearchTerm.toLowerCase()) ?? false) ||
      (panel.issue_transmittal_no?.toLowerCase().includes(bulkImportSearchTerm.toLowerCase()) ?? false);
    const matchesStatus = bulkImportStatusFilter === "all" || statusMap[panel.status] === bulkImportStatusFilter;
    const matchesType = bulkImportTypeFilter === "all" || typeMap[panel.type] === bulkImportTypeFilter;
    const matchesValidity =
      bulkImportValidityFilter === "all" ||
      (bulkImportValidityFilter === "valid" && panel.isValid) ||
      (bulkImportValidityFilter === "invalid" && !panel.isValid);
    return matchesSearch && matchesStatus && matchesType && matchesValidity;
  });

  const bulkImportTotalPages = Math.ceil(filteredImportedPanels.length / bulkImportPageSize);
  const bulkImportStartIndex = (bulkImportCurrentPage - 1) * bulkImportPageSize;
  const bulkImportEndIndex = bulkImportStartIndex + bulkImportPageSize;
  const paginatedImportedPanels = filteredImportedPanels.slice(bulkImportStartIndex, bulkImportEndIndex);

  const validPanelsCount = importedPanels.filter((p) => p.isValid).length;
  const invalidPanelsCount = importedPanels.length - validPanelsCount;

  const clearBulkImportFilters = () => {
    setBulkImportSearchTerm("");
    setBulkImportStatusFilter("all");
    setBulkImportTypeFilter("all");
    setBulkImportValidityFilter("all");
    setBulkImportCurrentPage(1);
  };

  const activeBulkImportFiltersCount = [
    bulkImportSearchTerm,
    bulkImportStatusFilter !== "all" ? bulkImportStatusFilter : "",
    bulkImportTypeFilter !== "all" ? bulkImportTypeFilter : "",
    bulkImportValidityFilter !== "all" ? bulkImportValidityFilter : "",
  ].filter(Boolean).length;

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedPanels(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedPanels.size === paginatedPanels.length) {
      setSelectedPanels(new Set());
    } else {
      setSelectedPanels(new Set(paginatedPanels.map(p => p.id)));
    }
  };

  const togglePanelSelection = (panelId: string) => {
    setSelectedPanels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(panelId)) {
        newSet.delete(panelId);
      } else {
        newSet.add(panelId);
      }
      return newSet;
    });
  };

  if (loading) {
    return <div>Loading panels...</div>;
  }

  if (isBulkImportMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Bulk Import Panels</h2>
            <span className="text-sm text-muted-foreground">for {projectName}</span>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setIsBulkImportMode(false);
              setBulkImportStep("upload");
              setBulkImportFile(null);
              setImportedPanels([]);
              setExistingPanels({});
              setImportProgress(0);
              setImportResults({ successful: 0, failed: 0 });
              setBulkImportErrors([]);
              setBulkImportCurrentPage(1);
              setBulkImportSearchTerm("");
              setBulkImportStatusFilter("all");
              setBulkImportTypeFilter("all");
              setBulkImportValidityFilter("all");
            }}
            className="border-border text-foreground hover:bg-accent"
          >
            <X className="h-4 w-4 mr-2" />
            Back to Panels
          </Button>
        </div>

        {bulkImportStep === "upload" && (
          <div className="space-y-6">
            {bulkImportErrors.length > 0 && (
              <div className="bg-destructive/15 border border-destructive/20 text-destructive p-4 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium mb-2">Import Errors</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {bulkImportErrors.map((error, index) => (
                        <li key={index} className="text-sm">{error}</li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBulkImportErrors([])}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Excel File
                  </CardTitle>
                  <CardDescription>Upload panels data for {projectName}</CardDescription>
                    </div>
                                      <div>
                    <Button variant="outline" onClick={downloadTemplate} className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                  </div>
                  </div>
                
                </CardHeader>
                <CardContent>
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = Array.from(e.dataTransfer.files);
                      const excelFile = files.find((f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls"));
                      if (excelFile) handleFileUpload(excelFile);
                    }}
                  >
                    <Upload className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
                    <h4 className="text-xl font-medium mb-3">Drop your Excel file here</h4>
                    <p className="text-muted-foreground mb-4">or click to browse files</p>
                    <p className="text-sm text-muted-foreground">Supports .xlsx files with panel data</p>
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
                  <div className="space-y-3 mt-8">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>Excel file must be in .xlsx format</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>Required columns: Panel Name, Type</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>Panels will be added to: {projectName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>Panel types: GRC, GRG, GRP, EIFS, UHPC</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>Panel statuses: Issued For Production, Produced, Inspected, Approved Material, Rejected Material, Issued, Proceed for Delivery, Delivered, Installed, Approved Final, Broken at Site, On Hold, Cancelled</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>Buildings and facades will be created automatically if they don't exist</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>Panel names only need to be unique within the same project</span>
                    </div>
                  </div>
                </CardContent>
              </Card>


          </div>
        )}

        {bulkImportStep === "preview" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Preview Import Data</h3>
                <p className="text-sm text-muted-foreground">Review and edit the imported panels before completing the import</p>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="secondary">{validPanelsCount} Valid</Badge>
                {invalidPanelsCount > 0 && <Badge variant="destructive">{invalidPanelsCount} Invalid</Badge>}
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Filters & Search</CardTitle>
                  {activeBulkImportFiltersCount > 0 && (
                    <Badge variant="secondary" className="h-5 w-5 p-0 text-xs">{activeBulkImportFiltersCount}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Search</Label>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search panels..."
                          value={bulkImportSearchTerm}
                          onChange={(e) => {
                            setBulkImportSearchTerm(e.target.value);
                            setBulkImportCurrentPage(1);
                          }}
                          className="pl-8"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={bulkImportStatusFilter}
                        onValueChange={(value) => {
                          setBulkImportStatusFilter(value);
                          setBulkImportCurrentPage(1);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          {PANEL_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={bulkImportTypeFilter}
                        onValueChange={(value) => {
                          setBulkImportTypeFilter(value);
                          setBulkImportCurrentPage(1);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All types</SelectItem>
                          {PANEL_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Validation</Label>
                      <Select
                        value={bulkImportValidityFilter}
                        onValueChange={(value) => {
                          setBulkImportValidityFilter(value);
                          setBulkImportCurrentPage(1);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All items" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All items</SelectItem>
                          <SelectItem value="valid">Valid only</SelectItem>
                          <SelectItem value="invalid">Invalid only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {bulkImportStartIndex + 1}-{Math.min(bulkImportEndIndex, filteredImportedPanels.length)} of {filteredImportedPanels.length} panels
                    </div>
                    <Button variant="outline" size="sm" onClick={clearBulkImportFilters}>
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="min-w-[200px]">Panel Name</TableHead>
                        <TableHead className="min-w-[120px]">Type</TableHead>
                        <TableHead className="min-w-[120px]">Status</TableHead>
                        <TableHead className="min-w-[120px]">Building</TableHead>
                        <TableHead className="min-w-[120px]">Facade</TableHead>
                        <TableHead className="min-w-[120px]">Issue/Trans No</TableHead>
                        <TableHead className="min-w-[120px]">Drawing No</TableHead>
                        <TableHead className="min-w-[100px]">Weight (kg)</TableHead>
                        <TableHead className="min-w-[150px]">Production Date</TableHead>
                        <TableHead className="min-w-[100px]">Action</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedImportedPanels.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2">
                              <Package className="h-8 w-8 text-muted-foreground" />
                              <p className="text-muted-foreground">No panels match your search criteria</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedImportedPanels.map((panel, index) => (
                          <TableRow key={panel.id} className={!panel.isValid ? "bg-destructive/5" : ""}>
                            <TableCell>
                              {panel.isValid ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <span title={panel.errors.join(", ")}>
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                value={panel.name}
                                onChange={(e) => updateImportedPanel(index, "name", e.target.value)}
                                className={panel.errors.some((e) => e.includes("name")) ? "border-destructive" : ""}
                                placeholder="Enter panel name"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={typeMap[panel.type]}
                                onValueChange={(value) => updateImportedPanel(index, "type", typeReverseMap[value])}
                              >
                                <SelectTrigger>
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
                            </TableCell>
                            <TableCell>
                              <Select
                                value={statusMap[panel.status]}
                                onValueChange={(value) => updateImportedPanel(index, "status", statusReverseMap[value])}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PANEL_STATUSES.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {status}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {panel.building_id ? (
                                <Select
                                  value={panel.building_id}
                                  onValueChange={(value) => updateImportedPanel(index, "building_id", value || undefined)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {buildings.map((building) => (
                                      <SelectItem key={building.id} value={building.id}>
                                        {building.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={panel.building_name || ""}
                                  onChange={(e) => updateImportedPanel(index, "building_name", e.target.value || undefined)}
                                  placeholder="Enter building name"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {panel.facade_id ? (
                                <Select
                                  value={panel.facade_id}
                                  onValueChange={(value) => updateImportedPanel(index, "facade_id", value || undefined)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {facades.map((facade) => (
                                      <SelectItem key={facade.id} value={facade.id}>
                                        {facade.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={panel.facade_name || ""}
                                  onChange={(e) => updateImportedPanel(index, "facade_name", e.target.value || undefined)}
                                  placeholder="Enter facade name"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                value={panel.issue_transmittal_no || ""}
                                onChange={(e) => updateImportedPanel(index, "issue_transmittal_no", e.target.value || undefined)}
                                placeholder="T-001"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={panel.drawing_number || ""}
                                onChange={(e) => updateImportedPanel(index, "drawing_number", e.target.value || undefined)}
                                placeholder="DWG-001"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.1"
                                value={panel.weight || ""}
                                onChange={(e) => updateImportedPanel(index, "weight", e.target.value ? parseFloat(e.target.value) : undefined)}
                                placeholder="25.5"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={panel.issued_for_production_date || ""}
                                onChange={(e) => updateImportedPanel(index, "issued_for_production_date", e.target.value || undefined)}
                                placeholder="2024-01-15"
                              />
                            </TableCell>
                            <TableCell>
                              {existingPanels[panel.name?.trim() || ''] ? (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <Edit className="h-3 w-3" />
                                  Update
                                </Badge>
                              ) : (
                                <Badge variant="default" className="flex items-center gap-1">
                                  <Plus className="h-3 w-3" />
                                  Create
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeImportedPanel(index)}
                                className="p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {bulkImportTotalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Page {bulkImportCurrentPage} of {bulkImportTotalPages}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBulkImportCurrentPage(1)}
                        disabled={bulkImportCurrentPage === 1}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBulkImportCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={bulkImportCurrentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">{bulkImportCurrentPage} of {bulkImportTotalPages}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBulkImportCurrentPage((prev) => Math.min(bulkImportTotalPages, prev + 1))}
                        disabled={bulkImportCurrentPage === bulkImportTotalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBulkImportCurrentPage(bulkImportTotalPages)}
                        disabled={bulkImportCurrentPage === bulkImportTotalPages}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {invalidPanelsCount > 0 && (
              <div className="bg-destructive/15 border border-destructive/20 text-destructive p-4 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">{invalidPanelsCount} panel(s) have validation errors. Please fix them before importing.</span>
                </div>
              </div>
            )}

            {/* Import Summary */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {validPanelsCount} Valid
                    </Badge>
                    {invalidPanelsCount > 0 && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {invalidPanelsCount} Invalid
                      </Badge>
                    )}
                    {(() => {
                      const newPanelsCount = validPanelsCount - Object.keys(existingPanels).length;
                      const existingPanelsCount = Object.keys(existingPanels).length;
                      return (
                        <>
                          {newPanelsCount > 0 && (
                            <Badge variant="default" className="flex items-center gap-1">
                              <Plus className="h-3 w-3" />
                              {newPanelsCount} New
                            </Badge>
                          )}
                          {existingPanelsCount > 0 && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Edit className="h-3 w-3" />
                              {existingPanelsCount} Update
                            </Badge>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Existing panels with the same name in this project will be updated automatically
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => {
                setBulkImportStep("upload");
                setExistingPanels({});
              }}>
                Back to Upload
              </Button>
              <div className="flex items-center gap-4">
                                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsBulkImportMode(false);
                      setBulkImportStep("upload");
                      setBulkImportFile(null);
                      setImportedPanels([]);
                      setExistingPanels({});
                      setImportProgress(0);
                      setImportResults({ successful: 0, failed: 0 });
                      setBulkImportErrors([]);
                    }}
                  >
                    Cancel Import
                  </Button>
                <Button onClick={handleImportPanels} disabled={validPanelsCount === 0 || isImportingPanels}>
                  {isImportingPanels ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Importing...
                    </>
                  ) : (
                    (() => {
                      const newPanelsCount = validPanelsCount - Object.keys(existingPanels).length;
                      const existingPanelsCount = Object.keys(existingPanels).length;
                      if (newPanelsCount > 0 && existingPanelsCount > 0) {
                        return `Create ${newPanelsCount} New & Update ${existingPanelsCount} Existing`;
                      } else if (existingPanelsCount > 0) {
                        return `Update ${existingPanelsCount} Panel${existingPanelsCount !== 1 ? "s" : ""}`;
                      } else {
                        return `Create ${validPanelsCount} New Panel${validPanelsCount !== 1 ? "s" : ""}`;
                      }
                    })()
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {bulkImportStep === "importing" && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="space-y-6">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Package className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium">Importing Panels...</h3>
                  <p className="text-muted-foreground">Please wait while we process your data</p>
                </div>
                <div className="space-y-4 max-w-md mx-auto">
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="h-2 bg-primary rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
                  </div>
                  <p className="text-sm text-muted-foreground">{Math.round(importProgress)}% complete</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {bulkImportStep === "complete" && (
          <Card>
            <CardContent className="p-12 pt-6 text-center">
              <div className="space-y-6">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium">Import Complete!</h3>
                  <p className="text-muted-foreground">{importResults.successful} panels have been imported successfully to {projectName}.</p>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    onClick={() => {
                      setBulkImportStep("upload");
                      setBulkImportFile(null);
                      setImportedPanels([]);
                      setExistingPanels({});
                      setImportProgress(0);
                      setImportResults({ successful: 0, failed: 0 });
                      setBulkImportErrors([]);
                    }}
                  >
                    Import More Panels
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsBulkImportMode(false);
                      setBulkImportStep("upload");
                      setBulkImportFile(null);
                      setImportedPanels([]);
                      setExistingPanels({});
                      setImportProgress(0);
                      setImportResults({ successful: 0, failed: 0 });
                      setBulkImportErrors([]);
                    }}
                  >
                    Back to Panels
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg sm:text-xl font-semibold">Panels</h2>
          <Badge variant="secondary" className="ml-2 text-xs sm:text-sm">{filteredPanels.length}</Badge>
          <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">in {projectName}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
           {isSelectionMode && canUpdatePanels && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsBulkStatusDialogOpen(true)}
                disabled={selectedPanels.size === 0}
                className="h-9 text-xs sm:text-sm"
              >
                <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Update Status ({selectedPanels.size})</span>
                <span className="sm:hidden">Status ({selectedPanels.size})</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAddToGroupDialogOpen(true)}
                disabled={selectedPanels.size === 0}
                className="h-9 text-xs sm:text-sm"
              >
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Add to Group ({selectedPanels.size})</span>
                <span className="sm:hidden">Add ({selectedPanels.size})</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsCreateGroupDialogOpen(true)}
                disabled={selectedPanels.size === 0}
                className="h-9 text-xs sm:text-sm"
              >
                <FolderPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Create Group</span>
                <span className="sm:hidden">Create</span>
              </Button>
              
            </>
          )}
         {isSelectionMode && canUpdatePanels && (
            <Button
            variant="outline"
            onClick={toggleSelectAll}
            disabled={paginatedPanels.length === 0}
            className="h-9 text-xs sm:text-sm"
          >
            {selectedPanels.size === paginatedPanels.length && paginatedPanels.length > 0 ? (
              <>
                <Square className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Deselect All</span>
                <span className="sm:hidden">Deselect</span>
              </>
            ) : (
              <>
                <CheckSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Select All</span>
                <span className="sm:hidden">Select All</span>
              </>
            )}
            </Button>
          )}
          {canUpdatePanels && (
          <Button
            variant={isSelectionMode ? "default" : "outline"}
            onClick={toggleSelectionMode}
            className="h-9 text-xs sm:text-sm"
          >
            {isSelectionMode ? (
              <>
                <CheckSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Exit Selection</span>
                <span className="sm:hidden">Exit</span>
              </>
            ) : (
              <>
                <Square className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Select Panels</span>
                <span className="sm:hidden">Select</span>
              </>
            )}
          </Button>
          )}
          {!isSelectionMode&&
          <>
            {canBulkImportPanels && (
            <Button
              variant="outline"
              onClick={() => setIsBulkImportMode(true)}
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground border-border h-9 text-xs sm:text-sm"
            >
              <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Bulk Import</span>
              <span className="sm:hidden">Import</span>
            </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExportPanelsToExcel}
              disabled={panels.length === 0}
              className="h-9 text-xs sm:text-sm"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Export to Excel</span>
              <span className="sm:hidden">Export</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExportPanelHistoryToExcel}
              className="h-9 text-xs sm:text-sm"
            >
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Export History</span>
              <span className="sm:hidden">History</span>
            </Button>
            <Button onClick={() => setIsAddPanelDialogOpen(true)} disabled={!canCreatePanels} className="h-9 text-xs sm:text-sm">
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Add Panel</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg">Filters & Search</CardTitle>
            {activeFiltersCount > 0 && <Badge variant="secondary" className="h-5 w-5 p-0 text-xs">{activeFiltersCount}</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search panels..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {PANEL_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {PANEL_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Building</Label>
                <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="All buildings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All buildings</SelectItem>
                    {buildings.map((building) => (
                      <SelectItem key={building.id} value={building.name}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Facade</Label>
                <Select value={facadeFilter} onValueChange={setFacadeFilter}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="All facades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All facades</SelectItem>
                    {facades.map((facade) => (
                      <SelectItem key={facade.id} value={facade.name}>
                        {facade.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t">
              <div className="text-xs sm:text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredPanels.length)} of {filteredPanels.length} panels
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={clearFilters} className="w-full sm:w-auto h-9 text-xs sm:text-sm">
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Panels List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {paginatedPanels.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Package className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium mb-2">
                  {searchTerm || statusFilter !== "all" || typeFilter !== "all" || buildingFilter !== "all" || facadeFilter !== "all"
                    ? "No panels match your search criteria"
                    : "No panels found"}
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== "all" || typeFilter !== "all" || buildingFilter !== "all" || facadeFilter !== "all"
                    ? "Try adjusting your filters to see more results."
                    : "Get started by adding your first panel."}
                </p>
                {!searchTerm && statusFilter === "all" && typeFilter === "all" && buildingFilter === "all" && facadeFilter === "all" && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <Button onClick={() => setIsAddPanelDialogOpen(true)} disabled={!canCreatePanels} className="w-full sm:w-auto h-9 text-xs sm:text-sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Panel
                    </Button>
                    {canBulkImportPanels && (
                    <Button
                      variant="outline"
                      onClick={() => setIsBulkImportMode(true)}
                      className="bg-secondary hover:bg-secondary/90 text-secondary-foreground border-border w-full sm:w-auto h-9 text-xs sm:text-sm"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Bulk Import
                    </Button>
                    )}
                    
                  </div>
                )}
              </div>
            ) : (
              paginatedPanels.map((panel) => (
                <Collapsible key={panel.id} >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <div 
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 hover:bg-muted/50 cursor-pointer gap-3 sm:gap-4"
                        onClick={() => handlePanelClick(panel)}
                      >
                        {/* Mobile Layout */}
                        <div className="w-full sm:hidden">
                          {/* Selection checkbox */}
                          {isSelectionMode && canUpdatePanels && (
                            <div 
                              className="flex items-center mb-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePanelSelection(panel.id);
                              }}
                            >
                              {selectedPanels.has(panel.id) ? (
                                <CheckSquare className="h-5 w-5 text-primary" />
                              ) : (
                                <Square className="h-5 w-5 text-muted-foreground" />
                              )}
                              <span className="ml-2 text-sm font-medium">Select Panel</span>
                            </div>
                          )}
                          
                          {/* Main panel info */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                {!isSelectionMode && (
                                  <>
                                    {expandedRows.has(panel.id) ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                  </>
                                )}
                                <p className="font-semibold text-base truncate">{panel.name}</p>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm text-muted-foreground">{typeMap[panel.type]}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Status:</span>
                                <span className="text-xs font-medium text-primary">{statusMap[panel.status]}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Action buttons - larger icons for better visibility */}
                          <div className="flex items-center justify-center gap-1 pt-2 border-t border-border/50">
                            {canChangePanelStatus && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(panel);
                              }}
                              className="h-9 w-9 p-0"
                              title="Change Status"
                            >
                              <RefreshCw className="h-8 w-8" />
                            </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewQRCode(panel);
                              }}
                              className="h-9 w-9 p-0"
                              title="View QR Code"
                            >
                              <QrCode className="h-8 w-8" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTimeline(panel);
                              }}
                              className="h-9 w-9 p-0"
                              title="View History"
                            >
                              <History className="h-8 w-8" />
                            </Button>
                            {canUpdatePanels && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditPanel(panel);
                              }}
                              className="h-9 w-9 p-0"
                              title="Edit Panel"
                            >
                              <Edit className="h-8 w-8" />
                            </Button>
                            )}
                            {canDeletePanels && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePanel(panel);
                              }}
                              className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                              title="Delete Panel"
                            >
                              <Trash2 className="h-8 w-8" />
                            </Button>
                            )}
                          </div>
                        </div>

                        {/* Desktop Layout */}
                        <div className="hidden sm:flex items-center space-x-4 flex-1">
                          {isSelectionMode && canUpdatePanels && (
                            <div 
                              className="flex items-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePanelSelection(panel.id);
                              }}
                            >
                              {selectedPanels.has(panel.id) ? (
                                <CheckSquare className="h-5 w-5 text-primary" />
                              ) : (
                                <Square className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-2">
                            {!isSelectionMode && (
                              <>
                                {expandedRows.has(panel.id) ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                            <div>
                              <p className="font-medium text-sm">{panel.name}</p>
                              <p className="text-xs text-muted-foreground">{panel.project_name}</p>
                            </div>
                            <div className="flex items-center">
                              <Layers className="mr-2 h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">Type: {typeMap[panel.type]}</span>
                            </div>
                            <div>
                              <Badge className={'bg-primary text-primary-foreground'}>{statusMap[panel.status]}</Badge>
                            </div>
                            <div className="flex items-center">
                              <FolderOpen className="mr-2 h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">Building: {panel.building_name || "—"}</span>
                            </div>
                            <div className="flex items-center">
                              <Hash className="mr-2 h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">IFP Qty Nos: {panel.ifp_qty_nos || "0"}</span>
                            </div>
                          </div>
                        </div>
                       <div className="hidden sm:flex items-center gap-2">
                          {canChangePanelStatus && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(panel);
                            }}
                            className="p-0 text-blue-600 hover:text-blue-700"
                            title="Change Status"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewQRCode(panel);
                            }}
                            className="p-0"
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                            <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTimeline(panel);
                            }}
                            className="p-0"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          {canUpdatePanels && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditPanel(panel);
                            }}
                            className="p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          )}
                          {canDeletePanels && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePanel(panel);
                            }}
                            className="p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          )}
                          
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t bg-muted/25">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-3 sm:pt-4">
                          <div className="space-y-2">
                            <h4 className="font-medium text-xs sm:text-sm">Technical Details</h4>
                            <div className="space-y-1">
                              <div className="flex items-center">
                                <FileText className="mr-2 h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">Issue/Transmittal:</span>
                                <span className="text-xs ml-2 truncate">{panel.issue_transmittal_no || "—"}</span>
                              </div>
                              <div className="flex items-center">
                                <FileText className="mr-2 h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">Drawing Number:</span>
                                <span className="text-xs ml-2 truncate">{panel.drawing_number || "—"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-medium text-xs sm:text-sm">Quantities</h4>
                            <div className="space-y-1">
                              <div className="flex items-center">
                                <Hash className="mr-2 h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">Unit Rate QR/m²:</span>
                                <span className="text-xs ml-2">{panel.unit_rate_qr_m2 || "—"}</span>
                              </div>
                              <div className="flex items-center">
                                <Hash className="mr-2 h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">IFP Qty Area SM:</span>
                                <span className="text-xs ml-2">{panel.ifp_qty_area_sm || "—"}</span>
                              </div>
                              <div className="flex items-center">
                                <Hash className="mr-2 h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">IFP Qty Nos:</span>
                                <span className="text-xs ml-2">{panel.ifp_qty_nos || "—"}</span>
                              </div>
                              <div className="flex items-center">
                                <Hash className="mr-2 h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">Weight:</span>
                                <span className="text-xs ml-2">{panel.weight ? `${panel.weight} kg` : "—"}</span>
                              </div>
                              <div className="flex items-center">
                                <Calendar className="mr-2 h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">Production Date:</span>
                                <span className="text-xs ml-2">{panel.issued_for_production_date ? new Date(panel.issued_for_production_date).toLocaleDateString('en-GB') : "—"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-medium text-xs sm:text-sm">Project Info</h4>
                            <div className="space-y-1">
                              <div className="flex items-center">
                                <FolderOpen className="mr-2 h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">Project:</span>
                                <span className="text-xs ml-2 truncate">{panel.project_name}</span>
                              </div>
                              <div className="flex items-center">
                                <FolderOpen className="mr-2 h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">Building:</span>
                                <span className="text-xs ml-2 truncate">{panel.building_name || "—"}</span>
                              </div>
                              <div className="flex items-center">
                                <FolderOpen className="mr-2 h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">Facade:</span>
                                <span className="text-xs ml-2 truncate">{panel.facade_name || "—"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 sm:gap-2 mt-4 sm:mt-6 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0"
              >
                <ChevronsLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0"
              >
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1))
                  .map((page, index, array) => (
                    <div key={page} className="flex items-center gap-1">
                      {index > 0 && array[index - 1] !== page - 1 && <span className="text-muted-foreground text-xs">...</span>}
                      <Button
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-7 h-7 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm"
                      >
                        {page}
                      </Button>
                    </div>
                  ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0"
              >
                <ChevronRightIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0"
              >
                <ChevronsRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddPanelDialogOpen} onOpenChange={setIsAddPanelDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:w-full sm:mx-0 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Add New Panel</DialogTitle>
            <DialogDescription className="text-sm">Create a new panel for {projectName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Panel Name *</Label>
              <Input
                id="name"
                value={newPanelModel.name}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, name: e.target.value })}
                placeholder="Enter panel name"
                className="w-full h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="text-sm font-medium">Panel Type *</Label>
              <Select
                value={typeMap[newPanelModel.type]}
                onValueChange={(value) => setNewPanelModel({ ...newPanelModel, type: typeReverseMap[value] })}
              >
                <SelectTrigger className="h-11">
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
              <Label htmlFor="status" className="text-sm font-medium">Status *</Label>
              <Select
                value={statusMap[newPanelModel.status]}
                disabled
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={statusMap[0]}>
                    {statusMap[0]}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DateInput
              id="issued_for_production_date"
              label="Issued for Production Date"
              value={newPanelModel.issued_for_production_date}
              onChange={(value) => setNewPanelModel({ ...newPanelModel, issued_for_production_date: value || undefined })}
              placeholder="Select date"
            />
            <div className="space-y-2">
              <Label htmlFor="building_id" className="text-sm font-medium">Building</Label>
              <Select
                value={newPanelModel.building_id || ""}
                disabled={!!facadeId}
                onValueChange={(value) => {
                  setNewPanelModel({ 
                    ...newPanelModel, 
                    building_id: value || undefined,
                    facade_id: undefined // Clear facade when building changes
                  });
                  filterFacadesByBuilding(value || undefined);
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select building" />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map((building) => (
                    <SelectItem key={building.id} value={building.id}>
                      {building.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="facade_id" className="text-sm font-medium">Facade</Label>
              <Select
                value={newPanelModel.facade_id || ""}
                disabled={!!facadeId}
                onValueChange={(value) => setNewPanelModel({ ...newPanelModel, facade_id: value || undefined })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select facade" />
                </SelectTrigger>
                <SelectContent>
                  {facades.map((facade) => (
                    <SelectItem key={facade.id} value={facade.id}>
                      {facade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue_transmittal_no" className="text-sm font-medium">Issue/Transmittal Number</Label>
              <Input
                id="issue_transmittal_no"
                value={newPanelModel.issue_transmittal_no || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, issue_transmittal_no: e.target.value || undefined })}
                placeholder="Enter issue/transmittal number"
                className="w-full h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drawing_number" className="text-sm font-medium">Drawing Number</Label>
              <Input
                id="drawing_number"
                value={newPanelModel.drawing_number || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, drawing_number: e.target.value || undefined })}
                placeholder="Enter drawing number"
                className="w-full h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_rate_qr_m2" className="text-sm font-medium">Unit Rate QR/m²</Label>
              <Input
                id="unit_rate_qr_m2"
                type="number"
                min="0"
                value={newPanelModel.unit_rate_qr_m2 || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, unit_rate_qr_m2: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Enter unit rate"
                className="w-full h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ifp_qty_area_sm" className="text-sm font-medium">IFP Qty Area SM</Label>
              <Input
                id="ifp_qty_area_sm"
                type="number"
                min="0"
                value={newPanelModel.ifp_qty_area_sm || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, ifp_qty_area_sm: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Enter IFP qty area"
                className="w-full h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ifp_qty_nos" className="text-sm font-medium">IFP Qty Nos</Label>
              <Input
                id="ifp_qty_nos"
                type="number"
                min="0"
                value={newPanelModel.ifp_qty_nos || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, ifp_qty_nos: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="Enter IFP qty nos"
                className="w-full h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight" className="text-sm font-medium">Weight (kg)</Label>
              <Input
                id="weight"
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
              <Label htmlFor="dimension" className="text-sm font-medium">Dimension</Label>
              <Input
                id="dimension"
                value={newPanelModel.dimension || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, dimension: e.target.value || undefined })}
                placeholder="Enter dimension (e.g., 2.5m x 1.2m)"
                className="w-full h-11"
              />
            </div>
          </div>
          </div>
          <DialogFooter className="pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddPanelDialogOpen(false);
                setNewPanelModel({
                  name: "",
                  type: 0,
                  status: 0,
                  building_id: facadeId ? parentBuildingId : undefined,
                  facade_id: facadeId || undefined,
                  issue_transmittal_no: undefined,
                  drawing_number: undefined,
                  unit_rate_qr_m2: undefined,
                  ifp_qty_area_sm: undefined,
                  ifp_qty_nos: undefined,
                  weight: undefined,
                  dimension: undefined,
                  issued_for_production_date: undefined,
                });
                // Reset facades to show all
                setFacades(allFacades);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button onClick={handleSavePanel} disabled={!canCreatePanels || isSavingPanel} className="w-full sm:w-auto">
              {isSavingPanel ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
                </>
              ) : (
                'Add Panel'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:w-full sm:mx-0 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Edit Panel</DialogTitle>
            <DialogDescription className="text-sm">Update panel information for {editingPanel?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <SelectTrigger className="h-11">
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
              <Label htmlFor="edit-status">Status *</Label>
              <Select
                value={statusMap[newPanelModel.status]}
                onValueChange={(value) => setNewPanelModel({ ...newPanelModel, status: statusReverseMap[value] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editingPanel ? getValidStatuses(editingPanel.status).map((statusIndex) => {
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
              <Label htmlFor="edit-building_id">Building</Label>
              <Select
                value={newPanelModel.building_id || ""}
                disabled={!!facadeId}
                onValueChange={(value) => {
                  setNewPanelModel({ 
                    ...newPanelModel, 
                    building_id: value || undefined,
                    facade_id: undefined // Clear facade when building changes
                  });
                  filterFacadesByBuilding(value || undefined);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select building" />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map((building) => (
                    <SelectItem key={building.id} value={building.id}>
                      {building.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-facade_id">Facade</Label>
              <Select
                value={newPanelModel.facade_id || ""}
                disabled={!!facadeId}
                onValueChange={(value) => setNewPanelModel({ ...newPanelModel, facade_id: value || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select facade" />
                </SelectTrigger>
                <SelectContent>
                  {facades.map((facade) => (
                    <SelectItem key={facade.id} value={facade.id}>
                      {facade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-issue_transmittal_no">Issue/Transmittal Number</Label>
              <Input
                id="edit-issue_transmittal_no"
                value={newPanelModel.issue_transmittal_no || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, issue_transmittal_no: e.target.value || undefined })}
                placeholder="Enter issue/transmittal number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-drawing_number">Drawing Number</Label>
              <Input
                id="edit-drawing_number"
                value={newPanelModel.drawing_number || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, drawing_number: e.target.value || undefined })}
                placeholder="Enter drawing number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-unit_rate_qr_m2">Unit Rate QR/m²</Label>
              <Input
                id="edit-unit_rate_qr_m2"
                type="number"
                min="0"
                value={newPanelModel.unit_rate_qr_m2 || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, unit_rate_qr_m2: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Enter unit rate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ifp_qty_area_sm">IFP Qty Area SM</Label>
              <Input
                id="edit-ifp_qty_area_sm"
                type="number"
                min="0"
                value={newPanelModel.ifp_qty_area_sm || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, ifp_qty_area_sm: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Enter IFP qty area"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ifp_qty_nos">IFP Qty Nos</Label>
              <Input
                id="edit-ifp_qty_nos"
                type="number"
                min="0"
                value={newPanelModel.ifp_qty_nos || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, ifp_qty_nos: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="Enter IFP qty nos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-weight">Weight (kg)</Label>
              <Input
                id="edit-weight"
                type="number"
                min="0"
                step="0.1"
                value={newPanelModel.weight || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, weight: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Enter weight in kg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dimension">Dimension</Label>
              <Input
                id="edit-dimension"
                value={newPanelModel.dimension || ""}
                onChange={(e) => setNewPanelModel({ ...newPanelModel, dimension: e.target.value || undefined })}
                placeholder="Enter dimension (e.g., 2.5m x 1.2m)"
              />
            </div>
            <DateInput
              id="edit-issued_for_production_date"
              label="Issued for Production Date"
              value={newPanelModel.issued_for_production_date}
              onChange={(value) => setNewPanelModel({ ...newPanelModel, issued_for_production_date: value || undefined })}
              placeholder="Select date"
            />
          
          </div></div>
          <DialogFooter className="pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingPanel(null);
                setNewPanelModel({
                  name: "",
                  type: 0,
                  status: 0,
                  building_id: facadeId ? parentBuildingId : undefined,
                  facade_id: facadeId || undefined,
                  issue_transmittal_no: undefined,
                  drawing_number: undefined,
                  unit_rate_qr_m2: undefined,
                  ifp_qty_area_sm: undefined,
                  ifp_qty_nos: undefined,
                  weight: undefined,
                  dimension: undefined,
                  issued_for_production_date: undefined,
                });
                // Reset facades to show all
                setFacades(allFacades);
              }}
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] max-w-md mx-4 sm:w-full sm:mx-0 rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Delete Panel</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to delete the panel "{panelToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setPanelToDelete(null)} className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePanel} className="bg-destructive text-destructive-foreground w-full sm:w-auto">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedPanelForQR && (
        <QRCodeModal
          isOpen={!!selectedPanelForQR}
          onClose={() => setSelectedPanelForQR(null)}
          panel={selectedPanelForQR}
        />
      )}


      <Dialog open={isTimelineOpen} onOpenChange={setIsTimelineOpen}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto mx-4 sm:w-[90vw] md:w-[85vw] lg:w-[80vw] sm:mx-0 rounded-lg">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">Panel Timeline</DialogTitle>
            <DialogDescription className="text-sm">
              Status history for {selectedPanelForTimeline?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 pr-2">
            {selectedPanelForTimeline && (
              <Timeline
                panel={selectedPanelForTimeline}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Update Dialog */}
      <Dialog open={isBulkStatusDialogOpen} onOpenChange={setIsBulkStatusDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md mx-4 sm:w-full sm:mx-0 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Update Panel Status</DialogTitle>
            <DialogDescription className="text-sm">
              Update status for {selectedPanels.size} selected panel(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const selectedPanelObjects = panels.filter(panel => selectedPanels.has(panel.id));
              const uniqueStatuses = new Set(selectedPanelObjects.map(panel => panel.status));
              const hasDifferentStatuses = uniqueStatuses.size > 1;
              const currentStatus = uniqueStatuses.size === 1 ? Array.from(uniqueStatuses)[0] : null;
              const currentStatusName = currentStatus !== null ? statusMap[currentStatus] : null;
              
              return (
                <>
                  {hasDifferentStatuses ? (
                    <div className="bg-destructive/15 border border-destructive/20 text-destructive p-3 rounded-lg">
                      <p className="text-sm font-medium mb-1">Cannot Update Different Statuses</p>
                      <p className="text-xs">
                        Selected panels have different statuses: {Array.from(uniqueStatuses).map(status => statusMap[status]).join(", ")}.
                        <br />
                        Please select panels with the same status to perform bulk updates.
                      </p>
                    </div>
                  ) : currentStatus !== null && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg">
                      <p className="text-sm font-medium mb-1 text-destructive">Current Status: {currentStatusName}</p>
                      <p className="text-xs text-destructive">
                        All selected panels have the same status. You can update them to the next status in the workflow.
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="bulk-status">New Status *</Label>
                    <Select
                      value={bulkStatusValue === null ? undefined : statusMap[bulkStatusValue]}
                      onValueChange={(value) => setBulkStatusValue(statusReverseMap[value])}
                      disabled={hasDifferentStatuses}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={hasDifferentStatuses ? "Cannot update different statuses" : "Select new status"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
                        {PANEL_STATUSES.map((status, index) => {
                          const isSpecial = isSpecialStatus(index);
                          // Admin can skip forward to any status but not backwards
                          let isValidTransition = true;
                          if (currentStatus !== null) {
                            if (currentUser?.role === 'Administrator') {
                              const onHoldStatusIndex = PANEL_STATUSES.indexOf('On Hold');
                              const cancelledStatusIndex = PANEL_STATUSES.indexOf('Cancelled');
                              const brokenAtSiteStatusIndex = PANEL_STATUSES.indexOf('Broken at Site');
                              
                              if (currentStatus === onHoldStatusIndex) {
                                // From On Hold, check if index is in allowed statuses
                                const allowedStatuses = [cancelledStatusIndex, brokenAtSiteStatusIndex];
                                // Note: For bulk updates, we can't easily get previous status for each panel
                                // So we only allow special statuses from On Hold in bulk updates
                                isValidTransition = allowedStatuses.includes(index);
                              } else {
                                // For other statuses, check if index is a forward status or a special status
                                const forwardStatuses = getAllForwardStatuses(currentStatus);
                                const specialStatuses = [onHoldStatusIndex, cancelledStatusIndex, brokenAtSiteStatusIndex];
                                const allowedStatuses = Array.from(new Set([...forwardStatuses, ...specialStatuses]));
                                isValidTransition = allowedStatuses.includes(index);
                              }
                            } else {
                              isValidTransition = validateStatusTransition(currentStatus, index).isValid;
                            }
                          }
                          return (
                            <SelectItem 
                              key={status} 
                              value={status}
                              disabled={!isValidTransition}
                            >
                              <div className="flex items-center gap-2">
                                <span>{status}</span>
                                {isSpecial && (
                                  <Badge variant="outline" className="text-xs">
                                    Special
                                  </Badge>
                                )}
                                {!isValidTransition && (
                                  <span className="text-xs text-muted-foreground">(Invalid)</span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="bg-muted/25 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      {hasDifferentStatuses ? (
                        "Bulk status updates are only allowed for panels with the same current status."
                      ) : (
                        <>
                          This will update the status of {selectedPanels.size} selected panel(s) to the new status.
                          <br />
                          <strong>Title:</strong> Only valid status transitions will be allowed.
                        </>
                      )}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
          <DialogFooter className="pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsBulkStatusDialogOpen(false);
                setBulkStatusValue(null);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleBulkStatusUpdate} 
              disabled={bulkStatusValue === null || isBulkStatusUpdating || (() => {
                const selectedPanelObjects = panels.filter(panel => selectedPanels.has(panel.id));
                const uniqueStatuses = new Set(selectedPanelObjects.map(panel => panel.status));
                return uniqueStatuses.size > 1;
              })()}
              className="w-full sm:w-auto"
            >
              {isBulkStatusUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                'Update Status'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Group Dialog */}
      <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
      <DialogContent className="w-[95vw] max-w-md mx-4 sm:w-full sm:mx-0 rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Create New Panel Group</DialogTitle>
          <DialogDescription className="text-sm">
            Create a new panel group with {selectedPanels.size} selected panels from this project
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="group-name" className="text-sm font-medium">Group Name *</Label>
            <Input
              id="group-name"
              value={newPanelGroupModel.name}
              onChange={(e) =>
                setNewPanelGroupModel({ ...newPanelGroupModel, name: e.target.value })
              }
              placeholder="Enter group name"
              className="w-full h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-description" className="text-sm font-medium">Description</Label>
            <Textarea
              id="group-description"
              value={newPanelGroupModel.description}
              onChange={(e) =>
                setNewPanelGroupModel({
                  ...newPanelGroupModel,
                  description: e.target.value,
                })
              }
              placeholder="Enter group description (optional)"
              rows={3}
              className="w-full"
            />
          </div>
                      <div className="bg-muted/25 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                This will create a new panel group with {selectedPanels.size} panels from the current selection. Only panels from this project can be added to groups.
              </p>
            </div>
        </div>
        <DialogFooter className="pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setIsCreateGroupDialogOpen(false);
              setNewPanelGroupModel({
                name: "",
                description: "",
              });
            }}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button onClick={handleCreateGroup} disabled={isCreatingGroup} className="w-full sm:w-auto">
            {isCreatingGroup ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              'Create Group'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {/* Add to Existing Group Dialog */}
      <Dialog open={isAddToGroupDialogOpen} onOpenChange={setIsAddToGroupDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md mx-4 sm:w-full sm:mx-0 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Add to Existing Panel Group</DialogTitle>
                      <DialogDescription className="text-sm">
            Add {selectedPanels.size} selected panels to an existing group from this project
          </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="group-select" className="text-sm font-medium">Select Group *</Label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Choose a panel group from this project" />
                </SelectTrigger>
                <SelectContent>
                  {panelGroups.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No panel groups found in this project
                    </div>
                  ) : (
                    panelGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                        {group.description && ` - ${group.description}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/25 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                This will add {selectedPanels.size} panels to the selected group. Only panels from this project can be added to groups. Individual panel statuses will be preserved.
              </p>
            </div>
          </div>
          <DialogFooter className="pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddToGroupDialogOpen(false);
                setSelectedGroupId("");
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button onClick={handleAddToExistingGroup} disabled={isAddingToGroup || !selectedGroupId} className="w-full sm:w-auto">
              {isAddingToGroup ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
                </>
              ) : (
                'Add to Group'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <StatusChangeDialog
        panel={selectedPanelForStatusChange}
        isOpen={isStatusChangeDialogOpen}
        onClose={() => {
          setIsStatusChangeDialogOpen(false);
          setSelectedPanelForStatusChange(null);
        }}
        onStatusChanged={handleStatusChanged}
      />
    </div>
  );
}