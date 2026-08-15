import { supabase } from './supabase'
import type { Project } from './types'

export async function getProjects(): Promise<{ data: Project[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('public_construction_projects')
    .select('*')
    .order('expected_end_date', { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function getProjectBySlug(slug: string): Promise<{ data: Project | null; error: string | null }> {
  const { data, error } = await supabase
    .from('public_construction_projects')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
