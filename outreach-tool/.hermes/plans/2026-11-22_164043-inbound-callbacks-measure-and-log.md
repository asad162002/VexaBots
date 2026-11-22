# Inbound callbacks: measure, log, alert

Goal: stop losing businesses that call the shared number back, without touching the
Telnyx routing that the working outbound dialer depends on.

Scope decided with Asad: build the cheap measurement layer now, park the expensive
routing. Everything in Phase A is safe to ship today. Phases B and C are written down
so the decision is not re-litigated later.

---

## Facts, verified

From Telnyx docs (developers.telnyx.com):

- `call.initiated` carries `payload.direction` as `incoming` or `outgoing`, plus
  `from`, `to`, `call_control_id`, `call_session_id`. Source: Voice API Webhooks,
  Receiving Webhooks for Programmable Voice.
- A credential connection has `webhook_event_url`, so webhooks are configured per
  connection and are not limited to Call Control apps. Source: create-a-credential-connection.
- Clients registered under the same credentials all ring at once. Source: telnyx.com
  release notes, simultaneous ring for SIP trunking and WebRTC.
- Inbound calls in the browser SDK: `call.direction === 'inbound'`,
  `call.remotePartyNumber`, `call.answer()`, and `call.hangup()` to reject. Source:
  WebRTC JS SDK Call class reference, Build a Call Center Agent tutorial.
- A phone number routes by `connection_id` (`PATCH /v2/phone_numbers/{id}`), so moving
  the number to a Call Control app takes it off the credential connection, which is
  where the WebRTC auth and the caller-ID the token route checks live. That is the
  reason Phase C is parked.

Verified against the account and the database, not from docs:

- Number +1 910 661 0871 is active on credential connection `vexabots-webrtc`
  (`3077960193393297256`), webhook `https://95-216-212-77.sslip.io/api/webhooks/telnyx`.
- 33 webhook deliveries, all `delivered`, HTTP 200 from that URL, spanning 16 to 22 Nov.
  So call events do reach the app today.
- 6 profiles, 2 telephony credentials (`caller-asad`, `caller-asad-v2`), 1 caller ID
  number. Reps share SIP endpoints, so Telnyx cannot tell them apart.
- `call_logs`: `caller_id` is NOT NULL, there is no `direction` column, no index on
  `telnyx_call_control_id`, and the status CHECK forbids `failed`, which the new
  stale-request guard writes. That guard's UPDATE fails today.

Gaps in the code:

- The webhook only UPDATEs `call_logs` rows matched by `telnyx_call_control_id`. An
  inbound call has no row, so it is dropped: no log, no activity, no trace.
- The browser hook has no inbound branch. An inbound invite that nobody answers falls
  into the outbound hangup path and would show "Call not answered" for a call the rep
  never placed.
- Nothing answers an inbound call. `call.answer()` appears nowhere in the codebase.

---

## Phase A: measure and log (build now)

### A1. Migration `supabase_inbound_callbacks.sql`

1. `call_logs.direction text not null default 'outbound'` with
   `check (direction in ('inbound','outbound'))`.
2. `alter table call_logs alter column caller_id drop not null` (an inbound call has no
   rep who placed it).
3. Recreate the status checks so `failed` is allowed, and drop the duplicate
   `call_logs_status_check` that only drifts.
4. `create index call_logs_telnyx_cci_idx on call_logs (telnyx_call_control_id)`.
5. `leads.phone_digits` and `linkedin_leads.phone_digits` as generated columns:
   `regexp_replace(phone, '[^0-9]', '', 'g')` stored, each with an index. Stored phone
   numbers are formatted, so matching a caller against them needs this.

Verify: read the columns and constraints back from `information_schema`, then in a
transaction that is rolled back, insert a row with `direction='inbound'`, `caller_id`
null, and update a row to `status='failed'`.

### A2. Webhook inbound branch

File: `src/app/api/webhooks/telnyx/route.ts`

- On `call.initiated` with `payload.direction === 'incoming'`:
  1. Idempotent guard: skip if a `call_logs` row already exists for this
     `call_control_id`.
  2. Insert `call_logs`: `direction='inbound'`, `caller_id=null`,
     `from_number=payload.from`, `to_number=payload.to`, `status='initiated'`,
     `telnyx_call_control_id`, `telnyx_call_session_id`.
  3. Match the caller: first `leads.phone_digits`, then `linkedin_leads.phone_digits`.
     Write `lead_id` or `linkedin_lead_id` onto the row.
  4. Insert a `lead_activities` row (`activity_type='call'`, `lead_table` set) when a
     lead matched: "Inbound callback from <number>".
  5. Alert (A3).
- On `call.hangup` for a row whose `direction='inbound'` with duration 0, add a
  "Missed inbound call" activity so an unanswered callback is visible in the feed.

Outbound rows are untouched: the app already inserted them, so the guard in step 1 and
the `direction === 'incoming'` check keep the two paths apart.

### A3. Alert helper `src/lib/notify.ts`

`sendTelegramAlert(text)` posting to the Telegram Bot API when
`TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are present, otherwise a console line and
no error. No credentials are committed; the code path simply stays quiet until Asad
drops the two values into `.env.local`.

### A4. Call History shows inbound

File: `src/app/dashboard/calls/page.tsx`

Rows whose `direction='inbound'` show the matched lead name, or the caller's number
when nothing matched, and "Inbound" instead of an empty caller column.

### A5. Verification

1. Call +1 910 661 0871 from a mobile.
2. `GET /v2/webhook_deliveries` shows a `call.initiated` for it, or the app log shows
   the inbound branch firing. If no delivery arrives for an inbound leg, the credential
   connection is not delivering inbound events and Phase B's browser path becomes the
   only source, which changes the priority of Phase C.
3. The `call_logs` row exists with `direction='inbound'`, matched to a lead if the
   number is one of ours, and the activity feed has the entry.
4. Hard refresh Call History and see the row.

---

## Phase B: ring the right rep in the app (later, half a day)

- Hook: branch on `call.direction === 'inbound'`, keep inbound out of the outbound
  state machine, expose an incoming state with the caller number, and answer/reject.
- Server: `GET /api/inbound/who?number=...` returning the owner: the rep who last
  called that number (`call_logs.caller_id` with the most recent `created_at`), else the
  matched lead's `assigned_to`, else admins.
- UI: incoming panel with the matched lead, Answer and Reject.
- Every registered client receives the invite (simultaneous ring is a platform
  behaviour, confirmed above). Each client asks the server whether the call is theirs
  and calls `call.hangup()` when it is not, so only the owner's app keeps ringing.
- Reject while a call is already active.

## Phase C: routing and voicemail at Telnyx (later, days, risky)

- One telephony credential per rep, stored in `profiles.telnyx_credential_id` (it
  exists; today 6 profiles point at 2).
- Move the number to a Call Control app only after testing on a spare number: the
  number's `connection_id` move is what risks the credential connection's outbound
  behaviour.
- Then the webhook can dial the specific rep or play a voicemail greeting and record.

## Out of scope

Voicemail infrastructure, WhatsApp, per-rep numbers, and any change to the number's
connection until Phase C is deliberately started.
