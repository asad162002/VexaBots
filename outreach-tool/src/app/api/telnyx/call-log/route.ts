import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/telnyx/call-log — inserts a call_logs row for an outbound call.
// This endpoint ONLY creates the log row. It does NOT call any Telnyx REST API.
// The caller is derived from the verified session.
//
// Required body: { to_number: string, lead_id?: string }
// The from_number is taken from the caller's profile (phone_number).

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

  // Derive caller's phone number from the session
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('phone_number, telnyx_credential_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.phone_number) {
    return NextResponse.json({
      error: 'No phone number assigned to your account. Add one in Settings first.'
    }, { status: 400 });
  }

  const normalizedTo = normalizeToE164(to_number);

  // Insert the call_log row. Status starts as 'initiated'.
  // telnyx_call_id is populated later via the webhook
  // (POST /api/webhooks/telnyx) or PATCH /api/telnyx/call-log/[id].
  const { data: callLog, error: insertError } = await supabaseAdmin
    .from('call_logs')
    .insert({
      caller_id: user.id,
      from_number: profile.phone_number,
      to_number: normalizedTo,
      lead_id: lead_id || null,
      status: 'initiated',
      created_at: new Date().toISOString(),
    })
    .select('id, from_number, to_number, caller_id, lead_id, status, telnyx_credential_id')
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
