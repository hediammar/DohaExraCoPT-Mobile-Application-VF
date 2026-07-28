import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Building,
  Calendar,
  Hash,
  Loader2,
  Edit,
  Plus,
  Sparkles,
  BarChart3,
  Settings,
  Zap,
  ArrowRight,
  CheckSquare,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission, UserRole } from '../utils/rolePermissions';
import * as XLSX from 'xlsx';
import { crudOperations } from '../utils/userTracking';

interface PanelImportData {
  project_name: string;
  name: string;
  type: string;
  status: string;
  date: string;
  issue_transmittal_no: string;
  dwg_no: string;
  description: string;
  unit_qty: string;
  ifp_qty_nos: string;
  ifp_qty: string;
  weight?: string;
  dimension?: string;
  building_name?: string;
  facade_name?: string;
  customer_name?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ImportResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
}

interface Building {
  id: string;
  name: string;
  project_id: string;
}

interface Facade {
  id: string;
  name: string;
  building_id?: string;
}

export function BulkImportPanelsPage() {
  const { user: currentUser } = useAuth();
  
  // Check if user has permission to bulk import panels
  const canBulkImportPanels = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panels', 'canBulkImport') : false;
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<PanelImportData[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [facades, setFacades] = useState<Facade[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPanels, setExistingPanels] = useState<{ [key: string]: any }>({});

  // RBAC Permission check
  const canCreatePanels = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panels', 'canCreate') : false;

  useEffect(() => {
    fetchProjects();
    fetchBuildings();
    fetchFacades();
    fetchCustomers();
  }, []);

  // Check if user has permission to bulk import panels
  if (!canBulkImportPanels) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600">You don't have permission to bulk import panels.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (err: any) {
      setError('Failed to fetch projects: ' + err.message);
    }
  };

  const fetchBuildings = async () => {
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select('id, name, project_id')
        .order('name');

      if (error) throw error;
      setBuildings(data || []);
    } catch (err: any) {
      console.error('Failed to fetch buildings:', err);
    }
  };

  const fetchFacades = async () => {
    try {
      const { data, error } = await supabase
        .from('facades')
        .select('id, name, building_id')
        .order('name');

      if (error) throw error;
      setFacades(data || []);
    } catch (err: any) {
      console.error('Failed to fetch facades:', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (err: any) {
      console.error('Failed to fetch customers:', err);
    }
  };

  // Helper functions for finding and creating projects, buildings, and facades
  const normalizeName = (value?: string) => (value || "").trim().toLowerCase();

  const findProjectIdByName = (name?: string): string | undefined => {
    if (!name) return undefined;
    const target = normalizeName(name);
    const match = projects.find((p) => normalizeName(p.name) === target);
    return match?.id;
  };

  const findBuildingIdByName = (name?: string, projectId?: string): string | undefined => {
    if (!name || !projectId) return undefined;
    const target = normalizeName(name);
    const match = buildings.find((b) => normalizeName(b.name) === target && b.project_id === projectId);
    return match?.id;
  };

  const findFacadeIdByName = (name?: string, buildingId?: string): string | undefined => {
    if (!name || !buildingId) return undefined;
    const target = normalizeName(name);
    const match = facades.find((f) => normalizeName(f.name) === target && f.building_id === buildingId);
    return match?.id;
  };

  // New function to find existing panel by name (without project constraint for global search)
  const findExistingPanelByName = async (panelName: string): Promise<any | null> => {
    if (!panelName?.trim()) return null;
    
    try {
      const { data, error } = await supabase
        .from('panels')
        .select(`
          *,
          projects!inner(name, customer_id),
          buildings(name),
          facades(name)
        `)
        .eq('name', panelName.trim())
        .limit(1);

      if (error) {
        console.error('Error finding existing panel:', error);
        return null;
      }

      // Return the first result if found, otherwise null
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error finding existing panel:', error);
      return null;
    }
  };

  // Function to find existing panel by name within a specific project
  const findExistingPanelByNameInProject = async (panelName: string, projectId: string): Promise<any | null> => {
    if (!panelName?.trim() || !projectId) return null;
    
    try {
      const { data, error } = await supabase
        .from('panels')
        .select(`
          *,
          projects!inner(name, customer_id),
          buildings(name),
          facades(name)
        `)
        .eq('name', panelName.trim())
        .eq('project_id', projectId)
        .limit(1);

      if (error) {
        console.error('Error finding existing panel in project:', error);
        return null;
      }

      // Return the first result if found, otherwise null
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error finding existing panel in project:', error);
      return null;
    }
  };

  const createProjectIfNotExists = async (projectName: string, customerId: string): Promise<string | null> => {
    if (!projectName) return null;
    
    // First check if project already exists
    const existingProjectId = findProjectIdByName(projectName);
    if (existingProjectId) {
      return existingProjectId;
    }

    // Create new project with default values
    try {
      const projectData = {
        name: projectName,
        customer_id: customerId, // Set the customer_id
        location: 'Unknown Location',
        status: 'active',
        start_date: new Date().toISOString().split('T')[0], // Default to today
      };

      console.log('Creating new project:', projectData);
      const newProject = await crudOperations.create("projects", projectData);
      
      // Add to local state immediately
      setProjects(prev => [...prev, { id: newProject.id, name: projectName }]);
      
      console.log('Project created successfully:', newProject.id);
      return newProject.id;
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error(`Failed to create project "${projectName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const createBuildingIfNotExists = async (buildingName: string, projectId: string): Promise<string | null> => {
    if (!buildingName || !projectId) return null;
    
    // First check if building already exists in this project
    const existingBuildingId = findBuildingIdByName(buildingName, projectId);
    if (existingBuildingId) {
      return existingBuildingId;
    }

    // Create new building
    try {
      const buildingData = {
        name: buildingName,
        project_id: projectId,
        status: 0, // Default status
        description: `Building created during bulk import for project ${projectId}`,
      };

      console.log('Creating new building:', buildingData);
      const newBuilding = await crudOperations.create("buildings", buildingData);
      
      // Add to local state
      setBuildings(prev => [...prev, { id: newBuilding.id, name: buildingName, project_id: projectId }]);
      
      console.log('Building created successfully:', newBuilding.id);
      return newBuilding.id;
    } catch (error) {
      console.error('Error creating building:', error);
      throw new Error(`Failed to create building "${buildingName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const createFacadeIfNotExists = async (facadeName: string, buildingId: string): Promise<string | null> => {
    if (!facadeName || !buildingId) return null;
    
    // First check if facade already exists in this building
    const existingFacadeId = findFacadeIdByName(facadeName, buildingId);
    if (existingFacadeId) {
      return existingFacadeId;
    }

    // Create new facade
    try {
      const facadeData = {
        name: facadeName,
        building_id: buildingId,
        status: 0, // Default status
        description: `Facade created during bulk import for building ${buildingId}`,
      };

      console.log('Creating new facade:', facadeData);
      const newFacade = await crudOperations.create("facades", facadeData);
      
      // Add to local state
      setFacades(prev => [...prev, { id: newFacade.id, name: facadeName, building_id: buildingId }]);
      
      console.log('Facade created successfully:', newFacade.id);
      return newFacade.id;
    } catch (error) {
      console.error('Error creating facade:', error);
      throw new Error(`Failed to create facade "${facadeName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const findCustomerIdByName = (name?: string): string | undefined => {
    if (!name) return undefined;
    const target = normalizeName(name);
    const match = customers.find((c) => normalizeName(c.name) === target);
    return match?.id;
  };

  const createCustomerIfNotExists = async (customerName: string): Promise<string | null> => {
    if (!customerName) return null;
    
    // First check if customer already exists
    const existingCustomerId = findCustomerIdByName(customerName);
    if (existingCustomerId) {
      return existingCustomerId;
    }

    // Create new customer
    try {
      const customerData = {
        name: customerName,
        email: `${customerName.toLowerCase().replace(/\s+/g, '.')}@example.com`, // Generate default email
        phone: '+974-0000-0000', // Default Qatar phone number
      };

      console.log('Creating new customer:', customerData);
      const newCustomer = await crudOperations.create("customers", customerData);
      
      // Add to local state
      setCustomers(prev => [...prev, { id: newCustomer.id, name: customerName }]);
      
      console.log('Customer created successfully:', newCustomer.id);
      return newCustomer.id;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw new Error(`Failed to create customer "${customerName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const downloadTemplate = () => {
        // Create sample data
    const sampleData = [
             {
          project_name: 'Project Alpha',
          name: 'Panel A-001',
          type: 'UHPC',
          status: 'Issued for Production',
          date: '15/01/2024',
          issue_transmittal_no: 'IT-001',
          dwg_no: 'DWG-001',
          description: 'Exterior wall panel',
          unit_qty: '10.5',
          ifp_qty_nos: '5',
          ifp_qty: '52.5',
          weight: '25.5',
          dimension: '1000x500x100',
          building_name: 'Building A',
          facade_name: 'North Facade',
          customer_name: 'Al Rayyan Construction'
        },
        {
          project_name: 'Project Beta',
          name: 'Panel B-002',
          type: 'GRC',
          status: 'Produced',
          date: '01.02.2024',
          issue_transmittal_no: 'IT-002',
          dwg_no: 'DWG-002',
          description: 'Interior partition panel',
          unit_qty: '8.0',
          ifp_qty_nos: '3',
          ifp_qty: '24.0',
          weight: '18.2',
          dimension: '500x300x50',
          building_name: 'Main Tower',
          facade_name: 'East Facade',
          customer_name: 'Qatar Building Solutions'
        },
        {
          project_name: 'Project Gamma',
          name: 'Panel C-003',
          type: 'EIFS',
          status: 'Proceed for Delivery',
          date: '2024-03-01',
          issue_transmittal_no: 'IT-003',
          dwg_no: 'DWG-003',
          description: 'Roof panel',
          unit_qty: '15.0',
          ifp_qty_nos: '2',
          ifp_qty: '30.0',
          weight: '45.8',
          dimension: '2000x1000x150',
          building_name: 'Office Complex',
          facade_name: 'South Facade',
          customer_name: 'Doha Development Corp'
        }
     ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);

    // Set column headers
    const headers = [
      'project_name',
      'name',
      'type',
      'status',
      'date',
      'issue_transmittal_no',
      'dwg_no',
      'description',
      'unit_qty',
      'ifp_qty_nos',
      'ifp_qty',
      'weight',
      'dimension',
      'building_name',
      'facade_name',
      'customer_name'
    ];

    // Add headers to the first row
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });

    // Set column widths
    const colWidths = [
      { wch: 20 }, // project_name
      { wch: 15 }, // name
      { wch: 8 },  // type
      { wch: 8 },  // status
      { wch: 12 }, // date
      { wch: 18 }, // issue_transmittal_no
      { wch: 12 }, // dwg_no
      { wch: 25 }, // description
      { wch: 10 }, // unit_qty
      { wch: 12 }, // ifp_qty_nos
      { wch: 10 }, // ifp_qty
      { wch: 10 }, // weight
      { wch: 15 }, // dimension
      { wch: 15 }, // building_name
      { wch: 15 }, // facade_name
      { wch: 20 }  // customer_name
    ];
    ws['!cols'] = colWidths;

    // Add the worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Panels');

    // Generate and download the file
    XLSX.writeFile(wb, 'panels_import_template.xlsx');
  };

  const parseExcel = (file: File): Promise<PanelImportData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get the first worksheet
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          
                     // Convert to JSON - keep raw values to handle dates properly
           const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
             header: 1,
             raw: true // Keep raw values to handle dates properly
           });
          
          // Skip header row and convert to our format
          const panels: PanelImportData[] = [];
          let skippedRows = 0;
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            
            // Check if row has any meaningful data (not completely empty or whitespace-only)
            const hasData = row && row.some((cell: any) => {
              if (cell === null || cell === undefined) return false;
              if (typeof cell === 'string') {
                return cell.trim() !== '';
              }
              return true; // For numbers, dates, etc.
            });
            
            if (hasData) {
              // Extract and check essential fields
              const projectName = row[0]?.toString().trim() || '';
              const panelName = row[1]?.toString().trim() || '';
              
              // Only process rows that have at least project_name and name
              if (projectName && panelName) {
                             // Helper function to convert Excel date to proper date string
               const convertExcelDate = (cell: any): string => {
                 if (!cell) return '';
                 
                 // If it's already a string, return as is
                 if (typeof cell === 'string') {
                   return cell.trim();
                 }
                 
                 // If it's a number (Excel serial date), convert it
                 if (typeof cell === 'number' && cell > 0) {
                   // Excel serial date: number of days since January 1, 1900
                   // Use the XLSX library's built-in date conversion
                   const date = XLSX.SSF.parse_date_code(cell);
                   if (date) {
                     const day = String(date.d).padStart(2, '0');
                     const month = String(date.m).padStart(2, '0');
                     const year = date.y;
                     return `${day}/${month}/${year}`;
                   }
                 }
                 
                 return cell.toString().trim();
               };
              
              panels.push({
                project_name: projectName,
                name: panelName,
                type: row[2]?.toString().trim() || '',
                status: row[3]?.toString().trim() || '',
                date: convertExcelDate(row[4]),
                issue_transmittal_no: row[5]?.toString().trim() || '',
                dwg_no: row[6]?.toString().trim() || '',
                description: row[7]?.toString().trim() || '',
                unit_qty: row[8]?.toString().trim() || '',
                ifp_qty_nos: row[9]?.toString().trim() || '',
                ifp_qty: row[10]?.toString().trim() || '',
                weight: row[11]?.toString().trim() || undefined,
                dimension: row[12]?.toString().trim() || undefined,
                building_name: row[13]?.toString().trim() || undefined,
                facade_name: row[14]?.toString().trim() || undefined,
                customer_name: row[15]?.toString().trim() || undefined,
              });
              } else {
                // Row has data but missing essential fields (project_name or name)
                skippedRows++;
                console.log(`Skipping row ${i + 1}: Missing project_name or name`);
              }
            } else {
              // Row is completely empty
              skippedRows++;
            }
          }
          
          console.log(`Excel parsing complete: ${panels.length} valid rows, ${skippedRows} rows skipped`);
          console.log('First 3 parsed panels:', panels.slice(0, 3));
          resolve(panels);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const validateData = (data: PanelImportData[]): ValidationResult[] => {
    console.log('validateData called with', data.length, 'rows');
    return data.map((row, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Debug logging for first few rows
      if (index < 3) {
        console.log(`Validating row ${index + 1}:`, {
          name: row.name,
          project_name: row.project_name,
          type: row.type,
          status: row.status,
          date: row.date,
          unit_qty: row.unit_qty,
          ifp_qty_nos: row.ifp_qty_nos,
          ifp_qty: row.ifp_qty,
          weight: row.weight
        });
      }

      // Required field validation
      if (!row.name?.trim()) {
        errors.push('Panel name is required');
      }

      // Project name validation - check if project name exists
      if (!row.project_name?.trim()) {
        errors.push('Project name is required');
      }

      // Project name validation - removed since projects will be created automatically
      // Note: Project validation errors are removed since they will be created automatically during import

      // Date validation - only validate if date is provided
       if (row.date && row.date.trim()) {
         const dateStr = row.date.trim();
         
         // Helper function to parse date in different formats (same as import function)
         const parseDateForValidation = (dateStr: string): Date | null => {
           if (!dateStr.trim()) return null;
           
           const str = dateStr.trim();
           
           // Handle 0000-00-00 format - convert to earliest valid date
           if (str === '0000-00-00' || str === '00/00/0000' || str === '00.00.0000') {
             return new Date('1900-01-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
           }
           
           try {
             // Try different date formats
             if (str.includes('/')) {
               // Format: DD/MM/YYYY
               const parts = str.split('/');
               if (parts.length === 3) {
                 // Check for invalid date parts (00/00/YYYY or DD/00/YYYY or DD/MM/0000)
                 if (parts[0] === '00' || parts[1] === '00' || parts[2] === '0000') {
                   return new Date('1900-01-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
                 }
                 const year = parseInt(parts[2]);
                 const month = parseInt(parts[1]) - 1;
                 const day = parseInt(parts[0]);
                 
                 // Create date using UTC to avoid timezone issues
                 const date = new Date(Date.UTC(year, month, day));
                 if (!isNaN(date.getTime())) {
                   return date;
                 }
               }
             } else if (str.includes('.')) {
               // Format: DD.MM.YYYY
               const parts = str.split('.');
               if (parts.length === 3) {
                 // Check for invalid date parts (00.00.YYYY or DD.00.YYYY or DD.MM.0000)
                 if (parts[0] === '00' || parts[1] === '00' || parts[2] === '0000') {
                   return new Date('1900-01-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
                 }
                 const year = parseInt(parts[2]);
                 const month = parseInt(parts[1]) - 1;
                 const day = parseInt(parts[0]);
                 
                 // Create date using UTC to avoid timezone issues
                 const date = new Date(Date.UTC(year, month, day));
                 if (!isNaN(date.getTime())) {
                   return date;
                 }
               }
             } else if (str.includes('-')) {
               // Format: YYYY-MM-DD
               const parts = str.split('-');
               if (parts.length === 3) {
                 // Check for invalid date parts (0000-MM-DD or YYYY-00-DD or YYYY-MM-00)
                 if (parts[0] === '0000' || parts[1] === '00' || parts[2] === '00') {
                   return new Date('1900-01-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
                 }
                 const year = parseInt(parts[0]);
                 const month = parseInt(parts[1]) - 1;
                 const day = parseInt(parts[2]);
                 
                 // Create date using UTC to avoid timezone issues
                 const date = new Date(Date.UTC(year, month, day));
                 if (!isNaN(date.getTime())) {
                   return date;
                 }
               }
             }
             
             // Try parsing as ISO string
             const parsedDate = new Date(str);
             if (!isNaN(parsedDate.getTime())) {
               return parsedDate;
             }
             
             // If all else fails, return 1900-01-01
             return new Date('1900-01-01T00:00:00.000Z');
           } catch (error) {
             // If any error occurs, return 1900-01-01
             return new Date('1900-01-01T00:00:00.000Z');
           }
         };
         
         const panelDate = parseDateForValidation(dateStr);
         
         if (!panelDate || isNaN(panelDate.getTime())) {
           errors.push('Invalid date format (use DD/MM/YYYY, DD.MM.YYYY, or YYYY-MM-DD)');
         }
       }

      // Type validation - only validate if type is provided
      if (row.type && row.type.trim()) {
        const typeText = row.type.toUpperCase().trim();
        
        // Check for valid panel types
        const validTypes = ['GRC', 'GRG', 'GRP', 'EIFS', 'UHPC'];
        
        if (!validTypes.includes(typeText)) {
          errors.push(`Invalid panel type "${row.type}". Valid types are: GRC, GRG, GRP, EIFS, UHPC`);
        }
      }

      // Status validation - only validate if status is provided
      if (row.status && row.status.trim()) {
        const statusText = row.status.toLowerCase().trim();
        
        // Check for common typos and variations
        const statusVariations: { [key: string]: string } = {
          'issued for production': 'issued for production',
          'produced': 'produced',
          'inspected': 'inspected',
          'approved material': 'approved material',
          'rejected material': 'rejected material',
          'issued': 'issued',
          'proceed for delivery': 'proceed for delivery',
          'procced for delivery': 'proceed for delivery', // Handle typo
          'delivered': 'delivered',
          'installed': 'installed',
          'approved final': 'approved final',
          'broken at site': 'broken at site',
          'on hold': 'on hold',
          'cancelled': 'cancelled'
        };
        
        if (!statusVariations[statusText]) {
          warnings.push(`Status "${row.status}" is not a standard value (did you mean "Proceed for Delivery" or "Issued for Production"?)`);
        }
      }

      // Numeric validation - only validate if values are provided
      if (row.unit_qty && row.unit_qty.trim()) {
        const unitQty = Number(row.unit_qty);
        if (isNaN(unitQty)) {
          errors.push('Unit quantity must be a number');
        }
      }

      if (row.ifp_qty_nos && row.ifp_qty_nos.trim()) {
        const ifpQtyNos = Number(row.ifp_qty_nos);
        if (isNaN(ifpQtyNos)) {
          errors.push('IFP quantity numbers must be a number');
        }
      }

      if (row.ifp_qty && row.ifp_qty.trim()) {
        const ifpQty = Number(row.ifp_qty);
        if (isNaN(ifpQty)) {
          errors.push('IFP quantity must be a number');
        }
      }

      // Weight validation - only validate if weight is provided
      if (row.weight && row.weight.trim()) {
        const weight = Number(row.weight);
        if (isNaN(weight)) {
          errors.push('Weight must be a number');
        }
        if (weight < 0) {
          errors.push('Weight cannot be negative');
        }
      }

      const result = {
        isValid: errors.length === 0,
        errors,
        warnings
      };

      // Debug logging for first few rows
      if (index < 3) {
        console.log(`Validation result for row ${index + 1}:`, result);
        console.log(`Row ${index + 1} errors:`, errors);
        console.log(`Row ${index + 1} warnings:`, warnings);
      }

      return result;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setFile(file);
    setError(null);
    setParsedData([]);
    setValidationResults([]);
    setImportResults([]);
    setExistingPanels({});

    try {
      const data = await parseExcel(file);
      setParsedData(data);
      
      // Validate data first (this is fast and should happen immediately)
      console.log('About to validate data:', data.slice(0, 3)); // Show first 3 rows of parsed data
      console.log('Data type:', typeof data, 'Is array:', Array.isArray(data));
      console.log('Calling validateData function...');
      const validation = validateData(data);
      console.log('Validation completed. Results:', validation.slice(0, 3)); // Show first 3 validation results
      console.log('Parsed data length:', data.length);
      console.log('Validation results length:', validation.length);
      setValidationResults(validation);
      console.log('Validation results set in state');
      
      // Check for existing panels (optimized for large datasets) - do this after validation
      console.log('Starting existing panel check for', data.length, 'rows...');
      const existingPanelsMap: { [key: string]: any } = {};
      const uniquePanelNames = Array.from(new Set(data.map(row => row.name?.trim()).filter(Boolean)));
      console.log('Found', uniquePanelNames.length, 'unique panel names to check');
      
      // Process in batches to avoid overwhelming the API
      const batchSize = 50;
      for (let i = 0; i < uniquePanelNames.length; i += batchSize) {
        const batch = uniquePanelNames.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(uniquePanelNames.length/batchSize)}`);
        
        for (const panelName of batch) {
          const existingPanel = await findExistingPanelByName(panelName);
          if (existingPanel) {
            existingPanelsMap[panelName] = existingPanel;
          }
        }
      }
      setExistingPanels(existingPanelsMap);
      console.log('Existing panel check complete. Found', Object.keys(existingPanelsMap).length, 'existing panels');
    } catch (err: any) {
      setError('Failed to parse Excel file: ' + err.message);
    }
  };

  const importPanels = async () => {
    if (!canCreatePanels) {
      setError('You do not have permission to create panels');
      return;
    }

    const validData = parsedData.filter((_, index) => validationResults[index]?.isValid);
    if (validData.length === 0) {
      setError('No valid data to import');
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setImportResults([]);

    // Create local caches for the import session to avoid state update issues
    const localProjects = [...projects];
    const localBuildings = [...buildings];
    const localFacades = [...facades];
    const localCustomers = [...customers];

    const results: ImportResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Helper function to map status text to numeric value
    const mapStatusToNumber = (statusText: string): number => {
      if (!statusText.trim()) return 0; // Default to "Issued For Production"
      
      const status = statusText.toLowerCase().trim();
      
      // Map common status texts to numeric values (including typos)
      const statusMap: { [key: string]: number } = {
        'issued for production': 0, // "Issued For Production"
        'produced': 1, // "Produced"
        'inspected': 2, // "Inspected"
        'approved material': 3, // "Approved Material"
        'rejected material': 4, // "Rejected Material"
        'issued': 5, // "Issued"
        'proceed for delivery': 6, // "Proceed for Delivery"
        'procced for delivery': 6, // Handle typo
        'delivered': 7, // "Delivered"
        'installed': 8, // "Installed"
        'approved final': 9, // "Approved Final"
        'broken at site': 10, // "Broken at Site"
        'on hold': 11, // "On Hold"
        'cancelled': 12 // "Cancelled"
      };
      
      return statusMap[status] || 0; // Default to "Issued For Production"
    };

    // Helper function to map panel type text to numeric value
    const mapTypeToNumber = (typeText: string): number => {
      if (!typeText.trim()) return 0; // Default to "GRC"
      
      const type = typeText.toUpperCase().trim();
      
      // Map panel type texts to numeric values
      const typeMap: { [key: string]: number } = {
        'GRC': 0, // "GRC"
        'GRG': 1, // "GRG"
        'GRP': 2, // "GRP"
        'EIFS': 3, // "EIFS"
        'UHPC': 4 // "UHPC"
      };
      
      return typeMap[type] || 0; // Default to "GRC"
    };

    // Helper function to parse date in different formats
    const parseDate = (dateStr: string): Date | null => {
      if (!dateStr.trim()) return null;
      
      const str = dateStr.trim();
      
      // Handle 0000-00-00 format - convert to earliest valid date
      if (str === '0000-00-00' || str === '00/00/0000' || str === '00.00.0000') {
        return new Date('1900-01-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
      }
      
      try {
        // Try different date formats
        if (str.includes('/')) {
          // Format: DD/MM/YYYY
          const parts = str.split('/');
          if (parts.length === 3) {
            // Check for invalid date parts (00/00/YYYY or DD/00/YYYY or DD/MM/0000)
            if (parts[0] === '00' || parts[1] === '00' || parts[2] === '0000') {
              return new Date('1900-01-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
            }
            const year = parseInt(parts[2]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[0]);
            
            // Create date using UTC to avoid timezone issues
            const date = new Date(Date.UTC(year, month, day));
            if (!isNaN(date.getTime())) {
              return date;
            }
          }
        } else if (str.includes('.')) {
          // Format: DD.MM.YYYY
          const parts = str.split('.');
          if (parts.length === 3) {
            // Check for invalid date parts (00.00.YYYY or DD.00.YYYY or DD.MM.0000)
            if (parts[0] === '00' || parts[1] === '00' || parts[2] === '0000') {
              return new Date('1900-01-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
            }
            const year = parseInt(parts[2]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[0]);
            
            // Create date using UTC to avoid timezone issues
            const date = new Date(Date.UTC(year, month, day));
            if (!isNaN(date.getTime())) {
              return date;
            }
          }
        } else if (str.includes('-')) {
          // Format: YYYY-MM-DD
          const parts = str.split('-');
          if (parts.length === 3) {
            // Check for invalid date parts (0000-MM-DD or YYYY-00-DD or YYYY-MM-00)
            if (parts[0] === '0000' || parts[1] === '00' || parts[2] === '00') {
              return new Date('1900-01-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
            }
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);
            
            // Create date using UTC to avoid timezone issues
            const date = new Date(Date.UTC(year, month, day));
            if (!isNaN(date.getTime())) {
              return date;
            }
          }
        }
        
        // Try parsing as ISO string
        const parsedDate = new Date(str);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
        
        // If all else fails, return 1900-01-01
        return new Date('1900-01-01T00:00:00.000Z');
      } catch (error) {
        // If any error occurs, return 1900-01-01
        return new Date('1900-01-01T00:00:00.000Z');
      }
    };

    for (let i = 0; i < validData.length; i++) {
      const row = validData[i];
      try {
        // Helper functions that work with local caches
        const findProjectIdByNameLocal = (name?: string): string | undefined => {
          if (!name) return undefined;
          const target = normalizeName(name);
          const match = localProjects.find((p) => normalizeName(p.name) === target);
          return match?.id;
        };

        const findBuildingIdByNameLocal = (name?: string, projectId?: string): string | undefined => {
          if (!name || !projectId) return undefined;
          const target = normalizeName(name);
          const match = localBuildings.find((b) => normalizeName(b.name) === target && b.project_id === projectId);
          return match?.id;
        };

        const findFacadeIdByNameLocal = (name?: string, buildingId?: string): string | undefined => {
          if (!name || !buildingId) return undefined;
          const target = normalizeName(name);
          console.log(`Looking for facade "${name}" in building ${buildingId}`);
          console.log(`Available facades:`, localFacades.map(f => ({ name: f.name, building_id: f.building_id })));
          const match = localFacades.find((f) => normalizeName(f.name) === target && f.building_id === buildingId);
          console.log(`Found facade match:`, match ? { id: match.id, name: match.name, building_id: match.building_id } : null);
          return match?.id;
        };

        const findCustomerIdByNameLocal = (name?: string): string | undefined => {
          if (!name) return undefined;
          const target = normalizeName(name);
          const match = localCustomers.find((c) => normalizeName(c.name) === target);
          return match?.id;
        };

        // Resolve project, building, and facade IDs using local caches
        let resolvedProjectId = findProjectIdByNameLocal(row.project_name);
        let resolvedBuildingId: string | null = null;
        let resolvedFacadeId: string | null = null;

        // If project doesn't exist, create it
        if (!resolvedProjectId) {
          try {
            // First resolve customer if provided, or create a default one
            let customerId: string | null = null;
            
            if (row.customer_name && row.customer_name.trim()) {
              const existingCustomerId = findCustomerIdByNameLocal(row.customer_name);
              if (existingCustomerId) {
                customerId = existingCustomerId;
              } else {
                // Create new customer
                const customerData = {
                  name: row.customer_name,
                  email: `${row.customer_name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
                  phone: '+974-0000-0000',
                };
                const newCustomer = await crudOperations.create("customers", customerData);
                localCustomers.push({ id: newCustomer.id, name: row.customer_name });
                customerId = newCustomer.id;
              }
            } else {
              // Create a default customer for the project
              const defaultCustomerName = `${row.project_name} Customer`;
              const customerData = {
                name: defaultCustomerName,
                email: `${defaultCustomerName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
                phone: '+974-0000-0000',
              };
              const newCustomer = await crudOperations.create("customers", customerData);
              localCustomers.push({ id: newCustomer.id, name: defaultCustomerName });
              customerId = newCustomer.id;
            }

            if (!customerId) {
              throw new Error(`Failed to create or find customer for project "${row.project_name}"`);
            }

            // Create new project
            const projectData = {
              name: row.project_name,
              customer_id: customerId,
              location: 'Unknown Location',
              status: 'active',
              start_date: new Date().toISOString().split('T')[0],
            };
            const newProject = await crudOperations.create("projects", projectData);
            localProjects.push({ id: newProject.id, name: row.project_name });
            resolvedProjectId = newProject.id;
          } catch (error) {
            console.error('Error resolving project:', error);
            throw error;
          }
        }

        // If building name is provided and not empty, find or create building
        if (row.building_name && row.building_name.trim() && resolvedProjectId) {
          try {
            const existingBuildingId = findBuildingIdByNameLocal(row.building_name, resolvedProjectId);
            if (existingBuildingId) {
              resolvedBuildingId = existingBuildingId;
            } else {
              // Create new building
              const buildingData = {
                name: row.building_name,
                project_id: resolvedProjectId,
                status: 0,
                description: `Building created during bulk import for project ${resolvedProjectId}`,
              };
              const newBuilding = await crudOperations.create("buildings", buildingData);
              localBuildings.push({ id: newBuilding.id, name: row.building_name, project_id: resolvedProjectId });
              resolvedBuildingId = newBuilding.id;
            }
          } catch (error) {
            console.error('Error resolving building:', error);
            throw error;
          }
        } else {
          // Explicitly set to null if building_name is empty or not provided
          resolvedBuildingId = null;
        }

        // If facade name is provided and not empty, find or create facade
        if (row.facade_name && row.facade_name.trim() && resolvedBuildingId) {
          try {
            console.log(`Resolving facade for panel ${row.name}: facade_name="${row.facade_name}", building_id="${resolvedBuildingId}"`);
            const existingFacadeId = findFacadeIdByNameLocal(row.facade_name, resolvedBuildingId);
            if (existingFacadeId) {
              console.log(`Using existing facade ID: ${existingFacadeId}`);
              resolvedFacadeId = existingFacadeId;
            } else {
              // Create new facade
              const facadeData = {
                name: row.facade_name,
                building_id: resolvedBuildingId,
                status: 0,
                description: `Facade created during bulk import for building ${resolvedBuildingId}`,
              };
              const newFacade = await crudOperations.create("facades", facadeData);
              localFacades.push({ id: newFacade.id, name: row.facade_name, building_id: resolvedBuildingId });
              resolvedFacadeId = newFacade.id;
            }
          } catch (error) {
            console.error('Error resolving facade:', error);
            throw error;
          }
        } else {
          // Explicitly set to null if facade_name is empty or not provided
          resolvedFacadeId = null;
        }

        if (!resolvedProjectId) {
          results.push({
            success: false,
            message: `Failed to resolve project for "${row.name}". Project "${row.project_name}" not found and could not be created.`,
            errors: [`Project "${row.project_name}" not found.`]
          });
          errorCount++;
          continue;
        }

        // Check if panel already exists in the same project
        const existingPanel = await findExistingPanelByNameInProject(row.name, resolvedProjectId);

        if (existingPanel) {
          console.log(`Panel "${row.name}" already exists. Updating...`);
          
          const updateData = {
            name: row.name.trim(),
            type: mapTypeToNumber(row.type),
            status: mapStatusToNumber(row.status),
            project_id: resolvedProjectId,
            building_id: resolvedBuildingId,
            facade_id: resolvedFacadeId,
            issue_transmittal_no: row.issue_transmittal_no?.trim() || null,
            drawing_number: row.dwg_no?.trim() || null,
            unit_rate_qr_m2: row.unit_qty?.trim() ? parseFloat(row.unit_qty) : null,
            ifp_qty_area_sm: row.ifp_qty?.trim() ? parseFloat(row.ifp_qty) : null,
            ifp_qty_nos: row.ifp_qty_nos?.trim() ? parseInt(row.ifp_qty_nos) : null,
            weight: row.weight?.trim() ? parseFloat(row.weight) : null,
            dimension: row.dimension?.trim() || null,
            issued_for_production_date: row.date?.trim() ? (() => {
              const parsedDate = parseDate(row.date);
              if (!parsedDate) return null;
              // Format as YYYY-MM-DD string for Supabase
              const year = parsedDate.getUTCFullYear();
              const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
              const day = String(parsedDate.getUTCDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            })() : null,
            user_id: currentUser?.id || null
          };

          const { data: updatedPanel, error: updateError } = await supabase
            .from('panels')
            .update(updateData)
            .eq('id', existingPanel.id)
            .select()
            .single();

          if (updateError) {
            results.push({
              success: false,
              message: `Failed to update panel "${row.name}". ${updateError.message}`,
              errors: [updateError.message]
            });
            errorCount++;
          } else {
            results.push({
              success: true,
              message: `Successfully updated panel "${row.name}"`,
              data: updatedPanel
            });
            successCount++;
          }
        } else {
          console.log('Creating new panel with data:', row.name);
          
          const panelData = {
            name: row.name.trim(),
            type: mapTypeToNumber(row.type),
            status: mapStatusToNumber(row.status),
            project_id: resolvedProjectId,
            building_id: resolvedBuildingId,
            facade_id: resolvedFacadeId,
            issue_transmittal_no: row.issue_transmittal_no?.trim() || null,
            drawing_number: row.dwg_no?.trim() || null,
            unit_rate_qr_m2: row.unit_qty?.trim() ? parseFloat(row.unit_qty) : null,
            ifp_qty_area_sm: row.ifp_qty?.trim() ? parseFloat(row.ifp_qty) : null,
            ifp_qty_nos: row.ifp_qty_nos?.trim() ? parseInt(row.ifp_qty_nos) : null,
            weight: row.weight?.trim() ? parseFloat(row.weight) : null,
            dimension: row.dimension?.trim() || null,
            issued_for_production_date: row.date?.trim() ? (() => {
              const parsedDate = parseDate(row.date);
              if (!parsedDate) return null;
              // Format as YYYY-MM-DD string for Supabase
              const year = parsedDate.getUTCFullYear();
              const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
              const day = String(parsedDate.getUTCDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            })() : null,
            user_id: currentUser?.id || null
          };

          // Insert panel
          const { data: newPanel, error } = await supabase
            .from('panels')
            .insert(panelData)
            .select()
            .single();

          if (error) {
            results.push({
              success: false,
              message: `Failed to import "${row.name}"`,
              errors: [error.message]
            });
            errorCount++;
          } else {
            results.push({
              success: true,
              message: `Successfully imported "${row.name}"`,
              data: newPanel
            });
            successCount++;
          }
        }
      } catch (err: any) {
        results.push({
          success: false,
          message: `Failed to import "${row.name}"`,
          errors: [err.message]
        });
        errorCount++;
      }

      setProgress(((i + 1) / validData.length) * 100);
      setImportResults([...results]);
    }

    // Update the global state with the local caches
    setProjects(localProjects);
    setBuildings(localBuildings);
    setFacades(localFacades);
    setCustomers(localCustomers);

    setIsImporting(false);
    setProgress(100);

    // Show summary
    const summary = `Import completed: ${successCount} successful, ${errorCount} failed`;
    if (errorCount > 0) {
      setError(summary);
    } else {
      setError(null);
    }
  };

  const resetForm = () => {
    setFile(null);
    setParsedData([]);
    setValidationResults([]);
    setImportResults([]);
    setProgress(0);
    setError(null);
  };

  const totalRows = parsedData.length;
  const validRows = validationResults.filter(r => r.isValid).length;
  const invalidRows = totalRows - validRows;
  const existingPanelsCount = Object.keys(existingPanels).length;
  const newPanelsCount = validRows - existingPanelsCount;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-accent text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            Bulk Import System
          </div>
          <h1 className="text-4xl font-bold text-foreground">
            Bulk Import Panels
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Import multiple panels from an Excel file with intelligent validation and automatic relationship management. 
            Each field is in a separate column for seamless editing.
          </p>
        </div>

        {!canCreatePanels && (
          <Alert className="border-destructive bg-destructive/10 backdrop-blur-sm">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              You do not have permission to create panels. Please contact your administrator.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Action Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Template Download */}
          <Card className="border-0 shadow-xl bg-card hover:shadow-2xl transition-all duration-300 group">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Download className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-card-foreground">Download Template</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Get the Excel template with proper formatting
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={downloadTemplate} 
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 h-12 text-base font-semibold"
              >
                <Download className="h-5 w-5 mr-2" />
                Download Excel Template
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckSquare className="h-4 w-4 text-green-500" />
                <span>Perfect formatting and data validation</span>
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card className="border-0 shadow-xl bg-card hover:shadow-2xl transition-all duration-300 group">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Upload className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-card-foreground">Upload File</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Select your Excel file to import
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="excel-file" className="text-sm font-medium text-card-foreground">Excel File (.xlsx or .xls)</Label>
                <Input
                  id="excel-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={!canCreatePanels}
                  className="border-2 border-dashed border-border hover:border-primary transition-colors duration-300 bg-input"
                />
              </div>
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions Card */}
        <Card className="border-0 shadow-xl bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-card-foreground">Excel Format Guide</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Each field in its own column for optimal editing experience
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Benefits Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-card-foreground">Excel Benefits</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    Each field in its own column
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    Better formatting and data validation
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    No issues with commas or special characters
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    Supports multiple date formats
                  </li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-card-foreground">Auto Creation</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Customers created automatically
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Projects created automatically
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Buildings and facades created
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Existing panels updated automatically
                  </li>
                </ul>
              </div>
            </div>

            {/* Sample Table */}
            <div className="space-y-4">
              <h3 className="font-semibold text-card-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-500" />
                Sample Data Structure
              </h3>
              <div className="overflow-x-auto rounded-xl border border-border bg-muted">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="font-semibold text-card-foreground">project_name</TableHead>
                      <TableHead className="font-semibold text-card-foreground">name</TableHead>
                      <TableHead className="font-semibold text-card-foreground">type</TableHead>
                      <TableHead className="font-semibold text-card-foreground">status</TableHead>
                      <TableHead className="font-semibold text-card-foreground">date</TableHead>
                      <TableHead className="font-semibold text-card-foreground">customer_name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="hover:bg-secondary/30 transition-colors">
                      <TableCell className="font-medium text-card-foreground">Project Alpha</TableCell>
                      <TableCell className="font-medium text-card-foreground">Panel A-001</TableCell>
                      <TableCell><Badge variant="secondary">UHPC</Badge></TableCell>
                      <TableCell><Badge variant="default">Issued for Production</Badge></TableCell>
                      <TableCell>15/01/2024</TableCell>
                      <TableCell>Al Rayyan Construction</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Panel Types and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-card-foreground flex items-center gap-2">
                  <Hash className="h-4 w-4 text-indigo-500" />
                  Available Panel Types
                </h4>
                <div className="flex flex-wrap gap-2">
                  {['GRC', 'GRG', 'GRP', 'EIFS', 'UHPC'].map((type) => (
                    <Badge key={type} variant="outline" className="bg-secondary/50 border-border text-card-foreground">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-card-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-500" />
                  Available Status Values
                </h4>
                <div className="flex flex-wrap gap-2">
                  {['Issued for Production', 'Produced', 'Inspected', 'Delivered', 'Installed'].map((status) => (
                    <Badge key={status} variant="outline" className="bg-secondary/50 border-border text-card-foreground text-xs">
                      {status}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Validation Results */}
        {parsedData.length > 0 && (
          <Card className="border-0 shadow-xl bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-card-foreground">Validation Results</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {validRows} of {totalRows} rows are valid for import
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Badge variant="default" className="bg-status-complete text-status-complete-foreground">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {validRows} Valid
                  </Badge>
                  {invalidRows > 0 && (
                    <Badge variant="destructive" className="bg-status-rejected text-status-rejected-foreground">
                      <XCircle className="h-3 w-3 mr-1" />
                      {invalidRows} Invalid
                    </Badge>
                  )}
                  {newPanelsCount > 0 && (
                    <Badge variant="default" className="bg-status-active text-status-active-foreground">
                      <Plus className="h-3 w-3 mr-1" />
                      {newPanelsCount} New
                    </Badge>
                  )}
                  {existingPanelsCount > 0 && (
                    <Badge variant="secondary" className="bg-status-inspected text-status-inspected-foreground">
                      <Edit className="h-3 w-3 mr-1" />
                      {existingPanelsCount} Update
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-border bg-muted">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="font-semibold text-card-foreground">Row</TableHead>
                      <TableHead className="font-semibold text-card-foreground">Panel Name</TableHead>
                      <TableHead className="font-semibold text-card-foreground">Project</TableHead>
                      <TableHead className="font-semibold text-card-foreground">Customer</TableHead>
                      <TableHead className="font-semibold text-card-foreground">Building</TableHead>
                      <TableHead className="font-semibold text-card-foreground">Facade</TableHead>
                      <TableHead className="font-semibold text-card-foreground">Action</TableHead>
                      <TableHead className="font-semibold text-card-foreground">Status</TableHead>
                      <TableHead className="font-semibold text-card-foreground">Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, index) => {
                      const validation = validationResults[index];
                      const isExisting = existingPanels[row.name?.trim() || ''];
                      return (
                        <TableRow key={index} className="hover:bg-secondary/30 transition-colors">
                          <TableCell className="font-medium text-card-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium text-card-foreground">{row.name}</TableCell>
                          <TableCell>{row.project_name}</TableCell>
                          <TableCell>{row.customer_name || '—'}</TableCell>
                          <TableCell>{row.building_name || '—'}</TableCell>
                          <TableCell>{row.facade_name || '—'}</TableCell>
                          <TableCell>
                            {isExisting ? (
                              <Badge variant="secondary" className="bg-status-inspected text-status-inspected-foreground">
                                <Edit className="h-3 w-3 mr-1" />
                                Update
                              </Badge>
                            ) : (
                              <Badge variant="default" className="bg-status-active text-status-active-foreground">
                                <Plus className="h-3 w-3 mr-1" />
                                Create
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {validation?.isValid ? (
                              <Badge variant="default" className="bg-status-complete text-status-complete-foreground">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Valid
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="bg-status-rejected text-status-rejected-foreground">
                                <XCircle className="h-3 w-3 mr-1" />
                                Invalid
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {validation?.errors.map((error, i) => (
                                <div key={i} className="text-sm text-destructive">{error}</div>
                              ))}
                              {validation?.warnings.map((warning, i) => (
                                <div key={i} className="text-sm text-status-onhold-foreground">{warning}</div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Actions */}
        {parsedData.length > 0 && validRows > 0 && (
          <Card className="border-0 shadow-xl bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-card-foreground">Import Actions</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Import {validRows} valid panels to the database
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isImporting && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="font-medium text-card-foreground">Importing panels...</span>
                  </div>
                  <Progress value={progress} className="w-full h-3" />
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  onClick={importPanels} 
                  disabled={!canCreatePanels || isImporting || validRows === 0}
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 h-12 px-8 text-base font-semibold"
                >
                  {isImporting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                  Import/Update {validRows} Panels
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  onClick={resetForm}
                  className="h-12 px-6 border-2 hover:bg-secondary transition-all duration-300 text-card-foreground border-border"
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Results */}
        {importResults.length > 0 && (
          <Card className="border-0 shadow-xl bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-card-foreground">Import Results</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Results from the latest import operation
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {importResults.map((result, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-xl border-2 ${
                      result.success 
                        ? 'bg-status-complete/10 border-status-complete' 
                        : 'bg-status-rejected/10 border-status-rejected'
                    } backdrop-blur-sm`}
                  >
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-status-complete" />
                      ) : (
                        <XCircle className="h-5 w-5 text-status-rejected" />
                      )}
                      <span className={`font-medium ${result.success ? 'text-status-complete-foreground' : 'text-status-rejected-foreground'}`}>
                        {result.message}
                      </span>
                    </div>
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-3 text-sm text-destructive space-y-1">
                        {result.errors.map((error, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-1 h-1 bg-destructive rounded-full"></div>
                            {error}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Alert className="border-destructive bg-destructive/10 backdrop-blur-sm">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive font-medium">{error}</AlertDescription>
          </Alert>
        )}

        {/* Available Projects */}
        <Card className="border-0 shadow-xl bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Building className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-card-foreground">Available Projects</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Use exact names in your Excel file for existing projects
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((project) => (
                <Badge 
                  key={project.id} 
                  variant="outline" 
                  className="justify-start bg-secondary/50 border-border text-card-foreground hover:bg-secondary transition-colors duration-200"
                >
                  {project.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 