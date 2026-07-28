import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase credentials from the web app
const supabaseUrl = 'https://xpwvyqhkxucpqvncyprw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwd3Z5cWhreHVjcHF2bmN5cHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjYxNjcsImV4cCI6MjA2ODYwMjE2N30.lMllGoiCHJBbYHs_8CCgIewbXpAOcMmx6ZWRkBh-zQI';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
