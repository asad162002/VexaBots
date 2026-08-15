import Link from 'next/link'
import type { Project } from '@/lib/types'

export function ProjectPanelCard({ project }: { project: Project }) {
  return (
    <Link href={'/projects/' + project.slug} className="block border-b border-current/15 py-6 transition-opacity hover:opacity-80">
      <p className="font-display text-xs uppercase tracking-wide opacity-70">{project.status}</p>
      <h3 className="mt-1 font-display text-xl">{project.project_name}</h3>
      <p className="mt-2 font-body text-sm opacity-80">{project.location}</p>
    </Link>
  )
}
