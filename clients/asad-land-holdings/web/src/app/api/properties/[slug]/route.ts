import { NextRequest, NextResponse } from 'next/server'
import { getPropertyBySlug } from '@/lib/properties'

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/api/properties/[slug]'>
) {
  const { slug } = await ctx.params

  const { data, error } = await getPropertyBySlug(slug)

  if (error || !data) {
    return NextResponse.json({ success: false, error: error ?? 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data })
}