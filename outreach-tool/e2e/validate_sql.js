const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261023000000_profiles_hardening.sql'), 'utf8');
const webhook = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'api', 'webhooks', 'telnyx', 'route.ts'), 'utf8');
const callLogRoute = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'api', 'telnyx', 'call-log', 'route.ts'), 'utf8');
const hook = fs.readFileSync(path.join(__dirname, '..', 'src', 'hooks', 'use-telnyx-call.ts'), 'utf8');
const types = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'types.ts'), 'utf8');

let pass = 0, fail = 0;
function check(name, condition) {
  if (condition) { console.log('PASS:', name); pass++; }
  else { console.log('FAIL:', name); fail++; }
}

// 1. log_call_outcome authorization: admin OR (lead assigned + call-log ownership check)
const loAuth = migration.substring(
  migration.indexOf('if not (public.is_admin()'),
  migration.indexOf('raise exception \'Unauthorized: you are not assigned to this lead\'')
);
check('log_call_outcome uses admin OR (lead assigned + call-log ownership)',
  loAuth.includes('auth.uid()') && loAuth.includes('assigned_to = auth.uid()') && loAuth.includes('caller_id = auth.uid()') && loAuth.includes('cl.lead_id = p_lead_id'));
check('log_call_outcome does NOT auto-assign (removed)',
  !migration.substring(migration.indexOf('log_call_outcome'), migration.indexOf('-- Enable RLS')).includes('assign it to the caller'));

// 2. log_call_outcome uses text for status (not public.lead_status)
check('log_call_outcome p_status is text', migration.includes('p_status text default null'));
check('log_call_outcome has set search_path = public',
  migration.includes('security definer\nset search_path = public') || migration.includes('security definer\nset search_path = public'));
// Actually check the function body has set search_path
const loFn = migration.substring(
  migration.indexOf('create or replace function public.log_call_outcome'),
  migration.indexOf('$$;', migration.indexOf('create or replace function public.log_call_outcome'))
);
check('log_call_outcome function has set search_path = public', loFn.includes('set search_path = public'));
check('claim_lead function has set search_path = public',
  migration.substring(migration.indexOf('create or replace function public.claim_lead'),
    migration.indexOf('$$;', migration.indexOf('create or replace function public.claim_lead'))).includes('set search_path = public'));

// 3. Statuses match LeadStatus
const statusMatch = migration.match(/p_status not in \('([^)]+)'\)/);
if (statusMatch) {
  const statuses = statusMatch[1].split(', ').map(s => s.replace(/^'|'$/g, ''));
  const expected = ['new', 'contacted', 'interested', 'not_interested', 'send_info', 'meeting_booked', 'dead'];
  check('log_call_outcome statuses match LeadStatus (new, contacted, interested, not_interested, send_info, meeting_booked, dead)',
    JSON.stringify(statuses) === JSON.stringify(expected));
  check('dnc is NOT in allowed statuses', !statuses.includes('dnc'));
  check('send_info IS in allowed statuses', statuses.includes('send_info'));
  check('dead IS in allowed statuses', statuses.includes('dead'));
}

// Verify LeadStatus in types.ts matches
const tsLeadStatus = types.match(/export type LeadStatus\s*=\s*\n([\s\S]*?)\n;/);
if (tsLeadStatus) {
  const tsStatuses = tsLeadStatus[1].split('\n').map(s => s.trim().replace(/'/g, '').replace(/\|/g, '').trim()).filter(Boolean);
  console.log('LeadStatus in types.ts:', tsStatuses);
  check('types.ts LeadStatus matches migration statuses',
    JSON.stringify(tsStatuses) === JSON.stringify(['new', 'contacted', 'interested', 'not_interested', 'send_info', 'meeting_booked', 'dead']));
}

// 4. Webhook matches on telnyx_call_control_id
check('Webhook matches on telnyx_call_control_id for lifecycle events',
  webhook.includes("eq('telnyx_call_control_id'"));
check('Webhook matches on telnyx_call_control_id for recording events',
  webhook.includes("eq('telnyx_call_control_id', matchId)"));
check('Webhook gets call_control_id from eventPayload',
  webhook.includes("eventPayload?.call_control_id"));
check('Webhook gets call_session_id from eventPayload',
  webhook.includes("eventPayload?.call_session_id"));

// 5. POST /api/telnyx/call-log returns 400 for missing lead_id
check('call-log endpoint returns 400 if lead_id missing',
  callLogRoute.includes("lead_id is required") && callLogRoute.includes('status: 400'));

// 6. Hook captures telnyxIDs
check('Hook captures call.telnyxIDs', hook.includes('call?.telnyxIDs'));
check('Hook captures telnyxCallControlId', hook.includes('ids?.telnyxCallControlId'));
check('Hook captures telnyxSessionId', hook.includes('ids?.telnyxSessionId'));
check('Hook PATCHes telnyx_call_control_id', hook.includes('telnyx_call_control_id: telnyxCallControlId'));
check('Hook PATCHes telnyx_call_session_id', hook.includes('telnyx_call_session_id: telnyxCallSessionId'));
check('Hook also captures IDs from notification events', hook.includes('telnyxIDs'));

// 7. No NEW. in RLS policies (only in trigger functions)
const policySection = migration.substring(
  migration.indexOf('-- profiles policies'),
  migration.indexOf('-- Enable RLS')
);
// Extract just the policy SQL (not comments)
const policyLines = policySection.split('\n').filter(l => !l.trim().startsWith('--'));
const policyCode = policyLines.join('\n');
const newInPolicies = (policyCode.match(/\bnew\./gi) || []).length;
check('No NEW. references in RLS policy code (only column refs)', newInPolicies === 0);

// 8. claim_lead handles max_leads = 0
const claimFn = migration.substring(
  migration.indexOf('create or replace function public.claim_lead'),
  migration.indexOf('$$;', migration.indexOf('create or replace function public.claim_lead'))
);
check('claim_lead treats max_leads=0 as unlimited', claimFn.includes('v_max_leads > 0'));

// 9. Status violation query before constraint
check('Status violation query included before constraint',
  migration.includes("select id, status from public.call_logs") &&
  migration.includes("where status not in"));

// 10. Telnyx call ID columns on call_logs
check('call_logs has telnyx_call_control_id column', migration.includes('add column if not exists telnyx_call_control_id text'));
check('call_logs has telnyx_call_session_id column', migration.includes('add column if not exists telnyx_call_session_id text'));

// 11. PATCH endpoint accepts new fields
const patchRoute = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'api', 'telnyx', 'call-log', '[id]', 'route.ts'), 'utf8');
check('PATCH endpoint accepts telnyx_call_control_id', patchRoute.includes('telnyx_call_control_id'));
check('PATCH endpoint accepts telnyx_call_session_id', patchRoute.includes('telnyx_call_session_id'));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
