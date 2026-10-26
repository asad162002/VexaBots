const https = require('https');
const fs = require('fs');

const envContent = fs.readFileSync('/home/asad/VexaBots/outreach-tool/.env.local', 'utf8');
const telnyxKey = envContent.match(/TELNYX_ACCESS_TOKEN=(.+)/)[1].trim();

const credentialId = '4b3908b5-1194-4d63-9da9-e9f18e3313c7';

// Try fetching the credential directly
const options = {
  hostname: 'api.telnyx.com',
  port: 443,
  path: `/v2/telephony_credentials/${credentialId}`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${telnyxKey}`,
    'Content-Type': 'application/json',
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('GET /v2/telephony_credentials/{id} ->', res.statusCode);
    console.log('Response:', data);

    // Also try listing all credentials
    const listReq = https.request({
      hostname: 'api.telnyx.com',
      port: 443,
      path: '/v2/telephony_credentials',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${telnyxKey}`,
        'Content-Type': 'application/json',
      },
    }, (listRes) => {
      let listData = '';
      listRes.on('data', (chunk) => { listData += chunk; });
      listRes.on('end', () => {
        console.log('\nGET /v2/telephony_credentials ->', listRes.statusCode);
        console.log('All credentials:', listData);
      });
    });
    listReq.end();
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.end();
