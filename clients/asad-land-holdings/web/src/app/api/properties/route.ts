import { NextRequest, NextResponse } from 'next/server'
import { getProperties } from '@/lib/properties'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const filters = {
    location: params.get('location') ?? undefined,
    property_type: params.get('property_type') ?? undefined,
    min_price: params.get('min_price') ? Number(params.get('min_price')) : undefined,
    max_price: params.get('max_price') ? Number(params.get('max_price')) : undefined,
  }

  const { data, error } = await getProperties(filters)

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}