import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/telnyx/token — returns a short-lived Telnyx browser token
// Requires: Authorization: Bearer <access_token>
// The caller is derived from the verified session, never from the request body.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const telnyxToken = process.env.TELNYX_ACCESS_TOKEN!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  if (!serviceRoleKey) return NextResponse.json({ error: 'Server not configured.' }, { status: 500 });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });

  // Get the user's phone number from their profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('phone_number')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.phone_number) {
    return NextResponse.json({
      error: 'No phone number assigned. Add a US number in Settings first.'
    }, { status: 400 });
  }

  try {
    // Request a short-lived browser token from Telnyx
    const response = await fetch('https://api.telnyx.com/v2/connections/tokens', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${telnyxToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // The caller's phone number (must be a Telnyx number assigned to your account)
        from_number: profile.phone_number,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Telnyx token error:', err);
      return NextResponse.json({ error: `Failed to get Telnyx token: ${err}` }, { status: response.status });
    }

    const tokenData = await response.json();
    return NextResponse.json({
      success: true,
      token: tokenData.data?.token,
      expires_at: tokenData.data?.expires_at,
    });
  } catch (err) {
    console.error('Token error:', err);
    return NextResponse.json({ error: 'Failed to get Telnyx token' }, { status: 500 });
  }
}
