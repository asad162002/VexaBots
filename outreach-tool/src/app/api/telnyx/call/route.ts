import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TELNYX_API_KEY = process.env.TELNYX_ACCESS_TOKEN!;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

export async function POST(req: NextRequest) {
  try {
    const { callerId, leadId, leadName, leadPhone } = await req.json();

    if (!callerId || !leadPhone) {
      return NextResponse.json({ error: 'Missing required fields: callerId, leadPhone' }, { status: 400 });
    }

    // Get the caller's assigned phone number from profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('phone_number, full_name')
      .eq('id', callerId)
      .single();

    if (profileError || !profile?.phone_number) {
      return NextResponse.json({ error: 'No phone number assigned to your account. Add one in Settings first.' }, { status: 400 });
    }

    const fromNumber = profile.phone_number;

    // Create the call via Telnyx API
    const response = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        to: leadPhone,
        webhook_url: 'https://api.telnyx.com/v2/webhooks',
        webhook_timeout: 30,
        record_audio: true,
        caller_name: leadName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Telnyx API error:', errorData);
      return NextResponse.json({ error: `Telnyx API error: ${errorData}` }, { status: response.status });
    }

    const callData = await response.json();
    const callId = callData.data?.id;

    // Log the call in call_logs
    await supabaseAdmin.from('call_logs').insert({
      call_id: callId,
      caller_id: callerId,
      from_number: fromNumber,
      to_number: leadPhone,
      lead_id: leadId,
      status: 'initiated',
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, callId, fromNumber, toNumber: leadPhone });
  } catch (error) {
    console.error('Call initiation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const callerId = searchParams.get('callerId');

    if (!callerId) {
      return NextResponse.json({ error: 'Missing callerId parameter' }, { status: 400 });
    }

    const { data: callLogs, error } = await supabaseAdmin
      .from('call_logs')
      .select('*')
      .eq('caller_id', callerId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ callLogs });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
