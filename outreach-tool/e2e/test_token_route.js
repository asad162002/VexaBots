const http = require('http');
const https = require('https');
const fs = require('fs');

const envContent = fs.readFileSync('/home/asad/VexaBots/outreach-tool/.env.local', 'utf8');
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const supabaseHost = new URL(supabaseUrl).hostname;
const supabasePort = new URL(supabaseUrl).port || '443';

async function signIn() {
  const payload = JSON.stringify({ email: 'asad@vexabots.com', password: 'test1234' });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: supabaseHost, port: supabasePort,
      path: '/auth/v1/token?grant_type=password', method: 'POST',
      headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json', 'apikey': anonKey },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.access_token) resolve(result.access_token);
          else reject(new Error(result.error || 'No token'));
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  const token = await signIn();
  console.log('Signed in as admin');

  // Call the token endpoint and get full response
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/telnyx/token',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
      console.log('Headers:', JSON.stringify(res.headers));
    });
  });
  req.on('error', (e) => console.error('Error:', e.message));
  req.end();
})();
