import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const telnyxApiKey = process.env.TELNYX_ACCESS_TOKEN!;

// POST /api/telnyx/assign-credential — admin assigns a Telnyx credential to a member.
//
// Body: { profileId: string, credentialId: string | null }
//
// Without a credential, /api/telnyx/token refuses to mint the WebRTC login JWT
// and the member sees "No Telnyx credential configured for your account".
//
// Written with the service role on purpose: the credential belongs to the
// Telnyx connection, not to the member, so members must never be able to
// grant themselves one. The trigger on profiles also blocks non-admin writes
// to caller_id_number, which is why this has to be an admin-only route.

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
    return { error: 'Admin access required.', status: 403 } as const;
  }

  return {} as const;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { profileId, credentialId } = await request.json().catch(() => ({}));

  if (!profileId || typeof profileId !== 'string') {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
  }

  // Explicit null clears the assignment; anything else must be a real credential.
  if (credentialId !== null && (typeof credentialId !== 'string' || !credentialId.trim())) {
    return NextResponse.json({
      error: 'credentialId must be a credential id or null',
    }, { status: 400 });
  }

  const supabaseAdmin = adminClient();

  const { data: target, error: targetError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, telnyx_credential_id')
    .eq('id', profileId)
    .single();

  if (targetError || !target) {
    return NextResponse.json({ error: 'Team member not found.' }, { status: 404 });
  }

  let assignedId: string | null = null;

  if (credentialId) {
    if (!telnyxApiKey) {
      console.error('TELNYX_ACCESS_TOKEN is not set.');
      return NextResponse.json({ error: 'Server not configured.' }, { status: 500 });
    }

    // Confirm the credential exists and is usable before storing it, so a typo
    // or a deleted credential cannot silently break calling for that member.
    const res = await fetch(
      `https://api.telnyx.com/v2/telephony_credentials/${encodeURIComponent(credentialId)}`,
      {
        headers: {
          Authorization: `Bearer ${telnyxApiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!res.ok) {
      // Telnyx answers 400 (not 404) for an unknown credential id.
      const body = await res.text();
      console.error('Telnyx credential lookup error:', res.status, body);
      return NextResponse.json({
        error: 'That Telnyx credential could not be found or is not usable.',
      }, { status: 400 });
    }

    const cred = await res.json().catch(() => null);
    if (cred?.data?.status && cred.data.status !== 'active') {
      return NextResponse.json({
        error: `That Telnyx credential is ${cred.data.status}, not active.`,
      }, { status: 400 });
    }

    assignedId = credentialId;
  }

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ telnyx_credential_id: assignedId, updated_at: new Date().toISOString() })
    .eq('id', profileId);

  if (updateError) {
    console.error('Failed to assign Telnyx credential:', updateError);
    return NextResponse.json({ error: 'Failed to save the credential.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    profileId,
    telnyx_credential_id: assignedId,
  });
}
