import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Edit,
  Grid3X3,
  Package,
  Search,
  Users,
  X
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { useAuth } from "../contexts/AuthContext";
import { hasPermission, UserRole } from "../utils/rolePermissions";
import { useToastContext } from "../contexts/ToastContext";

const PANEL_STATUSES = [
  { value: "Issued For Production", label: "Issued For Production" },
  { value: "Produced", label: "Produced" },
  { value: "Proceed for Delivery", label: "Proceed for Delivery" },
  { value: "Delivered", label: "Delivered" },
  { value: "Approved Material", label: "Approved Material" },
  { value: "Rejected Material", label: "Rejected Material" },
  { value: "Installed", label: "Installed" },
  { value: "Inspected", label: "Inspected" },
  { value: "Approved Final", label: "Approved Final" }, 
  { value: "On Hold", label: "On Hold" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Broken at Site", label: "Broken at Site" },
] as const;

type PanelStatus = (typeof PANEL_STATUSES)[number]["value"];

interface PanelModel {
  id: string;
  name: string;
  status: PanelStatus;
  panelTag: string;
  dwgNo: string;
  unitQty: number;
  unitRateQrM2: number;
  ifpQtyAreaSm: number;
  weight: number;
  groupId?: string; // Optional since we're using many-to-many relationship
  allGroupIds?: string[];
}

interface PanelGroupModel {
  id: string;
  name: string;
  description: string;
  panelCount: number;
  createdAt: string;
  project: string;
  project_id?: string;
}

interface PanelGroupsSectionProps {
  onAddGroup?: () => void;
  onEditGroup?: (group: PanelGroupModel) => void;
  onDeleteGroup?: (group: PanelGroupModel) => void;
  onViewGroup?: (group: PanelGroupModel) => void;
}

interface UpdateGroupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  group: PanelGroupModel;
  onGroupUpdated: () => void;
}

interface DeleteGroupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  group: PanelGroupModel;
  onGroupDeleted: () => void;
}

interface CreateGroupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated: () => void;
}

interface AddPanelsToGroupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  projectId: string;
  onPanelsAdded: () => void;
}

interface UpdateGroupStatusDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  currentStatus: string;
  onStatusUpdate: () => void;
}

interface UpdatePanelGroupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  group: PanelGroupModel;
  onGroupUpdated: () => void;
}

function UpdateGroupDialog({ isOpen, onOpenChange, group, onGroupUpdated }: UpdateGroupDialogProps) {
  const [groupName, setGroupName] = useState(group.name);
  const [groupDescription, setGroupDescription] = useState(group.description || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const { showToast } = useToastContext();

  const handleUpdateGroup = async () => {
    if (!groupName.trim()) {
      alert("Title is required");
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('panel_groups')
        .update({
          name: groupName.trim(),
          description: groupDescription.trim() || null
        })
        .eq('id', group.id);

      if (error) {
        console.error('Error updating panel group:', error);
        alert('Failed to update panel group');
        return;
      }

      onGroupUpdated();
      onOpenChange(false);
      showToast('Panel group updated successfully', 'success');
    } catch (err) {
      console.error('Unexpected error:', err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Panel Group</DialogTitle>
          <DialogDescription>
            Update the details for the panel group "{group.name}"
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Title *</Label>
            <Input
              id="name"
              placeholder="Enter a Title"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter group Description (optional)"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setGroupName(group.name);
              setGroupDescription(group.description || "");
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleUpdateGroup} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteGroupDialog({ isOpen, onOpenChange, group, onGroupDeleted }: DeleteGroupDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToastContext();

  const handleDeleteGroup = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('panel_groups')
        .delete()
        .eq('id', group.id);

      if (error) {
        console.error('Error deleting panel group:', error);
        alert('Failed to delete panel group');
        return;
      }

      onGroupDeleted();
      onOpenChange(false);
      showToast('Panel group deleted successfully', 'success');
    } catch (err) {
      console.error('Unexpected error:', err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Panel Group</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the panel group "{group.name}"?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
            <p className="text-sm text-destructive">
              This action will:
            </p>
            <ul className="text-sm text-destructive mt-2 list-disc list-inside">
              <li>Remove all panels from this group</li>
              <li>Delete the panel group permanently</li>
              <li>This action cannot be undone</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDeleteGroup} 
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateGroupDialog({ isOpen, onOpenChange, onGroupCreated }: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { showToast } = useToastContext();

  // Fetch projects when dialog opens
  useEffect(() => {
    if (isOpen) {
      const fetchProjects = async () => {
        try {
          const { data, error } = await supabase
            .from('projects')
            .select('id, name')
            .order('name');
          
          if (error) {
            console.error('Error fetching projects:', error);
            return;
          }
          
          setProjects(data || []);
        } catch (err) {
          console.error('Unexpected error:', err);
        }
      };
      
      fetchProjects();
    }
  }, [isOpen]);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert("Title is required");
      return;
    }

    if (!selectedProjectId) {
      alert("Please select a project");
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('panel_groups')
        .insert([{
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          project_id: selectedProjectId
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating panel group:', error);
        alert('Failed to create panel group');
        return;
      }

      if (data) {
        setGroupName("");
        setGroupDescription("");
        onOpenChange(false);
        onGroupCreated();
        showToast('Panel group created successfully', 'success');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Panel Group</DialogTitle>
          <DialogDescription>
            Create a new panel group to organize your panels
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project">Project *</Label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Title *</Label>
            <Input
              id="name"
              placeholder="Enter a Title"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter group Description (optional)"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setGroupName("");
              setGroupDescription("");
              setSelectedProjectId("");
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleCreateGroup} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddPanelsToGroupDialog({ isOpen, onOpenChange, groupId, groupName, projectId, onPanelsAdded }: AddPanelsToGroupDialogProps) {
  const [availablePanels, setAvailablePanels] = useState<PanelModel[]>([]);
  const [selectedPanels, setSelectedPanels] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { showToast } = useToastContext();

  useEffect(() => {
    if (isOpen) {
      const fetchAvailablePanels = async () => {
        setIsLoading(true);
        try {
          // Get panels that belong to the same project as the group
          const { data: allPanels, error: panelsError } = await supabase
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
              weight
            `)
            .eq('project_id', projectId);

          if (panelsError) {
            console.error('Error fetching panels:', panelsError);
            return;
          }

          // Filter panels that belong to the same project as the group
          const availablePanelsData = allPanels;

          const formattedPanels = availablePanelsData.map(panel => ({
            id: panel.id,
            name: panel.name,
            status: mapPanelStatus(panel.status),
            panelTag: panel.issue_transmittal_no || `TAG-${panel.id.slice(0, 8)}`,
            dwgNo: panel.drawing_number || 'N/A',
            unitQty: panel.ifp_qty_nos || 0,
            unitRateQrM2: panel.unit_rate_qr_m2 || 0,
            ifpQtyAreaSm: panel.ifp_qty_area_sm || 0,
            weight: panel.weight || 0,
            groupId: '',
          }));

          setAvailablePanels(formattedPanels);
        } catch (err) {
          console.error('Unexpected error:', err);
        } finally {
          setIsLoading(false);
        }
      };

      fetchAvailablePanels();
    }
  }, [isOpen]);

  const handleAddPanels = async () => {
    if (selectedPanels.size === 0) {
      alert("Please select at least one panel");
      return;
    }

    setIsAdding(true);
    try {
      const panelMemberships = Array.from(selectedPanels).map(panelId => ({
        panel_group_id: groupId,
        panel_id: panelId
      }));

      const { error } = await supabase
        .from('panel_group_memberships')
        .insert(panelMemberships);

      if (error) {
        console.error('Error adding panels to group:', error);
        alert('Failed to add panels to group');
        return;
      }

      setSelectedPanels(new Set());
      onOpenChange(false);
      onPanelsAdded();
      showToast('Panels added to group successfully', 'success');
    } catch (err) {
      console.error('Unexpected error:', err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const togglePanelSelection = (panelId: string) => {
    const newSelected = new Set(selectedPanels);
    if (newSelected.has(panelId)) {
      newSelected.delete(panelId);
    } else {
      newSelected.add(panelId);
    }
    setSelectedPanels(newSelected);
  };

  const selectAllPanels = () => {
    setSelectedPanels(new Set(availablePanels.map(panel => panel.id)));
  };

  const clearSelection = () => {
    setSelectedPanels(new Set());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Add Panels to "{groupName}"</DialogTitle>
          <DialogDescription>
            Select panels from the same project to add to this group. Individual panel statuses will be preserved.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="text-sm text-muted-foreground">
              {selectedPanels.size} of {availablePanels.length} panels selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllPanels}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-muted-foreground">Loading available panels...</div>
              </div>
            ) : availablePanels.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-muted-foreground">No available panels to add</div>
              </div>
            ) : (
              <div className="divide-y">
                {availablePanels.map((panel) => (
                  <div key={panel.id} className="flex items-center p-4 hover:bg-muted/50">
                    <Checkbox
                      checked={selectedPanels.has(panel.id)}
                      onCheckedChange={() => togglePanelSelection(panel.id)}
                      className="mr-3 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{panel.name}</span>
                        <Badge variant="secondary" className="flex-shrink-0">{panel.status}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="truncate">Tag: {panel.panelTag}</span>
                        <span className="truncate">Drawing: {panel.dwgNo}</span>
                        <span className="truncate">Qty: {panel.unitQty}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedPanels(new Set());
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleAddPanels} disabled={isAdding || selectedPanels.size === 0}>
            {isAdding ? "Adding..." : `Add ${selectedPanels.size} Panel${selectedPanels.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateGroupStatusDialog({ isOpen, onOpenChange, groupId, groupName, currentStatus, onStatusUpdate }: UpdateGroupStatusDialogProps) {
  const [status, setStatus] = useState(currentStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const { showToast } = useToastContext();

  const handleUpdateStatus = async () => {
    setIsUpdating(true);
    try {
      // Since panel_groups table doesn't have a status column, we'll just close the dialog
      // In a real implementation, you might want to add a status column to the table
      onStatusUpdate();
      onOpenChange(false);
      showToast('Panel group status updated successfully', 'success');
    } catch (err) {
      console.error('Unexpected error:', err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Panel Group Status</DialogTitle>
          <DialogDescription>
            Update the status for the panel group "{groupName}"
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdateStatus} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdatePanelGroupDialog({ isOpen, onOpenChange, group, onGroupUpdated }: UpdatePanelGroupDialogProps) {
  const [groupName, setGroupName] = useState(group.name);
  const [groupDescription, setGroupDescription] = useState(group.description || "");
  const [currentPanels, setCurrentPanels] = useState<PanelModel[]>([]);
  const [availablePanels, setAvailablePanels] = useState<PanelModel[]>([]);
  const [selectedPanelsToAdd, setSelectedPanelsToAdd] = useState<Set<string>>(new Set());
  const [selectedPanelsToRemove, setSelectedPanelsToRemove] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'panels'>('details');
  const [panelSearchTerm, setPanelSearchTerm] = useState("");
  const { showToast } = useToastContext();

  useEffect(() => {
    if (isOpen) {
      loadPanelData();
    }
  }, [isOpen, group.id]);

  // Update form fields when group prop changes
  useEffect(() => {
    setGroupName(group.name);
    setGroupDescription(group.description || "");
  }, [group]);

  const loadPanelData = async () => {
    setIsLoading(true);
    // Reset panel selections when loading new data
    setSelectedPanelsToAdd(new Set());
    setSelectedPanelsToRemove(new Set());
    try {
      // Fetch current panels in the group using the junction table
      const { data: membershipData, error: membershipError } = await supabase
        .from('panel_group_memberships')
        .select('panel_id')
        .eq('panel_group_id', group.id);

      if (membershipError) {
        console.error('Error fetching panel group memberships:', membershipError);
        return;
      }

      const currentPanelIds = membershipData?.map(m => m.panel_id) || [];

      let currentPanelsData: any[] = [];
      if (currentPanelIds.length > 0) {
        const { data: currentData, error: currentError } = await supabase
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
            weight
          `)
          .in('id', currentPanelIds);

        if (currentError) {
          console.error('Error fetching current panels:', currentError);
          return;
        }
        currentPanelsData = currentData || [];
      }

      const formattedCurrentPanels = currentPanelsData.map(panel => ({
        id: panel.id,
        name: panel.name,
        status: mapPanelStatus(panel.status),
        panelTag: panel.issue_transmittal_no || `TAG-${panel.id.slice(0, 8)}`,
        dwgNo: panel.drawing_number || 'N/A',
        unitQty: panel.ifp_qty_nos || 0,
        unitRateQrM2: panel.unit_rate_qr_m2 || 0,
        ifpQtyAreaSm: panel.ifp_qty_area_sm || 0,
        weight: panel.weight || 0,
        groupId: group.id,
      }));

      setCurrentPanels(formattedCurrentPanels);

      // Fetch panels that belong to the same project as the group
      const { data: allPanelsData, error: allPanelsError } = await supabase
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
          weight
        `)
        .eq('project_id', group.project_id);

      if (allPanelsError) {
        console.error('Error fetching all panels:', allPanelsError);
        return;
      }

      // Filter out panels that are already in the current group
      const currentPanelIdsSet = new Set(currentPanelIds);
      const availablePanelsData = allPanelsData?.filter(panel => !currentPanelIdsSet.has(panel.id)) || [];

      const formattedAvailablePanels = availablePanelsData.map(panel => ({
        id: panel.id,
        name: panel.name,
        status: mapPanelStatus(panel.status),
        panelTag: panel.issue_transmittal_no || `TAG-${panel.id.slice(0, 8)}`,
        dwgNo: panel.drawing_number || 'N/A',
        unitQty: panel.ifp_qty_nos || 0,
        unitRateQrM2: panel.unit_rate_qr_m2 || 0,
        ifpQtyAreaSm: panel.ifp_qty_area_sm || 0,
        weight: panel.weight || 0,
        groupId: '',
      }));

      setAvailablePanels(formattedAvailablePanels);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!groupName.trim()) {
      alert("Title is required");
      return;
    }

    setIsUpdating(true);
    try {
      // Update group details directly
      const { error: updateError } = await supabase
        .from('panel_groups')
        .update({
          name: groupName.trim(),
          description: groupDescription.trim() || null
        })
        .eq('id', group.id);

      if (updateError) {
        console.error('Error updating panel group:', updateError);
        alert('Failed to update panel group');
        return;
      }

      // Handle panel removals
      if (selectedPanelsToRemove.size > 0) {
        const { error: removeError } = await supabase
          .from('panel_group_memberships')
          .delete()
          .eq('panel_group_id', group.id)
          .in('panel_id', Array.from(selectedPanelsToRemove));

        if (removeError) {
          console.error('Error removing panels from group:', removeError);
          alert('Failed to remove some panels from group');
        }
      }

      // Handle panel additions
      if (selectedPanelsToAdd.size > 0) {
        const panelMemberships = Array.from(selectedPanelsToAdd).map(panelId => ({
          panel_group_id: group.id,
          panel_id: panelId
        }));

        const { error: addError } = await supabase
          .from('panel_group_memberships')
          .insert(panelMemberships);

        if (addError) {
          console.error('Error adding panels to group:', addError);
          alert('Failed to add some panels to group');
        }
      }

      onGroupUpdated();
      onOpenChange(false);
      showToast('Panel group updated successfully', 'success');
      
      // Reset panel selection state after successful update
      setSelectedPanelsToAdd(new Set());
      setSelectedPanelsToRemove(new Set());
    } catch (err) {
      console.error('Unexpected error:', err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const togglePanelToAdd = (panelId: string) => {
    const newSelected = new Set(selectedPanelsToAdd);
    if (newSelected.has(panelId)) {
      newSelected.delete(panelId);
    } else {
      newSelected.add(panelId);
    }
    setSelectedPanelsToAdd(newSelected);
  };

  const togglePanelToRemove = (panelId: string) => {
    const newSelected = new Set(selectedPanelsToRemove);
    if (newSelected.has(panelId)) {
      newSelected.delete(panelId);
    } else {
      newSelected.add(panelId);
    }
    setSelectedPanelsToRemove(newSelected);
  };

  const selectAllAvailablePanels = () => {
    setSelectedPanelsToAdd(new Set(availablePanels.map(panel => panel.id)));
  };

  const selectAllCurrentPanels = () => {
    setSelectedPanelsToRemove(new Set(currentPanels.map(panel => panel.id)));
  };

  const clearAllSelections = () => {
    setSelectedPanelsToAdd(new Set());
    setSelectedPanelsToRemove(new Set());
  };

  // Combine and sort all panels for the unified list
  const allPanels = useMemo(() => {
    const combined = [
      ...currentPanels.map(panel => ({ ...panel, isInGroup: true })),
      ...availablePanels.map(panel => ({ ...panel, isInGroup: false }))
    ];

    // Filter by search term
    const filtered = panelSearchTerm.trim() === "" 
      ? combined 
      : combined.filter(panel => 
          panel.name.toLowerCase().includes(panelSearchTerm.toLowerCase()) ||
          panel.panelTag.toLowerCase().includes(panelSearchTerm.toLowerCase()) ||
          panel.dwgNo.toLowerCase().includes(panelSearchTerm.toLowerCase())
        );

    // Sort alphabetically by name only (static sort)
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [currentPanels, availablePanels, panelSearchTerm]);

  const togglePanelSelection = (panel: PanelModel & { isInGroup: boolean }) => {
    if (panel.isInGroup) {
      togglePanelToRemove(panel.id);
    } else {
      togglePanelToAdd(panel.id);
    }
  };

  const isPanelSelected = (panel: PanelModel & { isInGroup: boolean }) => {
    if (panel.isInGroup) {
      // If panel is in group, it's selected unless it's marked for removal
      return !selectedPanelsToRemove.has(panel.id);
    } else {
      // If panel is not in group, it's selected if it's marked for addition
      return selectedPanelsToAdd.has(panel.id);
    }
  };

  const selectAllPanels = () => {
    const newSelectedToAdd = new Set(availablePanels.map(panel => panel.id));
    const newSelectedToRemove = new Set(currentPanels.map(panel => panel.id));
    setSelectedPanelsToAdd(newSelectedToAdd);
    setSelectedPanelsToRemove(newSelectedToRemove);
  };

  const clearAllPanelSelections = () => {
    setSelectedPanelsToAdd(new Set());
    setSelectedPanelsToRemove(new Set());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Update Panel Group: {group.name}</DialogTitle>
          <DialogDescription>
            Update the group details and manage panels in this group
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          {/* Tabs */}
          <div className="flex border-b flex-shrink-0">
            <button
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('details')}
            >
              Group Details
            </button>
            <button
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'panels'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('panels')}
            >
              Manage Panels ({currentPanels.length + availablePanels.length})
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {activeTab === 'details' ? (
              /* Group Details Tab */
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Title *</Label>
                  <Input
                    id="name"
                    placeholder="Enter a Title"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter group Description (optional)"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            ) : (
              /* Manage Panels Tab */
              <div className="flex-1 flex flex-col min-h-0 p-6">
                {isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-muted-foreground">Loading panels...</div>
                  </div>
                ) : (
                  <>
                    {/* Search and Controls */}
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                      <div className="flex-1 max-w-md">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search panels by name, tag, or drawing number..."
                            value={panelSearchTerm}
                            onChange={(e) => setPanelSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={selectAllPanels}>
                          Select All
                        </Button>
                        <Button variant="outline" size="sm" onClick={clearAllPanelSelections}>
                          Clear
                        </Button>
                      </div>
                    </div>

                    {/* Panel List */}
                    <div className="flex-1 overflow-y-auto border rounded-lg min-h-0 max-h-96">
                      {allPanels.length === 0 ? (
                        <div className="flex items-center justify-center p-8">
                          <div className="text-muted-foreground text-center">
                            <Package className="h-8 w-8 mx-auto mb-2" />
                            <p>{panelSearchTerm.trim() ? 'No panels match your search' : 'No panels available'}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {allPanels.map((panel) => (
                            <div key={panel.id} className="flex items-center p-3 hover:bg-muted/50">
                              <Checkbox
                                checked={isPanelSelected(panel)}
                                onCheckedChange={() => togglePanelSelection(panel)}
                                className="mr-3 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium truncate">{panel.name}</span>
                                  <Badge variant="secondary" className="flex-shrink-0">{panel.status}</Badge>
                                  {panel.isInGroup && (
                                    <Badge variant="outline" className="flex-shrink-0 text-xs">In Group</Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                  <span className="truncate">Tag: {panel.panelTag}</span>
                                  <span className="truncate">Drawing: {panel.dwgNo}</span>
                                  <span className="truncate">Qty: {panel.unitQty}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Summary */}
                    <div className="mt-4 text-sm text-muted-foreground flex-shrink-0">
                      Showing {allPanels.length} of {currentPanels.length + availablePanels.length} panels
                      {panelSearchTerm.trim() && ` (filtered by "${panelSearchTerm}")`}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {selectedPanelsToAdd.size > 0 && (
              <span>+{selectedPanelsToAdd.size} to add</span>
            )}
            {selectedPanelsToRemove.size > 0 && (
              <span>-{selectedPanelsToRemove.size} to remove</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setGroupName(group.name);
                setGroupDescription(group.description || "");
                clearAllSelections();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateGroup} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update Group"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Fetch panel groups from Supabase
async function fetchPanelGroups(): Promise<PanelGroupModel[]> {
  const { data, error } = await supabase
    .from('panel_groups')
    .select(`
      id,
      name,
      description,
      created_at,
      project_id
    `);

  if (error) {
    console.error('Error fetching panel groups:', error);
    return [];
  }

  // Fetch project names for all unique project IDs
  const projectIds = Array.from(new Set(data.map(group => group.project_id).filter(Boolean)));
  let projectsMap = new Map<string, string>();
  
  if (projectIds.length > 0) {
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', projectIds);

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
    } else {
      projectsMap = new Map(projectsData?.map(p => [p.id, p.name]) || []);
    }
  }

  // Get panel count for each group using the new junction table
  const groupsWithCounts = await Promise.all(
    data.map(async (group) => {
      const { data: panelCountData, error: countError } = await supabase
        .from('panel_group_memberships')
        .select('panel_id', { count: 'exact' })
        .eq('panel_group_id', group.id);

      if (countError) {
        console.error('Error fetching panel count for group:', group.id, countError);
        return {
          id: group.id,
          name: group.name,
          description: group.description || '',
          panelCount: 0,
          createdAt: new Date(group.created_at).toISOString(),
          project: projectsMap.get(group.project_id || '') || 'Unknown Project',
          project_id: group.project_id || '',
        };
      }

      return {
        id: group.id,
        name: group.name,
        description: group.description || '',
        panelCount: panelCountData?.length || 0,
        createdAt: new Date(group.created_at).toISOString(),
        project: projectsMap.get(group.project_id || '') || 'Unknown Project',
        project_id: group.project_id || '',
      };
    })
  );

  return groupsWithCounts;
}

async function fetchPanels(): Promise<PanelModel[]> {
  // Fetch panels using pagination to get all panels
  let allPanels: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('panels')
      .select(`
        id,
        name,
        type,
        status,
        drawing_number,
        ifp_qty_nos,
        issue_transmittal_no,
        unit_rate_qr_m2,
        ifp_qty_area_sm,
        weight
      `)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching panels:', error);
      return [];
    }

    if (data && data.length > 0) {
      allPanels = [...allPanels, ...data];
      console.log(`🔍 PanelGroups: Fetched page ${page + 1}: ${data.length} panels (total so far: ${allPanels.length})`);
      
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  const data = allPanels;
  console.log(`🔍 PanelGroups: Total panels fetched: ${data.length}`);

  // Get all panel group memberships in one query for efficiency
  const { data: allMemberships, error: membershipsError } = await supabase
    .from('panel_group_memberships')
    .select('panel_id, panel_group_id');

  if (membershipsError) {
    console.error('Error fetching panel group memberships:', membershipsError);
    return [];
  }

  // Create a map of panel_id to group_ids for quick lookup
  const panelToGroupsMap = new Map<string, string[]>();
  allMemberships?.forEach(membership => {
    const existing = panelToGroupsMap.get(membership.panel_id) || [];
    existing.push(membership.panel_group_id);
    panelToGroupsMap.set(membership.panel_id, existing);
  });

  // Create panels with group information
  const panelsWithGroups = data.map((panel) => {
    const groupIds = panelToGroupsMap.get(panel.id) || [];

    return {
      id: panel.id,
      name: panel.name,
      status: mapPanelStatus(panel.status),
      panelTag: panel.issue_transmittal_no || `TAG-${panel.id.slice(0, 8)}`,
      dwgNo: panel.drawing_number || 'N/A',
      unitQty: panel.ifp_qty_nos || 0,
      unitRateQrM2: panel.unit_rate_qr_m2 || 0,
      ifpQtyAreaSm: panel.ifp_qty_area_sm || 0,
      weight: panel.weight || 0,
      groupId: '', // No longer used for many-to-many relationship
      // Store all group IDs for future use if needed
      allGroupIds: groupIds,
    };
  });

  return panelsWithGroups;
}

function mapPanelStatus(status: number): PanelStatus {
  const statusMap: { [key: number]: PanelStatus } = {
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

export function PanelGroupsPage({
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  onViewGroup,
}: PanelGroupsSectionProps) {
  const [panelGroups, setPanelGroups] = useState<PanelGroupModel[]>([]);
  const [panels, setPanels] = useState<PanelModel[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [panelCountMinFilter, setPanelCountMinFilter] = useState("");
  const [panelCountMaxFilter, setPanelCountMaxFilter] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isUpdateGroupDialogOpen, setIsUpdateGroupDialogOpen] = useState(false);
  const [isDeleteGroupDialogOpen, setIsDeleteGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<PanelGroupModel | null>(null);
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [isAddPanelsDialogOpen, setIsAddPanelsDialogOpen] = useState(false);
  const [isUpdateStatusDialogOpen, setIsUpdateStatusDialogOpen] = useState(false);
  const [isUpdatePanelGroupDialogOpen, setIsUpdatePanelGroupDialogOpen] = useState(false);

  // RBAC Permission checks
  const { user: currentUser } = useAuth();
  const { showToast } = useToastContext();
  const canCreatePanelGroups = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panelGroups', 'canCreate') : false;
  const canUpdatePanelGroups = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panelGroups', 'canUpdate') : false;
  const canDeletePanelGroups = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panelGroups', 'canDelete') : false;

  useEffect(() => {
    async function loadData() {
      const groups = await fetchPanelGroups();
      const panelsData = await fetchPanels();
      setPanelGroups(groups);
      setPanels(panelsData);
    }
    loadData();

    const groupSubscription = supabase
      .channel('panel_groups')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'panel_groups' }, () => {
        fetchPanelGroups().then(setPanelGroups);
      })
      .subscribe();

    const panelSubscription = supabase
      .channel('panels')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'panels' }, () => {
        fetchPanels().then(setPanels);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(groupSubscription);
      supabase.removeChannel(panelSubscription);
    };
  }, []);

  const getGroupPanels = (group: PanelGroupModel) => {
    // For many-to-many relationship, check if panel belongs to this group
    return panels.filter(panel => {
      // Check if this panel belongs to the current group using allGroupIds
      return panel.allGroupIds?.includes(group.id);
    });
  };

  const calculateGroupTotals = (group: PanelGroupModel) => {
    const groupPanels = getGroupPanels(group);
    
    const totalArea = groupPanels.reduce((sum, panel) => sum + (panel.ifpQtyAreaSm || 0), 0);
    const totalAmount = groupPanels.reduce((sum, panel) => {
      const area = panel.ifpQtyAreaSm || 0;
      const rate = panel.unitRateQrM2 || 0;
      return sum + (area * rate);
    }, 0);
    const totalWeight = groupPanels.reduce((sum, panel) => sum + (panel.weight || 0), 0);
    
    return { totalArea, totalAmount, totalWeight };
  };

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleEdit = (group: PanelGroupModel) => {
    handleOpenUpdatePanelGroup(group);
  };

  const handleOpenUpdateGroup = (group: PanelGroupModel) => {
    setSelectedGroup(group);
    setIsUpdateGroupDialogOpen(true);
  };

  const handleOpenDeleteGroup = (group: PanelGroupModel) => {
    setSelectedGroup(group);
    setIsDeleteGroupDialogOpen(true);
  };

  const handleOpenCreateGroup = () => {
    setIsCreateGroupDialogOpen(true);
  };

  const handleOpenAddPanels = (group: PanelGroupModel) => {
    setSelectedGroup(group);
    setIsAddPanelsDialogOpen(true);
  };

  const handleOpenUpdateStatus = (group: PanelGroupModel) => {
    setSelectedGroup(group);
    setIsUpdateStatusDialogOpen(true);
  };

  const handleOpenUpdatePanelGroup = (group: PanelGroupModel) => {
    setSelectedGroup(group);
    setIsUpdatePanelGroupDialogOpen(true);
  };

  const handleDelete = async (groupId: string) => {
    try {
      onDeleteGroup?.({ id: groupId, name: "Loading...", description: "", panelCount: 0, createdAt: "", project: "" });
      const { error } = await supabase
        .from('panel_groups')
        .delete()
        .eq('id', groupId);
      
      if (error) {
        console.error('Error deleting panel group:', error);
        onDeleteGroup?.({ id: groupId, name: "Error", description: "", panelCount: 0, createdAt: "", project: "" });
        showToast('Failed to delete panel group', 'error');
        return;
      }
      
      onDeleteGroup?.({ id: groupId, name: "Deleted", description: "", panelCount: 0, createdAt: "", project: "" });
      await fetchPanelGroups().then(setPanelGroups);
      await fetchPanels().then(setPanels);
      showToast('Panel group deleted successfully', 'success');
    } catch (err: any) {
      console.error('Error deleting panel group:', err);
      onDeleteGroup?.({ id: groupId, name: "Error", description: "", panelCount: 0, createdAt: "", project: "" });
      showToast('An unexpected error occurred', 'error');
    }
  };



  const filteredGroups = panelGroups.filter((group) => {
    const matchesSearch = searchTerm === "" ||
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.description.toLowerCase().includes(searchTerm.toLowerCase());



    const matchesPanelCount = (() => {
      if (!panelCountMinFilter && !panelCountMaxFilter) return true;
      const min = panelCountMinFilter ? parseInt(panelCountMinFilter) : 0;
      const max = panelCountMaxFilter ? parseInt(panelCountMaxFilter) : Infinity;
      return group.panelCount >= min && group.panelCount <= max;
    })();

    const matchesDateRange = (() => {
      if (dateRangeFilter === "all") return true;
      const groupDate = new Date(group.createdAt);
      const now = new Date();

      switch (dateRangeFilter) {
        case "this-month": {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          return groupDate >= monthStart;
        }
        case "this-quarter": {
          const quarterStart = new Date(
            now.getFullYear(),
            Math.floor(now.getMonth() / 3) * 3,
            1
          );
          return groupDate >= quarterStart;
        }
        case "this-year": {
          const yearStart = new Date(now.getFullYear(), 0, 1);
          return groupDate >= yearStart;
        }
        default:
          return true;
      }
    })();

    return matchesSearch && matchesPanelCount && matchesDateRange;
  });

  const activePanelGroupFiltersCount = [
    searchTerm !== "",
    panelCountMinFilter !== "",
    panelCountMaxFilter !== "",
    dateRangeFilter !== "all",
  ].filter(Boolean).length;

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const clearPanelGroupFilters = () => {
    setSearchTerm("");
    setPanelCountMinFilter("");
    setPanelCountMaxFilter("");
    setDateRangeFilter("all");
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredGroups.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGroups = filteredGroups.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Panel Groups</h2>
          <Badge variant="secondary" className="ml-2">
            {filteredGroups.length}
          </Badge>
        </div>
        <div className="flex gap-2">
          {canCreatePanelGroups && (
            <Button onClick={handleOpenCreateGroup} className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Add Panel Group
            </Button>
          )}
        </div>
        
      </div>

      {/* Filters & Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters & Search</CardTitle>
            {activePanelGroupFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 text-xs">
                {activePanelGroupFiltersCount}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search groups..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      handleFilterChange();
                    }}
                    className="pl-8"
                  />
                </div>
              </div>



              <div className="space-y-2">
                <Label>Min Panels</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={panelCountMinFilter}
                  onChange={(e) => {
                    setPanelCountMinFilter(e.target.value);
                    handleFilterChange();
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Panels</Label>
                <Input
                  type="number"
                  placeholder="∞"
                  value={panelCountMaxFilter}
                  onChange={(e) => {
                    setPanelCountMaxFilter(e.target.value);
                    handleFilterChange();
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
                <Select
                  value={dateRangeFilter}
                  onValueChange={(value) => {
                    setDateRangeFilter(value);
                    handleFilterChange();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any time</SelectItem>
                    <SelectItem value="this-month">This month</SelectItem>
                    <SelectItem value="this-quarter">This quarter</SelectItem>
                    <SelectItem value="this-year">This year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredGroups.length)} of {filteredGroups.length} panel groups
              </div>
              <Button variant="outline" size="sm" onClick={clearPanelGroupFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panel Groups List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Panel Groups</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paginatedGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">
                  {searchTerm || panelCountMinFilter || panelCountMaxFilter || dateRangeFilter !== 'all'
                    ? 'No panel groups match your search criteria'
                    : 'No panel groups found'}
                </h3>
                <p className="text-muted-foreground text-center">
                  {searchTerm || panelCountMinFilter || panelCountMaxFilter || dateRangeFilter !== 'all'
                    ? 'Try adjusting your filters to see more results.'
                    : 'Get started by creating your first panel group.'}
                </p>
 
              </div>
            ) : (
              paginatedGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.id);
                const groupPanels = getGroupPanels(group);

                return (
                  <Card key={group.id} className="overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleGroupExpansion(group.id)}
                            className="p-1"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {group.name}
                              {group.project && (
                                <Badge className="bg-red-600 text-white text-xs px-2 py-1 rounded-md">
                                  {group.project}
                                </Badge>
                              )}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {group.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {canUpdatePanelGroups && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(group)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {canDeletePanelGroups && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(group.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Group Summary */}
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Package className="h-4 w-4" />
                          <span>{group.panelCount || 0} panels</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Created {group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'Unknown'}</span>
                        </div>
                      </div>
                      
                      {/* Group Totals */}
                      {(() => {
                        const { totalArea, totalAmount, totalWeight } = calculateGroupTotals(group);
                        return (
                          <div className="flex items-center gap-6 text-sm text-muted-foreground mt-2">
                            <div className="flex items-center gap-1">
                              <span>Total Area: {totalArea.toFixed(2)} m²</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span>Total Amount: {totalAmount.toFixed(2)} QR</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span>Total Weight: {totalWeight.toFixed(2)} kg</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Expanded Content - Panels in Group */}
                    {isExpanded && (
                      <CardContent className="pt-0">
                        <div className="border-t pt-4">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Panels in this Group ({groupPanels.length})
                          </h4>

                          {groupPanels.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">
                              No panels assigned to this group
                            </p>
                          ) : (
                            <div className="grid gap-3">
                              {groupPanels.map((panel) => (
                                <div key={panel.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium">{panel.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      <span>Tag: {panel.panelTag}</span>
                                      <span>Drawing: {panel.dwgNo}</span>
                                      <span>Qty: {panel.unitQty}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={'bg-primary text-primary-foreground'}>
                                      {panel.status}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </div>

          {/* Update Group Status Dialog */}
          {selectedGroup && (
            <UpdateGroupStatusDialog
              isOpen={isUpdateStatusDialogOpen}
              onOpenChange={setIsUpdateStatusDialogOpen}
              groupId={selectedGroup.id}
              groupName={selectedGroup.name}
              currentStatus="active"
              onStatusUpdate={() => fetchPanelGroups().then(setPanelGroups)}
            />
          )}

          {/* Create Group Dialog */}
          {isCreateGroupDialogOpen && (
            <CreateGroupDialog
              isOpen={isCreateGroupDialogOpen}
              onOpenChange={setIsCreateGroupDialogOpen}
              onGroupCreated={() => {
                setIsCreateGroupDialogOpen(false);
                fetchPanelGroups().then(setPanelGroups);
              }}
            />
          )}

          {/* Add Panels to Group Dialog */}
          {selectedGroup && (
            <AddPanelsToGroupDialog
              isOpen={isAddPanelsDialogOpen}
              onOpenChange={setIsAddPanelsDialogOpen}
              groupId={selectedGroup.id}
              groupName={selectedGroup.name}
              projectId={selectedGroup.project_id || ''}
              onPanelsAdded={() => {
                setIsAddPanelsDialogOpen(false);
                fetchPanelGroups().then(setPanelGroups);
                fetchPanels().then(setPanels); // Refresh panels to reflect added ones
              }}
            />
          )}

          {/* Update Panel Group Dialog */}
          {selectedGroup && (
            <UpdatePanelGroupDialog
              isOpen={isUpdatePanelGroupDialogOpen}
              onOpenChange={setIsUpdatePanelGroupDialogOpen}
              group={selectedGroup}
              onGroupUpdated={() => {
                setIsUpdatePanelGroupDialogOpen(false);
                fetchPanelGroups().then(setPanelGroups);
                fetchPanels().then(setPanels); // Refresh panels to reflect added/removed ones
              }}
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}