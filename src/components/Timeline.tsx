import { AlertCircle, Ban, CheckCircle, Clock, Package, PauseCircle, Truck, XCircle, Image as ImageIcon, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PanelModel } from './project-details/PanelsSection';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface TimelineProps {
  panel: PanelModel;
}

interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  previousStatus?: string;
  user?: {
    name: string;
    username: string;
  };
  notes?: string;
  image_url?: string;
}

const PANEL_STATUSES = [
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
  'Broken at Site',
] as const;

export function Timeline({ panel }: TimelineProps) {
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  // Map integer status from database to human-readable status
  const statusMap: { [key: number]: string } = Object.fromEntries(
    PANEL_STATUSES.map((status, index) => [index, status])
  );

  // Fetch status history from Supabase
  useEffect(() => {
    async function fetchStatusHistory() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('panel_status_histories')
          .select(`
            status, 
            created_at,
            user_id,
            notes,
            image_url,
            users!panel_status_histories_user_id_fkey(id, name, username)
          `)
          .eq('panel_id', panel.id)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        console.log('Raw status history data:', data);
        
        const history: StatusHistoryEntry[] = data.map((entry, index, arr) => {
          console.log('Processing entry:', entry);
          
          // Handle user data - try different possible structures
          let user = undefined;
          if (entry.users) {
            if (Array.isArray(entry.users) && entry.users.length > 0) {
              user = {
                name: entry.users[0]?.name || 'Unknown User',
                username: entry.users[0]?.username || 'unknown'
              };
            } else if (typeof entry.users === 'object' && 'name' in entry.users) {
              user = {
                name: (entry.users as any).name || 'Unknown User',
                username: (entry.users as any).username || 'unknown'
              };
            }
          }
          
          console.log('Extracted user:', user);
          
          return {
            status: statusMap[entry.status] || 'Unknown',
            timestamp: entry.created_at,
            previousStatus: index < arr.length - 1 ? statusMap[arr[index + 1].status] || 'Unknown' : undefined,
            user: user,
            notes: entry.notes,
            image_url: entry.image_url,
          };
        });
        
        console.log('Processed history:', history);

        setStatusHistory(history);
      } catch (err) {
        setError('Failed to fetch status history');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchStatusHistory();
  }, [panel.id]);

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'Produced': 'bg-status-produced text-status-produced-foreground',
      "Issued For Production": 'bg-status-checked text-status-checked-foreground',
      'Inspected': 'bg-status-inspected text-status-inspected-foreground',
      'Approved Material': 'bg-status-approved-material text-status-approved-material-foreground',
      'Rejected Material': 'bg-status-rejected-material text-status-rejected-material-foreground',
      'Issued': 'bg-status-issued text-status-issued-foreground',
      'Proceed for Delivery': 'bg-status-proceed-delivery text-status-proceed-delivery-foreground',
      'Delivered': 'bg-status-delivered text-status-delivered-foreground',
      'Installed': 'bg-status-installed text-status-installed-foreground',
      'Approved Final': 'bg-status-approved-final text-status-approved-final-foreground',
      'Broken at Site': 'bg-status-broken text-status-broken-foreground',
      'On Hold': 'bg-status-held text-status-held-foreground',
      'Cancelled': 'bg-status-cancelled text-status-cancelled-foreground',
    };

    return statusColors[status] || 'bg-secondary text-secondary-foreground';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Issued For Production':
        return <Package className="h-3 w-3" />;
      case 'Produced':
        return <Package className="h-3 w-3" />;
      case 'Inspected':
        return <AlertCircle className="h-3 w-3" />;
      case 'Approved Material':
        return <CheckCircle className="h-3 w-3" />;
      case 'Rejected Material':
        return <XCircle className="h-3 w-3" />;
      case 'Issued':
        return <Package className="h-3 w-3" />;
      case 'Proceed for Delivery':
        return <Truck className="h-3 w-3" />;
      case 'Delivered':
        return <Truck className="h-3 w-3" />;
      case 'Installed':
        return <CheckCircle className="h-3 w-3" />;
      case 'Approved Final':
        return <CheckCircle className="h-3 w-3" />;
      case 'Broken at Site':
        return <XCircle className="h-3 w-3" />;
      case 'On Hold':
        return <PauseCircle className="h-3 w-3" />;
      case 'Cancelled':
        return <Ban className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
  };

  const handleImageClick = (imageUrl: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    console.log('Image clicked:', imageUrl);
    console.log('Setting modal state to true');
    setSelectedImage(imageUrl);
    setIsImageModalOpen(true);
    setImageLoading(true);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isImageModalOpen) {
      setIsImageModalOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isImageModalOpen]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading status history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  console.log('Modal state:', { isImageModalOpen, selectedImage });
  
  return (
    <div className="space-y-3">
      
      
      {statusHistory.length > 0 ? (
        <div className="space-y-3">
          {statusHistory.map((entry, index) => {
            const { date, time } = formatDateTime(entry.timestamp);
            const isLatest = index === 0;

            return (
              <div key={index} className="flex items-start gap-3">
                <div className="flex flex-col items-center flex-shrink-0 mt-1">
                  <div className={`p-1.5 rounded-full ${isLatest ? 'bg-primary' : 'bg-muted'}`}>
                    {getStatusIcon(entry.status)}
                  </div>
                  {index < statusHistory.length - 1 && (
                    <div className="w-0.5 h-6 bg-border mt-1" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-3 overflow-hidden">
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    <Badge className={`${getStatusColor(entry.status)} text-xs flex-shrink-0`}>{entry.status}</Badge>
                    <span className="text-xs text-muted-foreground break-words">
                      {date} at {time}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {entry.previousStatus && entry.user && (
                      <p className="text-xs text-muted-foreground break-words leading-relaxed">
                        Changed from {entry.previousStatus} to {entry.status} by {entry.user.name}
                      </p>
                    )}
                    {entry.previousStatus && !entry.user && (
                      <p className="text-xs text-muted-foreground break-words leading-relaxed">
                        Changed from {entry.previousStatus} to {entry.status}
                      </p>
                    )}
                    {!entry.previousStatus && entry.user && (
                      <p className="text-xs text-muted-foreground break-words leading-relaxed">
                        Status set to {entry.status} by {entry.user.name}
                      </p>
                    )}
                    
                    {entry.notes && (
                      <div className="bg-muted/25 p-2 rounded-lg">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <span className="font-medium">Notes:</span> {entry.notes}
                        </p>
                      </div>
                    )}
                    
                    {entry.image_url && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Attached Image:</p>
                        <div className="relative group">
                          <button
                            className="block w-24 h-24 relative overflow-hidden rounded-lg border hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onClick={(e) => handleImageClick(entry.image_url!, e)}
                            title="Click to view full screen"
                          >
                            <img
                              src={entry.image_url}
                              alt="Status change documentation"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                              <div className="bg-white/90 backdrop-blur-sm rounded-full p-2">
                                <ImageIcon className="h-4 w-4 text-gray-700" />
                              </div>
                            </div>
                            <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              <span className="text-[10px]">👁</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6">
          <Clock className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No status history available</p>
        </div>
      )}

      {/* Image Modal */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Status Change Documentation</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center p-6 pt-0 overflow-hidden">
            {selectedImage && (
              <div className="relative w-full h-full flex items-center justify-center">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="text-sm text-muted-foreground">Loading image...</p>
                    </div>
                  </div>
                )}
                <img
                  src={selectedImage}
                  alt="Status change documentation"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  style={{ maxWidth: '90vw', maxHeight: '80vh' }}
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm hover:bg-background"
                  onClick={() => {
                    setIsImageModalOpen(false);
                    setImageLoading(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}