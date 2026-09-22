import { NextRequest, NextResponse } from 'next/server';

// This route creates a Supabase user via the Management API
// Requires the Management API PAT in SURPABASE_MANAGEMENT_TOKEN env var

export async function POST(request: NextRequest) {
  try {
    const { email, role, name } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const managementToken = process.env.SUPABASE_MANAGEMENT_TOKEN;
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/(.+?)\.supabase\.co/)?.[1];

    if (!managementToken) {
      return NextResponse.json(
        { error: 'Server not configured. Ask the admin to set SUPABASE_MANAGEMENT_TOKEN.' },
        { status: 500 }
      );
    }

    // Create the auth user via Management API
    const authRes = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/auth/users`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json',
          'apikey': managementToken,
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          send_email_invite: true,
          data: {
            full_name: name || '',
            role: role || 'member',
          },
        }),
      }
    );

    const authData = await authRes.json();

    if (!authRes.ok) {
      // Check if user already exists
      if (authRes.status === 400 && authData.message?.includes('already been invited')) {
        return NextResponse.json(
          { success: true, message: 'User already invited. They can sign in with the existing invite.' },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: authData.message || 'Failed to create user' }, { status: authRes.status });
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
      user_id: authData.id,
    });
  } catch (err) {
    console.error('Invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
