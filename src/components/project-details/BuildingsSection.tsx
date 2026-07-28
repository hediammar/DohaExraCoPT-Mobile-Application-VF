import { createClient } from '@supabase/supabase-js'
import {
  Building2,
  Edit,
  FolderOpen,
  MapPin,
  Search,
  Trash2,
  Square,
  DollarSign,
  Weight,
  Package
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { supabase } from '../../lib/supabase';
import { crudOperations } from '../../utils/userTracking';
import { BuildingModalTrigger } from '../BuildingModal';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, UserRole } from '../../utils/rolePermissions';


interface BuildingModel {
  id: string;
  name: string;
  project_id: string;
  status: number;
  description?: string;
  created_at: string;
  totalArea: number;
  totalAmount: number;
  totalWeight: number;
  totalPanels: number;
}

interface BuildingsSectionProps {
  projectId?: string;
  projectName?: string;
}

export function BuildingsSection({
  projectId,
  projectName,
}: BuildingsSectionProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [buildings, setBuildings] = useState<BuildingModel[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const canCreateBuildings = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'buildings', 'canCreate') : false;
  const canUpdateBuildings = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'buildings', 'canUpdate') : false;
  const canDeleteBuildings = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'buildings', 'canDelete') : false;

  // Map database status (integer) to UI status
  const statusMap: { [key: number]: string } = {
    0: "inactive",
    1: "active",
    2: "on-hold",
    3: "completed"
  };


  const getStatusBadge = (status: number) => {
    // Handle null/undefined status values
    if (status === null || status === undefined) {
      return (
        <Badge className="text-xs bg-secondary text-secondary-foreground">
          Unknown
        </Badge>
      );
    }
    
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

  // Fetch buildings from Supabase
  useEffect(() => {
    async function fetchBuildings() {
      setLoading(true);
      let query = supabase
        .from('buildings')
        .select('*');
      
      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching buildings:', error);
        return;
      }
      
                // Fetch panels for each building to calculate totals
          const buildingsWithTotals = await Promise.all(
            data?.map(async (building) => {
              // Fetch panels associated with this building
              const { data: panelsData, error: panelsError } = await supabase
                .from('panels')
                .select(`
                  unit_rate_qr_m2,
                  ifp_qty_area_sm,
                  weight
                `)
                .eq('building_id', building.id);

              if (panelsError) {
                console.error('Error fetching panels for building:', building.id, panelsError);
                return {
                  ...building,
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
                ...building,
                totalArea,
                totalAmount,
                totalWeight,
                totalPanels
              };
            }) || []
          );
      
      setBuildings(buildingsWithTotals);
      setLoading(false);
    }

    fetchBuildings();
  }, [projectId]);

  const handleDelete = async (building: BuildingModel) => {
    if (!window.confirm('Are you sure you want to delete this building? This will delete its facades and unlink its panels.')) {
      return;
    }
    try {
      await crudOperations.deleteBuilding(building.id);
      setBuildings(buildings.filter(b => b.id !== building.id));
    } catch (error) {
      console.error('Error deleting building:', error);
    }
  };

  const handleCardClick = (building: BuildingModel) => {
    navigate(`/buildings/${building.id}`);
  };

  const handleAddBuilding = async (buildingData: Omit<BuildingModel, "id" | "created_at" | "totalArea" | "totalAmount" | "totalWeight" | "totalPanels">) => {
    if (isCreating) {
      return; // Prevent double-clicking
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('buildings')
        .insert({
          name: buildingData.name,
          project_id: buildingData.project_id,
          status: buildingData.status,
          description: buildingData.description
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding building:', error);
        return;
      }

      const buildingWithTotals = {
        ...data,
        totalArea: 0,
        totalAmount: 0,
        totalWeight: 0
      };

      setBuildings([...buildings, buildingWithTotals]);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredBuildings = buildings.filter((building) => {
    try {
      const matchesSearch = searchTerm === "" || 
        (building.name && building.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || 
        (building.status !== null && building.status !== undefined && statusMap[building.status] === statusFilter);
      
      return matchesSearch && matchesStatus;
    } catch (error) {
      console.error('Error filtering building:', building, error);
      return false;
    }
  });

  const activeBuildingFiltersCount = [
    searchTerm !== "",
    statusFilter !== "all",
  ].filter(Boolean).length;

  const clearBuildingFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const currentProject = projectId && projectName ? {
    id: projectId,
    name: projectName,
  } : undefined;

  if (loading) {
    return <div>Loading buildings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Buildings</h2>
          <Badge variant="secondary" className="ml-2">
            {filteredBuildings.length}
          </Badge>
          {projectName && (
            <span className="text-sm text-muted-foreground">
              in {projectName}
            </span>
          )}
        </div>
        <div>
          <BuildingModalTrigger 
            onSubmit={handleAddBuilding}
            currentProject={currentProject}
            disabled={!canCreateBuildings || isCreating}
          />
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters & Search</CardTitle>
            {activeBuildingFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 text-xs">
                {activeBuildingFiltersCount}
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
                    placeholder="Search buildings..."
                    value={searchTerm}
                    onChange={(e) => {
                      try {
                        setSearchTerm(e.target.value || "");
                      } catch (error) {
                        console.error('Error updating search term:', error);
                        setSearchTerm("");
                      }
                    }}
                    className="pl-8"
                  />
                </div>
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
              Showing {filteredBuildings.length} of {buildings.length} buildings
            </div>
            <Button variant="outline" size="sm" onClick={clearBuildingFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Buildings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBuildings.map((building) => (
          <Card
            key={building.id}
            className="qatar-card flex flex-col justify-between cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => handleCardClick(building)}
          >
            <CardHeader className="qatar-card-header">
              <div>
                <CardTitle className="qatar-card-title">
                  {building.name}
                </CardTitle>
                <p className="qatar-card-subtitle">
                  BLD-{building.id.slice(-4).toUpperCase()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(building.status)}
              </div>
            </CardHeader>

            <CardContent className="qatar-card-content">
              <div className="space-y-3">
                {projectName && (
                  <div className="flex items-center gap-2 text-sm">
                    <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-card-foreground truncate">
                      {projectName}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-card-foreground font-medium">
                    {building.description ? 'Has description' : 'No description'}
                  </span>
                </div>

                {/* Building Totals */}
                <div className="space-y-2 mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold text-card-foreground">Total Area:</span>
                    <span className="text-muted-foreground">{building.totalArea.toFixed(2)} m²</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold text-card-foreground">Total Panels:</span>
                    <span className="text-muted-foreground">{building.totalPanels}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold text-card-foreground">Total Amount:</span>
                    <span className="text-muted-foreground">{building.totalAmount.toFixed(2)} QR</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Weight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold text-card-foreground">Total Weight:</span>
                    <span className="text-muted-foreground">{building.totalWeight.toFixed(2)} kg</span>
                  </div>
                  
                </div>
              </div>

              <div className="qatar-card-footer">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Created: {formatDate(building.created_at)}
                  </div>
                  <div className="flex gap-2">
                    {canUpdateBuildings && (
                      <BuildingModalTrigger
                        onSubmit={async (data: Omit<BuildingModel, "id" | "created_at" | "totalArea" | "totalAmount" | "totalWeight" | "totalPanels">) => {
                          const { error } = await supabase
                            .from('buildings')
                            .update({
                              name: data.name,
                              project_id: data.project_id,
                              status: data.status,
                              description: data.description
                            })
                            .eq('id', building.id);

                          if (error) {
                            console.error('Error updating building:', error);
                            return;
                          }

                          // Keep the existing totals when updating
                          setBuildings(buildings.map(b => 
                            b.id === building.id ? { ...b, ...data } : b
                          ));
                        }}
                        editingBuilding={building}
                        currentProject={currentProject}
                      />
                    )}
                    {canDeleteBuildings && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(building);
                        }}
                        className="border-red-400/50 text-red-400 hover:bg-red-400/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBuildings.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No buildings found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Get started by adding your first building"}
          </p>
          {(!searchTerm && statusFilter === "all") && (
            <BuildingModalTrigger 
              onSubmit={handleAddBuilding}
              currentProject={currentProject}
              disabled={!canCreateBuildings || isCreating}
            />
          )}
        </div>
      )}
    </div>
  );
}