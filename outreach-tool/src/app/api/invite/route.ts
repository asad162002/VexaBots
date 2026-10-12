import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This route creates a Supabase auth user and sends an invite email.
// Uses the service_role key for admin operations.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local

export async function POST(request: NextRequest) {
  try {
    const { email, role, name } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server not configured. Set SUPABASE_SERVICE_ROLE_KEY in environment.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    // Create user and send invite email via Admin SDK
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
      {
        data: {
          full_name: name || '',
          role: role || 'member',
        },
      }
    );

    if (authError) {
      // Check if user already exists
      if (authError.message?.includes('already been invited')) {
        return NextResponse.json(
          { success: true, message: 'User already invited. They can sign in with the existing invite.' },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: authError.message || 'Failed to create user' }, { status: 400 });
    }

    // Create profile entry if user was created
    if (authData?.user?.id) {
      await supabaseAdmin.from('profiles').upsert({
        id: authData.user.id,
        email: email.toLowerCase().trim(),
        full_name: name || '',
        role: role || 'member',
      });

      // Create default assignment limit entry (0 = no limit)
      await supabaseAdmin.from('assignment_limits').upsert({
        profile_id: authData.user.id,
        max_leads: 0,
        current_leads: 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
      user_id: authData?.user?.id,
    });
  } catch (err) {
    console.error('Invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
