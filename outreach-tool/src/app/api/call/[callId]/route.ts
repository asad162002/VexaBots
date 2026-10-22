import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const telnyxToken = process.env.TELNYX_ACCESS_TOKEN!

if (!telnyxToken) {
  console.error('TELNYX_ACCESS_TOKEN is not set')
}

function getTelnyxHeaders() {
  return {
    Authorization: `Bearer ${telnyxToken}`,
    'Content-Type': 'application/json',
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ callId: string }> }) {
  const { callId } = await context.params

  if (!callId) {
    return NextResponse.json({ error: 'Missing callId' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const setState = (status: string, message: string) => {
        const data = JSON.stringify({ status, message })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      try {
        // Poll Telnyx for call status
        const pollInterval = setInterval(async () => {
          try {
            const resp = await fetch(`https://api.telnyx.com/v2/calls/${callId}`, {
              headers: getTelnyxHeaders(),
            })

            if (resp.ok) {
              const callData = await resp.json()
              const status = callData.status

              if (status === 'connected') {
                setState('answered', 'Connected')
              } else if (status === 'busy') {
                setState('busy', 'Busy')
              } else if (status === 'no-answer') {
                setState('no_answer', 'No Answer')
              } else if (status === 'completed' || status === 'canceled' || status === 'failed') {
                setState('disconnected', 'Ended')
                controller.close()
                clearInterval(pollInterval)
              } else {
                setState('ringing', status)
              }
            }
          } catch (err) {
            console.error('Error polling call status:', err)
          }
        }, 3000)

        // Initial state
        setState('initiated', 'Dialing')

        // Clean up on disconnect
        req.signal.addEventListener('abort', () => {
          clearInterval(pollInterval)
          controller.close()
        })
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
