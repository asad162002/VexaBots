import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/telnyx/call — creates a call_logs row for an outbound call.
// Does NOT call Telnyx REST API. The actual call is made via the
// useTelnyxCall hook using the @telnyx/webrtc SDK in the browser.
// The call_id / telnyx_call_id are populated later via the webhook
// or the PATCH /api/telnyx/call-log/[id] endpoint.
//
// Security: the caller is always derived from the verified session;
// callerId / callerNumber in the request body are ignored (prevents impersonation).
// The caller's telnyx_credential_id is fetched from profiles and returned
// so the client knows which Telnyx credential to use.

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

  const { leadPhone, leadName, leadId } = await request.json();
  if (!leadPhone) {
    return NextResponse.json({ error: 'leadPhone is required' }, { status: 400 });
  }

  // Normalize the lead phone to E.164
  const normalizedTo = normalizeToE164(leadPhone);

  // Derive caller from the session — fetch phone_number + telnyx_credential_id
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('phone_number, full_name, telnyx_credential_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.phone_number) {
    return NextResponse.json({
      error: 'No phone number assigned to your account. Add one in Settings first.'
    }, { status: 400 });
  }

  const callerNumber = profile.phone_number;

  // Create the call_log row (status = 'initiated', no telnyx_call_id yet)
  // The telnyx_call_id / call_id will be populated by the webhook
  const { data: callLog, error: insertError } = await supabaseAdmin
    .from('call_logs')
    .insert({
      caller_id: user.id,
      from_number: callerNumber,
      to_number: normalizedTo,
      lead_id: leadId || null,
      status: 'initiated',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to create call_log:', insertError);
    return NextResponse.json(
      { error: 'Failed to log call. Please try again.' },
      { status: 500 }
    );
  }

  // Return the call_log_id and caller info so the client hook can
  // use the SDK to make the WebRTC call, then update the log later.
  return NextResponse.json({
    success: true,
    callLogId: callLog?.id,
    callerNumber,
    toNumber: normalizedTo,
    telnyx_credential_id: profile.telnyx_credential_id || null,
  });
}

// GET /api/telnyx/call — fetch recent call logs for the session user
// (admins can optionally pass ?callerId=uuid to view another caller's logs)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!authHeader) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader);
  if (userError || !user) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const callerId = searchParams.get('callerId');

  let query = supabaseAdmin
    .from('call_logs')
    .select('*')
    .eq('caller_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Admins can view any caller's logs
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin' && callerId && callerId !== user.id) {
    query = supabaseAdmin
      .from('call_logs')
      .select('*')
      .eq('caller_id', callerId)
      .order('created_at', { ascending: false })
      .limit(50);
  }

  const { data: callLogs, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ callLogs });
}

// Normalize to E.164 format
function normalizeToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`; // US default
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone; // already E.164
  return `+${digits}`; // best-effort
}
