import {
  Calendar,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Edit,
  ExternalLink,
  FolderOpen,
  MapPin,
  Package,
  Plus,
  Search,
  Square,
  Trash2,
  Upload,
  User,
  Weight
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { supabase } from "../lib/supabase";
import { useToastContext } from "../contexts/ToastContext";
import { DateInput } from "./ui/date-input";
import { crudOperations } from "../utils/userTracking";
import { useAuth } from "../contexts/AuthContext";
import { hasPermission, isCustomerRole, UserRole } from "../utils/rolePermissions";

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

export function ProjectManagement() {
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const { user: currentUser } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Add form submission protection
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const lastSubmissionTime = useRef<number>(0);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [startDateFrom, setStartDateFrom] = useState("");
  const [startDateTo, setStartDateTo] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  // RBAC - page-level permissions
  const canCreateProjects = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'projects', 'canCreate') : false;
  const canUpdateProjects = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'projects', 'canUpdate') : false;
  const canDeleteProjects = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'projects', 'canDelete') : false;
  const canCreateCustomers = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'customers', 'canCreate') : false;

  const [formData, setFormData] = useState({
    name: "",
    customer_id: "",
    new_customer_name: "",
    new_customer_email: "",
    new_customer_phone: "",
    location: "",
    start_date: "",
    end_date: "",
    status: "active" as "active" | "completed" | "on-hold",
    estimated_cost: 0,
    estimated_panels: 0,
  });

  // Function to suggest a unique project name
  const suggestUniqueProjectName = async (baseName: string): Promise<string> => {
    let counter = 1;
    let suggestedName = baseName;
    
    while (counter <= 10) { // Limit to 10 attempts
      const { data: existingProjects, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('name', suggestedName);
      
      if (error) {
        console.error('Error checking for existing projects:', error);
        break;
      }
      
      if (!existingProjects || existingProjects.length === 0) {
        return suggestedName;
      }
      
      suggestedName = `${baseName} (${counter})`;
      counter++;
    }
    
    // If we can't find a unique name, append timestamp
    return `${baseName} (${new Date().getTime()})`;
  };

  // Function to check if project name is available
  const checkProjectNameAvailability = async (name: string): Promise<{ available: boolean; suggestedName?: string }> => {
    if (!name.trim()) {
      return { available: true };
    }
    
    const { data: existingProjects, error } = await supabase
      .from('projects')
      .select('id, name')
      .eq('name', name);
    
    if (error) {
      console.error('Error checking project name availability:', error);
      return { available: true }; // Assume available if we can't check
    }
    
    if (!existingProjects || existingProjects.length === 0) {
      return { available: true };
    }
    
    const suggestedName = await suggestUniqueProjectName(name);
    return { available: false, suggestedName };
  };

  // Function to debug customer issues
  const debugCustomerIssues = async () => {
    console.log('=== CUSTOMER DEBUG ===');
    
    // Check all customers
    try {
      const { data: allCustomers, error } = await supabase
        .from('customers')
        .select('id, name, email')
        .order('name');
      
      if (error) {
        console.error('Error fetching all customers:', error);
      } else {
        console.log('All available customers:', allCustomers);
      }
    } catch (error) {
      console.error('Exception fetching all customers:', error);
    }
    
    console.log('=== END CUSTOMER DEBUG ===');
  };

  // Fetch customers and projects on mount
  useEffect(() => {
    fetchCustomers();
    fetchProjects();
  }, []);

  // Reset submitting state when dialog closes
  useEffect(() => {
    if (!isAddDialogOpen && !editingProject) {
      setIsSubmitting(false);
    }
  }, [isAddDialogOpen, editingProject]);

  const fetchCustomers = async () => {
    // Check if current user is a customer and implement data filtering
    const isCustomer = currentUser?.role ? isCustomerRole(currentUser.role as UserRole) : false;
    
    let query = supabase
      .from('customers')
      .select('*');
    
    // If user is a customer, only show their own customer record
    if (isCustomer && currentUser?.customer_id) {
      query = query.eq('id', currentUser.customer_id);
      console.log('Filtering customers for customer user:', currentUser.customer_id);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching customers:', error);
      return;
    }
    setCustomers(data || []);
  };

  const fetchProjects = async () => {
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
  };

  const resetForm = () => {
    setFormData({
      name: "",
      customer_id: "",
      new_customer_name: "",
      new_customer_email: "",
      new_customer_phone: "",
      location: "",
      start_date: "",
      end_date: "",
      status: "active",
      estimated_cost: 0,
      estimated_panels: 0,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isSubmitting) {
      console.log('Form submission already in progress, ignoring duplicate submission');
      return;
    }
    
    // Debounce rapid submissions (prevent submissions within 2 seconds)
    const now = Date.now();
    if (now - lastSubmissionTime.current < 2000) {
      console.log('Form submission debounced, ignoring rapid submission');
      return;
    }
    lastSubmissionTime.current = now;
    
    setIsSubmitting(true);
    
    // Add timeout to prevent stuck state
    const timeoutId = setTimeout(() => {
      console.log('Form submission timeout, resetting state');
      setIsSubmitting(false);
      showToast('Request timed out. Please try again.', 'error');
    }, 30000); // 30 seconds timeout
    
    try {
      // Check if current user is a customer and implement data filtering
      const isCustomer = currentUser?.role ? isCustomerRole(currentUser.role as UserRole) : false;
      
      let customerId = formData.customer_id;
      
      // Validate required fields
      if (!formData.name.trim()) {
        showToast('Project name is required', 'error');
        clearTimeout(timeoutId);
        setIsSubmitting(false);
        return;
      }
      
      if (!formData.start_date) {
        showToast('Start date is required', 'error');
        clearTimeout(timeoutId);
        setIsSubmitting(false);
        return;
      }
      
      if (!formData.location.trim()) {
        showToast('Location is required', 'error');
        clearTimeout(timeoutId);
        setIsSubmitting(false);
        return;
      }
      
      // If user is a customer, force them to use their own customer_id
      if (isCustomer && currentUser?.customer_id) {
        customerId = currentUser.customer_id;
        console.log('Customer user forced to use their own customer_id:', customerId);
      } else if (formData.customer_id === "other") {
        // If "Other" is selected, create new customer (only for users with customer creation permissions)
        if (!canCreateCustomers) {
          showToast('You do not have permission to create customers', 'error');
          clearTimeout(timeoutId);
          setIsSubmitting(false);
          return;
        }
        
        try {
          // Validate new customer data
          if (!formData.new_customer_name.trim()) {
            showToast('New customer name is required', 'error');
            clearTimeout(timeoutId);
            setIsSubmitting(false);
            return;
          }
          
          if (!formData.new_customer_email.trim()) {
            showToast('Customer email is required', 'error');
            clearTimeout(timeoutId);
            setIsSubmitting(false);
            return;
          }
          
          console.log('Creating new customer with data:', {
            name: formData.new_customer_name,
            email: formData.new_customer_email,
            phone: formData.new_customer_phone || null
          });
          
          const newCustomer = await crudOperations.create('customers', {
            name: formData.new_customer_name,
            email: formData.new_customer_email,
            phone: formData.new_customer_phone || null
          });
          
          customerId = newCustomer.id;
          console.log('Customer created successfully with ID:', customerId);
        } catch (error) {
          console.error('Error creating customer:', error);
          
          // Extract meaningful error message
          let errorMessage = 'Error creating customer. Please try again.';
          
          if (error instanceof Error) {
            const errorMsg = error.message;
            
            // Handle specific error cases
            if (errorMsg.includes('already exists')) {
              if (errorMsg.includes('email')) {
                errorMessage = `A customer with the email "${formData.new_customer_email}" already exists. Please use a different email address.`;
              } else if (errorMsg.includes('name')) {
                errorMessage = `A customer with the name "${formData.new_customer_name}" already exists. Please use a different name.`;
              } else {
                errorMessage = errorMsg;
              }
            } else if (errorMsg.includes('required')) {
              errorMessage = errorMsg;
            } else if (errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
              errorMessage = 'You do not have permission to create customers.';
            } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
              errorMessage = 'Network error. Please check your connection and try again.';
            } else {
              // For other errors, show the actual error message if it's meaningful
              errorMessage = errorMsg.length > 100 ? 'Error creating customer. Please try again.' : errorMsg;
            }
          }
          
          showToast(errorMessage, 'error');
          clearTimeout(timeoutId);
          setIsSubmitting(false);
          return;
        }
      }

      if (!customerId) {
        showToast('Please select a customer', 'error');
        clearTimeout(timeoutId);
        setIsSubmitting(false);
        return;
      }

      // Validate that the selected customer exists
      try {
        console.log('Validating selected customer:', customerId);
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('id, name')
          .eq('id', customerId)
          .single();
        
        if (customerError) {
          console.error('Error validating customer:', customerError);
          showToast('Selected customer is invalid. Please choose a different customer.', 'error');
          clearTimeout(timeoutId);
          setIsSubmitting(false);
          return;
        }
        
        if (!customer) {
          showToast('Selected customer does not exist. Please choose a valid customer.', 'error');
          clearTimeout(timeoutId);
          setIsSubmitting(false);
          return;
        }
        
        console.log('Customer validation successful:', customer);
      } catch (error) {
        console.error('Error validating customer:', error);
        showToast('Error validating customer. Please try again.', 'error');
        clearTimeout(timeoutId);
        setIsSubmitting(false);
        return;
      }

      console.log('Submitting project data:', {
        editingProject,
        formData,
        customerId
      });
      
      if (editingProject) {
        const updateData = {
          name: formData.name,
          customer_id: customerId,
          location: formData.location,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          status: formData.status,
          estimated_cost: formData.estimated_cost,
          estimated_panels: formData.estimated_panels
        };
        console.log('Updating project with data:', updateData);
        
        await crudOperations.update('projects', editingProject.id, updateData);
        
        showToast('Project updated successfully', 'success');
        setEditingProject(null);
      } else {
        // Check if project name already exists before creating
        console.log('Checking for existing project with name:', formData.name);
        const { data: existingProjects, error: checkError } = await supabase
          .from('projects')
          .select('id, name, customer_id')
          .eq('name', formData.name);
        
        if (checkError) {
          console.error('Error checking for existing projects:', checkError);
        } else if (existingProjects && existingProjects.length > 0) {
          const suggestedName = await suggestUniqueProjectName(formData.name);
          showToast(
            `A project with the name "${formData.name}" already exists. Suggested name: "${suggestedName}"`, 
            'error'
          );
          // Update the form with the suggested name
          setFormData(prev => ({ ...prev, name: suggestedName }));
          clearTimeout(timeoutId);
          setIsSubmitting(false);
          return;
        }
        
        const createData = {
          name: formData.name,
          customer_id: customerId,
          location: formData.location,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          status: formData.status,
          estimated_cost: formData.estimated_cost,
          estimated_panels: formData.estimated_panels
        };
        console.log('Creating project with data:', createData);
        
        await crudOperations.create('projects', createData);
        
        showToast('Project added successfully', 'success');
        setIsAddDialogOpen(false);
      }
      
      resetForm();
      await fetchProjects();
      await fetchCustomers();
    } catch (error) {
      console.error('Error saving project:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error saving project';
      showToast(errorMessage, 'error');
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  };

  const startEdit = (project: Project) => {
    // Check if current user is a customer and implement data filtering
    const isCustomer = currentUser?.role ? isCustomerRole(currentUser.role as UserRole) : false;
    
    // If user is a customer, verify they can only edit their own projects
    if (isCustomer && currentUser?.customer_id) {
      if (project.customer_id !== currentUser.customer_id) {
        showToast('You can only edit your own projects', 'error');
        return;
      }
    }
    
    setEditingProject(project);
    setFormData({
      name: project.name,
      customer_id: project.customer_id || "",
      new_customer_name: "",
      new_customer_email: "",
      new_customer_phone: "",
      location: project.location,
      start_date: project.start_date,
      end_date: project.end_date || "",
      status: project.status,
      estimated_cost: project.estimated_cost,
      estimated_panels: project.estimated_panels,
    });
  };

  const handleDelete = (project: Project) => {
    // Check if current user is a customer and implement data filtering
    const isCustomer = currentUser?.role ? isCustomerRole(currentUser.role as UserRole) : false;
    
    // If user is a customer, verify they can only delete their own projects
    if (isCustomer && currentUser?.customer_id) {
      if (project.customer_id !== currentUser.customer_id) {
        showToast('You can only delete your own projects', 'error');
        return;
      }
    }
    
    setDeletingProject(project);
  };

  const confirmDelete = async () => {
    if (deletingProject) {
      setIsDeleting(true);
      
      // Check if current user is a customer and implement data filtering
      const isCustomer = currentUser?.role ? isCustomerRole(currentUser.role as UserRole) : false;
      
      // If user is a customer, verify they can only delete their own projects
      if (isCustomer && currentUser?.customer_id) {
        if (deletingProject.customer_id !== currentUser.customer_id) {
          showToast('You can only delete your own projects', 'error');
          setDeletingProject(null);
          setIsDeleting(false);
          return;
        }
      }
      
      try {
        // Check for all dependencies in the correct order
        console.log('Checking project dependencies...');
        
        // 1. Check for panels
        let panelQuery = supabase
          .from('panels')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', deletingProject.id);
        
        if (isCustomer && currentUser?.customer_id) {
          panelQuery = panelQuery.eq('customer_id', currentUser.customer_id);
        }
        
        const { count: panelCount, error: panelError } = await panelQuery;
        
        if (panelError) {
          console.error('Error checking for panels:', panelError);
          showToast('Error checking project dependencies', 'error');
          return;
        }
        
        // 2. Check for facades (through buildings)
        // First get building IDs for this project
        let buildingIdsForCountQuery = supabase
          .from('buildings')
          .select('id')
          .eq('project_id', deletingProject.id);
        
        if (isCustomer && currentUser?.customer_id) {
          buildingIdsForCountQuery = buildingIdsForCountQuery.eq('customer_id', currentUser.customer_id);
        }
        
        const { data: buildingIdsForCount, error: buildingIdsForCountError } = await buildingIdsForCountQuery;
        
        if (buildingIdsForCountError) {
          console.error('Error checking for facades:', buildingIdsForCountError);
          showToast('Error checking project dependencies', 'error');
          return;
        }
        
        let facadeCount = 0;
        if (buildingIdsForCount && buildingIdsForCount.length > 0) {
          let facadeQuery = supabase
            .from('facades')
            .select('id', { count: 'exact', head: true })
            .in('building_id', buildingIdsForCount.map(b => b.id));
          
          if (isCustomer && currentUser?.customer_id) {
            facadeQuery = facadeQuery.eq('customer_id', currentUser.customer_id);
          }
          
          const { count: facadeCountResult, error: facadeError } = await facadeQuery;
          
          if (facadeError) {
            console.error('Error checking for facades:', facadeError);
            showToast('Error checking project dependencies', 'error');
            return;
          }
          
          facadeCount = facadeCountResult || 0;
        }
        
        // 3. Check for buildings
        let buildingQuery = supabase
          .from('buildings')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', deletingProject.id);
        
        if (isCustomer && currentUser?.customer_id) {
          buildingQuery = buildingQuery.eq('customer_id', currentUser.customer_id);
        }
        
        const { count: buildingCount, error: buildingError } = await buildingQuery;
        
        if (buildingError) {
          console.error('Error checking for buildings:', buildingError);
          showToast('Error checking project dependencies', 'error');
          return;
        }
        
        // Show warning if project has dependencies
        const totalDependencies = (panelCount || 0) + (facadeCount || 0) + (buildingCount || 0);
        
        if (totalDependencies > 0) {
          const dependencyDetails = [
            panelCount ? `${panelCount} panel(s)` : null,
            facadeCount ? `${facadeCount} facade(s)` : null,
            buildingCount ? `${buildingCount} building(s)` : null
          ].filter(Boolean).join(', ');
          
          const confirmed = window.confirm(
            `This project has ${dependencyDetails} associated with it. Deleting the project will also delete all associated data. Are you sure you want to continue?`
          );
          
          if (!confirmed) {
            setDeletingProject(null);
            return;
          }
          
          console.log(`Deleting dependencies for project ${deletingProject.id}: ${dependencyDetails}`);
          
          // Delete in the correct order: Panels → Facades → Buildings → Project
          
          // 1. Delete panels
          if (panelCount && panelCount > 0) {
            console.log(`Deleting ${panelCount} panels...`);
            let deletePanelsQuery = supabase
              .from('panels')
              .delete()
              .eq('project_id', deletingProject.id);
            
            if (isCustomer && currentUser?.customer_id) {
              deletePanelsQuery = deletePanelsQuery.eq('customer_id', currentUser.customer_id);
            }
            
            const { error: deletePanelsError } = await deletePanelsQuery;
            
            if (deletePanelsError) {
              console.error('Error deleting panels:', deletePanelsError);
              showToast('Error deleting project panels', 'error');
              return;
            }
            
            console.log('Panels deleted successfully');
          }
          
          // 2. Delete facades
          if (facadeCount && facadeCount > 0) {
            console.log(`Deleting ${facadeCount} facades...`);
            
            // First, get all building IDs for this project
            let buildingIdsQuery = supabase
              .from('buildings')
              .select('id')
              .eq('project_id', deletingProject.id);
            
            if (isCustomer && currentUser?.customer_id) {
              buildingIdsQuery = buildingIdsQuery.eq('customer_id', currentUser.customer_id);
            }
            
            const { data: buildingIds, error: buildingIdsError } = await buildingIdsQuery;
            
            if (buildingIdsError) {
              console.error('Error getting building IDs:', buildingIdsError);
              showToast('Error deleting project facades', 'error');
              return;
            }
            
            if (buildingIds && buildingIds.length > 0) {
              // Delete facades that belong to these buildings
              let deleteFacadesQuery = supabase
                .from('facades')
                .delete()
                .in('building_id', buildingIds.map(b => b.id));
              
              if (isCustomer && currentUser?.customer_id) {
                deleteFacadesQuery = deleteFacadesQuery.eq('customer_id', currentUser.customer_id);
              }
              
              const { error: deleteFacadesError } = await deleteFacadesQuery;
              
              if (deleteFacadesError) {
                console.error('Error deleting facades:', deleteFacadesError);
                showToast('Error deleting project facades', 'error');
                return;
              }
              
              console.log('Facades deleted successfully');
            }
          }
          
          // 3. Delete buildings
          if (buildingCount && buildingCount > 0) {
            console.log(`Deleting ${buildingCount} buildings...`);
            let deleteBuildingsQuery = supabase
              .from('buildings')
              .delete()
              .eq('project_id', deletingProject.id);
            
            if (isCustomer && currentUser?.customer_id) {
              deleteBuildingsQuery = deleteBuildingsQuery.eq('customer_id', currentUser.customer_id);
            }
            
            const { error: deleteBuildingsError } = await deleteBuildingsQuery;
            
            if (deleteBuildingsError) {
              console.error('Error deleting buildings:', deleteBuildingsError);
              showToast('Error deleting project buildings', 'error');
              return;
            }
            
            console.log('Buildings deleted successfully');
          }
        }
        
        // Now delete the project
        console.log('Deleting project...');
        await crudOperations.delete('projects', deletingProject.id);
        
        showToast('Project deleted successfully', 'success');
        setDeletingProject(null);
        await fetchProjects();
      } catch (error) {
        console.error('Error deleting project:', error);
        
        // Check if it's a foreign key constraint error
        if (error instanceof Error && error.message.includes('409')) {
          showToast('Cannot delete project: It has associated data. Please delete all associated data first.', 'error');
        } else {
          showToast('Error deleting project', 'error');
        }
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleCardClick = (project: Project) => {
    navigate(`/projects/${project.id}`);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: "default", label: "Active" },
      completed: { variant: "secondary", label: "Completed" },
      "on-hold": { variant: "destructive", label: "On Hold" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: "secondary", label: status };

    return (
      <Badge variant={config.variant as any} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  // Get unique values for filters
  const uniqueCustomers = Array.from(new Set(projects.map((p) => p.customer_name).filter(Boolean))).sort();
  const uniqueLocations = Array.from(new Set(projects.map((p) => p.location).filter(Boolean))).sort();

  // Filter and sort projects
  const filteredAndSortedProjects = projects
    .filter((project) => {
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

      // Date range filter
      if (dateRangeFilter && dateRangeFilter !== "all") {
        const projectStart = new Date(project.start_date);
        const projectEnd = project.end_date ? new Date(project.end_date) : new Date();
        const now = new Date();

        switch (dateRangeFilter) {
          case "this-month":
            const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            if (projectStart >= nextMonth || projectEnd < thisMonth) return false;
            break;
          case "this-quarter":
            const quarter = Math.floor(now.getMonth() / 3);
            const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
            const quarterEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 1);
            if (projectStart >= quarterEnd || projectEnd < quarterStart) return false;
            break;
          case "this-year":
            const yearStart = new Date(now.getFullYear(), 0, 1);
            const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
            if (projectStart >= yearEnd || projectEnd < yearStart) return false;
            break;
          case "custom":
            if (startDateFrom && projectStart < new Date(startDateFrom)) return false;
            if (startDateTo && projectStart > new Date(startDateTo)) return false;
            break;
        }
      }

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "customer":
          comparison = (a.customer_name || "").localeCompare(b.customer_name || "");
          break;
        case "location":
          comparison = (a.location || "").localeCompare(b.location || "");
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          break;
        case "startDate":
          comparison = new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime();
          break;
        case "endDate":
          comparison = new Date(a.end_date || 0).getTime() - new Date(b.end_date || 0).getTime();
          break;
        case "estimatedCost":
          comparison = (a.estimated_cost || 0) - (b.estimated_cost || 0);
          break;
        case "estimatedPanels":
          comparison = (a.estimated_panels || 0) - (b.estimated_panels || 0);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedProjects.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProjects = filteredAndSortedProjects.slice(startIndex, endIndex);

  // Reset to first page when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCustomerFilter("all");
    setStatusFilter("all");
    setLocationFilter("all");
    setDateRangeFilter("all");
    setStartDateFrom("");
    setStartDateTo("");
    setSortBy("name");
    setSortOrder("asc");
    setCurrentPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const activeFiltersCount = [
    searchTerm,
    customerFilter !== "all" ? customerFilter : "",
    statusFilter !== "all" ? statusFilter : "",
    locationFilter !== "all" ? locationFilter : "",
    dateRangeFilter !== "all" ? dateRangeFilter : "",
  ].filter(Boolean).length;

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

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  // Generate page numbers for pagination
  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push("...");
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
      if (currentPage < totalPages - 2) {
        pages.push("...");
      }
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Project Management</h1>
          <p className="text-muted-foreground">
            Manage your projects, timelines, and deliverables
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!canCreateProjects}>
                <Plus className="mr-2 h-4 w-4" />
                Add Project
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:w-full sm:mx-0 rounded-lg">
              <DialogHeader className="pb-4">
                <DialogTitle className="text-lg sm:text-xl">
                  {isSubmitting ? "Adding Project..." : "Add New Project"}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {isSubmitting 
                    ? "Please wait while we create your project..." 
                    : "Create a new project for a customer."
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-2">
                  {/* Project Name - Full Width */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Project Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          name: e.target.value,
                        })
                      }
                      required
                      disabled={isSubmitting}
                      className="w-full"
                      placeholder="Enter project name"
                    />
                  </div>

                  {/* Customer - Full Width */}
                  <div className="space-y-2">
                    <Label htmlFor="customer" className="text-sm font-medium">Customer</Label>
                    <Select
                      value={formData.customer_id}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          customer_id: value,
                        })
                      }
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                        {canCreateCustomers && <SelectItem value="other">Other</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* New Customer Fields - Full Width on Mobile */}
                  {formData.customer_id === "other" && canCreateCustomers && (
                    <div className="space-y-4 border-l-4 border-primary pl-4 bg-muted/20 p-4 rounded-r-lg">
                      <h4 className="text-sm font-medium text-primary">New Customer Details</h4>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="new_customer_name" className="text-sm font-medium">Customer Name</Label>
                          <Input
                            id="new_customer_name"
                            value={formData.new_customer_name}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                new_customer_name: e.target.value,
                              })
                            }
                            required
                            disabled={isSubmitting}
                            className="w-full"
                            placeholder="Enter customer name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new_customer_email" className="text-sm font-medium">Email</Label>
                          <Input
                            id="new_customer_email"
                            type="email"
                            value={formData.new_customer_email}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                new_customer_email: e.target.value,
                              })
                            }
                            disabled={isSubmitting}
                            className="w-full"
                            placeholder="Enter email address"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new_customer_phone" className="text-sm font-medium">Phone</Label>
                          <Input
                            id="new_customer_phone"
                            type="tel"
                            value={formData.new_customer_phone}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                new_customer_phone: e.target.value,
                              })
                            }
                            disabled={isSubmitting}
                            className="w-full"
                            placeholder="Enter phone number"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Date Fields - Stack on Mobile, Side by Side on Desktop */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DateInput
                      id="startDate"
                      label="Start Date"
                      value={formData.start_date}
                      onChange={(value) =>
                        setFormData({
                          ...formData,
                          start_date: value,
                        })
                      }
                      required
                    />
                    <DateInput
                      id="endDate"
                      label="End Date"
                      value={formData.end_date}
                      onChange={(value) =>
                        setFormData({
                          ...formData,
                          end_date: value,
                        })
                      }
                    />
                  </div>

                  {/* Location - Full Width */}
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-sm font-medium">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          location: e.target.value,
                        })
                      }
                      required
                      disabled={isSubmitting}
                      className="w-full"
                      placeholder="Enter project location"
                    />
                  </div>

                  {/* Cost and Panels - Stack on Mobile, Side by Side on Desktop */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estimatedCost" className="text-sm font-medium">Estimated Cost ($)</Label>
                      <Input
                        id="estimatedCost"
                        type="number"
                        min="0"
                        step="1"
                        value={formData.estimated_cost}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            estimated_cost: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder=""
                        required
                        disabled={isSubmitting}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="estimatedPanels" className="text-sm font-medium">Estimated Panels</Label>
                      <Input
                        id="estimatedPanels"
                        type="number"
                        min="0"
                        step="1"
                        value={formData.estimated_panels || 1}  
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            estimated_panels: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="0"
                        required
                        disabled={isSubmitting}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Status - Full Width */}
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          status: value as any,
                        })
                      }
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="on-hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="pt-6 border-t">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !canCreateProjects}
                    className="w-full sm:w-auto"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Adding Project...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Project
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters Panel - Always Visible */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters & Search</CardTitle>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search - Full Width on Mobile */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    handleFilterChange();
                  }}
                  className="pl-10 h-11"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Filter Grid - Responsive */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {/* Customer Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Customer</Label>
                <Select
                  value={customerFilter}
                  onValueChange={(value) => {
                    setCustomerFilter(value);
                    handleFilterChange();
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="All customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All customers</SelectItem>
                    {uniqueCustomers.map((customer) => (
                      <SelectItem key={customer} value={customer}>
                        {customer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    handleFilterChange();
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Location Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Location</Label>
                <Select
                  value={locationFilter}
                  onValueChange={(value) => {
                    setLocationFilter(value);
                    handleFilterChange();
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {uniqueLocations.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date Range</Label>
                <Select
                  value={dateRangeFilter}
                  onValueChange={(value) => {
                    setDateRangeFilter(value);
                    handleFilterChange();
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any time</SelectItem>
                    <SelectItem value="this-month">This month</SelectItem>
                    <SelectItem value="this-quarter">This quarter</SelectItem>
                    <SelectItem value="this-year">This year</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Date Range - Full Width on Mobile */}
            {dateRangeFilter === "custom" && (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <DateInput
                  id="startDateFrom"
                  label="Start Date From"
                  value={startDateFrom}
                  onChange={(value) => {
                    setStartDateFrom(value);
                    handleFilterChange();
                  }}
                />
                <DateInput
                  id="startDateTo"
                  label="Start Date To"
                  value={startDateTo}
                  onChange={(value) => {
                    setStartDateTo(value);
                    handleFilterChange();
                  }}
                />
              </div>
            )}

            {/* Sort Controls - Responsive */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {/* Sort By */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sort By</Label>
                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Project Name</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="startDate">Start Date</SelectItem>
                    <SelectItem value="estimatedCost">Estimated Cost</SelectItem>
                    <SelectItem value="estimatedPanels">Estimated Panels</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Order */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sort Order</Label>
                <Select
                  value={sortOrder}
                  onValueChange={(value) => setSortOrder(value as "asc" | "desc")}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Page Size */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Items per page</Label>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(parseInt(value));
                    setCurrentPage(1);
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12 per page</SelectItem>
                    <SelectItem value="24">24 per page</SelectItem>
                    <SelectItem value="36">36 per page</SelectItem>
                    <SelectItem value="48">48 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-6 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-
              {Math.min(endIndex, filteredAndSortedProjects.length)} of {filteredAndSortedProjects.length} projects
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearFilters} 
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>



      {/* Projects Grid */}
      {filteredAndSortedProjects.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {activeFiltersCount > 0 ? "No projects match your filters" : "No projects found"}
          </p>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4" disabled={isSubmitting}>
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {paginatedProjects.map((project) => (
              <Card
                key={project.id}
                className="qatar-card cursor-pointer hover:shadow-xl transition-all duration-200 group"
                onClick={() => handleCardClick(project)}
              >
                <CardHeader className="qatar-card-header pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <CardTitle className="qatar-card-title text-base sm:text-lg leading-tight break-words hyphens-auto">
                          {project.name}
                        </CardTitle>
                        <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                      </div>
                      <p className="qatar-card-subtitle text-xs">
                        PRJ-{project.id.slice(-4).toUpperCase()}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(project.status)}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="qatar-card-content">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-card-foreground truncate">{project.location}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-card-foreground truncate">{project.customer_name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground text-xs">
                        {formatDate(project.start_date)} - {formatDate(project.end_date || '')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-card-foreground font-medium text-sm">
                        {formatCurrency(project.estimated_cost)}
                      </span>
                    </div>
                  </div>

                  <div className="qatar-card-footer">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Panels</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-card-foreground">{project.actual_panels}</span>
                        <span className="text-xs text-muted-foreground ml-1">/ {project.estimated_panels}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <div className="qatar-progress flex-1 h-2">
                        <div
                          className="qatar-progress-bar h-full"
                          style={{ 
                            width: `${project.estimated_panels > 0 ? Math.min((project.actual_panels / project.estimated_panels) * 100, 100) : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Project Totals - Responsive Grid */}
                    <div className="pt-3 border-t border-border/30">
                      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-xs">
                        <div className="flex flex-col items-center text-center p-1.5 sm:p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <Square className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary mb-1" />
                          <span className="text-muted-foreground text-[9px] sm:text-[10px] uppercase tracking-wide">Area</span>
                          <span className="font-semibold text-card-foreground text-[10px] sm:text-xs">
                            {(project.total_area || 0).toFixed(1)} m²
                          </span>
                        </div>
                        <div className="flex flex-col items-center text-center p-1.5 sm:p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600 mb-1" />
                          <span className="text-muted-foreground text-[9px] sm:text-[10px] uppercase tracking-wide">Amount</span>
                          <span className="font-semibold text-card-foreground text-[10px] sm:text-xs">
                            {formatQatarRiyal(project.total_amount || 0)}
                          </span>
                        </div>
                        <div className="flex flex-col items-center text-center p-1.5 sm:p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <Weight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-600 mb-1" />
                          <span className="text-muted-foreground text-[9px] sm:text-[10px] uppercase tracking-wide">Weight</span>
                          <span className="font-semibold text-card-foreground text-[10px] sm:text-xs">
                            {(project.total_weight || 0).toFixed(1)} kg
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons - Mobile Optimized */}
                    <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                      {canUpdateProjects && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(project);
                          }}
                          className="flex-1 h-9 text-xs sm:text-sm"
                          disabled={isSubmitting}
                        >
                          <Edit className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                          Edit
                        </Button>
                      )}
                      {canDeleteProjects && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(project);
                          }}
                          className="flex-1 h-9 text-xs sm:text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={isSubmitting}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center pt-6">
              <Pagination>
                <PaginationContent className="flex-wrap">
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className={`${currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} h-9 px-2 sm:px-3`}
                      disabled={isSubmitting}
                    />
                  </PaginationItem>

                  {getVisiblePages().map((page, index) => (
                    <PaginationItem key={index}>
                      {page === "..." ? (
                        <PaginationEllipsis className="h-9 px-2" />
                      ) : (
                        <PaginationLink
                          onClick={() => setCurrentPage(page as number)}
                          isActive={currentPage === page}
                          className="cursor-pointer h-9 w-9 sm:w-10"
                          disabled={isSubmitting}
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className={`${currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} h-9 px-2 sm:px-3`}
                      disabled={isSubmitting}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      {editingProject && (
        <Dialog open={true} onOpenChange={() => setEditingProject(null)}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:w-full sm:mx-0 rounded-lg">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-lg sm:text-xl">
                {isSubmitting ? "Updating Project..." : "Edit Project"}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {isSubmitting 
                  ? "Please wait while we update your project..." 
                  : "Update project information."
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-2">
                {/* Project Name - Full Width */}
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-sm font-medium">Project Name</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                      })
                    }
                    required
                    disabled={isSubmitting}
                    className="w-full"
                    placeholder="Enter project name"
                  />
                </div>

                {/* Customer - Full Width */}
                <div className="space-y-2">
                  <Label htmlFor="edit-customer" className="text-sm font-medium">Customer</Label>
                  <Select
                    value={formData.customer_id}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        customer_id: value,
                      })
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                      {canCreateCustomers && <SelectItem value="other">Other</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>

                {/* New Customer Fields - Full Width on Mobile */}
                {formData.customer_id === "other" && canCreateCustomers && (
                  <div className="space-y-4 border-l-4 border-primary pl-4 bg-muted/20 p-4 rounded-r-lg">
                    <h4 className="text-sm font-medium text-primary">New Customer Details</h4>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="new_customer_name" className="text-sm font-medium">Customer Name</Label>
                        <Input
                          id="new_customer_name"
                          value={formData.new_customer_name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              new_customer_name: e.target.value,
                            })
                          }
                          required
                          disabled={isSubmitting}
                          className="w-full"
                          placeholder="Enter customer name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_customer_email" className="text-sm font-medium">Email</Label>
                        <Input
                          id="new_customer_email"
                          type="email"
                          value={formData.new_customer_email}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              new_customer_email: e.target.value,
                            })
                          }
                          disabled={isSubmitting}
                          className="w-full"
                          placeholder="Enter email address"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_customer_phone" className="text-sm font-medium">Phone</Label>
                        <Input
                          id="new_customer_phone"
                          type="tel"
                          value={formData.new_customer_phone}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              new_customer_phone: e.target.value,
                            })
                          }
                          disabled={isSubmitting}
                          className="w-full"
                          placeholder="Enter phone number"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Location - Full Width */}
                <div className="space-y-2">
                  <Label htmlFor="edit-location" className="text-sm font-medium">Location</Label>
                  <Input
                    id="edit-location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        location: e.target.value,
                      })
                    }
                    required
                    disabled={isSubmitting}
                    className="w-full"
                    placeholder="Enter project location"
                  />
                </div>

                {/* Date Fields - Stack on Mobile, Side by Side on Desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DateInput
                    id="edit-startDate"
                    label="Start Date"
                    value={formData.start_date}
                    onChange={(value) =>
                      setFormData({
                        ...formData,
                        start_date: value,
                      })
                    }
                    required
                  />
                  <DateInput
                    id="edit-endDate"
                    label="End Date"
                    value={formData.end_date}
                    onChange={(value) =>
                      setFormData({
                        ...formData,
                        end_date: value,
                      })
                    }
                  />
                </div>

                {/* Cost and Panels - Stack on Mobile, Side by Side on Desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-estimatedCost" className="text-sm font-medium">Estimated Cost ($)</Label>
                    <Input
                      id="edit-estimatedCost"
                      type="number"
                      min="0"
                      step="100"
                      value={formData.estimated_cost}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          estimated_cost: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                      required
                      disabled={isSubmitting}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-estimatedPanels" className="text-sm font-medium">Estimated Panels</Label>
                    <Input
                      id="edit-estimatedPanels"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.estimated_panels}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          estimated_panels: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                      required
                      disabled={isSubmitting}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Status - Full Width */}
                <div className="space-y-2">
                  <Label htmlFor="edit-status" className="text-sm font-medium">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        status: value as any,
                      })
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on-hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="pt-6 border-t">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating Project...
                    </>
                  ) : (
                    <>
                      <Edit className="mr-2 h-4 w-4" />
                      Update Project
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingProject} onOpenChange={() => setDeletingProject(null)}>
        <AlertDialogContent className="w-[95vw] max-w-md mx-4 sm:w-full sm:mx-0 rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Delete Project</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              <div className="space-y-3">
                <p>
                  This action cannot be undone. This will permanently delete the project "
                  <strong className="text-foreground">{deletingProject?.name}</strong>".
                </p>
                {deletingProject && (
                  <div className="text-sm text-muted-foreground space-y-2 bg-muted/30 p-3 rounded-lg">
                    <div className="grid grid-cols-1 gap-1">
                      <p><span className="font-medium">Project ID:</span> {deletingProject.id}</p>
                      <p><span className="font-medium">Location:</span> {deletingProject.location}</p>
                      <p><span className="font-medium">Customer:</span> {deletingProject.customer_name}</p>
                      <p><span className="font-medium">Current Panels:</span> {deletingProject.actual_panels}</p>
                    </div>
                    {deletingProject.actual_panels > 0 && (
                      <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
                        <p className="font-medium">
                          ⚠️ This project has {deletingProject.actual_panels} panel(s) that will also be deleted.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Project
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Empty export to ensure this file is treated as a module
export {};