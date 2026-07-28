import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectManagement } from '../components/ProjectManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AlertCircle, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission, isCustomerRole, UserRole } from '../utils/rolePermissions';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // RBAC Permission checks
  const canCreateProjects = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'projects', 'canCreate') : false;
  const canUpdateProjects = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'projects', 'canUpdate') : false;
  const canDeleteProjects = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'projects', 'canDelete') : false;
  const isCustomer = currentUser?.role ? isCustomerRole(currentUser.role as UserRole) : false;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (showRetrying = false) => {
    try {
      if (showRetrying) {
        setIsRetrying(true);
      } else {
        setLoading(true);
      }
      setError(null);

      console.log('Loading projects data...');
      
      // Since ProjectManagement handles its own data loading, we don't need to load data here
      setProjects([]);
      setCustomers([]);
      
      console.log('Data loading handled by ProjectManagement component');

    } catch (err) {
      console.error('Error loading projects data:', err);
      setError('Failed to load data. Please check your connection and try again.');
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  const handleRetry = () => {
    loadData(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectManagement/>
    </div>
  );
}