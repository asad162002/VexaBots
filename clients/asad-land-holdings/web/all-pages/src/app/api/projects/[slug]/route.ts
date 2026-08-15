import { NextResponse } from 'next/server'
import { getProjectBySlug } from '@/lib/projects'

export async function GET(_request: Request, ctx: RouteContext<'/api/projects/[slug]'>) {
  const { slug } = await ctx.params
  const { data, error } = await getProjectBySlug(slug)
  if (error || !data) {
    return NextResponse.json({ success: false, error: error ?? 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data })
}
