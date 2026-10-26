const fs = require('fs');
const https = require('https');

const envContent = fs.readFileSync('/home/asad/VexaBots/outreach-tool/.env.local', 'utf8');
const keyMatch = envContent.match(/TELNYX_ACCESS_TOKEN=(.+)/);
const TELNYX_KEY = keyMatch[1].trim();

// The webhook URL for the app - we need to set this up
const WEBHOOK_URL = "https://your-app-url.com/api/webhooks/telnyx";

// Get the existing connection and update its webhook URL
const connectionId = "3077960193393297256";

const payload = JSON.stringify({
  webhook_url: WEBHOOK_URL,
  webhook_event_secret: "telnyx-secret-" + Date.now().toString(36)  // Generate a secret
});

const options = {
  hostname: 'api.telnyx.com',
  port: 443,
  path: `/v2/telephony_connections/${connectionId}`,
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${TELNYX_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Update Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => { console.error('Error:', e.message); });
req.write(payload);
req.end();
