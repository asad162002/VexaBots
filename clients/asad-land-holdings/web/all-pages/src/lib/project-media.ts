import { supabase } from './supabase'
import type { ProjectMedia } from './types'

export async function getProjectMedia(projectId: string): Promise<{ data: ProjectMedia[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('project_media')
    .select('id, project_id, media_type, url, position')
    .eq('project_id', projectId)
    .order('position', { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
