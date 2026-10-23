import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/telnyx/call — initiate an outbound Telnyx call via Call Control API
// Requires: Authorization: Bearer <access_token> in headers
// The caller is always derived from the verified session; callerId in the
// request body is ignored (security: prevents impersonation).
//
// NOTE: This REST endpoint is kept for backwards compatibility but the
// preferred path is WebRTC via /api/telnyx/token + the useTelnyxCall hook.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const telnyxToken = process.env.TELNYX_ACCESS_TOKEN!;

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

  // Derive caller from the session, NOT from the request body
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('phone_number, full_name')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.phone_number) {
    return NextResponse.json({
      error: 'No phone number assigned to your account. Add one in Settings first.'
    }, { status: 400 });
  }

  const { leadPhone, leadName, leadId } = await request.json();
  if (!leadPhone) {
    return NextResponse.json({ error: 'leadPhone is required' }, { status: 400 });
  }

  const fromNumber = profile.phone_number;
  const normalizedTo = normalizeToE164(leadPhone);

  try {
    const response = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${telnyxToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        from_display_name: profile.full_name || '',
        to: normalizedTo,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/telnyx`,
        webhook_url_method: 'POST',
        timeout_secs: 30,
        record: 'record-from-answer-dual',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Telnyx API error:', errorData);
      return NextResponse.json(
        { error: `Telnyx API error: ${errorData}` },
        { status: response.status }
      );
    }

    const callData = await response.json();
    // Telnyx returns call_control_id (not data.id) for the /v2/calls endpoint
    const callControlId = callData?.data?.call_control_id ?? callData?.data?.id ?? callData?.call_control_id;

    if (!callControlId) {
      console.error('Unexpected Telnyx response (no call_control_id):', JSON.stringify(callData));
      return NextResponse.json(
        { error: 'Telnyx returned unexpected response shape' },
        { status: 502 }
      );
    }

    // Store the call_control_id as call_id
    const { data: callLog, error: insertError } = await supabaseAdmin
      .from('call_logs')
      .insert({
        call_id: callControlId,
        caller_id: user.id,
        from_number: fromNumber,
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

    return NextResponse.json({
      success: true,
      callId: callControlId,
      callLogId: callLog?.id,
      fromNumber,
      toNumber: normalizedTo,
    });
  } catch (err) {
    console.error('Call initiation error:', err);
    return NextResponse.json({ error: 'Failed to initiate call' }, { status: 500 });
  }
}

// GET /api/telnyx/call — fetch recent call logs for the session user
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
