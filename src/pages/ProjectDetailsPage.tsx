import {
  ArrowLeft,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BuildingsSection } from "../components/project-details/BuildingsSection";
import { PanelGroupsSection } from "../components/project-details/PanelGroupsSection";
import { PanelsSection } from "../components/project-details/PanelsSection";
import { ProjectOverview } from "../components/project-details/ProjectOverview";
import { NotesSection } from "../components/project-details/NotesSection";
import { Button } from "../components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { supabase } from "../lib/supabase";
import { FacadesSection } from "../components/project-details/FacadesSection";

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  customer_id: string;
  location: string;
  start_date: string;
  end_date?: string;
  status: "active" | "completed" | "on-hold";
  estimated_cost: number;
  estimated_panels: number;
  total_area?: number;
  total_amount?: number;
  total_weight?: number;
}

export function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("buildings");
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (id) {
      loadProjectDetails(id);
    }
  }, [id]);

  const loadProjectDetails = async (projectId: string, showRetrying = false) => {
    try {
      if (showRetrying) {
        setIsRetrying(true);
      } else {
        setLoading(true);
      }
      setError(null);

      console.log(`Loading project details for ID: ${projectId}`);

      // Fetch project with customer data
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          customers (id, name, email, phone, created_at, updated_at)
        `)
        .eq('id', projectId)
        .single();

      if (projectError) {
        throw projectError;
      }

      if (projectData) {
        // Fetch panels for this project to calculate totals
        const { data: panelsData, error: panelsError } = await supabase
          .from('panels')
          .select('unit_rate_qr_m2, ifp_qty_area_sm, weight')
          .eq('project_id', projectId);

        if (panelsError) {
          console.error('Error fetching panel data for project:', projectId, panelsError);
        }

        // Calculate totals from panels data
        const total_area = panelsData?.reduce((sum, panel) => sum + (panel.ifp_qty_area_sm || 0), 0) || 0;
        const total_amount = panelsData?.reduce((sum, panel) => {
          const area = panel.ifp_qty_area_sm || 0;
          const rate = panel.unit_rate_qr_m2 || 0;
          return sum + (area * rate);
        }, 0) || 0;
        const total_weight = panelsData?.reduce((sum, panel) => sum + (panel.weight || 0), 0) || 0;

        const formattedProject: Project = {
          id: projectData.id,
          name: projectData.name,
          customer_id: projectData.customer_id,
          location: projectData.location,
          start_date: projectData.start_date,
          end_date: projectData.end_date,
          status: projectData.status,
          estimated_cost: projectData.estimated_cost,
          estimated_panels: projectData.estimated_panels,
          total_area,
          total_amount,
          total_weight
        };

        setProject(formattedProject);
        setCustomer(projectData.customers);
        console.log("Project details loaded successfully:", projectData.name);
      } else {
        setError("Project not found");
      }
    } catch (err) {
      console.error("Error loading project details:", err);
      setError(
        "Failed to load project details. Please check your connection and try again."
      );

      // Attempt fallback
      try {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('projects')
          .select(`
            *,
            customers (id, name, email, phone, created_at, updated_at)
          `)
          .eq('id', projectId)
          .single();

        if (fallbackError) {
          throw fallbackError;
        }

        if (fallbackData) {
          // Fetch panels for this project to calculate totals
          const { data: panelsData, error: panelsError } = await supabase
            .from('panels')
            .select('unit_rate_qr_m2, ifp_qty_area_sm, weight')
            .eq('project_id', projectId);

          if (panelsError) {
            console.error('Error fetching panel data for project:', projectId, panelsError);
          }

          // Calculate totals from panels data
          const total_area = panelsData?.reduce((sum, panel) => sum + (panel.ifp_qty_area_sm || 0), 0) || 0;
          const total_amount = panelsData?.reduce((sum, panel) => {
            const area = panel.ifp_qty_area_sm || 0;
            const rate = panel.unit_rate_qr_m2 || 0;
            return sum + (area * rate);
          }, 0) || 0;
          const total_weight = panelsData?.reduce((sum, panel) => sum + (panel.weight || 0), 0) || 0;

          const formattedProject: Project = {
            id: fallbackData.id,
            name: fallbackData.name,
            customer_id: fallbackData.customer_id,
            location: fallbackData.location,
            start_date: fallbackData.start_date,
            end_date: fallbackData.end_date,
            status: fallbackData.status,
            estimated_cost: fallbackData.estimated_cost,
            estimated_panels: fallbackData.estimated_panels,
            total_area,
            total_amount,
            total_weight
          };

          setProject(formattedProject);
          setCustomer(fallbackData.customers);
          setError(null);
          console.log("Fallback project data loaded successfully");
        }
      } catch (fallbackErr) {
        console.error("Failed to load fallback project data:", fallbackErr);
      }
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  const handleRetry = () => {
    if (id) {
      loadProjectDetails(id, true);
    }
  };

  // Event handlers for modular components
  const handleEdit = (item: any) => {
    console.log("Edit item:", item);
  };

  const handleDelete = (item: any) => {
    console.log("Delete item:", item);
  };

  const handleAddBuilding = (buildingData: Omit<any, "id" | "createdAt" | "totalPanels">) => {
    const newBuilding: any = {
      ...buildingData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      totalPanels: 0,
    };
  };

  const handleAddFacade = (facadeData: Omit<any, "id" | "createdAt" | "totalPanels">) => {
    const newFacade: any = {
      ...facadeData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      totalPanels: 0,
    };
    console.log("Add facade:", newFacade);
  };

  const handlePanelsChange = (updatedPanels: any[]) => {
    console.log("Panels changed:", updatedPanels);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <div>
            <h3 className="font-medium">Loading project details...</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we fetch the project information
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4 max-w-md">
          <div className="flex items-center justify-center">
            <WifiOff className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="font-medium text-destructive">Connection Error</h3>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={handleRetry} disabled={isRetrying}>
              {isRetrying ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              {isRetrying ? "Retrying..." : "Retry"}
            </Button>
            <Button variant="outline" onClick={() => navigate("/projects")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-medium">Project not found</h3>
          <p className="text-muted-foreground">
            The requested project could not be found.
          </p>
          <Button onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/projects")}
          className="hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>

      {/* Project Overview */}
      <ProjectOverview
        project={project}
        customer={customer}
        onEdit={() => console.log("Edit project")}
        onSettings={() => console.log("Project settings")}
      />

      {/* Tabbed Sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 h-auto">
          <TabsTrigger value="buildings" className="text-xs sm:text-sm px-2 py-2 sm:px-3 sm:py-2">
            Buildings
          </TabsTrigger>
          <TabsTrigger value="facades" className="text-xs sm:text-sm px-2 py-2 sm:px-3 sm:py-2">
            Facades
          </TabsTrigger>
          <TabsTrigger value="panel-groups" className="text-xs sm:text-sm px-2 py-2 sm:px-3 sm:py-2">
            Panel Groups
          </TabsTrigger>
          <TabsTrigger value="panels" className="text-xs sm:text-sm px-2 py-2 sm:px-3 sm:py-2">
            Panels
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs sm:text-sm px-2 py-2 sm:px-3 sm:py-2">
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buildings" className="space-y-6">
          <BuildingsSection
            projectId={project.id}
            projectName={project.name}
          />
        </TabsContent>

        <TabsContent value="facades" className="space-y-6">
          <FacadesSection
            projectId={project.id}
            projectName={project.name}
          />
        </TabsContent>

        <TabsContent value="panel-groups" className="space-y-6">
          <PanelGroupsSection
            projectId={project.id}
            onAddGroup={() => console.log("Add panel group")}
            onEditGroup={(group) => console.log("Edit group:", group)}
            onDeleteGroup={(group) => console.log("Delete group:", group)}
            onViewGroup={(group) => console.log("View group:", group)}
          />
        </TabsContent>

        <TabsContent value="panels" className="space-y-6">
          <PanelsSection
            projectId={project.id}
            projectName={project.name}
          />
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          <NotesSection
            projectId={project.id}
            projectName={project.name}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}