import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const body = await request.json();

    // Handle Telnyx webhook events
    if (body && body.event) {
      const event = body.event;
      
      switch (event) {
        case 'callAnswered': {
          const telnyxCallId = body.data?.call_id || body.data?.payload?.call_control_id;
          await supabaseAdmin
            .from('call_logs')
            .update({ status: 'answered', started_at: new Date().toISOString() })
            .eq('call_id', telnyxCallId);
          break;
        }

        case 'callCompleted': {
          const telnyxCallId = body.data?.call_id || body.data?.payload?.call_control_id;
          const duration = body.data?.duration_seconds || body.data?.payload?.duration_seconds || 0;
          await supabaseAdmin
            .from('call_logs')
            .update({
              status: 'completed',
              ended_at: new Date().toISOString(),
              duration_seconds: duration,
            })
            .eq('call_id', telnyxCallId);

          // Log to activity log if linked to a lead
          const { data: callLog } = await supabaseAdmin
            .from('call_logs')
            .select('lead_id, caller_id, to_number, from_number, duration_seconds, started_at')
            .eq('call_id', telnyxCallId)
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

        case 'callRecordingAvailable': {
          const telnyxCallId = body.data?.call_id || body.data?.payload?.call_control_id;
          const recordingUrl = body.data?.recording_url || body.data?.payload?.recording_url || null;
          await supabaseAdmin
            .from('call_logs')
            .update({ recording_url: recordingUrl })
            .eq('call_id', telnyxCallId);
          break;
        }

        case 'callFailed': {
          const telnyxCallId = body.data?.call_id || body.data?.payload?.call_control_id;
          await supabaseAdmin
            .from('call_logs')
            .update({ status: 'failed', ended_at: new Date().toISOString() })
            .eq('call_id', telnyxCallId);
          break;
        }

        default:
          console.log(`Unhandled Telnyx event: ${event}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
