import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  MapPin,
  Calendar,
  User,
  DollarSign,
  Package,
  Building2,
  Clock,
  TrendingUp,
  Edit,
  Settings,
  Square,
  Weight,
} from "lucide-react";
import { Project } from "../../pages/ProjectDetailsPage";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";



interface ProjectOverviewProps {
  project: Project;
  customer: any;
  onEdit?: () => void;
  onSettings?: () => void;
}

export function ProjectOverview({ project, customer, onEdit, onSettings }: ProjectOverviewProps) {
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

  const [panelStatusCounts, setPanelStatusCounts] = useState<Record<string, number>>({});
  const [totalPanels, setTotalPanels] = useState<number>(0);

  useEffect(() => {
    const fetchPanelStatuses = async () => {
      const { data, error } = await supabase
        .from("panels")
        .select("status")
        .eq("project_id", project.id);

      if (error) {
        console.error("Error fetching panel statuses:", error);
        setPanelStatusCounts({});
        setTotalPanels(0);
        return;
      }

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        const statusName = statusMap[(row as any).status] || "Unknown";
        counts[statusName] = (counts[statusName] || 0) + 1;
      }
      setPanelStatusCounts(counts);
      setTotalPanels(data?.length || 0);
    };

    fetchPanelStatuses();
  }, [project.id]);

  const pieData = Object.entries(panelStatusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ name: status, value: count }));
  const getStatusBadge = (status: string) => {
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
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: "secondary",
      label: status,
      color: "bg-secondary text-secondary-foreground",
    };

    return (
      <Badge className={`text-xs ${config.color}`}>
        {config.label}
      </Badge>
    );
  };

  const getProgress = () => {
    if (!project || !project.estimated_panels || project.estimated_panels === 0)
      return 0;
    return Math.round(((panelStatusCounts["Installed"] || 0) / project.estimated_panels) * 100);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatQatarRiyal = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "QAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getDaysRemaining = () => {
    if (!project?.end_date) return null;
    const endDate = new Date(project.end_date);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const daysRemaining = getDaysRemaining();
  const progress = getProgress();

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            {getStatusBadge(project.status)}
          </div>
        </div>
      </div>

      {/* Project Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Customer Card */}
        <Card className="qatar-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer</CardTitle>
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold truncate">{customer?.name || 'No Customer'}</div>
            {customer?.email && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {customer.email}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Location Card */}
        <Card className="qatar-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Location</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold truncate">{project.location}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Project Site
            </p>
          </CardContent>
        </Card>

        {/* Budget Card */}
        <Card className="qatar-card">
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold">
              {formatCurrency(project.estimated_cost)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Estimated Cost
            </p>
          </CardContent>
        </Card>

        {/* Estimated Panels Card */}
        <Card className="qatar-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Panels</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold">
              {project.estimated_panels || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total Panels
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Details Grid - 2x2 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Manufacturing Pipeline */}
          <Card className="qatar-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Manufacturing Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-card-foreground">Issued For Production</span>
                  <span className="text-muted-foreground">
                    {(panelStatusCounts['Issued For Production'] || 0) + (panelStatusCounts['Produced'] || 0) + 
                     (panelStatusCounts['Proceed for Delivery'] || 0) + (panelStatusCounts['Delivered'] || 0) + 
                     (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                     (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                     (panelStatusCounts['Approved Final'] || 0) } / {project.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project.estimated_panels > 0 ? 
                        Math.min(100, (((panelStatusCounts['Issued For Production'] || 0) + (panelStatusCounts['Produced'] || 0) + 
                         (panelStatusCounts['Proceed for Delivery'] || 0) + (panelStatusCounts['Delivered'] || 0) + 
                         (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                         (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                         (panelStatusCounts['Approved Final'] || 0) ) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project.estimated_panels > 0 ? 
                    ((((panelStatusCounts['Issued For Production'] || 0) + (panelStatusCounts['Produced'] || 0) + 
                      (panelStatusCounts['Proceed for Delivery'] || 0) + (panelStatusCounts['Delivered'] || 0) + 
                      (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                      (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                      (panelStatusCounts['Approved Final'] || 0) ) / project.estimated_panels) * 100).toFixed(2) : 0}% panels issued for production
                </p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-card-foreground">Produced Progress</span>
                  <span className="text-muted-foreground">
                    {(panelStatusCounts['Produced'] || 0) + (panelStatusCounts['Proceed for Delivery'] || 0) + 
                     (panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                     (panelStatusCounts['Rejected Material'] || 0) + (panelStatusCounts['Installed'] || 0) + 
                     (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)} / {project.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project.estimated_panels > 0 ? 
                        Math.min(100, (((panelStatusCounts['Produced'] || 0) + (panelStatusCounts['Proceed for Delivery'] || 0) + 
                         (panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                         (panelStatusCounts['Rejected Material'] || 0) + (panelStatusCounts['Installed'] || 0) + 
                         (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project.estimated_panels > 0 ? 
                    ((((panelStatusCounts['Produced'] || 0) + (panelStatusCounts['Proceed for Delivery'] || 0) + 
                      (panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                      (panelStatusCounts['Rejected Material'] || 0) + (panelStatusCounts['Installed'] || 0) + 
                      (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100).toFixed(2) : 0}% panels produced
                </p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-card-foreground">Proceed for Delivery Progress</span>
                  <span className="text-muted-foreground">
                    {(panelStatusCounts['Proceed for Delivery'] || 0) + (panelStatusCounts['Delivered'] || 0) + 
                     (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                     (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                     (panelStatusCounts['Approved Final'] || 0) } / {project.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project.estimated_panels > 0 ? 
                        Math.min(100, (((panelStatusCounts['Proceed for Delivery'] || 0) + (panelStatusCounts['Delivered'] || 0) + 
                        (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                        (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                        (panelStatusCounts['Approved Final'] || 0) ) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project.estimated_panels > 0 ? 
                     ((((panelStatusCounts['Proceed for Delivery'] || 0) + (panelStatusCounts['Delivered'] || 0) + 
                     (panelStatusCounts['Approved Material'] || 0) + (panelStatusCounts['Rejected Material'] || 0) + 
                     (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                     (panelStatusCounts['Approved Final'] || 0) ) / project.estimated_panels) * 100).toFixed(2) : 0}% panels proceed for delivery
                </p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-card-foreground">Delivered Progress</span>
                  <span className="text-muted-foreground">
                    {(panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                     (panelStatusCounts['Rejected Material'] || 0) + (panelStatusCounts['Installed'] || 0) + 
                     (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)} / {project.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project.estimated_panels > 0 ? 
                        Math.min(100, (((panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                         (panelStatusCounts['Rejected Material'] || 0) + (panelStatusCounts['Installed'] || 0) + 
                         (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project.estimated_panels > 0 ? 
                    ((((panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                      (panelStatusCounts['Rejected Material'] || 0) + (panelStatusCounts['Installed'] || 0) + 
                      (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100).toFixed(2) : 0}% panels delivered
                </p>
              </div>
              
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-card-foreground">Installation Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {panelStatusCounts['Installed'] || 0} / {project.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project.estimated_panels > 0 ? 
                        Math.min(100, (((panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project.estimated_panels > 0 ? 
                    ((((panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100).toFixed(2) : 0}% panels installed
                </p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-card-foreground">Inspected Progress</span>
                  <span className="text-muted-foreground">
                    {(panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)} / {project.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project.estimated_panels > 0 ? 
                        Math.min(100, ((
                         (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project.estimated_panels > 0 ? 
                      ((((panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100).toFixed(2) : 0}% panels inspected
                </p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-card-foreground">Approved Final Progress</span>
                  <span className="text-muted-foreground">
                    {(panelStatusCounts['Approved Final'] || 0)} / {project.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project.estimated_panels > 0 ? 
                        Math.min(100, ((
                        (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project.estimated_panels > 0 ? 
                      ((((panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100).toFixed(2) : 0}% panels approved final
                </p>
              </div>  
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-card-foreground">On Hold Progress</span>
                  <span className="text-muted-foreground">
                    {panelStatusCounts['On Hold'] || 0} / {project.estimated_panels || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${project.estimated_panels > 0 ? 
                        Math.min(100, ((panelStatusCounts['On Hold'] || 0) / project.estimated_panels) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project.estimated_panels > 0 ? 
                    (((panelStatusCounts['On Hold'] || 0) / project.estimated_panels) * 100).toFixed(2) : 0}% panels on hold
                </p>
              </div>

              

              
            </CardContent>
          </Card>

          {/* Efficiency Metrics */}
          <Card className="qatar-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
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
                  {project.estimated_panels > 0 ? 
                    ((((panelStatusCounts['Produced'] || 0) + (panelStatusCounts['Proceed for Delivery'] || 0) + 
                      (panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                      (panelStatusCounts['Rejected Material'] || 0) + (panelStatusCounts['Installed'] || 0) + 
                      (panelStatusCounts['Inspected'] || 0) + (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels) * 100).toFixed(1) : 0}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-card-foreground">Delivery Efficiency</span>
                </div>
                <Badge variant="secondary">
                  {project.estimated_panels > 0 ? 
                    (((panelStatusCounts['Delivered'] || 0) + (panelStatusCounts['Approved Material'] || 0) + 
                      (panelStatusCounts['Installed'] || 0) + (panelStatusCounts['Inspected'] || 0) + 
                      (panelStatusCounts['Approved Final'] || 0)) / project.estimated_panels * 100).toFixed(1) : 0}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-sm text-card-foreground">Overall Completion</span>
                </div>
                <Badge variant="secondary">
                  {project.estimated_panels > 0 ? 
                    (((panelStatusCounts['Approved Final'] || 0) / project.estimated_panels) * 100).toFixed(1) : 0}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Progress Overview */}
          <Card className="qatar-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Progress Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {totalPanels === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-10">
                  No panels yet for this project
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Installed vs Estimated</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
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
                          <div key={key} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[key] || "#999999" }} />
                              <span className="text-muted-foreground">{label}</span>
                            </div>
                            <span className="font-medium text-foreground">{count}</span>
                          </div>
                        );
                      })}
                      {/* Rest entry for remaining panels */}
                      {(() => {
                        const mainStatuses = ['Issued For Production', 'Produced', 'Delivered', 'Installed'];
                        const mainStatusCount = mainStatuses.reduce((sum, status) => sum + (panelStatusCounts[status] || 0), 0);
                        const restCount = totalPanels - mainStatusCount;
                        return restCount > 0 ? (
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: "#999999" }} />
                              <span className="text-muted-foreground">Rest</span>
                            </div>
                            <span className="font-medium text-foreground">{restCount}</span>
                          </div>
                        ) : null;
                      })()}
                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <span className="text-muted-foreground">Total Panels</span>
                        <span className="font-medium text-foreground">{totalPanels}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Estimated Panels</span>
                        <span className="font-medium text-foreground">{project.estimated_panels}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Totals */}
          <Card className="qatar-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Project Totals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Square className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Area</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {(project.total_area || 0).toFixed(2)} m²
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Amount</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {formatQatarRiyal(project.total_amount || 0)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Weight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Weight</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-card-foreground">
                    {(project.total_weight || 0).toFixed(2)} kg
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
    </div>
  );
}