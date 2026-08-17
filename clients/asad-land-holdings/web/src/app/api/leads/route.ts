import { NextRequest, NextResponse } from 'next/server'
import { submitWebLead } from '@/lib/leads'

export async function POST(request: NextRequest) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null || !('phone' in body)) {
    return NextResponse.json({ success: false, error: 'Phone number is required.' }, { status: 400 })
  }

  const input = body as Record<string, unknown>

  const result = await submitWebLead({
    phone: String(input.phone ?? ''),
    name: input.name ? String(input.name) : undefined,
    property_type: input.property_type ? String(input.property_type) : undefined,
    location: input.location ? String(input.location) : undefined,
    budget: input.budget ? String(input.budget) : undefined,
    message: input.message ? String(input.message) : undefined,
    interested_property_id: input.interested_property_id ? String(input.interested_property_id) : undefined,
  })

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}