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
  Users,
  Calendar,
  MapPin,
  DollarSign,
  Hash,
  Loader2,
  Sparkles,
  BarChart3,
  Settings,
  Zap,
  ArrowRight,
  CheckSquare,
  Clock,
  TrendingUp,
  Building2,
  History,
  User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission, UserRole } from '../utils/rolePermissions';
import * as XLSX from 'xlsx';

interface PanelHistoryImportData {
  panel_name: string;
  status: string;
  changed_by: string;
  created_at?: string;
  image_url?: string;
  notes?: string;
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

interface UpdateResult {
  success: boolean;
  message: string;
  updatedCount?: number;
  errors?: string[];
}

export function BulkImportPanelHistoriesPage() {
  const { user: currentUser } = useAuth();
  
  // Check if user has permission to bulk import panel histories
  const canBulkImportHistories = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panels', 'canBulkImport') : false;
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<PanelHistoryImportData[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [panels, setPanels] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Update functionality state
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateResults, setUpdateResults] = useState<UpdateResult[]>([]);

  // RBAC Permission check
  const canCreateHistories = currentUser?.role ? hasPermission(currentUser.role as UserRole, 'panels', 'canCreate') : false;

  // Status mapping from string to integer (case-insensitive)
  const statusMapping: { [key: string]: number } = {
    'issued for production': 0,
    'produced': 1,
    'proceed for delivery': 2,
    'delivered': 3,
    'approved material': 4,
    'rejected material': 5,
    'installed': 6,
    'inspected': 7,
    'approved final': 8,
    'on hold': 9,
    'cancelled': 10,
    'broken at site': 11
  };

  // Helper function to parse date and combine with current time for proper ordering
  const parseDateWithCurrentTime = (dateValue: any, orderIndex: number = 0): Date | null => {
    if (!dateValue) return null;
    
    // Handle Excel serial date numbers (days since 1900-01-01)
    let numericValue: number | null = null;
    
    if (typeof dateValue === 'number' && dateValue > 0) {
      numericValue = dateValue;
    } else if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim();
      if (/^\d+\.?\d*$/.test(trimmed)) {
        numericValue = parseFloat(trimmed);
      }
    }
    
    let parsedDate: Date | null = null;
    
    if (numericValue && numericValue > 0) {
      // Handle Excel serial dates
      const excelEpoch = new Date(1900, 0, 1);
      const days = Math.floor(numericValue);
      const time = (numericValue - days) * 24 * 60 * 60 * 1000;
      parsedDate = new Date(excelEpoch.getTime() + (days - 2) * 24 * 60 * 60 * 1000 + time);
    } else {
      // Handle string dates
      const dateStr = dateValue.toString().trim();
      if (!dateStr) return null;

      const normalizedDateStr = dateStr.replace(/\s+/g, ' ').trim();
      
      // Try direct parsing first
      parsedDate = new Date(normalizedDateStr);
      if (isNaN(parsedDate.getTime())) {
        // Try different date formats
        const formats = [
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
          /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
          /^\d{4}-\d{2}-\d{2}$/,
          /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}$/,
          /^\d{1,2}\/\d{1,2}\/\d{4}$/,
          /^\d{1,2}-\d{1,2}-\d{4}$/,
          /^\d{1,2}\.\d{1,2}\.\d{4}$/
        ];

        for (const format of formats) {
          if (format.test(dateStr)) {
            parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate.getTime())) {
              break;
            }
          }
        }

        // Try manual parsing for MM/DD/YYYY HH:MM:SS format
        if (isNaN(parsedDate.getTime())) {
          const mmddyyyyTimeMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
          if (mmddyyyyTimeMatch) {
            const [, month, day, year, hour, minute, second] = mmddyyyyTimeMatch;
            parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
          }
        }

        // Try manual parsing for DD/MM/YYYY HH:MM:SS format
        if (isNaN(parsedDate.getTime())) {
          const ddmmyyyyTimeMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
          if (ddmmyyyyTimeMatch) {
            const [, day, month, year, hour, minute, second] = ddmmyyyyTimeMatch;
            parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
          }
        }
      }
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) {
      return null;
    }

    // Extract only the date part (year, month, day)
    const year = parsedDate.getFullYear();
    const month = parsedDate.getMonth();
    const day = parsedDate.getDate();

    // Get current time
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    const currentMillisecond = now.getMilliseconds();

    // Combine the date from Excel with current time, plus order index for proper sequencing
    const finalDate = new Date(
      year,
      month,
      day,
      currentHour,
      currentMinute,
      currentSecond,
      currentMillisecond + orderIndex // Add order index to milliseconds for proper ordering
    );

    return finalDate;
  };

  const fetchPanels = async () => {
    try {
      const { data, error } = await supabase
        .from('panels')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setPanels(data || []);
    } catch (err: any) {
      setError('Failed to fetch panels: ' + err.message);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      setError('Failed to fetch users: ' + err.message);
    }
  };

  useEffect(() => {
    fetchPanels();
    fetchUsers();
  }, []);

  // Check if user has permission to bulk import panel histories
  if (!canBulkImportHistories) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <Card className="border-0 shadow-2xl bg-card">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold text-card-foreground mb-2">Access Denied</h2>
              <p className="text-muted-foreground">You don't have permission to bulk import panel histories.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const downloadTemplate = () => {
    // Create sample data
    const sampleData = [
      {
        panel_name: 'OH-UC-101',
        status: 'Issued For Production',
        changed_by: 'John Doe',
        created_at: '01/15/2024 09:00:00',
        image_url: 'https://example.com/image1.jpg',
        notes: 'Initial status change'
      },
      {
        panel_name: 'OH-UC-101',
        status: 'Produced',
        changed_by: 'Jane Smith',
        created_at: '01/20/2024 14:30:00',
        image_url: '',
        notes: 'Production completed'
      },
      {
        panel_name: 'OH-UC-101',
        status: 'Proceed for Delivery',
        changed_by: '', // Empty - will default to "admin"
        created_at: '01/25/2024 11:15:00',
        image_url: 'https://example.com/image2.jpg',
        notes: 'Ready for delivery'
      }
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);

    // Set column headers
    const headers = [
      'panel_name',
      'status', 
      'changed_by',
      'created_at',
      'image_url',
      'notes'
    ];

    // Add headers to the first row
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });

    // Set column widths
    const colWidths = [
      { wch: 20 }, // panel_name
      { wch: 25 }, // status
      { wch: 20 }, // changed_by
      { wch: 20 }, // created_at
      { wch: 30 }, // image_url
      { wch: 30 }  // notes
    ];
    ws['!cols'] = colWidths;

    // Add the worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Panel Histories');

    // Generate and download the file
    XLSX.writeFile(wb, 'panel_histories_import_template.xlsx');
  };

  const parseExcel = (file: File): Promise<PanelHistoryImportData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get the first worksheet
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Skip header row and convert to our format
          const histories: PanelHistoryImportData[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (row && row.length > 0 && row[0]) { // Check if row exists and has data
              const history = {
                panel_name: row[0]?.toString().trim() || '',
                status: row[1]?.toString().trim() || '',
                changed_by: row[2]?.toString().trim() || '',
                created_at: row[3] !== undefined && row[3] !== null && row[3] !== '' ? row[3] : undefined,
                image_url: row[4] !== undefined && row[4] !== null && row[4] !== '' ? row[4]?.toString().trim() : undefined,
                notes: row[5] !== undefined && row[5] !== null && row[5] !== '' ? row[5]?.toString().trim() : undefined
              };
              
              histories.push(history);
            }
          }
          
          resolve(histories);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const validateData = (data: PanelHistoryImportData[]): ValidationResult[] => {
    return data.map((row, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Required field validation
      if (!row.panel_name?.trim()) {
        errors.push('Panel name is required');
      }

      if (!row.status?.trim()) {
        errors.push('Status is required');
      }

      // Note: changed_by is optional - will default to "admin" if empty

      // Panel name validation
      if (row.panel_name && row.panel_name.trim()) {
        const panelExists = panels.find(p => 
          p.name.toLowerCase() === row.panel_name?.toLowerCase()
        );
        if (!panelExists) {
          errors.push(`Panel "${row.panel_name}" not found in database`);
        }
      }

      // User name validation - only validate if provided
      if (row.changed_by && row.changed_by.trim()) {
        const userExists = users.find(u => 
          u.name.toLowerCase() === row.changed_by?.toLowerCase()
        );
        if (!userExists) {
          errors.push(`User "${row.changed_by}" not found in database`);
        }
      }

      // Status validation - only validate if status is provided
      if (row.status && row.status.trim()) {
        const statusText = row.status.toLowerCase().trim();
        
        // Check for common typos and variations
        const statusVariations: { [key: string]: string } = {
          'issued for production': 'issued for production',
          'produced': 'produced',
          'proceed for delivery': 'proceed for delivery',
          'procced for delivery': 'proceed for delivery', // Handle typo
          'delivered': 'delivered',
          'approved material': 'approved material',
          'rejected material': 'rejected material',
          'installed': 'installed',
          'inspected': 'inspected',
          'approved final': 'approved final',
          'on hold': 'on hold',
          'cancelled': 'cancelled',
          'broken at site': 'broken at site'
        };
        
        if (!statusVariations[statusText]) {
          const validStatuses = [
            'Issued For Production',
            'Produced', 
            'Proceed for Delivery',
            'Delivered',
            'Approved Material',
            'Rejected Material',
            'Installed',
            'Inspected',
            'Approved Final',
            'On Hold',
            'Cancelled',
            'Broken at Site'
          ];
          errors.push(`Invalid status "${row.status}". Valid statuses: ${validStatuses.join(', ')}`);
        }
      }

      // Date validation - only validate if date is provided
      if (row.created_at !== undefined && row.created_at !== null && row.created_at !== '') {
        const createdDate = parseDateWithCurrentTime(row.created_at, index);
        if (!createdDate || isNaN(createdDate.getTime())) {
          errors.push('Invalid created_at format (supports: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, or Excel date format)');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
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

    try {
      const data = await parseExcel(file);
      setParsedData(data);
      const validation = validateData(data);
      setValidationResults(validation);
    } catch (err: any) {
      setError('Failed to parse Excel file: ' + err.message);
    }
  };

  const importHistories = async () => {
    if (!canCreateHistories) {
      setError('You do not have permission to create panel histories');
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

    const results: ImportResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Pre-fetch all required data to avoid repeated lookups
    console.log('Pre-fetching all required data...');
    const startTime = Date.now();
    const allPanels = await supabase.from('panels').select('id, name').order('name');
    const allUsers = await supabase.from('users').select('id, name').order('name');
    
    console.log(`Data pre-fetch completed in ${Date.now() - startTime}ms`);
    
    if (allPanels.error) {
      setError('Failed to fetch panels: ' + allPanels.error.message);
      setIsImporting(false);
      return;
    }
    
    if (allUsers.error) {
      setError('Failed to fetch users: ' + allUsers.error.message);
      setIsImporting(false);
      return;
    }

    // Create lookup maps for faster access
    const panelMap = new Map(allPanels.data.map(p => [p.name.toLowerCase(), p]));
    const userMap = new Map(allUsers.data.map(u => [u.name.toLowerCase(), u]));
    const adminUser = allUsers.data.find(u => u.name.toLowerCase() === 'admin');

    // Group data by panel name to handle sequential import and duplicate status filtering
    const groupedData: { [panelName: string]: PanelHistoryImportData[] } = {};
    validData.forEach(row => {
      if (!groupedData[row.panel_name]) {
        groupedData[row.panel_name] = [];
      }
      groupedData[row.panel_name].push(row);
    });

    const totalPanels = Object.keys(groupedData).length;
    let processedPanels = 0;

    // Process each panel's history sequentially
    for (const [panelName, panelHistories] of Object.entries(groupedData)) {
      try {
        // Find panel ID using pre-fetched data
        const panel = panelMap.get(panelName.toLowerCase());
        if (!panel) {
          results.push({
            success: false,
            message: `Panel "${panelName}" not found`,
            errors: ['Panel not found in database']
          });
          errorCount++;
          continue;
        }

        // Sort histories by created_at to maintain chronological order
        const sortedHistories = panelHistories.sort((a, b) => {
          const dateA = a.created_at ? parseDateWithCurrentTime(a.created_at, 0) : new Date(0);
          const dateB = b.created_at ? parseDateWithCurrentTime(b.created_at, 0) : new Date(0);
          return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
        });

        // Filter out duplicate consecutive statuses
        const filteredHistories: PanelHistoryImportData[] = [];
        let lastStatus: string | null = null;

        for (const history of sortedHistories) {
          const normalizedStatus = history.status.toLowerCase().trim();
          
          // Apply typo correction for duplicate filtering
          const statusVariations: { [key: string]: string } = {
            'issued for production': 'issued for production',
            'produced': 'produced',
            'proceed for delivery': 'proceed for delivery',
            'procced for delivery': 'proceed for delivery', // Handle typo
            'delivered': 'delivered',
            'approved material': 'approved material',
            'rejected material': 'rejected material',
            'installed': 'installed',
            'inspected': 'inspected',
            'approved final': 'approved final',
            'on hold': 'on hold',
            'cancelled': 'cancelled',
            'broken at site': 'broken at site'
          };
          
          const matchedStatus = statusVariations[normalizedStatus] || normalizedStatus;
          
          if (matchedStatus !== lastStatus) {
            filteredHistories.push(history);
            lastStatus = matchedStatus;
          }
        }

        // Map status text to numeric value using the correct mapping
        const mapStatusToNumber = (statusText: string): number => {
          if (!statusText.trim()) return 0; // Default to "Issued For Production"
          
          const status = statusText.toLowerCase().trim();
          
          // Map common status texts to numeric values (including typos)
          const statusMap: { [key: string]: number } = {
            'issued for production': 0, // "Issued For Production"
            'produced': 1, // "Produced"
            'proceed for delivery': 2, // "Proceed for Delivery"
            'procced for delivery': 2, // Handle typo
            'delivered': 3, // "Delivered"
            'approved material': 4, // "Approved Material"
            'rejected material': 5, // "Rejected Material"
            'installed': 6, // "Installed"
            'inspected': 7, // "Inspected"
            'approved final': 8, // "Approved Final"
            'on hold': 9, // "On Hold"
            'cancelled': 10, // "Cancelled"
            'broken at site': 11 // "Broken at Site"
          };
          
          return statusMap[status] || 0; // Default to "Issued For Production"
        };

        // Prepare batch insert data
        const batchHistoryData: any[] = [];
        let lastImportedStatus: number | null = null;

        for (let i = 0; i < filteredHistories.length; i++) {
          const history = filteredHistories[i];
          // Find user ID - default to "admin" if changed_by is empty
          const changedByUser = history.changed_by?.trim() || 'admin';
          const user = userMap.get(changedByUser.toLowerCase());
          if (!user) {
            results.push({
              success: false,
              message: `User "${changedByUser}" not found for panel "${panelName}"`,
              errors: ['User not found in database']
            });
            errorCount++;
            continue;
          }

          // Prepare history data with proper ordering
          const createdAt = history.created_at ? parseDateWithCurrentTime(history.created_at, i) : new Date();
          const statusValue = mapStatusToNumber(history.status);
          console.log(`Preparing: status="${history.status}" -> value=${statusValue}`);

          batchHistoryData.push({
            panel_id: panel.id,
            status: statusValue,
            created_at: createdAt ? createdAt.toISOString() : new Date().toISOString(),
            user_id: user.id,
            image_url: history.image_url || null,
            notes: history.notes || null
          });

          lastImportedStatus = statusValue; // Track the last imported status
        }

        // Batch insert all histories for this panel
        if (batchHistoryData.length > 0) {
          try {
            const { data: newHistories, error } = await supabase
              .from('panel_status_histories')
              .insert(batchHistoryData)
              .select();

            if (error) {
              results.push({
                success: false,
                message: `Failed to import ${batchHistoryData.length} histories for panel "${panelName}"`,
                errors: [error.message]
              });
              errorCount += batchHistoryData.length;
            } else {
              results.push({
                success: true,
                message: `Successfully imported ${batchHistoryData.length} histories for panel "${panelName}"`,
                data: newHistories
              });
              successCount += batchHistoryData.length;
              console.log(`Panel "${panelName}" - Imported ${batchHistoryData.length} histories, lastImportedStatus: ${lastImportedStatus}`);
            }
          } catch (err: any) {
            results.push({
              success: false,
              message: `Failed to import histories for panel "${panelName}"`,
              errors: [err.message]
            });
            errorCount += batchHistoryData.length;
          }
        }

        // After importing all histories, check if we need to sync with current panel status
        if (lastImportedStatus !== null) {
          try {
            // Get current panel status
            const { data: currentPanel, error: panelError } = await supabase
              .from('panels')
              .select('status')
              .eq('id', panel.id)
              .single();

            console.log(`Panel "${panelName}" - Last imported status: ${lastImportedStatus}, Current panel status: ${currentPanel?.status}`);

            if (panelError) {
              console.error('Error fetching current panel status:', panelError);
            } else if (currentPanel && currentPanel.status !== lastImportedStatus) {
              // Current panel status doesn't match the last imported status
              // Add a new status change using "admin" as the user
              if (adminUser) {
                console.log(`Adding sync status change for panel "${panelName}" from ${lastImportedStatus} to ${currentPanel.status}`);
                
                const syncHistoryData = {
                  panel_id: panel.id,
                  status: currentPanel.status,
                  created_at: new Date().toISOString(),
                  user_id: adminUser.id,
                  image_url: null,
                  notes: `Status synchronized with current panel status during bulk import`
                };

                const { data: syncHistory, error: syncError } = await supabase
                  .from('panel_status_histories')
                  .insert(syncHistoryData)
                  .select()
                  .single();

                if (syncError) {
                  console.error('Error syncing panel status:', syncError);
                } else {
                  console.log(`Successfully synced panel "${panelName}" status from ${lastImportedStatus} to ${currentPanel.status}`);
                  results.push({
                    success: true,
                    message: `Synchronized panel "${panelName}" status with current panel status`,
                    data: syncHistory
                  });
                  successCount++;
                }
              } else {
                console.error('Admin user not found for status sync');
              }
            } else {
              console.log(`Panel "${panelName}" status already matches - no sync needed`);
            }
          } catch (err: any) {
            console.error('Error during status synchronization:', err);
          }
        } else {
          console.log(`Panel "${panelName}" - No histories imported, skipping sync`);
        }
      } catch (err: any) {
        results.push({
          success: false,
          message: `Failed to process panel "${panelName}"`,
          errors: [err.message]
        });
        errorCount++;
      }

      // Update progress (less frequently for better performance)
      processedPanels++;
      if (processedPanels % 10 === 0 || processedPanels === totalPanels) {
        setProgress((processedPanels / totalPanels) * 100);
        setImportResults([...results]);
      }
    }

    const totalTime = Date.now() - startTime;
    setIsImporting(false);
    setProgress(100);

    // Show summary with performance metrics
    const summary = `Import completed in ${(totalTime / 1000).toFixed(1)}s: ${successCount} successful, ${errorCount} failed`;
    const rate = successCount > 0 ? (successCount / (totalTime / 1000)).toFixed(1) : '0';
    console.log(`Import Performance: ${successCount} records in ${(totalTime / 1000).toFixed(1)}s (${rate} records/sec)`);
    
    if (errorCount > 0) {
      setError(summary);
    } else {
      setError(null);
    }
  };

  const updateExistingHistories = async () => {
    if (!canCreateHistories) {
      setError('You do not have permission to update panel histories');
      return;
    }

    const validData = parsedData.filter((_, index) => validationResults[index]?.isValid);
    if (validData.length === 0) {
      setError('No valid data to update');
      return;
    }

    setIsUpdating(true);
    setUpdateProgress(0);
    setUpdateResults([]);

    const results: UpdateResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Pre-fetch all required data to avoid repeated lookups
    console.log('Pre-fetching all required data for update...');
    const startTime = Date.now();
    const allPanels = await supabase.from('panels').select('id, name').order('name');
    const allUsers = await supabase.from('users').select('id, name').order('name');
    
    console.log(`Data pre-fetch completed in ${Date.now() - startTime}ms`);
    
    if (allPanels.error) {
      setError('Failed to fetch panels: ' + allPanels.error.message);
      setIsUpdating(false);
      return;
    }
    
    if (allUsers.error) {
      setError('Failed to fetch users: ' + allUsers.error.message);
      setIsUpdating(false);
      return;
    }

    // Create lookup maps for faster access
    const panelMap = new Map(allPanels.data.map(p => [p.name.toLowerCase(), p]));
    const userMap = new Map(allUsers.data.map(u => [u.name.toLowerCase(), u]));

    // Group data by panel name to handle sequential update and duplicate status filtering
    const groupedData: { [panelName: string]: PanelHistoryImportData[] } = {};
    validData.forEach(row => {
      if (!groupedData[row.panel_name]) {
        groupedData[row.panel_name] = [];
      }
      groupedData[row.panel_name].push(row);
    });

    const totalPanels = Object.keys(groupedData).length;
    let processedPanels = 0;

    // Process each panel's history sequentially
    for (const [panelName, panelHistories] of Object.entries(groupedData)) {
      try {
        // Find panel ID using pre-fetched data
        const panel = panelMap.get(panelName.toLowerCase());
        if (!panel) {
          results.push({
            success: false,
            message: `Panel "${panelName}" not found`,
            errors: ['Panel not found in database']
          });
          errorCount++;
          continue;
        }

        // Sort histories by created_at to maintain chronological order
        const sortedHistories = panelHistories.sort((a, b) => {
          const dateA = a.created_at ? parseDateWithCurrentTime(a.created_at, 0) : new Date(0);
          const dateB = b.created_at ? parseDateWithCurrentTime(b.created_at, 0) : new Date(0);
          return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
        });

        // Filter out duplicate consecutive statuses
        const filteredHistories: PanelHistoryImportData[] = [];
        let lastStatus: string | null = null;

        for (const history of sortedHistories) {
          const normalizedStatus = history.status.toLowerCase().trim();
          
          // Apply typo correction for duplicate filtering
          const statusVariations: { [key: string]: string } = {
            'issued for production': 'issued for production',
            'produced': 'produced',
            'proceed for delivery': 'proceed for delivery',
            'procced for delivery': 'proceed for delivery', // Handle typo
            'delivered': 'delivered',
            'approved material': 'approved material',
            'rejected material': 'rejected material',
            'installed': 'installed',
            'inspected': 'inspected',
            'approved final': 'approved final',
            'on hold': 'on hold',
            'cancelled': 'cancelled',
            'broken at site': 'broken at site'
          };
          
          const matchedStatus = statusVariations[normalizedStatus] || normalizedStatus;
          
          if (matchedStatus !== lastStatus) {
            filteredHistories.push(history);
            lastStatus = matchedStatus;
          }
        }

        // Map status text to numeric value
        const mapStatusToNumber = (statusText: string): number => {
          if (!statusText.trim()) return 0;
          
          const status = statusText.toLowerCase().trim();
          const statusMap: { [key: string]: number } = {
            'issued for production': 0,
            'produced': 1,
            'proceed for delivery': 2,
            'procced for delivery': 2, // Handle typo
            'delivered': 3,
            'approved material': 4,
            'rejected material': 5,
            'installed': 6,
            'inspected': 7,
            'approved final': 8,
            'on hold': 9,
            'cancelled': 10,
            'broken at site': 11
          };
          
          return statusMap[status] || 0;
        };

        // Get existing panel histories for this panel
        const { data: existingHistories, error: fetchError } = await supabase
          .from('panel_status_histories')
          .select('id, status, user_id, created_at')
          .eq('panel_id', panel.id)
          .order('created_at', { ascending: true });

        if (fetchError) {
          results.push({
            success: false,
            message: `Failed to fetch existing histories for panel "${panelName}"`,
            errors: [fetchError.message]
          });
          errorCount++;
          continue;
        }

        if (!existingHistories || existingHistories.length === 0) {
          results.push({
            success: false,
            message: `No existing histories found for panel "${panelName}"`,
            errors: ['No existing panel histories to update']
          });
          errorCount++;
          continue;
        }

        // Create a map of existing histories by status and user for efficient lookup
        const existingHistoryMap = new Map<string, any>();
        existingHistories.forEach(history => {
          const key = `${history.status}-${history.user_id}`;
          if (!existingHistoryMap.has(key)) {
            existingHistoryMap.set(key, history);
          }
        });

        // Update histories that match the Excel data
        let updatedCount = 0;
        const updatePromises: PromiseLike<any>[] = [];

        for (let i = 0; i < filteredHistories.length; i++) {
          const history = filteredHistories[i];
          // Find user ID - default to "admin" if changed_by is empty
          const changedByUser = history.changed_by?.trim() || 'admin';
          const user = userMap.get(changedByUser.toLowerCase());
          if (!user) {
            results.push({
              success: false,
              message: `User "${changedByUser}" not found for panel "${panelName}"`,
              errors: ['User not found in database']
            });
            errorCount++;
            continue;
          }

          const statusValue = mapStatusToNumber(history.status);
          const key = `${statusValue}-${user.id}`;
          const existingHistory = existingHistoryMap.get(key);

          if (existingHistory && history.created_at) {
            const newCreatedAt = parseDateWithCurrentTime(history.created_at, i);
            if (newCreatedAt && !isNaN(newCreatedAt.getTime())) {
              // Only update if the date is different
              const existingDate = new Date(existingHistory.created_at);
              if (Math.abs(newCreatedAt.getTime() - existingDate.getTime()) > 1000) { // 1 second tolerance
                updatePromises.push(
                  supabase
                    .from('panel_status_histories')
                    .update({ created_at: newCreatedAt.toISOString() })
                    .eq('id', existingHistory.id)
                    .then(result => result)
                );
                updatedCount++;
              }
            }
          }
        }

        // Execute all updates for this panel in parallel
        if (updatePromises.length > 0) {
          try {
            const updateResults = await Promise.all(updatePromises);
            const failedUpdates = updateResults.filter(result => result.error);
            
            if (failedUpdates.length > 0) {
              results.push({
                success: false,
                message: `Failed to update ${failedUpdates.length} histories for panel "${panelName}"`,
                errors: failedUpdates.map(result => result.error.message)
              });
              errorCount += failedUpdates.length;
            } else {
              results.push({
                success: true,
                message: `Successfully updated ${updatedCount} histories for panel "${panelName}"`,
                updatedCount
              });
              successCount += updatedCount;
            }
          } catch (err: any) {
            results.push({
              success: false,
              message: `Failed to update histories for panel "${panelName}"`,
              errors: [err.message]
            });
            errorCount += updatePromises.length;
          }
        } else {
          results.push({
            success: true,
            message: `No updates needed for panel "${panelName}" - all dates are already correct`,
            updatedCount: 0
          });
        }
      } catch (err: any) {
        results.push({
          success: false,
          message: `Failed to process panel "${panelName}"`,
          errors: [err.message]
        });
        errorCount++;
      }

      // Update progress (less frequently for better performance)
      processedPanels++;
      if (processedPanels % 10 === 0 || processedPanels === totalPanels) {
        setUpdateProgress((processedPanels / totalPanels) * 100);
        setUpdateResults([...results]);
      }
    }

    const totalTime = Date.now() - startTime;
    setIsUpdating(false);
    setUpdateProgress(100);

    // Show summary with performance metrics
    const summary = `Update completed in ${(totalTime / 1000).toFixed(1)}s: ${successCount} successful, ${errorCount} failed`;
    const rate = successCount > 0 ? (successCount / (totalTime / 1000)).toFixed(1) : '0';
    console.log(`Update Performance: ${successCount} records in ${(totalTime / 1000).toFixed(1)}s (${rate} records/sec)`);
    
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
    setUpdateResults([]);
    setUpdateProgress(0);
  };

  const totalRows = parsedData.length;
  const validRows = validationResults.filter(r => r.isValid).length;
  const invalidRows = totalRows - validRows;

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
            Bulk Import Panel Histories
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Import panel status history data from an Excel file with intelligent validation and automatic relationship management. 
            Each field is in a separate column for seamless editing.
          </p>
        </div>

        {!canCreateHistories && (
          <Alert className="border-destructive bg-destructive/10 backdrop-blur-sm">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              You do not have permission to create panel histories. Please contact your administrator.
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
                  disabled={!canCreateHistories}
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
                  <h3 className="font-semibold text-card-foreground">Smart Features</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Automatic duplicate status filtering
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Chronological ordering by date
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Panel and user name validation
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Status mapping validation
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
                      <TableHead className="font-semibold text-card-foreground">panel_name</TableHead>
                      <TableHead className="font-semibold text-card-foreground">status</TableHead>
                      <TableHead className="font-semibold text-card-foreground">changed_by</TableHead>
                      <TableHead className="font-semibold text-card-foreground">created_at</TableHead>
                      <TableHead className="font-semibold text-card-foreground">image_url</TableHead>
                      <TableHead className="font-semibold text-card-foreground">notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="hover:bg-secondary/30 transition-colors">
                      <TableCell className="font-medium text-card-foreground">OH-UC-101</TableCell>
                      <TableCell><Badge variant="default">Issued For Production</Badge></TableCell>
                      <TableCell>John Doe</TableCell>
                      <TableCell>01/15/2024 09:00:00</TableCell>
                      <TableCell>https://example.com/image1.jpg</TableCell>
                      <TableCell>Initial status change</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-secondary/30 transition-colors">
                      <TableCell className="font-medium text-card-foreground">OH-UC-102</TableCell>
                      <TableCell><Badge variant="default">Produced</Badge></TableCell>
                      <TableCell className="text-muted-foreground italic">(empty - defaults to "admin")</TableCell>
                      <TableCell>01/20/2024 14:30:00</TableCell>
                      <TableCell></TableCell>
                      <TableCell>Production completed</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Status Values */}
            <div className="space-y-3">
              <h4 className="font-semibold text-card-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                Available Status Values
              </h4>
              <div className="flex flex-wrap gap-2">
                {[
                  'Issued For Production',
                  'Produced', 
                  'Proceed for Delivery',
                  'Delivered',
                  'Approved Material',
                  'Rejected Material',
                  'Installed',
                  'Inspected',
                  'Approved Final',
                  'On Hold',
                  'Cancelled',
                  'Broken at Site'
                ].map((status) => (
                  <Badge key={status} variant="outline" className="bg-secondary/50 border-border text-card-foreground">
                    {status}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Date and Timestamp Fields Information */}
            <div className="space-y-3">
              <h4 className="font-semibold text-card-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Date & Timestamp Fields (Optional)
              </h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span><strong>created_at:</strong> YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, or Excel format</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span><strong>Smart Date Handling:</strong> Date from Excel + Current Time for proper ordering</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span>If left empty, current timestamp will be used automatically</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span><strong>changed_by:</strong> If left empty, will default to "admin"</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                  <span><strong>Important:</strong> Duplicate consecutive statuses are automatically filtered out</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                  <span><strong>Ordering:</strong> Records maintain Excel row order with unique timestamps</span>
                </div>
              </div>
            </div>

            {/* Update Mode Information */}
            <div className="space-y-3">
              <h4 className="font-semibold text-card-foreground flex items-center gap-2">
                <History className="h-4 w-4 text-purple-500" />
                Update Mode Features
              </h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                  <span><strong>Update Existing:</strong> Updates created_at for existing panel histories</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span>Matches records by panel name, status, and user</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span><strong>Smart Date Update:</strong> Excel date + Current time + Order index</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                  <span>Optimized for performance with minimal database calls</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span><strong>Note:</strong> Use this mode when you have existing panel histories with empty created_at fields</span>
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
                      <TableHead className="font-semibold text-card-foreground">Status</TableHead>
                      <TableHead className="font-semibold text-card-foreground">Changed By</TableHead>
                      <TableHead className="font-semibold text-card-foreground">Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, index) => {
                      const validation = validationResults[index];
                      return (
                        <TableRow key={index} className="hover:bg-secondary/30 transition-colors">
                          <TableCell className="font-medium text-card-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium text-card-foreground">{row.panel_name}</TableCell>
                          <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                          <TableCell>{row.changed_by}</TableCell>
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
                    Import {validRows} valid panel histories to the database
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isImporting && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="font-medium text-card-foreground">Importing panel histories...</span>
                  </div>
                  <Progress value={progress} className="w-full h-3" />
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  onClick={importHistories} 
                  disabled={!canCreateHistories || isImporting || validRows === 0}
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 h-12 px-8 text-base font-semibold"
                >
                  {isImporting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                  Import {validRows} Panel Histories
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

        {/* Update Existing Histories Actions */}
        {parsedData.length > 0 && validRows > 0 && (
          <Card className="border-0 shadow-xl bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <History className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-card-foreground">Update Existing Histories</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Update created_at timestamps for existing panel histories based on Excel data
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-blue-200 bg-blue-50 backdrop-blur-sm">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Update Mode:</strong> This will update the <code>created_at</code> field for existing panel histories that match the panel name, status, and user from your Excel file. Duplicate consecutive statuses are automatically filtered out.
                </AlertDescription>
              </Alert>

              {isUpdating && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="font-medium text-card-foreground">Updating panel histories...</span>
                  </div>
                  <Progress value={updateProgress} className="w-full h-3" />
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  onClick={updateExistingHistories} 
                  disabled={!canCreateHistories || isUpdating || validRows === 0}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 h-12 px-8 text-base font-semibold"
                >
                  {isUpdating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <History className="h-5 w-5" />
                  )}
                  Update {validRows} Panel Histories
                  <ArrowRight className="h-4 w-4" />
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

        {/* Update Results */}
        {updateResults.length > 0 && (
          <Card className="border-0 shadow-xl bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <History className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-card-foreground">Update Results</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Results from the latest update operation
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {updateResults.map((result, index) => (
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
                      {result.updatedCount !== undefined && result.updatedCount > 0 && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                          {result.updatedCount} updated
                        </Badge>
                      )}
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

        {/* Available Panels and Users */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Available Panels */}
          <Card className="border-0 shadow-xl bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-card-foreground">Available Panels</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Use exact names in your Excel file for existing panels
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {panels.map((panel) => (
                  <Badge 
                    key={panel.id} 
                    variant="outline" 
                    className="justify-start bg-secondary/50 border-border text-card-foreground hover:bg-secondary transition-colors duration-200"
                  >
                    {panel.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Available Users */}
          <Card className="border-0 shadow-xl bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-card-foreground">Available Users</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Use exact names in your Excel file for existing users
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {users.map((user) => (
                  <Badge 
                    key={user.id} 
                    variant="outline" 
                    className="justify-start bg-secondary/50 border-border text-card-foreground hover:bg-secondary transition-colors duration-200"
                  >
                    {user.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
