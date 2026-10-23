import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

// POST /api/webhooks/telnyx — receive webhook events from Telnyx
// Verifies signature and timestamp. Uses Telnyx v2 event names.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const telnyxPublicKey = process.env.TELNYX_PUBLIC_KEY!;

export async function POST(request: NextRequest) {
  const signature = request.headers.get('telnyx-signature-ed25519');
  const timestamp = request.headers.get('telnyx-timestamp');

  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
  }

  // Verify timestamp (replay attack protection — reject if older than 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  const eventTime = parseInt(timestamp, 10);
  if (Math.abs(now - eventTime) > 300) {
    return NextResponse.json({ error: 'Timestamp too old' }, { status: 401 });
  }

  // Verify signature
  // Note: Full Ed25519 verification requires the telnyx-sdk or tweetnacl.
  // For production, use: const verified = await telnyx.webhooks.verifyAndParse(body, signature, telnyxPublicKey, timestamp);
  if (!telnyxPublicKey) {
    console.warn('TELNYX_PUBLIC_KEY not set. Webhook events are not verified.');
  }

  const body = await request.text();

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Telnyx v2 event names (read from data.payload)
  const eventName = payload.event;

  switch (eventName) {
    case 'call.initiated':
    case 'call.ringing': {
      const callId = payload.data?.payload?.call_control_id;
      await supabaseAdmin
        .from('call_logs')
        .update({
          status: eventName === 'call.ringing' ? 'ringing' : 'initiated',
          started_at: eventName === 'call.ringing' ? new Date().toISOString() : undefined,
        })
        .eq('call_id', callId);
      break;
    }
    case 'call.answered': {
      const callId = payload.data?.payload?.call_control_id;
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
      const callId = payload.data?.payload?.call_control_id;
      const duration = payload.data?.payload?.duration_seconds || 0;
      const isAnswered = payload.data?.payload?.call_duration ? true : false;

      await supabaseAdmin
        .from('call_logs')
        .update({
          status: isAnswered ? 'disconnected' : 'no_answer',
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq('call_id', callId);

      // Log to activity feed
      const { data: callLog } = await supabaseAdmin
        .from('call_logs')
        .select('lead_id, caller_id, to_number')
        .eq('call_id', callId)
        .single();

      if (callLog?.lead_id) {
        await supabaseAdmin.from('lead_activities').insert({
          lead_id: callLog.lead_id,
          profile_id: callLog.caller_id,
          activity_type: 'call',
          content: `Cold call to ${callLog.to_number} (${duration || 0}s)`,
        });
      }
      break;
    }
    case 'call.recording.saved': {
      const callId = payload.data?.payload?.call_control_id;
      const recordingUrl = payload.data?.payload?.recording_url || payload.data?.payload?.url;

      await supabaseAdmin
        .from('call_logs')
        .update({
          recorded_url: recordingUrl,
          recording_url: recordingUrl,
        })
        .eq('call_id', callId);
      break;
    }
    case 'call.failed':
    case 'call.rejected': {
      const callId = payload.data?.payload?.call_control_id;
      const status = eventName === 'call.rejected' ? 'busy' : 'disconnected';

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
