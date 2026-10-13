import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This route creates a Supabase auth user.
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

    // Generate random password for the user
    const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

    // Create user with email already confirmed (no invite email sent)
    // Also set password so user can log in directly
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      email_confirm: true,
      password: randomPassword,
      user_metadata: {
        full_name: name || '',
      },
      app_metadata: {
        role: role || 'member',
      },
    });

    if (authError) {
      if (authError.message?.includes('already been invited') || authError.message?.includes('already registered')) {
        return NextResponse.json(
          { success: true, message: 'User already exists. They can sign in directly.', email: email.toLowerCase().trim() },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: authError.message || 'Failed to create user' }, { status: 400 });
    }

    // Create profile entry
    if (authData?.user?.id) {
      // Upsert profile
      await supabaseAdmin.from('profiles').upsert({
        id: authData.user.id,
        email: email.toLowerCase().trim(),
        full_name: name || '',
        role: role || 'member',
        created_at: new Date().toISOString(),
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
      message: `Team member added: ${email}. They can sign in with the password provided below or reset it.`,
      user_id: authData?.user?.id,
      password: randomPassword,
    });
  } catch (err) {
    console.error('Invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
