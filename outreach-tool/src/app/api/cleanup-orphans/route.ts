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

  // List all auth users
  const { data: listData, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const { data: profiles } = await admin.from('profiles').select('id');
  const profileIds = new Set((profiles ?? []).map((p: { id: string }) => p.id));

  const orphans = (listData?.users ?? []).filter((u) => !profileIds.has(u.id));
  const deleted: string[] = [];
  for (const u of orphans) {
    try {
      await admin.auth.admin.deleteUser(u.id);
      deleted.push(u.email || u.id);
    } catch (e) {
      console.error('delete error', u.id, e);
    }
  }
  return NextResponse.json({ success: true, deleted });
}
