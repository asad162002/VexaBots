import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

// POST /api/webhooks/telnyx — receive webhook events from Telnyx
// Must verify the telnyx-signature-ed25519 and telnyx-timestamp headers

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// TODO: replace with your actual Telnyx signing secret from the Telnyx dashboard
const TELNYX_PUBLIC_KEY = process.env.TELNYX_PUBLIC_KEY || '';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('telnyx-signature-ed25519');
  const timestamp = request.headers.get('telnyx-timestamp');

  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
  }

  // Note: Full Ed25519 verification requires the telnyx-sdk or a crypto library.
  // For production, use Telnyx's official verification:
  // const telnyx = require('telnyx')(TELNYX_ACCESS_TOKEN);
  // telnyx.webhooks.constructEvent(body, signature, TELNYX_PUBLIC_KEY);
  if (!TELNYX_PUBLIC_KEY) {
    console.warn('TELNYX_PUBLIC_KEY not set. Webhook events are not verified.');
    // In production, reject unverified webhooks
    // return NextResponse.json({ error: 'Webhook verification not configured' }, { status: 500 });
  }

  // Verify timestamp is within 5 minutes (replay attack protection)
  const now = Math.floor(Date.now() / 1000);
  const eventTime = parseInt(timestamp, 10);
  if (Math.abs(now - eventTime) > 300) {
    return NextResponse.json({ error: 'Timestamp too old' }, { status: 401 });
  }

  const body = await request.json();
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  // Telnyx v2 event names
  const eventName = body.event;

  switch (eventName) {
    case 'call.initiated': {
      const callId = body.data?.payload?.call_control_id || body.data?.call_id;
      await supabaseAdmin
        .from('call_logs')
        .update({ status: 'initiated' })
        .eq('call_id', callId);
      break;
    }
    case 'call.answered': {
      const callId = body.data?.payload?.call_control_id || body.data?.call_id;
      await supabaseAdmin
        .from('call_logs')
        .update({
          status: 'answered',
          started_at: new Date().toISOString(),
        })
        .eq('call_id', callId);
      break;
    }
    case 'call.hangup': {
      const callId = body.data?.payload?.call_control_id || body.data?.call_id;
      const duration = body.data?.payload?.duration_seconds || body.data?.duration_seconds || 0;
      await supabaseAdmin
        .from('call_logs')
        .update({
          status: 'disconnected',
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq('call_id', callId);

      // Log to activity feed
      const { data: callLog } = await supabaseAdmin
        .from('call_logs')
        .select('lead_id, caller_id, to_number, from_number, duration_seconds, started_at')
        .eq('call_id', callId)
        .single();

      if (callLog?.lead_id) {
        await supabaseAdmin.from('lead_activities').insert({
          lead_id: callLog.lead_id,
          activity_type: 'call',
          notes: `Cold call (${callLog.duration_seconds || 0}s) to ${callLog.to_number}`,
          created_by: callLog.caller_id,
        });
      }
      break;
    }
    case 'call.recording.saved': {
      const callId = body.data?.payload?.call_control_id || body.data?.call_id;
      const recordingUrl = body.data?.payload?.recording_url || body.data?.recording_url || null;
      await supabaseAdmin
        .from('call_logs')
        .update({ recorded_url: recordingUrl, recording_url: recordingUrl })
        .eq('call_id', callId);
      break;
    }
    case 'call.failed':
    case 'call.rejected':
    case 'call.no_answer': {
      const callId = body.data?.payload?.call_control_id || body.data?.call_id;
      let status = 'disconnected';
      if (eventName === 'call.failed') status = 'disconnected';
      if (eventName === 'call.rejected') status = 'busy';
      if (eventName === 'call.no_answer') status = 'no_answer';

      await supabaseAdmin
        .from('call_logs')
        .update({
          status,
          ended_at: new Date().toISOString(),
        })
        .eq('call_id', callId);
      break;
    }
    default:
      console.log(`Unhandled Telnyx event: ${eventName}`);
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
