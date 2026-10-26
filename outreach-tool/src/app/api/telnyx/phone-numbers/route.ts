import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const telnyxApiKey = process.env.TELNYX_ACCESS_TOKEN!;

export async function GET(request: Request) {
  // Verify the caller is an admin
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const admin = createClient(supabaseUrl, supabaseServiceRole);
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // Fetch phone numbers from Telnyx
  const res = await fetch('https://api.telnyx.com/v2/phone_numbers', {
    headers: {
      'Authorization': `Bearer ${telnyxApiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    return new Response(JSON.stringify({ error: 'Failed to fetch Telnyx numbers', detail: errorText }), { status: 502 });
  }

  const telnyxData = await res.json();

  // Format the numbers
  const numbers = telnyxData.data.map((n: any) => ({
    id: n.id,
    phone_number: n.phone_number,
    country: n.country_code,
  }));

  return new Response(JSON.stringify({ data: numbers }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
