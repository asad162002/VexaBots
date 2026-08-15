import { NextResponse } from 'next/server'
import { getProjects } from '@/lib/projects'

export async function GET() {
  const { data, error } = await getProjects()
  if (error) return NextResponse.json({ success: false, error }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
