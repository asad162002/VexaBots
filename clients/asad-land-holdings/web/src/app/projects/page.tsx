import { PageTheme } from '@/components/shared/PageTheme'
import { Nav } from '@/components/shared/Nav'
import { ProjectPanelCard } from '@/components/projects/ProjectPanelCard'
import { getProjects } from '@/lib/projects'

export default async function ProjectsPage() {
  const { data: projects, error } = await getProjects()

  return (
    <PageTheme value="dark">
      <Nav />
      <main className="min-h-screen bg-cocoa px-6 pt-28 text-cream sm:px-10">
        <h1 className="font-display text-3xl">Projects</h1>
        <p className="mt-1 font-body text-sm opacity-70">{projects?.length ?? 0} in the portfolio</p>

        {error && <p className="mt-8 font-body text-sm text-brick-clay">Couldn&apos;t load projects right now. Try refreshing.</p>}
        {!error && projects?.length === 0 && <p className="mt-8 font-body text-sm opacity-70">No projects to show yet.</p>}

        <div className="mt-10 grid gap-12 lg:grid-cols-2">
          <div className="flex min-h-[400px] items-center justify-center border border-cream/20 lg:sticky lg:top-28 lg:self-start">
            <p className="font-data text-xs text-cream/40">TODO: looping project photos, or default fallback illustration when a project has no media</p>
          </div>
          <div>
            {projects?.map((project) => <ProjectPanelCard key={project.id} project={project} />)}
          </div>
        </div>
      </main>
    </PageTheme>
  )
}
