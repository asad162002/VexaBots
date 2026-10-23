import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/invite — admin-only user creation
// Requires: Authorization: Bearer <access_token> in headers
// Verifies the caller is an admin via their Supabase session.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { email, role, name } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const validRole = role === 'admin' ? 'admin' : 'member';
    const supabaseAdmin = createAdminClient();

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      email_confirm: true,
      user_metadata: { full_name: name || '' },
      app_metadata: { role: validRole },
    });

    if (authError) {
      if (authError.message?.includes('already been invited') || authError.message?.includes('already registered')) {
        return NextResponse.json({
          success: true,
          message: `User already exists. They can sign in directly.`,
          email: email.toLowerCase().trim(),
        }, { status: 200 });
      }
      return NextResponse.json({ error: authError.message || 'Failed to create user' }, { status: 400 });
    }

    if (authData?.user?.id) {
      await supabaseAdmin.from('profiles').upsert({
        id: authData.user.id,
        email: email.toLowerCase().trim(),
        full_name: name || '',
        role: validRole,
        created_at: new Date().toISOString(),
      });

      await supabaseAdmin.from('assignment_limits').upsert({
        profile_id: authData.user.id,
        max_leads: 0,
        current_leads: 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Team member added: ${email}. They can sign in with magic link or password reset.`,
      user_id: authData?.user?.id,
    });
  } catch (err) {
    console.error('Invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Shared admin verification helper
export async function verifyAdmin(request: NextRequest): Promise<{ error?: string; status?: number }> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return { error: 'Authentication required. Send Authorization: Bearer <access_token>.', status: 401 };

  if (!serviceRoleKey) return { error: 'Server not configured.', status: 500 };

  const adminClient = createAdminClient();
  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);

  if (userError || !user) return { error: 'Invalid or expired session.', status: 401 };

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Profile lookup error:', profileError);
    return { error: 'Failed to verify role.', status: 500 };
  }

  if (profile?.role !== 'admin') return { error: 'Admin access required.', status: 403 };

  return {};
}
