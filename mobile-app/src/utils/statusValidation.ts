export const PANEL_STATUSES = [
  "Issued For Production",
  "Produced", 
  "Proceed for Delivery",
  "Delivered",
  "Approved Material",
  "Rejected Material",
  "Installed",
  "Inspected",
  "Approved Final",
  "On Hold",
  "Cancelled",
  "Broken at Site",
] as const;

export type PanelStatus = (typeof PANEL_STATUSES)[number];

// Define the valid status flow - each status can only move to specific next statuses
// NO BACKWARD TRANSITIONS ALLOWED - only forward progression
export const STATUS_FLOW: Record<number, number[]> = {
  0: [1, 9, 10], // Issued For Production -> Produced, On Hold, Cancelled
  1: [2, 9, 10], // Produced -> Proceed for Delivery, On Hold, Cancelled
  2: [3, 9, 10], // Proceed for Delivery -> Delivered, On Hold, Cancelled
  3: [4, 5, 9, 10], // Delivered -> Approved Material, Rejected Material, On Hold, Cancelled
  4: [6, 9, 10], // Approved Material -> Installed, On Hold, Cancelled
  5: [9, 10], // Rejected Material -> On Hold, Cancelled (NO rework to Issued For Production)
  6: [7, 9, 10], // Installed -> Inspected, On Hold, Cancelled
  7: [8, 9, 10], // Inspected -> Approved Final, On Hold, Cancelled
  8: [9, 10], // Approved Final -> On Hold, Cancelled (final status)
  9: [1, 2, 3, 4, 5, 6, 7, 8, 11, 10], // On Hold -> can resume to any status except Issued For Production (0) and itself, or cancel
  10: [], // Cancelled -> terminal status, no further transitions
  11: [9, 10], // Broken at Site -> On Hold, Cancelled (NO rework to Issued For Production)
};

// Special statuses that can be set from any status (emergency/administrative)
export const SPECIAL_STATUSES = [9, 10, 11]; // On Hold, Cancelled, Broken at Site

// Role-based status change restrictions based on the table
// Each role can only change to specific statuses (following the status flow logic)
export const ROLE_STATUS_RESTRICTIONS: Record<string, number[]> = {
  'Data Entry': [0, 9, 10], // Issued For Production, On Hold, Cancelled
  'Production engineer': [1], // Produced
  'Site Engineer': [7], // Inspected
  'QC Site': [4, 5, 8], // Approved Material, Rejected Material, Approved Final
  'QC Factory': [2], // Proceed for Delivery
  'Store Site': [3, 11], // Delivered, Broken at Site
  'Foreman Site': [6], // Installed
};

/**
 * Validates if a status transition is allowed based on user role
 * @param currentStatus - The current status index
 * @param newStatus - The proposed new status index
 * @param userRole - The user's role
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateStatusTransitionWithRole(
  currentStatus: number, 
  newStatus: number, 
  userRole: string
): { isValid: boolean; error?: string } {
  // Validate input parameters
  if (currentStatus === undefined || currentStatus === null || newStatus === undefined || newStatus === null) {
    return { isValid: false, error: "Invalid status values provided" };
  }

  // Validate that status indices are within bounds
  if (currentStatus < 0 || currentStatus >= PANEL_STATUSES.length || newStatus < 0 || newStatus >= PANEL_STATUSES.length) {
    return { isValid: false, error: "Status index out of bounds" };
  }

  // Administrator can jump to any forward status (not backward)
  if (userRole === 'Administrator') {
    return validateAdministratorTransition(currentStatus, newStatus);
  }

  // Data Entry can only move to next status in the flow (not any status)
  if (userRole === 'Data Entry') {
    return validateStatusTransition(currentStatus, newStatus);
  }

  // Check if user has permission to change to this specific status
  const allowedStatuses = ROLE_STATUS_RESTRICTIONS[userRole];
  if (!allowedStatuses) {
    return { isValid: false, error: `Role "${userRole}" is not authorized to change panel status` };
  }

  // Check if the new status is in the role's allowed statuses
  if (!allowedStatuses.includes(newStatus)) {
    const newStatusName = PANEL_STATUSES[newStatus];
    const allowedStatusNames = allowedStatuses.map(index => PANEL_STATUSES[index]);
    return { 
      isValid: false, 
      error: `Role "${userRole}" cannot change status to "${newStatusName}". Allowed statuses: ${allowedStatusNames.join(", ")}` 
    };
  }

  // Now check if the transition follows the status flow logic
  return validateStatusTransition(currentStatus, newStatus);
}

/**
 * Gets valid next statuses for a given current status and user role
 * @param currentStatus - The current status index
 * @param userRole - The user's role
 * @returns Array of valid next status indices
 */
export function getValidNextStatusesForRole(currentStatus: number, userRole: string): number[] {
  // Administrator can jump to any forward status (not backward)
  if (userRole === 'Administrator') {
    return getAllForwardStatuses(currentStatus);
  }

  // Data Entry can only move to next status in the flow (not any status)
  if (userRole === 'Data Entry') {
    return getValidNextStatuses(currentStatus);
  }

  // Get role's allowed statuses
  const allowedStatuses = ROLE_STATUS_RESTRICTIONS[userRole];
  if (!allowedStatuses) {
    return [];
  }

  // Get valid next statuses from status flow
  const validNextStatuses = getValidNextStatuses(currentStatus);
  
  // Filter to only include statuses that the role is allowed to change to
  return validNextStatuses.filter(status => allowedStatuses.includes(status));
}

/**
 * Validates if a status transition is allowed for Administrator (forward-only)
 * @param currentStatus - The current status index
 * @param newStatus - The proposed new status index
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateAdministratorTransition(currentStatus: number, newStatus: number): { isValid: boolean; error?: string } {
  // Validate input parameters
  if (currentStatus === undefined || currentStatus === null || newStatus === undefined || newStatus === null) {
    return { isValid: false, error: "Invalid status values provided" };
  }

  // Validate that status indices are within bounds
  if (currentStatus < 0 || currentStatus >= PANEL_STATUSES.length || newStatus < 0 || newStatus >= PANEL_STATUSES.length) {
    return { isValid: false, error: "Status index out of bounds" };
  }

  // Same status is not allowed
  if (currentStatus === newStatus) {
    return { isValid: false, error: "Cannot change to the same status" };
  }

  // Special statuses (On Hold, Cancelled, Broken at Site) can be set from any status
  if (SPECIAL_STATUSES.includes(newStatus)) {
    return { isValid: true };
  }

  // Administrator can only move forward (newStatus > currentStatus)
  if (newStatus <= currentStatus) {
    const currentStatusName = PANEL_STATUSES[currentStatus];
    const newStatusName = PANEL_STATUSES[newStatus];
    return { 
      isValid: false, 
      error: `Administrator cannot move backward from "${currentStatusName}" to "${newStatusName}". Only forward transitions are allowed.` 
    };
  }

  return { isValid: true };
}

/**
 * Validates if a status transition is allowed
 * @param currentStatus - The current status index
 * @param newStatus - The proposed new status index
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateStatusTransition(currentStatus: number, newStatus: number): { isValid: boolean; error?: string } {
  // Validate input parameters
  if (currentStatus === undefined || currentStatus === null || newStatus === undefined || newStatus === null) {
    return { isValid: false, error: "Invalid status values provided" };
  }

  // Validate that status indices are within bounds
  if (currentStatus < 0 || currentStatus >= PANEL_STATUSES.length || newStatus < 0 || newStatus >= PANEL_STATUSES.length) {
    return { isValid: false, error: "Status index out of bounds" };
  }

  // Same status is not allowed
  if (currentStatus === newStatus) {
    return { isValid: false, error: "Cannot change to the same status" };
  }

  // Special statuses (On Hold, Cancelled) can be set from any status
  if (SPECIAL_STATUSES.includes(newStatus)) {
    return { isValid: true };
  }

  // Check if the transition is allowed in the status flow
  const allowedTransitions = STATUS_FLOW[currentStatus];
  if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
    const currentStatusName = PANEL_STATUSES[currentStatus];
    const newStatusName = PANEL_STATUSES[newStatus];
    const allowedStatusNames = allowedTransitions ? allowedTransitions.map(index => PANEL_STATUSES[index]) : [];
    
    return { 
      isValid: false, 
      error: `Cannot change from "${currentStatusName}" to "${newStatusName}". Allowed transitions: ${allowedStatusNames.join(", ")}` 
    };
  }

  return { isValid: true };
}

/**
 * Gets all valid next statuses for a given current status
 * @param currentStatus - The current status index
 * @returns Array of valid next status indices
 */
export function getValidNextStatuses(currentStatus: number): number[] {
  return STATUS_FLOW[currentStatus] || [];
}

/**
 * Gets all valid next status names for a given current status
 * @param currentStatus - The current status index
 * @returns Array of valid next status names
 */
export function getValidNextStatusNames(currentStatus: number): string[] {
  return getValidNextStatuses(currentStatus).map(index => PANEL_STATUSES[index]);
}

/**
 * Gets all forward statuses for Administrator (any status that comes after current status)
 * @param currentStatus - The current status index
 * @returns Array of all forward status indices
 */
export function getAllForwardStatuses(currentStatus: number): number[] {
  const allStatuses = PANEL_STATUSES.map((_, index) => index);
  
  // Return all statuses that are greater than current status (forward only)
  // Plus special statuses (On Hold, Cancelled, Broken at Site) which can be set from any status
  const forwardStatuses = allStatuses.filter(status => status > currentStatus);
  const specialStatuses = SPECIAL_STATUSES.filter(status => status !== currentStatus);
  
  return [...new Set([...forwardStatuses, ...specialStatuses])].sort((a, b) => a - b);
}

/**
 * Checks if a status is terminal (no further transitions allowed)
 * @param status - The status index to check
 * @returns True if the status is terminal
 */
export function isTerminalStatus(status: number): boolean {
  return STATUS_FLOW[status].length === 0;
}

/**
 * Checks if a status is special (can be set from any status)
 * @param status - The status index to check
 * @returns True if the status is special
 */
export function isSpecialStatus(status: number): boolean {
  return SPECIAL_STATUSES.includes(status);
}

/**
 * Gets valid next statuses for Admin/Data Entry when coming from On Hold
 * @param previousStatus - The status before it was put on hold
 * @returns Array of valid next status indices
 */
export function getValidStatusesFromOnHold(previousStatus: number | null): number[] {
  const cancelledStatusIndex = PANEL_STATUSES.indexOf('Cancelled');
  const brokenAtSiteStatusIndex = PANEL_STATUSES.indexOf('Broken at Site');
  
  const allowedStatuses = [cancelledStatusIndex, brokenAtSiteStatusIndex];
  
  // Only allow resuming to the same status or forward statuses, never backward
  if (previousStatus !== null) {
    // Get all valid next statuses from the previous status
    const validNextFromPrevious = getValidNextStatuses(previousStatus);
    allowedStatuses.push(...validNextFromPrevious);
    
    // Also allow the previous status itself (resuming from hold)
    if (!allowedStatuses.includes(previousStatus)) {
      allowedStatuses.push(previousStatus);
    }
  }
  
  return [...new Set(allowedStatuses)]; // Remove duplicates
}
