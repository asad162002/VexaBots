import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/inbound/who?number=+19164821205
//
// Decides whether an inbound call belongs to the rep asking. Everybody registered on
// the shared Telnyx credentials receives the invite, so without this every browser on
// the team would ring for every callback and whoever clicked first would get it.
//
// The rule, in order:
//   1. Nobody known. Let it ring here, someone should pick up a business calling back.
//   2. A lead or contact matches the number and it is assigned to this rep, or the
//      rep last called that number, or the rep is an admin. It is theirs.
//   3. It matches somebody else's lead. Not theirs, so their client hangs up.
//
// The number is matched on digits, because stored numbers are formatted.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface WhoResponse {
  mine: boolean;
  from: string;
  leadId: string | null;
  leadTable: 'leads' | 'linkedin_leads' | null;
  leadName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  lastCallerId: string | null;
  lastCallerName: string | null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!authHeader) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: { user }, error: userError } = await admin.auth.getUser(authHeader);
  if (userError || !user) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
  }

  const from = request.nextUrl.searchParams.get('number') ?? '';
  const digits = from.replace(/\D/g, '');

  const answer: WhoResponse = {
    mine: true, // an unknown caller rings wherever it lands
    from,
    leadId: null,
    leadTable: null,
    leadName: null,
    ownerId: null,
    ownerName: null,
    lastCallerId: null,
    lastCallerName: null,
  };

  const { data: myProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = myProfile?.role === 'admin';

  if (digits) {
    const { data: lead } = await admin
      .from('leads')
      .select('id, title, assigned_to')
      .eq('phone_digits', digits)
      .limit(1)
      .maybeSingle();

    if (lead) {
      answer.leadId = lead.id;
      answer.leadTable = 'leads';
      answer.leadName = lead.title;
      answer.ownerId = lead.assigned_to ?? null;
    } else {
      const { data: contact } = await admin
        .from('linkedin_leads')
        .select('id, lead_name, assigned_to')
        .eq('phone_digits', digits)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (contact) {
        answer.leadId = contact.id;
        answer.leadTable = 'linkedin_leads';
        answer.leadName = contact.lead_name;
        answer.ownerId = contact.assigned_to ?? null;
      }
    }

    // Who last dialed this number out. That is the rep the callback is really for.
    if (answer.leadId) {
      const { data: lastLog } = await admin
        .from('call_logs')
        .select('caller_id')
        .eq(answer.leadTable === 'leads' ? 'lead_id' : 'linkedin_lead_id', answer.leadId)
        .eq('direction', 'outbound')
        .not('caller_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      answer.lastCallerId = lastLog?.caller_id ?? null;
    }

    if (answer.ownerId || answer.lastCallerId) {
      const ids = [answer.ownerId, answer.lastCallerId].filter(Boolean) as string[];
      const { data: people } = await admin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);

      const nameOf = (id: string | null) => {
        if (!id) return null;
        const person = people?.find(p => p.id === id);
        return person?.full_name || person?.email || null;
      };

      answer.ownerName = nameOf(answer.ownerId);
      answer.lastCallerName = nameOf(answer.lastCallerId);
    }

    // A lead that exists is somebody's, so only its owner, whoever last called it, or
    // an admin lets it ring on this line.
    if (answer.ownerId || answer.lastCallerId) {
      answer.mine =
        isAdmin ||
        answer.ownerId === user.id ||
        answer.lastCallerId === user.id;
    }
  }

  return NextResponse.json(answer);
}
