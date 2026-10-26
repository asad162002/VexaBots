const https = require('https');
const fs = require('fs');

const envContent = fs.readFileSync('/home/asad/VexaBots/outreach-tool/.env.local', 'utf8');
const telnyxKey = envContent.match(/TELNYX_ACCESS_TOKEN=(.+)/)[1].trim();

const credentialId = '4b3908b5-1194-4d63-9da9-e9f18e3313c7';

// Test 1: POST to /v2/telephony_credentials/{id}/token
console.log('--- Test 1: POST /v2/telephony_credentials/{id}/token ---');
let payload = JSON.stringify({ expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() });

let req = https.request({
  hostname: 'api.telnyx.com',
  port: 443,
  path: `/v2/telephony_credentials/${credentialId}/token`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${telnyxKey}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);

    // Test 2: Try /v2/telephony_connections/{id}/token as alternative
    console.log('\n--- Test 2: POST /v2/credential_connections/{id}/token ---');
    let payload2 = JSON.stringify({ expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
    let req2 = https.request({
      hostname: 'api.telnyx.com',
      port: 443,
      path: `/v2/credential_connections/3077960193393297256/token`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${telnyxKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload2),
      },
    }, (res2) => {
      let data2 = '';
      res2.on('data', (chunk) => { data2 += chunk; });
      res2.on('end', () => {
        console.log('Status:', res2.statusCode);
        console.log('Response:', data2);
      });
    });
    req2.on('error', (e) => console.error('Test 2 Error:', e.message));
    req2.write(payload2);
    req2.end();
  });
});
req.on('error', (e) => console.error('Test 1 Error:', e.message));
req.write(payload);
req.end();
