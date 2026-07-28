import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Alert } from 'react-native';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // For React Native, we'll use Alert for now
    // In a production app, you might want to use a more sophisticated toast library
    Alert.alert(
      type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info',
      message,
      [{ text: 'OK' }]
    );
  };

  const value = {
    showToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}