import { supabase } from './supabase'

export async function getSiteSettings(): Promise<Record<string, string | null>> {
  const { data, error } = await supabase.from('site_settings').select('key, value')
  if (error || !data) return {}
  return Object.fromEntries(data.map((row) => [row.key, row.value]))
}
