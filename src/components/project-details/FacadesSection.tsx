import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
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
  Layers,
  Search,
  Edit,
  Trash2,
  Building,
  FolderOpen,
  Square,
  DollarSign,
  Weight,
  Package
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { FacadeModalTrigger } from "../FacadeModal";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission, UserRole } from "../../utils/rolePermissions";

interface FacadeData {
  id: string;
  name: string;
  building_id: string;
  building_name?: string;
  project_name?: string;
  status: number;
  description?: string;
  created_at: string;
  updated_at: string;
  totalArea: number;
  totalAmount: number;
  totalWeight: number;
  totalPanels: number;
}

interface FacadesSectionProps {
  projectId?: string;
  projectName?: string;
  buildingId?: string;
  buildingName?: string;
}

export function FacadesSection({
  projectId,
  projectName,
  buildingId,
  buildingName,
}: FacadesSectionProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [facades, setFacades] = useState<FacadeData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [buildingFilter, setBuildingFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const canCreateFacades = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'facades', 'canCreate') : false;
  const canUpdateFacades = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'facades', 'canUpdate') : false;
  const canDeleteFacades = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'facades', 'canDelete') : false;

  // Map database status (integer) to UI status
  const statusMap: { [key: number]: string } = {
    0: "inactive",
    1: "active",
    2: "on-hold",
    3: "completed"
  };

  const getStatusBadge = (status: number) => {
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
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Fetch facades from Supabase
  useEffect(() => {
    async function fetchFacades() {
      setLoading(true);
      let query = supabase
        .from('facades')
        .select(`
          *,
          buildings!inner (
            id,
            name,
            project_id,
            projects (
              name
            )
          )
        `);
      
      if (buildingId) {
        query = query.eq('building_id', buildingId);
      } else if (projectId) {
        query = query.eq('buildings.project_id', projectId);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching facades:', error);
        return;
      }
      
      // Fetch panels for each facade to calculate totals
      const facadesWithTotals = await Promise.all(
        data?.map(async (facade) => {
          // Fetch panels associated with this facade
          const { data: panelsData, error: panelsError } = await supabase
            .from('panels')
            .select(`
              unit_rate_qr_m2,
              ifp_qty_area_sm,
              weight
            `)
            .eq('facade_id', facade.id);

          if (panelsError) {
            console.error('Error fetching panels for facade:', facade.id, panelsError);
            return {
              ...facade,
              building_name: facade.buildings?.name,
              project_name: facade.buildings?.projects?.name,
              totalArea: 0,
              totalAmount: 0,
              totalWeight: 0,
              totalPanels: 0
            };
          }

          // Calculate totals
          const totalArea = panelsData?.reduce((sum, panel) => sum + (panel.ifp_qty_area_sm || 0), 0) || 0;
          const totalAmount = panelsData?.reduce((sum, panel) => {
            const area = panel.ifp_qty_area_sm || 0;
            const rate = panel.unit_rate_qr_m2 || 0;
            return sum + (area * rate);
          }, 0) || 0;
          const totalWeight = panelsData?.reduce((sum, panel) => sum + (panel.weight || 0), 0) || 0;
          const totalPanels = panelsData?.length || 0;

          return {
            ...facade,
            building_name: facade.buildings?.name,
            project_name: facade.buildings?.projects?.name,
            totalArea,
            totalAmount,
            totalWeight,
            totalPanels
          };
        }) || []
      );
      
      setFacades(facadesWithTotals);
      setLoading(false);
    }

    fetchFacades();
  }, [projectId, buildingId]);

  const handleEdit = async (facade: FacadeData) => {
    // The FacadeModalTrigger will handle opening the modal
  };

  const handleDelete = async (facade: FacadeData) => {
    if (window.confirm('Are you sure you want to delete this facade?')) {
      const { error } = await supabase
        .from('facades')
        .delete()
        .eq('id', facade.id);

      if (error) {
        console.error('Error deleting facade:', error);
        return;
      }

      setFacades(facades.filter(f => f.id !== facade.id));
    }
  };

  const handleCardClick = (facade: FacadeData) => {
    navigate(`/facades/${facade.id}`);
  };

  const handleAddFacade = async (facadeData: Omit<FacadeData, "id" | "created_at" | "updated_at" | "totalArea" | "totalAmount" | "totalWeight" | "totalPanels">) => {
    if (isCreating) {
      return; // Prevent double-clicking
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('facades')
        .insert({
          name: facadeData.name,
          building_id: facadeData.building_id,
          status: facadeData.status,
          description: facadeData.description
        })
        .select(`
          *,
          buildings (
            name,
            projects (
              name
            )
          )
        `)
        .single();

      if (error) {
        console.error('Error adding facade:', error);
        return;
      }

      const formattedData = {
        ...data,
        building_name: data.buildings?.name,
        project_name: data.buildings?.projects?.name,
        totalArea: 0,
        totalAmount: 0,
        totalWeight: 0,
        totalPanels: 0
      } as FacadeData;

      setFacades([...facades, formattedData]);
    } finally {
      setIsCreating(false);
    }
  };

  const uniqueBuildings = Array.from(new Set(facades.map(facade => facade.building_name || ''))).filter(Boolean);

  const filteredFacades = facades.filter((facade) => {
    const matchesSearch = searchTerm === "" || 
      facade.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (facade.building_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesStatus = statusFilter === "all" || statusMap[facade.status] === statusFilter;
    const matchesBuilding = buildingFilter === "all" || facade.building_name === buildingFilter;
    
    return matchesSearch && matchesStatus && matchesBuilding;
  });

  const activeFacadeFiltersCount = [
    searchTerm !== "",
    statusFilter !== "all",
    buildingFilter !== "all",
  ].filter(Boolean).length;

  const clearFacadeFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setBuildingFilter("all");
  };

  const currentProject = projectId && projectName ? {
    id: projectId,
    name: projectName,
  } : undefined;

  const currentBuilding = buildingId && buildingName ? {
    id: buildingId,
    name: buildingName,
  } : undefined;

  if (loading) {
    return <div>Loading facades...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Facades</h2>
          <Badge variant="secondary" className="ml-2">
            {filteredFacades.length}
          </Badge>
          {projectName && (
            <span className="text-sm text-muted-foreground">
              in {projectName}
            </span>
          )}
          {buildingName && (
            <span className="text-sm text-muted-foreground">
              • {buildingName}
            </span>
          )}
        </div>
        <FacadeModalTrigger
          onSubmit={handleAddFacade}
          currentProject={currentProject}
          currentBuilding={currentBuilding}
          disabled={!canCreateFacades || isCreating}
        />
      </div>

      {/* Filters & Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters & Search</CardTitle>
            {activeFacadeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 text-xs">
                {activeFacadeFiltersCount}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search facades..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Building</Label>
                <Select
                  value={buildingFilter}
                  onValueChange={setBuildingFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All buildings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All buildings</SelectItem>
                    {uniqueBuildings.map((building) => (
                      <SelectItem key={building} value={building}>
                        {building}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {filteredFacades.length} of {facades.length} facades
            </div>
            <Button variant="outline" size="sm" onClick={clearFacadeFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Facades Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFacades.map((facade) => (
          <Card
            key={facade.id}
            className="qatar-card flex flex-col justify-between cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => handleCardClick(facade)}
          >
            <CardHeader className="qatar-card-header">
              <div>
                <CardTitle className="qatar-card-title">
                  {facade.name}
                </CardTitle>
                <p className="qatar-card-subtitle">
                  FCD-{facade.id.slice(-4).toUpperCase()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(facade.status)}
              </div>
            </CardHeader>

            <CardContent className="qatar-card-content">
              <div className="space-y-3">
                {!projectName && facade.project_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-card-foreground truncate">
                      {facade.project_name}
                    </span>
                  </div>
                )}

                {!buildingName && facade.building_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-card-foreground truncate">
                      {facade.building_name}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-card-foreground font-medium">
                    {facade.description ? 'Has description' : 'No description'}
                  </span>
                </div>

                {/* Facade Totals */}
                <div className="space-y-2 mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold text-card-foreground">Total Area:</span>
                    <span className="text-muted-foreground">{facade.totalArea.toFixed(2)} m²</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold text-card-foreground">Total Panels:</span>
                    <span className="text-muted-foreground">{facade.totalPanels}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold text-card-foreground">Total Amount:</span>
                    <span className="text-muted-foreground">{facade.totalAmount.toFixed(2)} QR</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Weight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold text-card-foreground">Total Weight:</span>
                    <span className="text-muted-foreground">{facade.totalWeight.toFixed(2)} kg</span>
                  </div>
                  
                </div>
              </div>

              <div className="qatar-card-footer">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Created: {formatDate(facade.created_at)}
                  </div>
                  <div className="flex gap-2">
                    {canUpdateFacades && (
                      <div onClick={(e) => e.stopPropagation()}>
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
                              return;
                            }

                            setFacades(facades.map(f => 
                              f.id === facade.id ? { ...f, ...data, updated_at: new Date().toISOString() } : f
                            ));
                          }}
                          editingFacade={facade}
                          currentProject={currentProject}
                          currentBuilding={currentBuilding}
                        />
                      </div>
                    )}
                    {canDeleteFacades && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(facade);
                        }}
                        className="border-red-400/50 text-red-400 hover:bg-red-400/10 h-9 w-9 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredFacades.length === 0 && (
        <div className="text-center py-12">
          <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No facades found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || statusFilter !== "all" || buildingFilter !== "all"
              ? "Try adjusting your filters"
              : "Get started by adding your first facade"}
          </p>
          {(!searchTerm && statusFilter === "all" && buildingFilter === "all") && (
            <FacadeModalTrigger 
              onSubmit={handleAddFacade}
              currentProject={currentProject}
              currentBuilding={currentBuilding}
              disabled={!canCreateFacades || isCreating}
            />
          )}
        </div>
      )}
    </div>
  );
}