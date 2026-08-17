import { createServiceClient } from './supabase'

export type WebLeadInput = {
  phone: string
  name?: string
  property_type?: string
  location?: string
  budget?: string
  message?: string
  interested_property_id?: string
}

export async function submitWebLead(input: WebLeadInput): Promise<{
  success: boolean
  error: string | null
}> {
  const phone = input.phone.trim()
  if (!phone) {
    return { success: false, error: 'Phone number is required.' }
  }

  const supabase = createServiceClient()

  const { error } = await supabase.rpc('upsert_web_lead', {
    p_phone: phone,
    p_source: 'website_contact_form',
    p_name: input.name?.trim() || null,
    p_property_type: input.property_type?.trim() || null,
    p_location: input.location?.trim() || null,
    p_budget: input.budget?.trim() || null,
    p_message: input.message?.trim() || null,
    p_interested_property_id: input.interested_property_id || null,
  })

  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true, error: null }
}