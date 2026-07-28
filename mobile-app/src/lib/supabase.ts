import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Supabase credentials from the web app
const supabaseUrl = 'https://xpwvyqhkxucpqvncyprw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwd3Z5cWhreHVjcHF2bmN5cHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjYxNjcsImV4cCI6MjA2ODYwMjE2N30.lMllGoiCHJBbYHs_8CCgIewbXpAOcMmx6ZWRkBh-zQI';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: {
      getItem: (key: string) => SecureStore.getItemAsync(key),
      setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
