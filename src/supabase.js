import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || supabaseUrl.includes('XXXXXXX')) {
  console.error('⚠️  Configure o arquivo .env com suas credenciais do Supabase!')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
