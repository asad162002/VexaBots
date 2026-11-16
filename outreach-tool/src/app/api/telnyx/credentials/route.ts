import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const telnyxApiKey = process.env.TELNYX_ACCESS_TOKEN!;

// GET /api/telnyx/credentials — list telephony credentials (admin only).
//
// A WebRTC login token is minted per telephony credential
// (POST /v2/telephony_credentials/{id}/token), so each caller needs a
// credential of their own when they present their own caller-ID number.
//
// Verified against Telnyx docs:
// - List: GET /v2/telephony_credentials
// - The credential id is what profiles.telnyx_credential_id stores.
// - resource_id on each credential names its connection ("connection:<id>"),
//   which is how we tell two credentials on different connections apart.

function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 } as const;
  }

  const supabaseAdmin = adminClient();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.substring(7));
  if (error || !user) {
    return { error: 'Unauthorized', status: 401 } as const;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 } as const;
  }

  return {} as const;
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  if (!telnyxApiKey) {
    console.error('TELNYX_ACCESS_TOKEN is not set.');
    return NextResponse.json({ error: 'Server not configured.' }, { status: 500 });
  }

  try {
    const res = await fetch('https://api.telnyx.com/v2/telephony_credentials?page_size=50', {
      headers: {
        Authorization: `Bearer ${telnyxApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Telnyx credentials API error:', res.status, body);
      return NextResponse.json({ error: 'Failed to fetch Telnyx credentials.' }, { status: 502 });
    }

    const data = await res.json();

    const credentials = (data.data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name || c.sip_username || c.id,
      status: c.status,
      // resource_id looks like "connection:3077960193393297256"
      connectionId: typeof c.resource_id === 'string'
        ? c.resource_id.replace(/^connection:/, '')
        : null,
      sipUsername: c.sip_username ?? null,
    }));

    return NextResponse.json({ data: credentials });
  } catch (err) {
    console.error('Telnyx credentials fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch credentials.' }, { status: 500 });
  }
}
