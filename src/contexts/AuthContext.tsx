import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  phone_number?: string;
  role: string;
  department?: string;
  status: string;
  last_login?: string;
  customer_id?: string;
  customer?: Customer;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateLastLogin: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

function isBcryptHash(value: string): boolean {
  return /^\$2[abxy]\$\d{2}\$/.test(value);
}

async function verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
  // Backward compatibility: accept old plain-text stored values
  if (!isBcryptHash(storedHash)) {
    const rawMatch = plainPassword === storedHash;
    const trimmedMatch = plainPassword.trim() === storedHash.trim();
    return rawMatch || trimmedMatch;
  }

  try {
    return await bcrypt.compare(plainPassword, storedHash);
  } catch {
    return false;
  }
}

function isInactiveStatus(status: unknown): boolean {
  if (typeof status !== 'string') {
    return false;
  }
  return status.trim().toLowerCase() === 'inactive';
}

function normalizeIdentity(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      await AsyncStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const normalizedUsername = username.trim();
      const providedPassword = password;

      if (!normalizedUsername || !providedPassword) {
        return { success: false, error: 'Username and password are required' };
      }

      const userSelect = `
        *,
        customer:customers!users_customer_id_fkey(id, name, email, phone)
      `;

      const { data: allUsers, error: usersLookupError } = await supabase
        .from('users')
        .select(userSelect)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(500);

      if (usersLookupError || !allUsers) {
        return { success: false, error: 'Invalid username or password' };
      }

      const normalizedIdentity = normalizeIdentity(normalizedUsername);
      const matchingUsers = allUsers.filter((candidate) => {
        const usernameMatch = normalizeIdentity(candidate.username) === normalizedIdentity;
        const emailMatch = normalizeIdentity(candidate.email) === normalizedIdentity;
        return usernameMatch || emailMatch;
      });

      if (matchingUsers.length === 0) {
        return { success: false, error: 'Invalid username or password' };
      }

      const activeUsers = matchingUsers.filter((candidate) => !isInactiveStatus(candidate.status));
      if (activeUsers.length === 0) {
        return { success: false, error: 'Your account is inactive. Please contact an administrator.' };
      }

      let authenticatedUser: any = null;
      for (const candidate of activeUsers) {
        const passwordIsValid = await verifyPassword(providedPassword, candidate.password_hash ?? '');
        if (passwordIsValid) {
          authenticatedUser = candidate;
          break;
        }
      }

      if (!authenticatedUser) {
        return { success: false, error: 'Invalid username or password' };
      }

      const { password_hash, ...safeUserData } = authenticatedUser;

      // Store user securely
      await AsyncStorage.setItem('user', JSON.stringify(safeUserData));
      setUser(safeUserData);

      // Update last login
      await updateLastLogin(authenticatedUser.id);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An error occurred during login' };
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('user');
    setUser(null);
  };

  const updateLastLogin = async (userId: string) => {
    try {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateLastLogin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};