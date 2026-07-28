// Qatar Panels Theme Colors - Matching globals.css
export const QatarColors = {
  // Primary Qatar Theme Colors
  background: '#8B2633',
  foreground: '#ffffff',
  card: '#5A1A23',
  cardForeground: '#ffffff',
  popover: '#3D111A',
  popoverForeground: '#ffffff',
  primary: '#C13B4A',
  primaryForeground: '#ffffff',
  secondary: '#7A2531',
  secondaryForeground: '#ffffff',
  muted: '#5A1A23',
  mutedForeground: '#D1B3B8',
  accent: '#9B3340',
  accentForeground: '#ffffff',
  destructive: '#DC2626',
  destructiveForeground: '#ffffff',
  border: '#7A2531',
  input: '#3D111A',
  inputBackground: '#3D111A',
  switchBackground: '#7A2531',
  ring: '#C13B4A',
  
  // Qatar theme status colors
  statusComplete: '#2D5A3D',
  statusCompleteForeground: '#A7E8B5',
  statusActive: '#C13B4A',
  statusActiveForeground: '#ffffff',
  statusOnhold: '#8B5A2D',
  statusOnholdForeground: '#F2D99F',
  statusInactive: '#5A2D31',
  statusInactiveForeground: '#D1B3B8',
  statusRejected: '#7A1F1F',
  statusRejectedForeground: '#F2A6A6',
  statusDelivered: '#2D4A5A',
  statusDeliveredForeground: '#A6CCE8',
  statusManufactured: '#5A3D2D',
  statusManufacturedForeground: '#E8C7A6',
  statusInspected: '#4A2D5A',
  statusInspectedForeground: '#C7A6E8',
  statusInstalled: '#1F4A3D',
  statusInstalledForeground: '#80E6CC',
  
  // Chart colors adapted for red theme
  chart1: '#C13B4A',
  chart2: '#2D5A3D',
  chart3: '#2D4A5A',
  chart4: '#8B5A2D',
  chart5: '#5A3D2D',
  
  // Sidebar specific to Qatar theme
  sidebar: '#3D111A',
  sidebarForeground: '#ffffff',
  sidebarPrimary: '#C13B4A',
  sidebarPrimaryForeground: '#ffffff',
  sidebarAccent: '#5A1A23',
  sidebarAccentForeground: '#ffffff',
  sidebarBorder: '#7A2531',
  sidebarRing: '#C13B4A',
  
  // Application branding
  appPrimary: '#C13B4A',
  appSecondary: '#8B2633',
  appAccent: '#9B3340',
} as const;

// Status color mapping for panels
export const PanelStatusColors: Record<number, { background: string; foreground: string }> = {
  0: { background: QatarColors.statusActive, foreground: QatarColors.statusActiveForeground }, // Issued For Production
  1: { background: QatarColors.statusManufactured, foreground: QatarColors.statusManufacturedForeground }, // Produced
  2: { background: QatarColors.statusDelivered, foreground: QatarColors.statusDeliveredForeground }, // Proceed for Delivery
  3: { background: QatarColors.statusDelivered, foreground: QatarColors.statusDeliveredForeground }, // Delivered
  4: { background: QatarColors.statusComplete, foreground: QatarColors.statusCompleteForeground }, // Approved Material
  5: { background: QatarColors.statusRejected, foreground: QatarColors.statusRejectedForeground }, // Rejected Material
  6: { background: QatarColors.statusInstalled, foreground: QatarColors.statusInstalledForeground }, // Installed
  7: { background: QatarColors.statusInspected, foreground: QatarColors.statusInspectedForeground }, // Inspected
  8: { background: QatarColors.statusComplete, foreground: QatarColors.statusCompleteForeground }, // Approved Final
  9: { background: QatarColors.statusOnhold, foreground: QatarColors.statusOnholdForeground }, // On Hold
  10: { background: QatarColors.statusInactive, foreground: QatarColors.statusInactiveForeground }, // Cancelled
  11: { background: QatarColors.statusRejected, foreground: QatarColors.statusRejectedForeground }, // Broken at Site
};

// Role color mapping
export const RoleColors = {
  'Administrator': { background: QatarColors.primary, foreground: QatarColors.primaryForeground },
  'Data Entry': { background: QatarColors.accent, foreground: QatarColors.accentForeground },
  'Production engineer': { background: QatarColors.secondary, foreground: QatarColors.secondaryForeground },
  'Site Engineer': { background: QatarColors.statusInspected, foreground: QatarColors.statusInspectedForeground },
  'QC Site': { background: QatarColors.statusComplete, foreground: QatarColors.statusCompleteForeground },
  'QC Factory': { background: QatarColors.statusDelivered, foreground: QatarColors.statusDeliveredForeground },
  'Store Site': { background: QatarColors.statusManufactured, foreground: QatarColors.statusManufacturedForeground },
  'Foreman Site': { background: QatarColors.statusInstalled, foreground: QatarColors.statusInstalledForeground },
} as const;
