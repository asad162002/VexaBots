const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('/home/asad/VexaBots/outreach-tool/.env.local', 'utf8');
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();

const supabase = createClient(supabaseUrl, anonKey);

supabase.auth.signInWithPassword({ email: 'asadisdying007@gmail.com', password: 'test1234' })
  .then(async ({ data: { session } }) => {
    const leads = await supabase.from('leads').select('id').limit(1);
    const leadId = leads.data[0].id;
    
    const res = await fetch('http://localhost:3000/api/telnyx/call-log', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_number: '+19165550199', lead_id: leadId }),
    });
    const data = await res.json();
    console.log('Call-log:', res.status, JSON.stringify(data));
    
    const tokenRes = await fetch('http://localhost:3000/api/telnyx/token', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    });
    const tokenData = await tokenRes.json();
    console.log('Token:', tokenRes.status, 'has_token:', !!tokenData.token, 'caller:', tokenData.callerNumber);
  })
  .catch(console.error);
