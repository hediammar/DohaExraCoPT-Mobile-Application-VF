import React from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  isVisible: boolean;
}

export function Toast({ message, type, onClose, isVisible }: ToastProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-bottom-2 duration-300">
      <div className={cn(
        "flex items-center gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm",
        "min-w-[300px] max-w-[400px]",
        type === 'success' 
          ? "bg-green-50 border-green-200 text-green-800" 
          : "bg-red-50 border-red-200 text-red-800"
      )}>
        <div className="flex-shrink-0">
          {type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-green-600">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-full p-1 hover:bg-black/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Toast manager hook
export function useToast() {
  const [toasts, setToasts] = React.useState<Array<{
    id: string;
    message: string;
    type: 'success' | 'error';
    isVisible: boolean;
  }>>([]);

  const showToast = React.useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { id, message, type, isVisible: true };
    
    setToasts(prev => [...prev, newToast]);

    // Auto-hide after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.map(toast => 
        toast.id === id ? { ...toast, isVisible: false } : toast
      ));
      
      // Remove from array after animation
      setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
      }, 300);
    }, 4000);
  }, []);

  const hideToast = React.useCallback((id: string) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, isVisible: false } : toast
    ));
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 300);
  }, []);

  return { toasts, showToast, hideToast };
}

// Toast container component
export function ToastContainer() {
  const { toasts, hideToast } = useToast();

  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={() => hideToast(toast.id)}
        />
      ))}
    </div>
  );
} 