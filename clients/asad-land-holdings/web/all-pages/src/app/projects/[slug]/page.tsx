import { notFound } from 'next/navigation'
import { PageTheme } from '@/components/shared/PageTheme'
import { Nav } from '@/components/shared/Nav'
import { getProjectBySlug } from '@/lib/projects'
import { getProjectMedia } from '@/lib/project-media'

export default async function ProjectDetailPage(props: PageProps<'/projects/[slug]'>) {
  const { slug } = await props.params
  const { data: project, error } = await getProjectBySlug(slug)
  if (error || !project) notFound()

  const { data: media } = await getProjectMedia(project.id)

  return (
    <PageTheme value="dark">
      <Nav />
      <main className="min-h-screen bg-cocoa px-6 pt-28 text-cream sm:px-10">
        <div className="mx-auto max-w-4xl">
          <p className="font-display text-xs uppercase tracking-wide text-brass">{project.status}</p>
          <h1 className="mt-1 font-display text-2xl">{project.project_name}</h1>
          <p className="mt-2 font-body text-sm opacity-70">{project.location}</p>

          {project.public_description && <p className="mt-6 font-body text-base opacity-80">{project.public_description}</p>}

          <div className="mt-8 flex min-h-[300px] items-center justify-center border border-cream/20">
            {media && media.length > 0 ? (
              <p className="font-data text-xs text-cream/50">TODO: gallery, {media.length} photo(s)</p>
            ) : (
              <p className="font-data text-xs text-cream/40">TODO: branded default fallback image (no photos uploaded yet)</p>
            )}
          </div>

          <a href="/book-consultation?type=site_visit" className="mt-8 inline-block rounded-full bg-brick-clay px-6 py-3 font-display text-sm text-cream">Schedule a site visit</a>
        </div>
      </main>
    </PageTheme>
  )
}
