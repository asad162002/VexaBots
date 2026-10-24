import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// POST /api/webhooks/telnyx — receive webhook events from Telnyx
// Verifies Ed25519 signature and timestamp. Uses Telnyx v2 event names.
// Fails closed: returns 500 if TELNYX_PUBLIC_KEY is not configured.
//
// What I verified from the Telnyx docs:
// - Signature verification uses Ed25519
// - Headers: telnyx-signature-ed25519 (signature), telnyx-timestamp (unix secs)
// - Signed payload format: `${timestamp}|${rawBody}`
// - Event type at data.event_type, details in data.payload
// - call_control_id and call_session_id are in the payload
// - start_time and end_time are ISO 8601 strings (no duration field)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const telnyxPublicKey = process.env.TELNYX_PUBLIC_KEY!;

// Timestamp tolerance: 5 minutes (300 seconds) per Telnyx docs
const TIMESTAMP_TOLERANCE_SECONDS = 300;

export async function POST(request: NextRequest) {
  // Fail closed: refuse to process if the public key is not configured
  if (!telnyxPublicKey) {
    console.error('TELNYX_PUBLIC_KEY is not set. Refusing to process webhook.');
    return NextResponse.json(
      { error: 'Webhook verification is not configured.' },
      { status: 500 }
    );
  }

  const signature = request.headers.get('telnyx-signature-ed25519');
  const timestamp = request.headers.get('telnyx-timestamp');

  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
  }

  // Read the raw body as text (do NOT parse first — signature is over raw bytes)
  const rawBody = await request.text();

  // Verify timestamp (replay attack protection)
  const now = Math.floor(Date.now() / 1000);
  const eventTime = parseInt(timestamp, 10);
  if (Number.isNaN(eventTime) || Math.abs(now - eventTime) > TIMESTAMP_TOLERANCE_SECONDS) {
    console.warn(`Webhook timestamp outside tolerance. now=${now} event=${eventTime}`);
    return NextResponse.json({ error: 'Timestamp verification failed' }, { status: 401 });
  }

  // Verify Ed25519 signature
  // Signed payload format: `${timestamp}|${rawBody}`
  const signedPayload = `${timestamp}|${rawBody}`;
  const verified = verifyEd25519Signature(
    signedPayload,
    signature,
    telnyxPublicKey
  );

  if (!verified) {
    console.warn('Telnyx webhook signature verification failed.');
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
  }

  // Parse the verified payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Telnyx v2 envelope: data.event_type + data.payload
  const eventType: string = payload?.data?.event_type;
  const eventPayload: any = payload?.data?.payload;

  if (!eventType || !eventPayload) {
    return NextResponse.json({ error: 'Invalid Telnyx event structure' }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  // Extract Telnyx identifiers from the payload
  // call_control_id is present on call lifecycle events (initiated, ringing, answered, hangup)
  // call_session_id is present on call lifecycle events AND recording events
  const callControlId: string | null = eventPayload?.call_control_id ?? null;
  const callSessionId: string | null = eventPayload?.call_session_id ?? null;

  switch (eventType) {
    case 'call.initiated':
    case 'call.ringing': {
      // Match on telnyx_call_control_id for call lifecycle events
      if (!callControlId) break;
      await supabaseAdmin
        .from('call_logs')
        .update({
          status: eventType === 'call.ringing' ? 'ringing' : 'initiated',
        })
        .eq('telnyx_call_control_id', callControlId);
      break;
    }

    case 'call.answered': {
      // Match on telnyx_call_control_id
      if (!callControlId) break;
      // start_time is in the payload (ISO 8601)
      const startTime = eventPayload?.start_time;
      await supabaseAdmin
        .from('call_logs')
        .update({
          status: 'answered',
          started_at: startTime ?? new Date().toISOString(),
        })
        .eq('telnyx_call_control_id', callControlId);
      break;
    }

    case 'call.hangup': {
      // Match on telnyx_call_control_id
      if (!callControlId) break;
      const startTime = eventPayload?.start_time;
      const endTime = eventPayload?.end_time;
      let durationSec: number | null = null;

      // Compute duration from start_time and end_time if both present
      if (startTime && endTime) {
        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();
        durationSec = Math.round((end - start) / 1000);
      }

      // Fetch the current status to refine
      const { data: existing } = await supabaseAdmin
        .from('call_logs')
        .select('status')
        .eq('telnyx_call_control_id', callControlId)
        .single();

      // If the call was answered (or duration > 0), it's a completed call
      const finalStatus = existing?.status === 'answered' || (durationSec && durationSec > 0)
        ? 'disconnected'
        : 'no_answer';

      await supabaseAdmin
        .from('call_logs')
        .update({
          status: finalStatus,
          ended_at: endTime ?? new Date().toISOString(),
          duration_seconds: durationSec,
        })
        .eq('telnyx_call_control_id', callControlId);

      // Log to activity feed (only if the call was answered and has a lead)
      if ((durationSec ?? 0) > 0) {
        const { data: callLog } = await supabaseAdmin
          .from('call_logs')
          .select('lead_id, caller_id, to_number')
          .eq('telnyx_call_control_id', callControlId)
          .single();

        if (callLog?.lead_id) {
          await supabaseAdmin.from('lead_activities').insert({
            lead_id: callLog.lead_id,
            profile_id: callLog.caller_id,
            activity_type: 'call',
            content: `Cold call to ${callLog.to_number} (${durationSec}s)`,
            created_at: new Date().toISOString(),
          });
        }
      }
      break;
    }

    case 'call.recording.saved': {
      // Recording events may not carry call_control_id — match on call_session_id
      const matchId = callSessionId ?? callControlId;
      if (!matchId) break;

      // The recording URLs are in payload.recording_urls or payload.public_recording_urls
      const recordingUrl =
        eventPayload?.recording_urls?.mp3 ||
        eventPayload?.public_recording_urls?.mp3 ||
        null;

      // Idempotent: only update if we haven't recorded a URL yet
      if (recordingUrl) {
        await supabaseAdmin
          .from('call_logs')
          .update({
            recording_url: recordingUrl,
            recorded_url: recordingUrl,
          })
          .eq('telnyx_call_control_id', matchId)
          .is('recording_url', null);
      }
      break;
    }

    case 'call.failed':
    case 'call.rejected': {
      // Note: Telnyx Voice API does not document these explicitly.
      // call.hangup covers most end scenarios. These are kept for safety.
      if (!callControlId) break;
      const status = eventType === 'call.rejected' ? 'busy' : 'disconnected';
      await supabaseAdmin
        .from('call_logs')
        .update({
          status,
          ended_at: new Date().toISOString(),
        })
        .eq('telnyx_call_control_id', callControlId)
        .is('ended_at', null);
      break;
    }

    default:
      console.log(`Unhandled Telnyx event: ${eventType}`);
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

// Ed25519 signature verification using Node.js crypto
// The public key from Telnyx is a base64-encoded raw Ed25519 public key
function verifyEd25519Signature(
  payload: string,
  signature: string,
  publicKeyBase64: string
): boolean {
  try {
    const pubKeyBytes = Buffer.from(publicKeyBase64, 'base64');
    const sigBytes = Buffer.from(signature, 'base64');
    const payloadBytes = Buffer.from(payload, 'utf8');

    // Create a KeyObject from the raw public key
    const keyObject = crypto.createPublicKey({
      key: pubKeyBytes,
      format: 'der',
      type: 'spki',
    });

    // Verify the signature using Ed25519
    const verified = crypto.verify(null, payloadBytes, {
      key: keyObject,
      format: 'der',
      type: 'spki',
    }, sigBytes);

    return verified === true;
  } catch (err) {
    // If the key format is raw (not DER), try raw format
    try {
      const pubKeyBytes = Buffer.from(publicKeyBase64, 'base64');
      const sigBytes = Buffer.from(signature, 'base64');
      const payloadBytes = Buffer.from(payload, 'utf8');

      // For raw Ed25519 keys, Node.js expects them prefixed with a specific header
      // The raw 32-byte key needs to be converted to SPKI format
      // Telnyx public keys are typically in raw format (32 bytes)
      const keyObject = crypto.createPublicKey({
        key: Buffer.concat([
          Buffer.from('302a300506032b6570032100', 'hex'),
          pubKeyBytes,
        ]),
        format: 'der',
        type: 'spki',
      });

      const verified = crypto.verify(null, payloadBytes, keyObject, sigBytes);
      return verified === true;
    } catch (err2) {
      console.error('Ed25519 signature verification error:', err2);
      return false;
    }
  }
}
