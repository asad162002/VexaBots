import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/telnyx/call-log — inserts a call_logs row for an outbound call.
// This endpoint ONLY creates the log row. It does NOT call any Telnyx REST API.
// The actual call is made via the useTelnyxCall hook using the @telnyx/webrtc SDK.
// The caller is derived from the verified session.
//
// Required body: { to_number: string, lead_id: string }
// The from_number is taken from the caller's profile caller_id_number (their assigned Telnyx number).
// lead_id is REQUIRED because the call_logs.lead_id column is NOT NULL.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!authHeader) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server not configured.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader);
  if (userError || !user) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
  }

  const { to_number, lead_id } = await request.json();

  if (!to_number) {
    return NextResponse.json({ error: 'to_number is required' }, { status: 400 });
  }

  // lead_id is NOT NULL on the call_logs table — enforce it here
  // so the error is a clean 400 instead of a 500 from the DB
  if (!lead_id) {
    return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
  }

  // Derive caller's assigned Telnyx number from the session profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('caller_id_number, telnyx_credential_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.caller_id_number) {
    return NextResponse.json({
      error: 'No phone number assigned to your account. Add one in Settings first.'
    }, { status: 400 });
  }

  const normalizedTo = normalizeToE164(to_number);

  // Insert the call_log row. Status starts as 'initiated'.
  // telnyx_call_control_id / telnyx_call_session_id are populated
  // later by the hook (PATCH) or the webhook.
  const { data: callLog, error: insertError } = await supabaseAdmin
    .from('call_logs')
    .insert({
      caller_id: user.id,
      from_number: profile.caller_id_number,
      to_number: normalizedTo,
      lead_id: lead_id,
      status: 'initiated',
      telnyx_credential_id: profile.telnyx_credential_id,
      created_at: new Date().toISOString(),
    })
    .select('id, from_number, to_number, caller_id, lead_id, status')
    .single();

  if (insertError) {
    console.error('Failed to create call_log:', insertError);
    return NextResponse.json(
      { error: 'Failed to log call. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    callLogId: callLog.id,
    callerNumber: callLog.from_number,
    toNumber: callLog.to_number,
    telnyx_credential_id: profile.telnyx_credential_id || null,
  });
}

function normalizeToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}
