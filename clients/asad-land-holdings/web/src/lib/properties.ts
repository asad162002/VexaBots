import { supabase } from './supabase'
import type { Property, PropertyFilters } from './types'

export async function getProperties(filters: PropertyFilters = {}): Promise<{
  data: Property[] | null
  error: string | null
}> {
  let query = supabase.from('public_properties').select('*')

  if (filters.location) query = query.eq('location', filters.location)
  if (filters.property_type) query = query.eq('property_type', filters.property_type)
  if (filters.min_price !== undefined) query = query.gte('price_pkr', filters.min_price)
  if (filters.max_price !== undefined) query = query.lte('price_pkr', filters.max_price)

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    return { data: null, error: error.message }
  }
  return { data, error: null }
}

export async function getPropertyBySlug(slug: string): Promise<{
  data: Property | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('public_properties')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }
  return { data, error: null }
}