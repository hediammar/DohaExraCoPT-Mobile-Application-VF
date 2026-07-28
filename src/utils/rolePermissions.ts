// Centralized role-based access control permissions
// This file defines all role permissions and utility functions for the Qatar Panel Tracker

export type UserRole = 
  | 'Administrator'
  | 'Data Entry'
  | 'Production engineer'
  | 'QC Factory'
  | 'Store Site'
  | 'QC Site'
  | 'Foreman Site'
  | 'Site Engineer'
  | 'Customer';

export interface RolePermissions {
  // Resource permissions
  users: {
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
  projects: {
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canBulkImport?: boolean;
    customerSpecific?: boolean; // For customer role - only see their own projects
  };
  customers: {
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
  buildings: {
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
  facades: {
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
  panels: {
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canBulkImport?: boolean;
    canChangeStatus?: boolean;
  };
  panelGroups: {
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
  notes: {
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
  // Navigation permissions
  navigation: {
    dashboard: boolean;
    projects: boolean;
    buildings: boolean;
    facades: boolean;
    panels: boolean;
    customers: boolean;
    panelGroups: boolean;
    notes: boolean;
    users: boolean;
    bulkImport: boolean;
  };
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  'Administrator': {
    users: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    projects: { canCreate: true, canRead: true, canUpdate: true, canDelete: true, canBulkImport: true },
    customers: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    buildings: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    facades: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    panels: { canCreate: true, canRead: true, canUpdate: true, canDelete: true, canBulkImport: true, canChangeStatus: true },
    panelGroups: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    notes: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    navigation: {
      dashboard: true,
      projects: true,
      buildings: true,
      facades: true,
      panels: true,
      customers: true,
      panelGroups: true,
      notes: true,
      users: true,
      bulkImport: true,
    },
  },
  'Data Entry': {
    users: { canCreate: false, canRead: false, canUpdate: false, canDelete: false },
    projects: { canCreate: true, canRead: true, canUpdate: true, canDelete: true, canBulkImport: true },
    customers: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    buildings: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    facades: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    panels: { canCreate: true, canRead: true, canUpdate: true, canDelete: true, canBulkImport: true, canChangeStatus: true },
    panelGroups: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    notes: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    navigation: {
      dashboard: true,
      projects: true,
      buildings: true,
      facades: true,
      panels: true,
      customers: true,
      panelGroups: true,
      notes: true,
      users: false,
      bulkImport: true,
    },
  },
  'Customer': {
    users: { canCreate: false, canRead: false, canUpdate: false, canDelete: false },
    projects: { canCreate: false, canRead: true, canUpdate: false, canDelete: false, customerSpecific: true },
    customers: { canCreate: false, canRead: false, canUpdate: false, canDelete: false },
    buildings: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    facades: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    panels: { canCreate: false, canRead: true, canUpdate: false, canDelete: false, canBulkImport: false, canChangeStatus: false },
    panelGroups: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    notes: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    navigation: {
      dashboard: false,
      projects: true,
      buildings: false,
      facades: false,
      panels: true,
      customers: false,
      panelGroups: false,
      notes: false,
      users: false,
      bulkImport: false,
    },
  },
  'Production engineer': {
    users: { canCreate: false, canRead: false, canUpdate: false, canDelete: false },
    projects: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    customers: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    buildings: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    facades: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    panels: { canCreate: false, canRead: true, canUpdate: false, canDelete: false, canBulkImport: false, canChangeStatus: true },
    panelGroups: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    notes: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    navigation: {
      dashboard: true,
      projects: true,
      buildings: true,
      facades: true,
      panels: true,
      customers: true,
      panelGroups: true,
      notes: true,
      users: false,
      bulkImport: false,
    },
  },
  'QC Factory': {
    users: { canCreate: false, canRead: false, canUpdate: false, canDelete: false },
    projects: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    customers: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    buildings: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    facades: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    panels: { canCreate: false, canRead: true, canUpdate: false, canDelete: false, canBulkImport: false, canChangeStatus: true },
    panelGroups: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    notes: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    navigation: {
      dashboard: true,
      projects: true,
      buildings: true,
      facades: true,
      panels: true,
      customers: true,
      panelGroups: true,
      notes: true,
      users: false,
      bulkImport: false,
    },
  },
  'Store Site': {
    users: { canCreate: false, canRead: false, canUpdate: false, canDelete: false },
    projects: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    customers: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    buildings: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    facades: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    panels: { canCreate: false, canRead: true, canUpdate: false, canDelete: false, canBulkImport: false, canChangeStatus: true },
    panelGroups: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    notes: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    navigation: {
      dashboard: true,
      projects: true,
      buildings: true,
      facades: true,
      panels: true,
      customers: true,
      panelGroups: true,
      notes: true,
      users: false,
      bulkImport: false,
    },
  },
  'QC Site': {
    users: { canCreate: false, canRead: false, canUpdate: false, canDelete: false },
    projects: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    customers: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    buildings: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    facades: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    panels: { canCreate: false, canRead: true, canUpdate: false, canDelete: false, canBulkImport: false, canChangeStatus: true },
    panelGroups: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    notes: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    navigation: {
      dashboard: true,
      projects: true,
      buildings: true,
      facades: true,
      panels: true,
      customers: true,
      panelGroups: true,
      notes: true,
      users: false,
      bulkImport: false,
    },
  },
  'Foreman Site': {
    users: { canCreate: false, canRead: false, canUpdate: false, canDelete: false },
    projects: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    customers: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    buildings: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    facades: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    panels: { canCreate: false, canRead: true, canUpdate: false, canDelete: false, canBulkImport: false, canChangeStatus: true },
    panelGroups: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    notes: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    navigation: {
      dashboard: true,
      projects: true,
      buildings: true,
      facades: true,
      panels: true,
      customers: true,
      panelGroups: true,
      notes: true,
      users: false,
      bulkImport: false,
    },
  },
  'Site Engineer': {
    users: { canCreate: false, canRead: false, canUpdate: false, canDelete: false },
    projects: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    customers: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    buildings: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    facades: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    panels: { canCreate: false, canRead: true, canUpdate: false, canDelete: false, canBulkImport: false, canChangeStatus: true },
    panelGroups: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    notes: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    navigation: {
      dashboard: true,
      projects: true,
      buildings: true,
      facades: true,
      panels: true,
      customers: true,
      panelGroups: true,
      notes: true,
      users: false,
      bulkImport: false,
    },
  },
};

// Utility functions for permission checking
export const hasPermission = (role: UserRole, resource: keyof Omit<RolePermissions, 'navigation'>, action: string): boolean => {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  
  const resourcePermissions = permissions[resource];
  if (!resourcePermissions) return false;
  
  return (resourcePermissions as any)[action] === true;
};

export const canAccessNavigation = (role: UserRole, page: keyof RolePermissions['navigation']): boolean => {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  
  return permissions.navigation[page] === true;
};

export const isReadOnlyRole = (role: UserRole): boolean => {
  return ['Customer'].includes(role);
};

export const canModifyData = (role: UserRole): boolean => {
  return !isReadOnlyRole(role);
};

export const canManageUsers = (role: UserRole): boolean => {
  return role === 'Administrator';
};

export const isCustomerRole = (role: UserRole): boolean => {
  return role === 'Customer';
};

export const isAdministratorRole = (role: UserRole): boolean => {
  return role === 'Administrator';
};

export const isDataEntryRole = (role: UserRole): boolean => {
  return role === 'Data Entry';
};

// Helper function to get all permissions for a role
export const getRolePermissions = (role: UserRole): RolePermissions | null => {
  return ROLE_PERMISSIONS[role] || null;
};

// Helper function to check if a role can perform any action on a resource
export const canPerformAction = (role: UserRole, resource: keyof Omit<RolePermissions, 'navigation'>, action: 'create' | 'read' | 'update' | 'delete'): boolean => {
  const actionKey = `can${action.charAt(0).toUpperCase() + action.slice(1)}` as keyof RolePermissions[typeof resource];
  return hasPermission(role, resource, actionKey);
}; 