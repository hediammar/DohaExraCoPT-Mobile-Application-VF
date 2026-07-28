import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccessNavigation } from '../utils/rolePermissions';

interface RoleBasedRedirectProps {
  children: React.ReactNode;
}

export const RoleBasedRedirect: React.FC<RoleBasedRedirectProps> = ({ children }) => {
  const { user } = useAuth();

  // If no user, let the normal auth flow handle it
  if (!user) {
    return <>{children}</>;
  }

  // For Customer role, redirect to projects page since they can't access dashboard
  if (user.role === 'Customer') {
    return <Navigate to="/projects" replace />;
  }

  // For other roles, check if they have dashboard access
  if (!canAccessNavigation(user.role as any, 'dashboard')) {
    // Find the first accessible page for this role
    const accessiblePages = [
      { path: '/projects', key: 'projects' as const },
      { path: '/panels', key: 'panels' as const },
      { path: '/buildings', key: 'buildings' as const },
      { path: '/facades', key: 'facades' as const },
      { path: '/customers', key: 'customers' as const },
      { path: '/panel-groups', key: 'panelGroups' as const },
      { path: '/notes', key: 'notes' as const },
    ];

    for (const page of accessiblePages) {
      if (canAccessNavigation(user.role as any, page.key)) {
        return <Navigate to={page.path} replace />;
      }
    }
  }

  // If user has dashboard access, show the dashboard
  return <>{children}</>;
};
