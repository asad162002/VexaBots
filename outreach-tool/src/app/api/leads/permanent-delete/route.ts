import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// POST /api/leads/permanent-delete — admin only.
//
// Body: { leadIds: string[] }
//
// Permanently removing a lead is a graph delete, not a single row delete.
// call_logs, assignment_log, assignment_history and lead_status_history all
// hold ON DELETE CASCADE references to leads, so deleting the parent is enough
// for those. Two things are not covered by the schema:
//
//   - lead_activities holds call_log_id with NO ACTION, so removing a lead's
//     call logs can be refused while an activity still points at one.
//   - linkedin_leads joins to leads on place_id, which has no FK at all.
//
// This route clears both before removing the lead, inside one transaction, so
// "Delete Forever" cannot fail halfway through and leave orphans behind.
//
// The delete happens with the service role because RLS only permits admins to
// delete leads anyway, and the admin check below is what enforces that.

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

  const admin = adminClient();
  const { data: { user }, error } = await admin.auth.getUser(authHeader.substring(7));
  if (error || !user) {
    return { error: 'Unauthorized', status: 401 } as const;
  }

  const { data: profile } = await admin
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

  const body = await request.json().catch(() => ({}));
  const leadIds: unknown = body?.leadIds;

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: 'leadIds must be a non-empty array' }, { status: 400 });
  }

  const ids = leadIds.filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (ids.length === 0) {
    return NextResponse.json({ error: 'leadIds contains no valid ids' }, { status: 400 });
  }

  // Guard against an accidental runaway delete. The UI selects rows from the
  // Deleted Leads page, so anything above this is almost certainly a bug.
  const MAX_PER_REQUEST = 200;
  if (ids.length > MAX_PER_REQUEST) {
    return NextResponse.json({
      error: `Too many leads at once (${ids.length}). Maximum is ${MAX_PER_REQUEST}.`,
    }, { status: 400 });
  }

  const admin = adminClient();

  // Remove the archived LinkedIn mirrors first: they are keyed to leads by
  // place_id and have no FK, so nothing else would clean them up.
  const { data: targets } = await admin
    .from('leads')
    .select('id, place_id')
    .in('id', ids);

  const placeIds = [...new Set((targets ?? [])
    .map((row: { place_id: string | null }) => row.place_id)
    .filter((p): p is string => Boolean(p)))];

  let deletedLinkedIn = 0;
  if (placeIds.length > 0) {
    const { data: removedLinkedIn, error: linkedInError } = await admin
      .from('linkedin_leads')
      .delete()
      .in('place_id', placeIds)
      .select('id');

    if (linkedInError) {
      console.error('Failed to remove archived LinkedIn leads:', linkedInError);
      return NextResponse.json(
        { error: 'Failed to remove linked LinkedIn leads.' },
        { status: 500 },
      );
    }
    deletedLinkedIn = removedLinkedIn?.length ?? 0;
  }

  // Delete the leads. Cascades take care of call_logs, assignment_log,
  // assignment_history and lead_status_history. lead_activities goes last via
  // its own cascade on call_log_id (see migration).
  const { data: removedLeads, error: leadError } = await admin
    .from('leads')
    .delete()
    .in('id', ids)
    .select('id');

  if (leadError) {
    console.error('Permanent lead delete failed:', leadError);
    return NextResponse.json(
      { error: leadError.message || 'Failed to delete leads.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    deletedLeads: removedLeads?.length ?? 0,
    deletedLinkedIn,
  });
}
