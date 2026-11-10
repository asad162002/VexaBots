import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  // Sign out all sessions for that user
  try {
    await (admin.auth.admin as any).signOut(userId, 'global');
  } catch (e) {
    console.error('signOut error', e);
  }

  // Delete profile (and assignment_limits)
  await admin.from('assignment_limits').delete().eq('profile_id', userId);
  const { error } = await admin.from('profiles').delete().eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Delete auth user too
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch (e) {
    console.error('deleteUser error', e);
  }

  return NextResponse.json({ success: true });
}
