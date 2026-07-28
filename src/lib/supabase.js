import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

// Validate that environment variables are loaded
if (!supabaseUrl) {
  throw new Error('Missing REACT_APP_SUPABASE_URL environment variable')
}
if (!supabaseKey) {
  throw new Error('Missing REACT_APP_SUPABASE_ANON_KEY environment variable')
}

export const supabase = createClient(supabaseUrl, supabaseKey)