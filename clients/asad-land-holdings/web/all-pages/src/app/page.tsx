import { PageTheme } from '@/components/shared/PageTheme'
import { Nav } from '@/components/shared/Nav'
import { InvertedSection } from '@/components/shared/InvertedSection'
import { PropertyPanelCard } from '@/components/properties/PropertyPanelCard'
import { ProjectPanelCard } from '@/components/projects/ProjectPanelCard'
import { getProperties } from '@/lib/properties'
import { getProjects } from '@/lib/projects'

export default async function HomePage() {
  const { data: properties } = await getProperties()
  const { data: projects } = await getProjects()
  const featuredProperties = (properties ?? []).slice(0, 4)
  const featuredProjects = (projects ?? []).slice(0, 4)

  return (
    <PageTheme value="dark">
      <Nav />
      <main>
        {/* 1. Hero — dark. TODO: swap the placeholder block for HeroSlideshow once
            the 4 locked hero renders are cropped/masked in, and the logo SVG is ready. */}
        <section className="relative flex min-h-screen items-center overflow-hidden bg-cocoa px-6 pt-24 text-cream sm:px-10">
          <div className="relative z-10 max-w-xl">
            <p className="font-data text-xs uppercase tracking-wide text-brass">Property. Construction. Consultancy.</p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-6xl">Land, built and valued right.</h1>
            <p className="mt-6 font-body text-base opacity-80">Buy, build, or get advised. One team across Wah Cantt and beyond.</p>
            <a href="/properties" className="mt-8 inline-block rounded-full bg-brick-clay px-8 py-3 font-display text-sm text-cream transition-opacity hover:opacity-90">Explore listings</a>
          </div>
          <div className="absolute inset-y-0 right-0 z-0 hidden w-1/2 items-center justify-center bg-cocoa/60 sm:flex">
            <p className="font-data text-xs text-cream/40">TODO: HeroSlideshow, organic-mask blend, 4 locked renders</p>
          </div>
        </section>

        {/* 2. About — dark, house magnifier */}
        <InvertedSection theme="dark" className="px-6 py-24 sm:px-10">
          <div className="grid gap-12 sm:grid-cols-2">
            <div>
              <p className="font-data text-xs uppercase tracking-wide text-brass">About us</p>
              <h2 className="mt-4 font-display text-3xl">Built on trust, plot by plot.</h2>
              <p className="mt-6 font-body text-base opacity-80">
                {/* TODO: real about copy from the client */}
                We help families and investors buy, build, and grow across Wah Cantt and the surrounding areas.
              </p>
            </div>
            <div className="flex min-h-[320px] items-center justify-center border border-cream/20">
              <p className="font-data text-xs text-cream/40">TODO: MagnifierLens — house exterior rotation + room hotspots (pending Blender renders)</p>
            </div>
          </div>
        </InvertedSection>

        {/* 3. Services — dark, tools magnifier */}
        <InvertedSection theme="dark" className="px-6 py-24 sm:px-10">
          <p className="font-data text-xs uppercase tracking-wide text-brass">03 — Services</p>
          <h2 className="mt-4 font-display text-3xl">What we do</h2>
          <div className="mt-10 grid gap-12 sm:grid-cols-2">
            <div className="flex min-h-[320px] items-center justify-center border border-cream/20">
              <p className="font-data text-xs text-cream/40">TODO: MagnifierLens — tools rotation + service hotspots</p>
            </div>
            <div className="space-y-6">
              {['Property', 'Construction', 'Consultancy', 'Map-Making'].map((service) => (
                <div key={service} className="border-b border-cream/15 pb-4">
                  <p className="font-display text-lg">{service}</p>
                </div>
              ))}
              <a href="/calculators" className="mt-4 inline-block rounded-full bg-brick-clay px-6 py-2.5 font-display text-sm text-cream">Try the calculator</a>
            </div>
          </div>
        </InvertedSection>

        {/* 4. Featured Listings — light, previews /properties */}
        <InvertedSection theme="light" className="px-6 py-24 sm:px-10">
          <p className="font-data text-xs uppercase tracking-wide">Featured</p>
          <h2 className="mt-4 font-display text-3xl">Live listings</h2>
          <div className="mt-10 grid gap-12 sm:grid-cols-2">
            <div className="flex min-h-[320px] items-center justify-center border border-cocoa/20">
              <p className="font-data text-xs opacity-40">TODO: looping listing photos</p>
            </div>
            <div>
              {featuredProperties.map((property) => <PropertyPanelCard key={property.id} property={property} />)}
              <a href="/properties" className="mt-6 inline-block font-display text-sm underline">View all listings</a>
            </div>
          </div>
        </InvertedSection>

        {/* 5. Featured Projects — dark */}
        <InvertedSection theme="dark" className="px-6 py-24 sm:px-10">
          <p className="font-data text-xs uppercase tracking-wide text-brass">Featured</p>
          <h2 className="mt-4 font-display text-3xl">Our projects</h2>
          <div className="mt-10 grid gap-12 sm:grid-cols-2">
            <div className="flex min-h-[320px] items-center justify-center border border-cream/20">
              <p className="font-data text-xs text-cream/40">TODO: looping project photos</p>
            </div>
            <div>
              {featuredProjects.map((project) => <ProjectPanelCard key={project.id} project={project} />)}
              <a href="/projects" className="mt-6 inline-block font-display text-sm underline">View all projects</a>
            </div>
          </div>
        </InvertedSection>

        {/* 6. Why Us — dark */}
        <InvertedSection theme="dark" className="px-6 py-24 sm:px-10">
          <h2 className="font-display text-3xl">Why Land Holdings</h2>
          <p className="mt-4 font-body text-sm text-cream/60">TODO: real trust-signal numbers from the client (years active, listings sold, projects delivered)</p>
        </InvertedSection>

        {/* 7. Final CTA — light */}
        <InvertedSection theme="light" className="px-6 py-24 text-center sm:px-10">
          <h2 className="font-display text-3xl">Ready to talk?</h2>
          <a href="/book-consultation?type=consultation" className="mt-8 inline-block rounded-full bg-brick-clay px-8 py-3 font-display text-sm text-cream">Book a consultation</a>
        </InvertedSection>
      </main>
    </PageTheme>
  )
}
