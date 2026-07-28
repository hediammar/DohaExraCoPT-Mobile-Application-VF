import { StackNavigationProp } from '@react-navigation/stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

// Define the parameter list for the root stack navigator
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  History: undefined;
  Scanner: undefined;
};

// Define the parameter list for the tab navigator
export type MainTabParamList = {
  PanelGroups: undefined;
  Scanner: undefined;
  Notes: undefined;
  Profile: undefined;
  Projects: undefined;
};

// Define parameter lists for each tab's stack navigator
export type ProjectStackParamList = {
  ProjectManagement: undefined;
  ProjectDetails: { projectId: string };
  BuildingDetails: { buildingId: string };
  FacadeDetails: { facadeId: string };
  PanelDetails: { panelId: string };
};

export type ScannerStackParamList = {
  QRScanner: undefined;
  PanelDetails: { panelId: string };
  StatusUpdate: { panelId: string };
};

export type HistoryStackParamList = {
  HistoryMain: undefined;
  ViewScans: undefined;
};

export type NotesStackParamList = {
  NotesMain: undefined;
  NoteDetails: { noteId: string };
  PanelDetails: { panelId: string };
};

export type PanelGroupsStackParamList = {
  PanelGroupsMain: undefined;
  PanelGroupDetails: { groupId: string };
  PanelDetails: { panelId: string };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
};

// Navigation prop types
export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;
export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;
export type ProjectStackNavigationProp = StackNavigationProp<ProjectStackParamList>;
export type ScannerStackNavigationProp = StackNavigationProp<ScannerStackParamList>;
export type HistoryStackNavigationProp = StackNavigationProp<HistoryStackParamList>;
export type NotesStackNavigationProp = StackNavigationProp<NotesStackParamList>;
export type PanelGroupsStackNavigationProp = StackNavigationProp<PanelGroupsStackParamList>;
export type ProfileStackNavigationProp = StackNavigationProp<ProfileStackParamList>;

// Combined navigation prop for screens that are part of the main tabs
export type MainTabScreenNavigationProp = CompositeNavigationProp<
  MainTabNavigationProp,
  RootStackNavigationProp
>;

// Combined navigation prop for project-related screens
export type ProjectScreenNavigationProp = CompositeNavigationProp<
  ProjectStackNavigationProp,
  CompositeNavigationProp<MainTabNavigationProp, RootStackNavigationProp>
>;

// Combined navigation prop for scanner-related screens
export type ScannerScreenNavigationProp = CompositeNavigationProp<
  ScannerStackNavigationProp,
  CompositeNavigationProp<MainTabNavigationProp, RootStackNavigationProp>
>;
