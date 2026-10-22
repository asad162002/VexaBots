import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Telnyx API route for making outbound calls
// Uses raw fetch - no SDK needed

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TELNYX_ACCESS_TOKEN = process.env.TELNYX_ACCESS_TOKEN;

if (!TELNYX_ACCESS_TOKEN) {
  console.warn('TELNYX_ACCESS_TOKEN is not set. Outbound calls will not work.');
}

function getTelnyxHeaders() {
  return {
    Authorization: `Bearer ${TELNYX_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

// POST /api/call - Start an outbound call
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, callerId, fromNumber, toNumber } = body;

    if (!TELNYX_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Carrier not configured. Add TELNYX_ACCESS_TOKEN to environment.' },
        { status: 503 }
      );
    }

    if (!fromNumber || !toNumber) {
      return NextResponse.json({ error: 'fromNumber and toNumber are required' }, { status: 400 });
    }

    // Step 1: Create a call using the Telnyx Outbound API
    const callResponse = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: getTelnyxHeaders(),
      body: JSON.stringify({
        from_number: fromNumber,
        to_number: toNumber,
        connect_contracts: [
          {
            actions: [
              {
                name: 'play_blank',
                method: 'play_blank',
              },
            ],
            to_branch: [
              {
                actions: [
                  {
                    name: 'hangup',
                    method: 'hangup',
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    if (!callResponse.ok) {
      const errBody = await callResponse.text();
      console.error('Telnyx call creation error:', errBody);
      return NextResponse.json({ error: `Telnyx API error: ${errBody}` }, { status: callResponse.status });
    }

    const callData = await callResponse.json();
    const callId = callData.id;

    // Step 2: Log the call start in Supabase using service role key (bypasses RLS)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseService = createClient(supabaseUrl, serviceRoleKey);
      const { error: logError } = await supabaseService.from('call_logs').insert({
        lead_id: leadId,
        caller_id: callerId,
        from_number: fromNumber,
        to_number: toNumber,
        status: 'initiated',
      });

      if (logError) {
        console.error('Supabase log error:', logError);
      }
    } else {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set. Call log not saved.');
    }

    // Return the call ID to the client
    return NextResponse.json({ callId });
  } catch (error) {
    console.error('Call initiation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate call' },
      { status: 500 }
    );
  }
}

// GET /api/call/[callId]/events - SSE stream for call status updates
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const callId = searchParams.get('callId');

  if (!callId) {
    return NextResponse.json({ error: 'callId is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const setState = (status: string, message: string) => {
        const data = JSON.stringify({ status, message });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      try {
        // Poll Telnyx for call status
        const pollInterval = setInterval(async () => {
          try {
            const resp = await fetch(`https://api.telnyx.com/v2/calls/${callId}`, {
              headers: getTelnyxHeaders(),
            });

            if (resp.ok) {
              const callData = await resp.json();
              const status = callData.status;

              if (status === 'connected') {
                setState('answered', 'connected');
              } else if (status === 'busy') {
                setState('busy', 'busy');
              } else if (status === 'no-answer') {
                setState('no_answer', 'no_answer');
              } else if (status === 'completed' || status === 'canceled' || status === 'failed') {
                setState('disconnected', 'call ended');
                controller.close();
                clearInterval(pollInterval);
              } else {
                setState('ringing', status);
              }
            }
          } catch (err) {
            console.error('Error polling call status:', err);
          }
        }, 3000);

        // Initial state
        setState('initiated', 'initiated');

        // Clean up on client disconnect
        req.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          controller.close();
        });
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
