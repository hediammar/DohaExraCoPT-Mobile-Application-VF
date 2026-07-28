import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { UserHeader } from "./UserHeader";
import { LayoutDashboard, Users, FolderOpen, Package, RefreshCw, Upload, AlertTriangle, Wifi, WifiOff, Layers, PackagePlus, UserCog, Menu, X, Building2, Building, LogOut, FileText } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { canAccessNavigation } from "../utils/rolePermissions";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const location = useLocation();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (!initialized) {
      initializeApp();
    }
  }, [initialized]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('mobile-menu-open');
    } else {
      document.body.classList.remove('mobile-menu-open');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('mobile-menu-open');
    };
  }, [mobileMenuOpen]);

  const initializeApp = async () => {
    if (initialized) return;
    
    try {
      setLoading(true);
      setError(null);
      console.log('Initializing application with Supabase...');

      // Since we're using Supabase directly, we don't need complex connection management
      // Just set initialized to true
      setInitialized(true);
      console.log('Application initialized successfully with Supabase');
      
    } catch (error) {
      console.warn('Error during initialization:', error);
      setError('Unable to initialize application. Please check your connection.');
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  const handleRetryConnection = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Attempting to retry connection...');
      
      // Reset initialization state to force a retry
      setInitialized(false);
      
      // Try to initialize again
      await initializeApp();
      
    } catch (error) {
      console.error('Error retrying connection:', error);
      setError('Failed to reconnect. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // Define all possible navigation items with access keys
  const allNavigationItems = [
    { id: '/', label: 'Dashboard', icon: LayoutDashboard, accessKey: 'dashboard' as const },
    { id: '/projects', label: 'Projects', icon: FolderOpen, accessKey: 'projects' as const },
    { id: '/buildings', label: 'Buildings', icon: Building2, accessKey: 'buildings' as const },
    { id: '/facades', label: 'Facades', icon: Building, accessKey: 'facades' as const },
    { id: '/panels', label: 'Panels', icon: Package, accessKey: 'panels' as const },
    { id: '/customers', label: 'Customers', icon: Users, accessKey: 'customers' as const },
    { id: '/panel-groups', label: 'Panel Groups', icon: Layers, accessKey: 'panelGroups' as const },
    { id: '/notes', label: 'Notes', icon: FileText, accessKey: 'notes' as const },
    { id: '/users', label: 'User Management', icon: UserCog, accessKey: 'users' as const },
  ];

  // Filter navigation items based on user role using centralized permissions
  const navigationItems = allNavigationItems.filter(item => 
    canAccessNavigation(currentUser?.role as any, item.accessKey)
  );

  const renderNavigationItem = (item: typeof navigationItems[0]) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.id;
    
    const buttonContent = (
      <div className={`qatar-nav-item ${isActive ? 'qatar-nav-item-active' : ''} ${sidebarCollapsed ? 'justify-center' : ''}`}>
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
      </div>
    );

    if (sidebarCollapsed) {
      return (
        <TooltipProvider key={item.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to={item.id} className="block" onClick={closeMobileMenu}>
                {buttonContent}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover text-popover-foreground">
              <p>{item.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Link key={item.id} to={item.id} className="block" onClick={closeMobileMenu}>
        {buttonContent}
      </Link>
    );
  };

  // Show loading spinner during initial app loading
  if (loading && !initialized) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin text-primary" />
          <div className="space-y-2">
            <h2 className="text-lg text-foreground">Initializing Qatar Panel Tracker</h2>
            <p className="text-sm text-muted-foreground">Connecting to server...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex relative">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <div className={`
        ${sidebarCollapsed ? 'w-16' : 'w-64'} 
        qatar-sidebar 
        flex flex-col h-full transition-all duration-300 ease-in-out
        md:relative md:translate-x-0
        ${mobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 translate-x-0' : 'fixed inset-y-0 left-0 z-50 -translate-x-full'}
      `}>
        {/* Sidebar Header */}
        <div className="qatar-sidebar-header">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} mb-2`}>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <Package className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="qatar-sidebar-brand">Qatar Panels</h1>
                    <p className="qatar-sidebar-subtitle">Qatar Panel Tracker</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              {/* Mobile close button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={closeMobileMenu}
                className="md:hidden w-10 h-10 p-0 flex-shrink-0 text-sidebar-foreground hover:bg-sidebar-accent"
                title="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
              {/* Desktop toggle button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className={`hidden md:flex ${sidebarCollapsed ? 'w-10 h-10 p-0' : 'ml-2 w-10 h-10 p-0'} flex-shrink-0 text-sidebar-foreground hover:bg-sidebar-accent`}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? (
                  <Menu className="h-5 w-5" />
                ) : (
                  <X className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className={`flex-1 px-4 ${sidebarCollapsed ? 'flex flex-col items-center px-2' : ''}`}>
          <div className="space-y-1">
            {/* Application section header */}
            {!sidebarCollapsed && (
              <div className="px-4 py-1">
                <p className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider">Application</p>
              </div>
            )}
            <div className="space-y-1">
              {navigationItems.map(renderNavigationItem)}
            </div>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* User Header - Sticky at top */}
        <UserHeader onMobileMenuToggle={toggleMobileMenu} />

        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/50 border-b border-red-700/50 text-red-200 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex-1 pr-2 text-sm">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setError(null)}
                className="flex-shrink-0 border-red-600 text-red-200 hover:bg-red-800"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}
        
        {/* Scrollable Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-background">
          <div className="qatar-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}