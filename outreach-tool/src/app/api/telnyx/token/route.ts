import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/telnyx/token — returns a short-lived WebRTC login token (JWT)
// for the authenticated member, using their assigned Telnyx credential.
//
// What I verified from Telnyx's official docs:
// - The WebRTC SDK authenticates with a `login_token` (JWT), not a username/password
// - The JWT is generated via: POST /v2/telephony_credentials/{id}/token
//   (NOT /v2/connections/tokens — that endpoint does not exist)
// - The {id} is the ID of a Telnyx "telephony credential" (created under a
//   credential connection via POST /v2/telephony_credentials)
// - The request body can include a `expires_at` to set token TTL (max 24h)
// - The response body IS the JWT string (not JSON-wrapped)
//
// Telnyx portal resources you must create:
// 1. A "Credential Connection" (type: credential) in Voice → Connections
// 2. Your member's US phone number assigned as the caller-ID on that connection
// 3. A telephony credential (SIP username) under the credential connection
//    — the credential ID goes in profiles.telnyx_credential_id
// 4. Route your Telnyx phone number to the credential connection

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const telnyxApiKey = process.env.TELNYX_ACCESS_TOKEN!;

export async function GET(request: NextRequest) {
  // Authenticate: require a valid session
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

  // Load the member's profile to get their Telnyx credential ID and assigned caller-ID number
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('caller_id_number, telnyx_credential_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  if (!profile.telnyx_credential_id) {
    return NextResponse.json({
      error: 'No Telnyx credential configured for your account. Contact your admin.'
    }, { status: 400 });
  }

  if (!telnyxApiKey) {
    console.error('TELNYX_ACCESS_TOKEN is not set.');
    return NextResponse.json({ error: 'Server not configured.' }, { status: 500 });
  }

  // Generate a WebRTC login token (JWT) from the Telnyx API
  // Endpoint: POST https://api.telnyx.com/v2/telephony_credentials/{id}/token
  // The {id} is the telephony credential's ID (not the connection ID)
  // Verified against Telnyx docs: https://developers.telnyx.com/docs/development/webrtc/js-sdk/how-to/authenticating-your-app
  try {
    const response = await fetch(
      `https://api.telnyx.com/v2/telephony_credentials/${profile.telnyx_credential_id}/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${telnyxApiKey}`,
          'Content-Type': 'application/json',
        },
        // Set a short expiry (30 minutes) — long enough for a calling session
        body: JSON.stringify({
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Telnyx token API error:', response.status, errorBody);
      return NextResponse.json(
        { error: `Failed to generate Telnyx token: ${errorBody}` },
        { status: response.status }
      );
    }

    // The response body is the raw JWT string (not JSON)
    const token = await response.text();

    return NextResponse.json({ token, callerNumber: profile.caller_id_number });
  } catch (err) {
    console.error('Telnyx token generation error:', err);
    return NextResponse.json({ error: 'Failed to generate token.' }, { status: 500 });
  }
}
