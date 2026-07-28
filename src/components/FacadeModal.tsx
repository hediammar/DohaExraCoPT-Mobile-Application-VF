import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useToastContext } from "../contexts/ToastContext";

interface Project {
  id: string;
  name: string;
  customer?: string;
}

interface Building {
  id: string;
  name: string;
  project_id: string;
}

interface FacadeData {
  id: string;
  name: string;
  building_id: string;
  status: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface FacadeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingFacade?: FacadeData | null;
  onSubmit: (facadeData: Omit<FacadeData, "id" | "created_at" | "updated_at">) => void;
  trigger?: React.ReactNode;
  currentProject?: {
    id: string;
    name: string;
    customer?: string;
  };
  currentBuilding?: {
    id: string;
    name: string;
  };
  currentProjectId?: string;
  currentProjectName?: string;
  currentBuildingId?: string;
  currentBuildingName?: string;
}

export function FacadeModal({
  isOpen,
  onOpenChange,
  editingFacade,
  onSubmit,
  trigger,
  currentProject,
  currentBuilding,
  currentProjectId,
  currentProjectName,
  currentBuildingId,
  currentBuildingName
}: FacadeModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    building_id: "",
    status: 1, // Default to active
    description: ""
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user: currentUser } = useAuth();
  const { showToast } = useToastContext();

  // Map database integer to UI status display
  const statusDisplay: { [key: number]: string } = {
    0: "Inactive",
    1: "Active",
    2: "On Hold",
    3: "Completed"
  };

  // Map UI select values to database integers
  const statusOptions = [
    { value: 1, label: "Active" },
    { value: 3, label: "Completed" },
    { value: 2, label: "On Hold" },
    { value: 0, label: "Inactive" }
  ];

  // Determine the current project and building context
  const effectiveProject = currentProject || (currentProjectId && currentProjectName ? {
    id: currentProjectId,
    name: currentProjectName
  } : null);

  const effectiveBuilding = currentBuilding || (currentBuildingId && currentBuildingName ? {
    id: currentBuildingId,
    name: currentBuildingName
  } : null);

  const isProjectPredefined = !!effectiveProject;
  const isBuildingPredefined = !!effectiveBuilding;

  // Fetch projects and buildings from Supabase
  useEffect(() => {
    async function fetchData() {
      console.log('🔍 FacadeModal: Starting data fetch...');
      console.log('🔍 FacadeModal: Modal isOpen:', isOpen);
      
      if (!isProjectPredefined) {
        console.log('🔍 FacadeModal: Fetching projects...');
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select(`
            id, 
            name, 
            customers (name)
          `)
          .order('name');
        
        if (projectError) {
          console.error('❌ FacadeModal: Error fetching projects:', projectError);
        } else {
          console.log('✅ FacadeModal: Projects fetched successfully:', projectData?.length || 0);
          // Transform the data to match the expected interface
          const transformedProjects = projectData?.map((project: any) => ({
            id: project.id,
            name: project.name,
            customer: project.customers?.name || ''
          })) || [];
          console.log('✅ FacadeModal: Transformed projects:', transformedProjects);
          setProjects(transformedProjects);
        }
      }

      if (!isBuildingPredefined) {
        console.log('🔍 FacadeModal: Fetching buildings...');
        let query = supabase.from('buildings').select('id, name, project_id');
        
        // If we have a specific project context, filter buildings by that project
        if (effectiveProject) {
          query = query.eq('project_id', effectiveProject.id);
          console.log('🔍 FacadeModal: Filtering buildings by project:', effectiveProject.id);
        }
        
        const { data: buildingData, error: buildingError } = await query;
        
        if (buildingError) {
          console.error('❌ FacadeModal: Error fetching buildings:', buildingError);
        } else {
          console.log('✅ FacadeModal: Buildings fetched successfully:', buildingData?.length || 0);
          console.log('✅ FacadeModal: Buildings data:', buildingData);
          setBuildings(buildingData || []);
        }
      }
      
      console.log('🔍 FacadeModal: Data fetch completed');
    }

    if (isOpen) {
      console.log('🔍 FacadeModal: Modal opened, fetching data...');
      fetchData();
    } else {
      console.log('🔍 FacadeModal: Modal closed, not fetching data');
    }
  }, [isProjectPredefined, isBuildingPredefined, effectiveProject, isOpen]);

  // Reset form when modal opens/closes or editing facade changes
  useEffect(() => {
    if (editingFacade) {
      setFormData({
        name: editingFacade.name,
        building_id: editingFacade.building_id,
        status: editingFacade.status,
        description: editingFacade.description || ""
      });
    } else {
      setFormData({
        name: "",
        building_id: effectiveBuilding?.id || "",
        status: 1,
        description: ""
      });
    }
  }, [editingFacade, isOpen, effectiveBuilding]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Prevent double submission
    
    if (!currentUser?.id) {
      console.error('User not authenticated');
      return;
    }

    if (formData.status === undefined || formData.status === null) {
      console.error('Status cannot be null');
      return;
    }

    if (!formData.name.trim()) {
      console.error('Facade name is required');
      return;
    }

    if (!formData.building_id) {
      console.error('Building selection is required');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit({
        name: formData.name,
        building_id: formData.building_id,
        status: formData.status,
        description: formData.description
      });
      
      // Show success toast
      const action = editingFacade ? 'updated' : 'created';
      showToast(`Facade "${formData.name}" ${action} successfully!`, 'success');
      
      // Reset form and close modal
      setFormData({
        name: "",
        building_id: effectiveBuilding?.id || "",
        status: 1,
        description: ""
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting facade:', error);
      showToast('Failed to save facade', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset form and close modal
    setFormData({
      name: "",
      building_id: effectiveBuilding?.id || "",
      status: 1,
      description: ""
    });
    onOpenChange(false);
  };

  // Filter buildings based on selected project
  const availableBuildings = buildings.filter(building => {
    // If we have a predefined project, only show buildings from that project
    if (effectiveProject) {
      return building.project_id === effectiveProject.id;
    }
    
    // If no project is selected, show all buildings
    if (!formData.building_id) {
      return true;
    }
    
    // If a building is selected, show buildings from the same project
    const selectedBuilding = buildings.find(b => b.id === formData.building_id);
    return selectedBuilding ? building.project_id === selectedBuilding.project_id : true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">
            {editingFacade ? 'Edit Facade' : 'Create New Facade'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 flex flex-col items-start">
              <Label htmlFor="name" className="text-card-foreground">Facade Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter facade name"
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>
            
            
            
            <div className="space-y-2 flex flex-col items-start">
              <Label htmlFor="building" className="text-card-foreground">Building *</Label>
              {isBuildingPredefined ? (
                <Input
                  id="building"
                  value={effectiveBuilding.name}
                  disabled
                  className="bg-input/50 border-border text-muted-foreground cursor-not-allowed"
                />
              ) : (
                <Select 
                  value={formData.building_id} 
                  onValueChange={(value) => setFormData({ ...formData, building_id: value })}
                >
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {availableBuildings.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No buildings available
                      </div>
                    ) : (
                      availableBuildings.map((building) => {
                        console.log('🔍 FacadeModal: Rendering building in dropdown:', building);
                        return (
                          <SelectItem 
                            key={building.id} 
                            value={building.id} 
                            className="text-popover-foreground"
                          >
                            {building.name}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              )}
              {isBuildingPredefined && (
                <p className="text-xs text-muted-foreground">
                  This facade will be added to the current building
                </p>
              )}
              {!isBuildingPredefined && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Available buildings: {availableBuildings.length}</p>
                  <p>Total buildings: {buildings.length}</p>
                  {effectiveProject && (
                    <p>Filtered by project: {effectiveProject.name}</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-2 flex flex-col items-start">
              <Label htmlFor="status" className="text-card-foreground">Status *</Label>
              <Select 
                value={formData.status.toString()} 
                onValueChange={(value) => setFormData({ ...formData, status: parseInt(value) })}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {statusOptions.map((option) => (
                    <SelectItem 
                      key={option.value} 
                      value={option.value.toString()} 
                      className="text-popover-foreground"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2 flex flex-col items-start">
            <Label htmlFor="description" className="text-card-foreground">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter facade description (optional)"
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              rows={3}
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button 
              type="submit" 
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {editingFacade ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                editingFacade ? 'Update Facade' : 'Create Facade'
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel} 
              className="border-border text-foreground hover:bg-accent"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FacadeModalTrigger({ 
  onSubmit, 
  editingFacade,
  currentProject,
  currentBuilding,
  currentProjectId,
  currentProjectName,
  currentBuildingId,
  currentBuildingName,
  disabled,
  onClick,
  ...props 
}: Omit<FacadeModalProps, "isOpen" | "onOpenChange" | "trigger"> & { disabled?: boolean; onClick?: (e: React.MouseEvent) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    // Stop event propagation if provided
    if (onClick) {
      onClick(e);
    }
    // Open the modal
    setIsOpen(true);
  };

  return (
    <FacadeModal
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      editingFacade={editingFacade}
      onSubmit={onSubmit}
      currentProject={currentProject}
      currentBuilding={currentBuilding}
      currentProjectId={currentProjectId}
      currentProjectName={currentProjectName}
      currentBuildingId={currentBuildingId}
      currentBuildingName={currentBuildingName}
      trigger={
        <Button className="gap-2 h-9 text-xs sm:text-sm" disabled={disabled} onClick={handleClick}>
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
          <span className="hidden sm:inline">{editingFacade ? 'Edit Facade' : 'Add Facade'}</span>
          <span className="sm:hidden">{editingFacade ? 'Edit' : 'Add'}</span>
        </Button>
      }
      {...props}
    />
  );
}