import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Plus, Edit, Trash2, MoreHorizontal, UserPlus, Search, Filter, Users, Shield, Clock, Mail, Phone, Calendar, Eye, EyeOff, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Users2, Loader2, Building2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import bcrypt from "bcryptjs";
import { useAuth } from "../contexts/AuthContext";
import { useToastContext } from "../contexts/ToastContext";
import { canManageUsers, hasPermission } from "../utils/rolePermissions";

// User roles and statuses - matches database constraints exactly
const USER_ROLES = [
  { value: 'Administrator', label: 'Administrator', description: 'Full system access including user management', color: 'destructive' },
  { value: 'Data Entry', label: 'Data Entry', description: 'Data entry and basic access', color: 'default' },
  { value: 'Production engineer', label: 'Production Engineer', description: 'Production management', color: 'secondary' },
  { value: 'QC Factory', label: 'QC Factory', description: 'Quality control factory', color: 'outline' },
  { value: 'Store Site', label: 'Store Site', description: 'Store site management', color: 'outline' },
  { value: 'QC Site', label: 'QC Site', description: 'Quality control site', color: 'outline' },
  { value: 'Foreman Site', label: 'Foreman Site', description: 'Site foreman', color: 'outline' },
  { value: 'Site Engineer', label: 'Site Engineer', description: 'Site engineering', color: 'outline' },
  { value: 'Customer', label: 'Customer', description: 'Customer access', color: 'outline' }
] as const;

type UserRole = typeof USER_ROLES[number]['value'];

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  phone_number?: string;
  role: UserRole;
  status: 'active' | 'inactive';
  last_login?: string;
  created_at: string;
  updated_at: string;
  department?: string;
  customer_id?: string;
  customer?: Customer;
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToastContext();
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // RBAC Permission checks
  const canManageUsersPermission = currentUser?.role ? canManageUsers(currentUser.role as UserRole) : false;
  const canCreateUsers = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'users', 'canCreate') : false;
  const canUpdateUsers = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'users', 'canUpdate') : false;
  const canDeleteUsers = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'users', 'canDelete') : false;

  // Fetch users from Supabase
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch customers when component mounts
  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        showToast('Error fetching users', 'error');
        return;
      }

      // If we have users with customer_id, fetch customer data separately
      if (data && data.length > 0) {
        const usersWithCustomerIds = data.filter(user => user.customer_id);
        if (usersWithCustomerIds.length > 0) {
          const customerIds = usersWithCustomerIds.map(user => user.customer_id);
          const { data: customerData, error: customerError } = await supabase
            .from('customers')
            .select('id, name, email, phone')
            .in('id', customerIds);

          if (customerError) {
            console.error('Error fetching customers for users:', customerError);
          } else {
            // Create a map of customer data
            const customerMap = new Map();
            customerData?.forEach(customer => {
              customerMap.set(customer.id, customer);
            });

            // Attach customer data to users
            const usersWithCustomers = data.map(user => ({
              ...user,
              customer: user.customer_id ? customerMap.get(user.customer_id) : null
            }));

            setUsers(usersWithCustomers);
            return;
          }
        }
      }

      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast('Error fetching users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      setCustomersLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching customers:', error);
        showToast('Error fetching customers', 'error');
        return;
      }

      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      showToast('Error fetching customers', 'error');
    } finally {
      setCustomersLoading(false);
    }
  };

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [loginActivityFilter, setLoginActivityFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [createdDateFrom, setCreatedDateFrom] = useState('');
  const [createdDateTo, setCreatedDateTo] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  const [formData, setFormData] = useState<{
    username: string;
    name: string;
    email: string;
    phone_number: string;
    role: UserRole;
    status: 'active' | 'inactive';
    department: string;
    password: string;
    confirmPassword: string;
    customer_id: string;
  }>({
    username: '',
    name: '',
    email: '',
    phone_number: '',
    role: 'Data Entry',
    status: 'active',
    department: '',
    password: '',
    confirmPassword: '',
    customer_id: ''
  });

  // Get unique values for filters
  const uniqueDepartments = Array.from(new Set(users.map(u => u.department).filter((dept): dept is string => Boolean(dept)))).sort();

  const resetForm = () => {
    setFormData({
      username: '',
      name: '',
      email: '',
      phone_number: '',
      role: 'Data Entry',
      status: 'active',
      department: '',
      password: '',
      confirmPassword: '',
      customer_id: ''
    });
  };

  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setLoginActivityFilter('all');
    setDateRangeFilter('all');
    setCreatedDateFrom('');
    setCreatedDateTo('');
    setCurrentPage(1);
  };

  // Calculate active filters count
  const activeFiltersCount = [
    searchTerm,
    roleFilter !== 'all' ? roleFilter : '',
    statusFilter !== 'all' ? statusFilter : '',
    departmentFilter !== 'all' ? departmentFilter : '',
    loginActivityFilter !== 'all' ? loginActivityFilter : '',
    dateRangeFilter !== 'all' ? dateRangeFilter : ''
  ].filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) {
      return; // Prevent double-clicking
    }
    
    if (!canManageUsersPermission) {
      showToast('You do not have permission to manage users', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Required field validation
      if (!formData.name.trim()) {
        showToast('Full name is required', 'error');
        return;
      }
      if (!formData.email.trim()) {
        showToast('Email address is required', 'error');
        return;
      }
      if (!formData.username.trim()) {
        showToast('Username is required', 'error');
        return;
      }
      if (!formData.role) {
        showToast('Role is required', 'error');
        return;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        showToast('Please enter a valid email address', 'error');
        return;
      }

      // Username validation (length and characters)
      if (formData.username.length < 3) {
        showToast('Username must be at least 3 characters long', 'error');
        return;
      }
      if (formData.username.length > 50) {
        showToast('Username must be 50 characters or less', 'error');
        return;
      }
      
      // Check for special characters in username (allow only alphanumeric, underscore, hyphen, period)
      const usernameRegex = /^[a-zA-Z0-9._-]+$/;
      if (!usernameRegex.test(formData.username)) {
        showToast('Username can only contain letters, numbers, underscore, hyphen, and period', 'error');
        return;
      }

      // Name validation (length)
      if (formData.name.length > 255) {
        showToast('Full name must be 255 characters or less', 'error');
        return;
      }

      // Email validation (length)
      if (formData.email.length > 255) {
        showToast('Email address must be 255 characters or less', 'error');
        return;
      }

      // Department validation (length)
      if (formData.department && formData.department.length > 100) {
        showToast('Department must be 100 characters or less', 'error');
        return;
      }

      // Phone number validation (length)
      if (formData.phone_number && formData.phone_number.length > 20) {
        showToast('Phone number must be 20 characters or less', 'error');
        return;
      }

      // Check for duplicate email (exclude current user when editing)
      const existingEmailUser = users.find(user => 
        user.email.toLowerCase() === formData.email.toLowerCase() && 
        (!editingUser || user.id !== editingUser.id)
      );
      if (existingEmailUser) {
        showToast('Email address is already in use', 'error');
        return;
      }

      // Check for duplicate username (exclude current user when editing)
      const existingUsernameUser = users.find(user => 
        user.username.toLowerCase() === formData.username.toLowerCase() && 
        (!editingUser || user.id !== editingUser.id)
      );
      if (existingUsernameUser) {
        showToast('Username is already taken', 'error');
        return;
      }

      // Role validation - check if role exists in the allowed roles
      const validRoles = USER_ROLES.map(role => role.value);
      if (!validRoles.includes(formData.role)) {
        showToast('Please select a valid role', 'error');
        return;
      }

      // Status validation
      if (!['active', 'inactive'].includes(formData.status)) {
        showToast('Please select a valid status', 'error');
        return;
      }

      // Customer validation for Customer role
      if (formData.role === 'Customer' && !formData.customer_id) {
        showToast('Customer selection is required for Customer role', 'error');
        return;
      }

      // Password validation
      if (!editingUser) {
        // For new users, password is required
        if (!formData.password) {
          showToast('Password is required for new users', 'error');
          return;
        }
        if (formData.password.length < 6) {
          showToast('Password must be at least 6 characters long', 'error');
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          showToast('Passwords do not match', 'error');
          return;
        }
      } else {
        // For editing users, password is optional but must match if provided
        if (formData.password && formData.password.length < 6) {
          showToast('Password must be at least 6 characters long', 'error');
          return;
        }
        if (formData.password && formData.password !== formData.confirmPassword) {
          showToast('Passwords do not match', 'error');
          return;
        }
      }
      if (editingUser) {
        // Update existing user
        const updateData: any = {
          username: formData.username,
          name: formData.name,
          email: formData.email,
          phone_number: formData.phone_number || null,
          role: formData.role,
          status: formData.status,
          department: formData.department || null,
          customer_id: formData.customer_id || null,
          updated_at: new Date().toISOString()
        };

        // Only update password if provided
        if (formData.password) {
          updateData.password_hash = await bcrypt.hash(formData.password, 10);
        }

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) {
          console.error('Error updating user:', error);
          showToast('Error updating user', 'error');
          return;
        }

        showToast('User updated successfully', 'success');
        setEditingUser(null);
      } else {
        // Add new user
        const { error } = await supabase
          .from('users')
          .insert({
            username: formData.username,
            name: formData.name,
            email: formData.email,
            phone_number: formData.phone_number || null,
            role: formData.role,
            status: formData.status,
            department: formData.department || null,
            customer_id: formData.customer_id || null,
            password_hash: await bcrypt.hash(formData.password, 10)
          });

        if (error) {
          console.error('Error adding user:', error);
          console.error('Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          
          // Handle specific error cases
          if (error.code === '23505') {
            if (error.message.includes('users_email_key')) {
              showToast('Email address is already in use', 'error');
            } else if (error.message.includes('users_username_key')) {
              showToast('Username is already taken', 'error');
            } else {
              showToast('A user with this information already exists', 'error');
            }
          } else if (error.code === '23514') {
            if (error.message.includes('users_role_check')) {
              showToast('Invalid role selected', 'error');
            } else if (error.message.includes('users_status_check')) {
              showToast('Invalid status selected', 'error');
            } else {
              showToast('Invalid data provided', 'error');
            }
          } else {
            showToast(`Error adding user: ${error.message}`, 'error');
          }
          return;
        }

        showToast('User added successfully', 'success');
        setIsAddDialogOpen(false);
      }
      
      resetForm();
      fetchUsers(); // Refresh the users list
    } catch (error) {
      console.error('Error saving user:', error);
      showToast('Error saving user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setOpenPopover(null);
    setFormData({
      username: user.username,
      name: user.name,
      email: user.email,
      phone_number: user.phone_number || '',
      role: user.role,
      status: user.status,
      department: user.department || '',
      password: '',
      confirmPassword: '',
      customer_id: user.customer_id || ''
    });
  };

  const handleDelete = (user: User) => {
    setDeletingUser(user);
    setOpenPopover(null);
  };

  const confirmDelete = async () => {
    if (!canManageUsersPermission) {
      showToast('You do not have permission to delete users', 'error');
      setDeletingUser(null);
      return;
    }

    if (deletingUser) {
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', deletingUser.id);

        if (error) {
          console.error('Error deleting user:', error);
          showToast('Error deleting user', 'error');
          return;
        }

        showToast('User deleted successfully', 'success');
        fetchUsers(); // Refresh the users list
      } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Error deleting user', 'error');
      }
      setDeletingUser(null);
    }
  };

  const toggleUserStatus = async (user: User) => {
    if (!canManageUsersPermission) {
      showToast('You do not have permission to modify user status', 'error');
      setOpenPopover(null);
      return;
    }

    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('users')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating user status:', error);
        showToast('Error updating user status', 'error');
        return;
      }

      showToast(`User ${newStatus} successfully`, 'success');
      fetchUsers(); // Refresh the users list
    } catch (error) {
      console.error('Error updating user status:', error);
      showToast('Error updating user status', 'error');
    }
    setOpenPopover(null);
  };

  const getRoleInfo = (role: UserRole) => {
    return USER_ROLES.find(r => r.value === role) || USER_ROLES[2];
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatLastLogin = (lastLogin?: string) => {
    if (!lastLogin) return 'Never';
    
    const date = new Date(lastLogin);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Filter users based on all criteria
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.department && user.department.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && user.status === 'active') ||
      (statusFilter === 'inactive' && user.status === 'inactive');
    
    const matchesDepartment = departmentFilter === 'all' || user.department === departmentFilter;
    
    const matchesLoginActivity = (() => {
      if (loginActivityFilter === 'all') return true;
      if (!user.last_login && loginActivityFilter === 'never-logged') return true;
      if (!user.last_login) return false;
      
      const daysSinceLogin = (new Date().getTime() - new Date(user.last_login).getTime()) / (1000 * 60 * 60 * 24);
      
      switch (loginActivityFilter) {
        case 'recent': return daysSinceLogin <= 7;
        case 'this-month': return daysSinceLogin <= 30;
        case 'inactive': return daysSinceLogin > 30;
        case 'never-logged': return false; // handled above
        default: return true;
      }
    })();
    
    const matchesDateRange = (() => {
      if (dateRangeFilter === 'all') return true;
      
      const createdDate = new Date(user.created_at);
      const now = new Date();
      
      switch (dateRangeFilter) {
        case 'this-month': {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          return createdDate >= monthStart;
        }
        case 'this-quarter': {
          const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          return createdDate >= quarterStart;
        }
        case 'this-year': {
          const yearStart = new Date(now.getFullYear(), 0, 1);
          return createdDate >= yearStart;
        }
        case 'custom': {
          if (!createdDateFrom && !createdDateTo) return true;
          const fromDate = createdDateFrom ? new Date(createdDateFrom) : new Date(0);
          const toDate = createdDateTo ? new Date(createdDateTo) : new Date();
          return createdDate >= fromDate && createdDate <= toDate;
        }
        default: return true;
      }
    })();
    
    return matchesSearch && matchesRole && matchesStatus && matchesDepartment && matchesLoginActivity && matchesDateRange;
  });

  // Sort users by last login (most recent first), then by name
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (a.last_login && b.last_login) {
      return new Date(b.last_login).getTime() - new Date(a.last_login).getTime();
    }
    if (a.last_login && !b.last_login) return -1;
    if (!a.last_login && b.last_login) return 1;
    return a.name.localeCompare(b.name);
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedUsers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedUsers = sortedUsers.slice(startIndex, endIndex);

  const activeUsersCount = users.filter(u => u.status === 'active').length;
  const recentLoginCount = users.filter(u => {
    if (!u.last_login) return false;
    const daysSinceLogin = (new Date().getTime() - new Date(u.last_login).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLogin <= 7;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Users2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Users</h2>
          <Badge variant="secondary" className="ml-2">
            {filteredUsers.length}
          </Badge>
        </div>
      </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canCreateUsers}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user account with appropriate role and permissions.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter full name"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter email address"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="Enter username"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="Enter department"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={formData.role} onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              <div className="flex items-center gap-2">
                                <div className="font-medium">{role.label}</div>
                                <div className="text-xs text-muted-foreground">{role.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.role === 'Customer' && (
                  <div className="grid gap-2">
                    <Label htmlFor="customer">Customer</Label>
                    <Select
                      value={formData.customer_id}
                      onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                      disabled={customersLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customersLoading ? (
                          <SelectItem value="" disabled>Loading customers...</SelectItem>
                        ) : customers.length === 0 ? (
                          <SelectItem value="" disabled>No customers found</SelectItem>
                        ) : (
                          customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {customer.name}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Confirm password"
                      required
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    'Add User'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardHeader>
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
            {/* First row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {/* Search */}
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      handleFilterChange();
                    }}
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Role Filter */}
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={roleFilter} onValueChange={(value) => {
                  setRoleFilter(value);
                  handleFilterChange();
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {USER_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={(value) => {
                  setStatusFilter(value);
                  handleFilterChange();
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Department Filter */}
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={departmentFilter} onValueChange={(value) => {
                  setDepartmentFilter(value);
                  handleFilterChange();
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {uniqueDepartments.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Page Size */}
              <div className="space-y-2">
                <Label>Items per page</Label>
                <Select value={pageSize.toString()} onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="25">25 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Second row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Login Activity Filter */}
              <div className="space-y-2">
                <Label>Login Activity</Label>
                <Select value={loginActivityFilter} onValueChange={(value) => {
                  setLoginActivityFilter(value);
                  handleFilterChange();
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any activity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any activity</SelectItem>
                    <SelectItem value="recent">Recent (7 days)</SelectItem>
                    <SelectItem value="this-month">This month</SelectItem>
                    <SelectItem value="inactive">Inactive (30+ days)</SelectItem>
                    <SelectItem value="never-logged">Never logged in</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-2">
                <Label>Created Date</Label>
                <Select value={dateRangeFilter} onValueChange={(value) => {
                  setDateRangeFilter(value);
                  handleFilterChange();
                }}>
                  <SelectTrigger>
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

              {/* Custom Date From */}
              {dateRangeFilter === "custom" && (
                <>
                  <div className="space-y-2">
                    <Label>Created From</Label>
                    <Input
                      type="date"
                      value={createdDateFrom}
                      onChange={(e) => {
                        setCreatedDateFrom(e.target.value);
                        handleFilterChange();
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Created To</Label>
                    <Input
                      type="date"
                      value={createdDateTo}
                      onChange={(e) => {
                        setCreatedDateTo(e.target.value);
                        handleFilterChange();
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, sortedUsers.length)} of {sortedUsers.length} users
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Manage user accounts and permissions
            {!canManageUsersPermission && (
              <span className="text-sm text-muted-foreground block mt-1">
                Only Administrators can add, edit, or delete users
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading users...</span>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Login Count</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-8 w-8 text-muted-foreground" />
                          <p className="text-muted-foreground">
                            {searchTerm || roleFilter !== 'all' || statusFilter !== 'all' || departmentFilter !== 'all' || loginActivityFilter !== 'all' || dateRangeFilter !== 'all'
                              ? 'No users match your search criteria'
                              : 'No users found. Add your first user to get started.'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                  paginatedUsers.map((user) => {
                    const roleInfo = getRoleInfo(user.role);
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="text-xs">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <UserPlus className="h-3 w-3" />
                                {user.username}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {user.email}
                              </div>
                              {user.phone_number && (
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {user.phone_number}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={roleInfo.color as any} className="flex items-center gap-1 w-fit">
                            <Shield className="h-3 w-3" />
                            {roleInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{user.department || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {user.customer?.name || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {user.status === 'active' ? (
                              <>
                                <div className="h-2 w-2 bg-green-500 rounded-full" />
                                <span className="text-sm text-green-600">Active</span>
                              </>
                            ) : (
                              <>
                                <div className="h-2 w-2 bg-gray-400 rounded-full" />
                                <span className="text-sm text-gray-600">Inactive</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {formatLastLogin(user.last_login)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">—</span>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center justify-end gap-2">
                                {canUpdateUsers && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEdit(user)}
                                    title="Edit user"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {canUpdateUsers && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleUserStatus(user)}
                                    title="Toggle user status"
                                  >
                                    {user.status === 'active' ? (
                                      <>
                                        <EyeOff className="h-4 w-4" />
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="h-4 w-4" />
                                      </>
                                    )}
                                  </Button>
                                )}
                                {canDeleteUsers && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(user)}
                                    title="Delete user"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
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
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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

      {/* Edit User Dialog */}
      {editingUser && (
        <Dialog open={true} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user information and permissions.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-username">Username</Label>
                    <Input
                      id="edit-username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-email">Email Address</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-phone">Phone Number</Label>
                    <Input
                      id="edit-phone"
                      type="tel"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-department">Department</Label>
                    <Input
                      id="edit-department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-role">Role</Label>
                    <Select value={formData.role} onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              <div>
                                <div className="font-medium">{role.label}</div>
                                <div className="text-xs text-muted-foreground">{role.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.role === 'Customer' && (
                  <div className="grid gap-2">
                    <Label htmlFor="edit-customer">Customer</Label>
                    <Select
                      value={formData.customer_id}
                      onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                      disabled={customersLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customersLoading ? (
                          <SelectItem value="" disabled>Loading customers...</SelectItem>
                        ) : customers.length === 0 ? (
                          <SelectItem value="" disabled>No customers found</SelectItem>
                        ) : (
                          customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {customer.name}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-password">Password (leave blank to keep current)</Label>
                    <Input
                      id="edit-password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter new password"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-confirmPassword">Confirm Password</Label>
                    <Input
                      id="edit-confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    'Update User'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account for
              "{deletingUser?.name}" and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}