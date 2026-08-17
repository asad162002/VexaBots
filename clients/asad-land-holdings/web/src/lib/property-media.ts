import { supabase } from './supabase'
import type { PropertyMedia } from './types'

export async function getPropertyMedia(propertyId: string): Promise<{
  data: PropertyMedia[] | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('public_property_media')
    .select('id, property_id, media_type, url, position, is_cover')
    .eq('property_id', propertyId)
    .order('position', { ascending: true })

  if (error) {
    return { data: null, error: error.message }
  }
  return { data, error: null }
}