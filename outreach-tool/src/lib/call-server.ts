'use server'

import { createClient } from '@supabase/supabase-js'
import { type CallLog, type CallStatus } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function logCallStart(lead_id: string, caller_id: string, from_number: string, to_number: string) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase not configured')
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { error } = await supabase.from('call_logs').insert({
    lead_id,
    caller_id,
    from_number,
    to_number,
    status: 'initiated',
  })
  if (error) throw error
}

export async function logCallEnd(callId: string, status: CallStatus, durationSeconds: number, recordedUrl?: string) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase not configured')
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  await supabase.from('call_logs').update({
    status,
    duration_seconds: durationSeconds,
    recorded_url: recordedUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', callId)
}

export async function getCallLogsForLead(lead_id: string) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase not configured')
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await supabase
    .from('call_logs')
    .select('*')
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as CallLog[]
}
