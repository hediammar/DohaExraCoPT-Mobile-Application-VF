import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; // Adjust path as needed
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "../components/ui/pagination";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { Plus, Edit, Trash2, MoreHorizontal, Building2, MapPin, Phone, Mail, User, Search, ChevronUp, ChevronDown, Filter, X, Users } from "lucide-react";
import { crudOperations } from "../utils/userTracking";
import { useAuth } from "../contexts/AuthContext";
import { hasPermission, UserRole } from "../utils/rolePermissions";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  projects?: number;
}

export function CustomersPage() {
  const { user: currentUser } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // RBAC Permission checks
  const canCreateCustomers = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'customers', 'canCreate') : false;
  const canUpdateCustomers = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'customers', 'canUpdate') : false;
  const canDeleteCustomers = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'customers', 'canDelete') : false;

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [projectCountFilter, setProjectCountFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  // Fetch customers with project counts
  useEffect(() => {
    async function fetchCustomers() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('customers')
          .select(`
            id,
            name,
            email,
            phone,
            projects:projects(count)
          `);

        if (error) throw error;

        const formattedCustomers: Customer[] = data.map((customer: any) => ({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          projects: customer.projects[0]?.count || 0
        }));

        setCustomers(formattedCustomers);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch customers');
      } finally {
        setLoading(false);
      }
    }

    fetchCustomers();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) {
      return; // Prevent double-clicking
    }

    setIsSubmitting(true);
    try {
      if (editingCustomer) {
        // Update customer
        await crudOperations.update('customers', editingCustomer.id, {
          name: formData.name,
          email: formData.email,
          phone: formData.phone
        });

        setCustomers(customers.map(c =>
          c.id === editingCustomer.id ? { ...c, ...formData } : c
        ));
        setEditingCustomer(null);
      } else {
        // Add new customer
        const newCustomer = await crudOperations.create('customers', {
          name: formData.name,
          email: formData.email,
          phone: formData.phone
        });

        setCustomers([...customers, {
          id: newCustomer.id,
          name: newCustomer.name,
          email: newCustomer.email,
          phone: newCustomer.phone,
          projects: 0
        }]);
        setIsAddDialogOpen(false);
      }
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setOpenPopover(null);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone
    });
  };

  const handleDelete = (customer: Customer) => {
    setDeletingCustomer(customer);
    setOpenPopover(null);
  };

  const confirmDelete = async () => {
    if (deletingCustomer) {
      try {
        await crudOperations.deleteCustomer(deletingCustomer.id);

        setCustomers(customers.filter(c => c.id !== deletingCustomer.id));
        setDeletingCustomer(null);
      } catch (err: any) {
        setError(err.message || 'Failed to delete customer');
      }
    }
  };


  const filteredAndSortedCustomers = customers
    .filter(customer => {
      if (searchTerm && !(customer.name || "").toLowerCase().includes(searchTerm.toLowerCase()) &&
          !(customer.email || "").toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      if (projectCountFilter && projectCountFilter !== "all") {
        const projectCount = customer.projects || 0;
        switch (projectCountFilter) {
          case "0":
            if (projectCount !== 0) return false;
            break;
          case "1-5":
            if (projectCount < 1 || projectCount > 5) return false;
            break;
          case "6-10":
            if (projectCount < 6 || projectCount > 10) return false;
            break;
          case "10+":
            if (projectCount <= 10) return false;
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
        case "projects":
          comparison = (a.projects || 0) - (b.projects || 0);
          break;
        case "email":
          comparison = (a.email || "").localeCompare(b.email || "");
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedCustomers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedCustomers = filteredAndSortedCustomers.slice(startIndex, endIndex);

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setProjectCountFilter("all");
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

  const activeFiltersCount = [searchTerm, projectCountFilter !== "all" ? projectCountFilter : ""].filter(Boolean).length;

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages =  5;
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const CustomerCard = ({ customer }: { customer: Customer }) => (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <h3 className="font-medium truncate">{customer.name}</h3>
            </div>
            {customer.projects !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {customer.projects} project{customer.projects !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <Popover open={openPopover === customer.id} onOpenChange={(open) => setOpenPopover(open ? customer.id : null)}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(customer)}
                  className="w-full justify-start h-10"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(customer)}
                  className="w-full justify-start h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{customer.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{customer.phone}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return <div>Loading customers...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Customers</h2>
                  <Badge variant="secondary" className="ml-2">
                    {customers.length}
                  </Badge>
                </div>

              </div>
        <div className="flex items-center gap-2">
          {canCreateCustomers && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  {"Add Customer"}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
                <DialogDescription>Create a new customer profile.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Customer Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-12"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-12"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-12"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    type="submit" 
                    className="w-full sm:w-auto"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Adding...
                      </>
                    ) : (
                      'Add Customer'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {/* Filters Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg">Filters & Search</CardTitle>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="h-5 w-5 p-0 text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 mb-4">
            <Label className="text-sm">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  handleFilterChange();
                }}
                className={`pl-10`}
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => {
                    setSearchTerm("");
                    handleFilterChange();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Project Count</Label>
              <Select value={projectCountFilter} onValueChange={(value) => {
                setProjectCountFilter(value);
                handleFilterChange();
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Any count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any count</SelectItem>
                  <SelectItem value="0">No projects</SelectItem>
                  <SelectItem value="1-5">1-5 projects</SelectItem>
                  <SelectItem value="6-10">6-10 projects</SelectItem>
                  <SelectItem value="10+">10+ projects</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="projects">Projects</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              <span>
                Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedCustomers.length)} of {filteredAndSortedCustomers.length} customers
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Customers</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAndSortedCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              <p className="text-muted-foreground mb-4">
                {activeFiltersCount > 0 ? "No customers match your filters" : "No customers found"}
              </p>
              {activeFiltersCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Customer Name
                          <SortIcon column="name" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort("email")}
                      >
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                          <SortIcon column="email" />
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort("projects")}
                      >
                        <div className="flex items-center gap-2">
                          Projects
                          <SortIcon column="projects" />
                        </div>
                      </TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCustomers.map((customer) => (
                      <TableRow key={customer.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell className="max-w-xs truncate">{customer.email}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>
                          {customer.projects !== undefined && (
                            <Badge variant="secondary">
                              {customer.projects} project{customer.projects !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(customer)}
                              className="w-full justify-start h-8"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(customer)}
                              className="w-full justify-start h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center pt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {getVisiblePages().map((page, index) => (
                        <PaginationItem key={index}>
                          {page === '...' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(page as number)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingCustomer && (
        <Dialog open={true} onOpenChange={() => setEditingCustomer(null)}>
          <DialogContent className="w-[95vw] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
              <DialogDescription>Update customer information.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Customer Name</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-12"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-12"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-12"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  className="w-full sm:w-auto"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    'Update Customer'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCustomer} onOpenChange={() => setDeletingCustomer(null)}>
        <AlertDialogContent className="w-[95vw] max-w-md mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the customer
              "{deletingCustomer?.name}" and their associated user account. 
              All projects linked to this customer will be unlinked (customer_id set to NULL).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}