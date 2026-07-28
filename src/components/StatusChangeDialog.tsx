import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Upload, X, Image as ImageIcon, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToastContext } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { crudOperations } from '../utils/userTracking';
import { 
  PANEL_STATUSES, 
  validateStatusTransition, 
  validateStatusTransitionWithRole,
  getValidNextStatuses,
  getValidNextStatusesForRole,
  isSpecialStatus 
} from '../utils/statusValidation';

type PanelStatus = (typeof PANEL_STATUSES)[number];

interface PanelModel {
  id: string;
  name: string;
  type: number;
  status: number;
  project_id: string;
  project_name?: string;
  building_id?: string;
  building_name?: string;
  facade_id?: string;
  facade_name?: string;
  issue_transmittal_no?: string;
  drawing_number?: string;
  unit_rate_qr_m2?: number;
  ifp_qty_area_sm?: number;
  ifp_qty_nos?: number;
  weight?: number;
  dimension?: string;
  issued_for_production_date?: string;
}

interface StatusChangeDialogProps {
  panel: PanelModel | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged: () => void;
}

export function StatusChangeDialog({ panel, isOpen, onClose, onStatusChanged }: StatusChangeDialogProps) {
  const { showToast } = useToastContext();
  const { user: currentUser } = useAuth();
  const [newStatus, setNewStatus] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [previousStatus, setPreviousStatus] = useState<number | null>(null);
  const [statusChangeDate, setStatusChangeDate] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map database integers to UI strings
  const statusMap: { [key: number]: PanelStatus } = PANEL_STATUSES.reduce((acc, status, index) => ({ ...acc, [index]: status }), {});
  const statusReverseMap = Object.fromEntries(Object.entries(statusMap).map(([k, v]) => [v, parseInt(k)]));

  // Fetch previous status from panel status history
  const fetchPreviousStatus = async (panelId: string) => {
    try {
      const { data, error } = await supabase
        .from('panel_status_histories')
        .select('status')
        .eq('panel_id', panelId)
        .order('created_at', { ascending: false })
        .limit(2); // Get the last 2 statuses

      if (error) {
        console.error('Error fetching panel status history:', error);
        return null;
      }

      // If we have at least 2 statuses, the second one is the previous status
      if (data && data.length >= 2) {
        return data[1].status;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching previous status:', error);
      return null;
    }
  };

  // Get all forward statuses from current status (for admin skip functionality)
  const getAllForwardStatuses = (currentStatus: number): number[] => {
    const visited = new Set<number>();
    const forwardStatuses = new Set<number>();
    
    const traverse = (status: number) => {
      if (visited.has(status)) return;
      visited.add(status);
      
      const nextStatuses = getValidNextStatuses(status);
      for (const nextStatus of nextStatuses) {
        // Only include statuses that are forward in the main workflow (higher index)
        // Exclude special statuses and rework paths (like Rejected Material -> Issued For Production)
        if (!isSpecialStatus(nextStatus) && nextStatus > status) {
          forwardStatuses.add(nextStatus);
          traverse(nextStatus);
        }
      }
    };
    
    traverse(currentStatus);
    return Array.from(forwardStatuses).sort((a, b) => a - b);
  };

  // Get valid next statuses for the current panel status and user role
  const getValidStatuses = () => {
    if (!panel || !currentUser?.role) return [];
    
    if (currentUser.role === 'Administrator') {
      const onHoldStatusIndex = PANEL_STATUSES.indexOf('On Hold');
      const cancelledStatusIndex = PANEL_STATUSES.indexOf('Cancelled');
      const brokenAtSiteStatusIndex = PANEL_STATUSES.indexOf('Broken at Site');

      let allowedStatuses: number[] = [];

      if (panel.status === onHoldStatusIndex) {
        // From On Hold, admins can go to:
        // 1. Previous status (if available)
        // 2. Other special statuses (Cancelled, Broken at Site)
        allowedStatuses = [cancelledStatusIndex, brokenAtSiteStatusIndex];
        
        // Add previous status if available
        if (previousStatus !== null) {
          allowedStatuses.push(previousStatus);
        }
      } else {
        // For other statuses, use the forward traversal logic + special statuses
        const forwardStatuses = getAllForwardStatuses(panel.status);
        const specialStatuses = [onHoldStatusIndex, cancelledStatusIndex, brokenAtSiteStatusIndex];
        allowedStatuses = Array.from(new Set([...forwardStatuses, ...specialStatuses]));
      }
      
      // Exclude the current status itself from the options
      return allowedStatuses.filter(status => status !== panel.status).sort((a, b) => a - b);
    }
    
    const validNextStatuses = getValidNextStatusesForRole(panel.status, currentUser.role);
    const allStatuses = PANEL_STATUSES.map((_, index) => index);
    
    // Include special statuses (On Hold, Cancelled) that can be set from any status
    const specialStatuses = allStatuses.filter(status => isSpecialStatus(status));
    
    // Combine valid next statuses with special statuses, removing duplicates
    const validStatuses = Array.from(new Set([...validNextStatuses, ...specialStatuses]));
    
    return validStatuses.sort((a, b) => a - b);
  };

  // Validate status transition when newStatus changes
  useEffect(() => {
    if (panel && newStatus !== panel.status && currentUser?.role) {
      if (currentUser.role === 'Administrator') {
        const onHoldStatusIndex = PANEL_STATUSES.indexOf('On Hold');
        const cancelledStatusIndex = PANEL_STATUSES.indexOf('Cancelled');
        const brokenAtSiteStatusIndex = PANEL_STATUSES.indexOf('Broken at Site');
        
        let isValidAdminTransition = false;
        if (panel.status === onHoldStatusIndex) {
          // From On Hold, check if newStatus is in allowed statuses
          const allowedStatuses = [cancelledStatusIndex, brokenAtSiteStatusIndex];
          if (previousStatus !== null) {
            allowedStatuses.push(previousStatus);
          }
          isValidAdminTransition = allowedStatuses.includes(newStatus);
        } else {
          // For other statuses, check if newStatus is a forward status or a special status
          const forwardStatuses = getAllForwardStatuses(panel.status);
          const specialStatuses = [onHoldStatusIndex, cancelledStatusIndex, brokenAtSiteStatusIndex];
          const allowedStatuses = Array.from(new Set([...forwardStatuses, ...specialStatuses]));
          isValidAdminTransition = allowedStatuses.includes(newStatus);
        }

        if (!isValidAdminTransition) {
          setValidationError('Invalid status transition for Administrator');
        } else {
          setValidationError('');
        }
      } else {
        const validation = validateStatusTransitionWithRole(panel.status, newStatus, currentUser.role);
        setValidationError(validation.error || '');
      }
    } else {
      setValidationError('');
    }
  }, [panel, newStatus, currentUser?.role, previousStatus]);

  // Reset form when panel changes
  useEffect(() => {
    if (panel) {
      setNewStatus(panel.status);
      setValidationError('');
      
      // Set default date to current date and time
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setStatusChangeDate(`${year}-${month}-${day}T${hours}:${minutes}`);
      
      // Fetch previous status if current status is "On Hold"
      const onHoldStatusIndex = PANEL_STATUSES.indexOf('On Hold');
      if (panel.status === onHoldStatusIndex) {
        fetchPreviousStatus(panel.id).then(setPreviousStatus);
      } else {
        setPreviousStatus(null);
      }
    }
  }, [panel]);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file', 'error');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image file size must be less than 5MB', 'error');
        return;
      }

      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage) return null;

    try {
      const fileExt = selectedImage.name.split('.').pop();
      const fileName = `${panel?.id}_${Date.now()}.${fileExt}`;
      const filePath = `panel-status-images/${fileName}`;

      console.log('Attempting to upload image to:', filePath);
      console.log('File size:', selectedImage.size, 'bytes');
      console.log('File type:', selectedImage.type);

      const { data, error: uploadError } = await supabase.storage
        .from('panel-images')
        .upload(filePath, selectedImage, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        showToast(`Failed to upload image: ${uploadError.message}`, 'error');
        return null;
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('panel-images')
        .getPublicUrl(filePath);

      console.log('Public URL:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      showToast(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!panel || !currentUser?.role) return;

    if (currentUser.role === 'Administrator') {
      const onHoldStatusIndex = PANEL_STATUSES.indexOf('On Hold');
      const cancelledStatusIndex = PANEL_STATUSES.indexOf('Cancelled');
      const brokenAtSiteStatusIndex = PANEL_STATUSES.indexOf('Broken at Site');
      
      let isValidAdminTransition = false;
      if (panel.status === onHoldStatusIndex) {
        // From On Hold, check if newStatus is in allowed statuses
        const allowedStatuses = [cancelledStatusIndex, brokenAtSiteStatusIndex];
        if (previousStatus !== null) {
          allowedStatuses.push(previousStatus);
        }
        isValidAdminTransition = allowedStatuses.includes(newStatus);
      } else {
        // For other statuses, check if newStatus is a forward status or a special status
        const forwardStatuses = getAllForwardStatuses(panel.status);
        const specialStatuses = [onHoldStatusIndex, cancelledStatusIndex, brokenAtSiteStatusIndex];
        const allowedStatuses = Array.from(new Set([...forwardStatuses, ...specialStatuses]));
        isValidAdminTransition = allowedStatuses.includes(newStatus);
      }

      if (!isValidAdminTransition) {
        showToast('Invalid status transition for Administrator', 'error');
        return;
      }
    } else {
      const validation = validateStatusTransitionWithRole(panel.status, newStatus, currentUser.role);
      if (!validation.isValid) {
        showToast(validation.error || 'Invalid status transition', 'error');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Upload image if selected
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImage();
        if (!imageUrl) {
          setIsSubmitting(false);
          return;
        }
      }

      // Convert the selected date to ISO string for database storage
      const selectedDateTime = new Date(statusChangeDate);
      const createdAtISO = selectedDateTime.toISOString();

      // Insert the status history record directly with the custom date
      const historyData = {
        panel_id: panel.id,
        status: newStatus,
        created_at: createdAtISO,
        user_id: currentUser.id,
        image_url: imageUrl,
        notes: notes.trim() || null
      };

      const { data: newHistory, error: historyError } = await supabase
        .from('panel_status_histories')
        .insert(historyData)
        .select()
        .single();

      if (historyError) {
        console.error('Error inserting status history:', historyError);
        showToast('Failed to create status history record', 'error');
        return;
      }

      // Update panel status with user tracking
      await crudOperations.update("panels", panel.id, { 
        status: newStatus 
      });

      showToast('Panel status updated successfully', 'success');

      // Reset form
      setNewStatus(0);
      setNotes('');
      setSelectedImage(null);
      setImagePreview(null);
      setValidationError('');
      setStatusChangeDate('');
      
      onStatusChanged();
      onClose();
    } catch (error) {
      console.error('Error updating panel status:', error);
      showToast('Failed to update panel status', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNewStatus(0);
    setNotes('');
    setSelectedImage(null);
    setImagePreview(null);
    setValidationError('');
    setPreviousStatus(null);
    setStatusChangeDate('');
    onClose();
  };

  const validStatuses = getValidStatuses();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md mx-2 sm:mx-4 sm:w-full rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base sm:text-lg">Update Panel Status</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Change status for panel "{panel?.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label htmlFor="current-status" className="text-xs sm:text-sm font-medium">Current Status</Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {panel ? statusMap[panel.status] : 'Unknown'}
              </Badge>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="new-status" className="text-xs sm:text-sm font-medium">New Status *</Label>
            <Select
              value={statusMap[newStatus]}
              onValueChange={(value) => setNewStatus(statusReverseMap[value])}
            >
              <SelectTrigger className="h-9 sm:h-10">
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {validStatuses.map((statusIndex) => {
                  const statusName = statusMap[statusIndex];
                  const isSpecial = isSpecialStatus(statusIndex);
                  return (
                    <SelectItem key={statusIndex} value={statusName} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{statusName}</span>
                        {isSpecial && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            Special
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {validStatuses.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No valid status transitions available for current status.
              </p>
            )}
          </div>

          {validationError && (
            <div className="flex items-center gap-2 p-2 bg-destructive/15 border border-destructive/20 text-destructive rounded-lg">
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">{validationError}</span>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="status-date" className="text-xs sm:text-sm font-medium">Status Change Date & Time</Label>
            <div className="relative">
              <Input
                id="status-date"
                type="datetime-local"
                value={statusChangeDate}
                onChange={(e) => setStatusChangeDate(e.target.value)}
                className="h-9 sm:h-10 pl-8 text-xs sm:text-sm"
              />
              <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave as current date/time or select a specific date and time for this status change
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs sm:text-sm font-medium">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this status change..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-xs sm:text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs sm:text-sm font-medium">Upload Image (Optional)</Label>
            <div className="space-y-1">
              {!imagePreview ? (
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-3 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs sm:text-sm text-muted-foreground">Click to upload image</p>
                  <p className="text-xs text-muted-foreground">Max 5MB, JPG, PNG, GIF</p>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-24 sm:h-32 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1 h-5 w-5 sm:h-6 sm:w-6 p-0"
                    onClick={removeImage}
                  >
                    <X className="h-2 w-2 sm:h-3 sm:w-3" />
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={isSubmitting} 
            className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || newStatus === panel?.status || !!validationError}
            className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
          >
            {isSubmitting ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 