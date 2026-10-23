import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// PATCH /api/telnyx/call-log/:id — update a call log row
// Only the caller themselves (or admin) can update their call log.
// The caller_id is verified from the session, not the body.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: callLogId } = await params;

  // Authenticate
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

  const updates = await request.json();

  // Only allow updating specific fields — ignore caller_id override attempts
  const allowedFields: Record<string, any> = {};
  const allowedKeys = ['status', 'duration_seconds', 'ended_at', 'recording_url', 'recorded_url', 'telnyx_call_control_id', 'telnyx_call_session_id'];
  for (const key of allowedKeys) {
    if (key in updates) {
      allowedFields[key] = updates[key];
    }
  }

  const { error } = await supabaseAdmin
    .from('call_logs')
    .update(allowedFields)
    .eq('id', callLogId)
    .eq('caller_id', user.id); // ensures only the caller can update their log

  if (error) {
    console.error('Call log update error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
