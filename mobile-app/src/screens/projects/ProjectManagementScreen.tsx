import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProjectScreenNavigationProp } from '../../types/navigation';
import { QatarColors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { useLoadingOverlay } from '../../contexts/LoadingOverlayContext';
import { NavigationBar } from '../../components/NavigationBar';
import { isCustomerRole, UserRole } from '../../utils/rolePermissions';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
  customer_id: string | null;
  customer_name: string;
  location: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "completed" | "on-hold";
  estimated_cost: number;
  estimated_panels: number;
  actual_panels: number;
  total_area: number;
  total_amount: number;
  total_weight: number;
}

interface ProjectManagementScreenProps {
  navigation: ProjectScreenNavigationProp;
}

export default function ProjectManagementScreen({ navigation }: ProjectManagementScreenProps) {
  const { user: currentUser } = useAuth();
  const { showToast } = useToastContext();
  const { showLoadingOverlay } = useLoadingOverlay();
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([fetchCustomers(), fetchProjects()]);
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching customers:', error);
        return;
      }
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      // Check if current user is a customer and implement data filtering
      const isCustomer = currentUser?.role ? isCustomerRole(currentUser.role as UserRole) : false;
      
      let query = supabase
        .from('projects')
        .select(`
          *,
          customers (name)
        `);
      
      // If user is a customer, filter projects by their customer_id
      if (isCustomer && currentUser?.customer_id) {
        query = query.eq('customer_id', currentUser.customer_id);
        console.log('Filtering projects for customer:', currentUser.customer_id);
      }
      
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching projects:', error);
        return;
      }

      // Fetch actual panel counts and totals for each project
      const projectsWithPanelCounts = await Promise.all(
        data?.map(async (project) => {
          const panelQuery = supabase
            .from('panels')
            .select('unit_rate_qr_m2, ifp_qty_area_sm, weight')
            .eq('project_id', project.id);

          const { data: panelsData, error: panelError } = await panelQuery;

          if (panelError) {
            console.error('Error fetching panel data for project:', project.id, panelError);
          }

          // Calculate totals from panels data
          const total_area = panelsData?.reduce((sum, panel) => sum + (panel.ifp_qty_area_sm || 0), 0) || 0;
          const total_amount = panelsData?.reduce((sum, panel) => {
            const area = panel.ifp_qty_area_sm || 0;
            const rate = panel.unit_rate_qr_m2 || 0;
            return sum + (area * rate);
          }, 0) || 0;
          const total_weight = panelsData?.reduce((sum, panel) => sum + (panel.weight || 0), 0) || 0;
          const actual_panels = panelsData?.length || 0;

          return {
            id: project.id,
            name: project.name,
            customer_id: project.customer_id,
            customer_name: project.customers?.name || 'No Customer',
            location: project.location,
            start_date: project.start_date,
            end_date: project.end_date,
            status: project.status,
            estimated_cost: project.estimated_cost,
            estimated_panels: project.estimated_panels,
            actual_panels,
            total_area,
            total_amount,
            total_weight
          };
        }) || []
      );

      setProjects(projectsWithPanelCounts);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: QatarColors.chart1, label: "Active" },
      completed: { color: QatarColors.chart2, label: "Completed" },
      "on-hold": { color: QatarColors.chart4, label: "On Hold" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { color: QatarColors.muted, label: status };

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
        <Text style={styles.statusBadgeText}>{config.label}</Text>
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return `QAR ${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0)}`;
  };

  const formatQatarRiyal = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "QAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Get unique values for filters
  const uniqueCustomers = Array.from(new Set(projects.map((p) => p.customer_name).filter(Boolean))).sort();
  const uniqueLocations = Array.from(new Set(projects.map((p) => p.location).filter(Boolean))).sort();

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    // Search filter
    if (
      searchTerm &&
      !(project.name || "").toLowerCase().includes(searchTerm.toLowerCase()) &&
      !(project.customer_name || "").toLowerCase().includes(searchTerm.toLowerCase()) &&
      !(project.location || "").toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }

    // Customer filter
    if (customerFilter && customerFilter !== "all" && project.customer_name !== customerFilter) {
      return false;
    }

    // Status filter
    if (statusFilter && statusFilter !== "all" && project.status !== statusFilter) {
      return false;
    }

    // Location filter
    if (locationFilter && locationFilter !== "all" && project.location !== locationFilter) {
      return false;
    }

    return true;
  });

  const handleProjectPress = (project: Project) => {
    showLoadingOverlay();
    navigation.navigate('ProjectDetails', { projectId: project.id });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCustomerFilter('all');
    setLocationFilter('all');
  };

  const activeFiltersCount = [
    searchTerm,
    statusFilter !== "all" ? statusFilter : "",
    customerFilter !== "all" ? customerFilter : "",
    locationFilter !== "all" ? locationFilter : "",
  ].filter(Boolean).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={QatarColors.primary} />
        <Text style={styles.loadingText}>Loading projects...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationBar title="Project Management" showBackButton={false} />
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.subtitle}>View and manage your projects</Text>
        </View>

      {/* Search and Filters */}
      <View style={styles.filtersContainer}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={QatarColors.mutedForeground} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search projects..."
            placeholderTextColor={QatarColors.mutedForeground}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        {/* Filter Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              statusFilter === 'all' && styles.filterChipActive
            ]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[
              styles.filterChipText,
              statusFilter === 'all' && styles.filterChipTextActive
            ]}>
              All Status
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterChip,
              statusFilter === 'active' && styles.filterChipActive
            ]}
            onPress={() => setStatusFilter('active')}
          >
            <Text style={[
              styles.filterChipText,
              statusFilter === 'active' && styles.filterChipTextActive
            ]}>
              Active
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterChip,
              statusFilter === 'completed' && styles.filterChipActive
            ]}
            onPress={() => setStatusFilter('completed')}
          >
            <Text style={[
              styles.filterChipText,
              statusFilter === 'completed' && styles.filterChipTextActive
            ]}>
              Completed
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterChip,
              statusFilter === 'on-hold' && styles.filterChipActive
            ]}
            onPress={() => setStatusFilter('on-hold')}
          >
            <Text style={[
              styles.filterChipText,
              statusFilter === 'on-hold' && styles.filterChipTextActive
            ]}>
              On Hold
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Active Filters Count */}
        {activeFiltersCount > 0 && (
          <View style={styles.activeFiltersContainer}>
            <Text style={styles.activeFiltersText}>
              {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active
            </Text>
            <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersButton}>
              <Text style={styles.clearFiltersText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Projects List */}
      <ScrollView
        style={styles.projectsList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[QatarColors.primary]}
            tintColor={QatarColors.primary}
          />
        }
      >
        {filteredProjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open" size={48} color={QatarColors.mutedForeground} />
            <Text style={styles.emptyText}>
              {activeFiltersCount > 0 ? "No projects match your filters" : "No projects found"}
            </Text>
            {activeFiltersCount > 0 && (
              <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersButton}>
                <Text style={styles.clearFiltersText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredProjects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={styles.projectCard}
              onPress={() => handleProjectPress(project)}
            >
              <View style={styles.projectCardHeader}>
                <View style={styles.projectTitleContainer}>
                  <Text style={styles.projectTitle}>{project.name}</Text>
                  <Text style={styles.projectId}>PRJ-{project.id.slice(-4).toUpperCase()}</Text>
                </View>
                {getStatusBadge(project.status)}
              </View>

              <View style={styles.projectCardContent}>
                <View style={styles.projectInfoRow}>
                  <Ionicons name="location" size={16} color={QatarColors.mutedForeground} />
                  <Text style={styles.projectInfoText}>{project.location}</Text>
                </View>

                <View style={styles.projectInfoRow}>
                  <Ionicons name="person" size={16} color={QatarColors.mutedForeground} />
                  <Text style={styles.projectInfoText}>{project.customer_name}</Text>
                </View>

                <View style={styles.projectInfoRow}>
                  <Ionicons name="calendar" size={16} color={QatarColors.mutedForeground} />
                  <Text style={styles.projectInfoText}>
                    {formatDate(project.start_date)} - {formatDate(project.end_date || '')}
                  </Text>
                </View>

                <View style={styles.projectInfoRow}>
                  <Ionicons name="cash" size={16} color={QatarColors.mutedForeground} />
                  <Text style={styles.projectInfoText} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(project.estimated_cost)}</Text>
                </View>
              </View>

              <View style={styles.projectCardFooter}>
                <View style={styles.panelsInfo}>
                  <View style={styles.panelsHeader}>
                    <Ionicons name="cube" size={16} color={QatarColors.mutedForeground} />
                    <Text style={styles.panelsLabel}>Panels</Text>
                  </View>
                  <Text style={styles.panelsCount}>
                    {project.actual_panels} / {project.estimated_panels}
                  </Text>
                </View>

                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${project.estimated_panels > 0 ? Math.min((project.actual_panels / project.estimated_panels) * 100, 100) : 0}%`
                      }
                    ]}
                  />
                </View>

                <View style={styles.projectTotals}>
                  <View style={styles.totalItem}>
                    <Ionicons name="square" size={14} color={QatarColors.primary} />
                    <Text style={styles.totalLabel}>Area</Text>
                    <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{(project.total_area || 0).toFixed(1)} m²</Text>
                  </View>
                  <View style={styles.totalItem}>
                    <Ionicons name="cash" size={14} color={QatarColors.chart2} />
                    <Text style={styles.totalLabel}>Amount</Text>
                    <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatQatarRiyal(project.total_amount || 0)}</Text>
                  </View>
                  <View style={styles.totalItem}>
                    <Ionicons name="fitness" size={14} color={QatarColors.chart4} />
                    <Text style={styles.totalLabel}>Weight</Text>
                    <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{(project.total_weight || 0).toFixed(1)} kg</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QatarColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QatarColors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: QatarColors.mutedForeground,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QatarColors.input,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: QatarColors.foreground,
  },
  filterRow: {
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: QatarColors.card,
    borderWidth: 1,
    borderColor: QatarColors.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: QatarColors.primary,
    borderColor: QatarColors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: QatarColors.foreground,
  },
  filterChipTextActive: {
    color: QatarColors.primaryForeground,
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  activeFiltersText: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
  },
  clearFiltersButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: QatarColors.accent,
  },
  clearFiltersText: {
    fontSize: 12,
    color: QatarColors.foreground,
    fontWeight: '500',
  },
  projectsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: QatarColors.mutedForeground,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  projectCard: {
    backgroundColor: QatarColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: QatarColors.border,
  },
  projectCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  projectTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    marginBottom: 2,
  },
  projectId: {
    fontSize: 12,
    color: QatarColors.mutedForeground,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: QatarColors.foreground,
  },
  projectCardContent: {
    marginBottom: 12,
  },
  projectInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  projectInfoText: {
    fontSize: 14,
    color: QatarColors.foreground,
    marginLeft: 8,
    flex: 1,
  },
  projectCardFooter: {
    borderTopWidth: 1,
    borderTopColor: QatarColors.border,
    paddingTop: 12,
  },
  panelsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  panelsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  panelsLabel: {
    fontSize: 14,
    color: QatarColors.mutedForeground,
    marginLeft: 4,
  },
  panelsCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: QatarColors.foreground,
  },
  progressBar: {
    height: 4,
    backgroundColor: QatarColors.muted,
    borderRadius: 2,
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: QatarColors.primary,
    borderRadius: 2,
  },
  projectTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: QatarColors.accent,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  totalLabel: {
    fontSize: 10,
    color: QatarColors.mutedForeground,
    marginTop: 2,
    marginBottom: 2,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: QatarColors.foreground,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
});
