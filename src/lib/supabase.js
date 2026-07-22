import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing Supabase env vars')
}

export const cleanUrl = url ? url.replace(/[^\x00-\x7F]/g, '') : ''
export const cleanKey = key ? key.replace(/[^\x00-\x7F]/g, '') : ''

export const supabase = createClient(cleanUrl, cleanKey)
