import { PageTheme } from '@/components/shared/PageTheme'
import { Nav } from '@/components/shared/Nav'
import { InvertedSection } from '@/components/shared/InvertedSection'
import { HeroSlideshow } from '@/components/shared/HeroSlideshow'
import { PropertyPanelCard } from '@/components/properties/PropertyPanelCard'
import { ProjectPanelCard } from '@/components/projects/ProjectPanelCard'
import { HouseRotationViewer } from '@/components/houses/HouseRotationViewer'
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
        <section className="relative flex min-h-screen items-center overflow-hidden bg-cocoa px-6 pt-24 text-cream sm:px-10">
          <div className="relative z-10 max-w-xl">
            <p className="font-data text-xs uppercase tracking-wide text-brass">Property. Construction. Consultancy.</p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-6xl">Land, built and valued right.</h1>
            <p className="mt-6 font-body text-base opacity-80">Buy, build, or get advised. One team across Wah Cantt and beyond.</p>
            <a href="/properties" className="mt-8 inline-block rounded-full bg-brick-clay px-8 py-3 font-display text-sm text-cream transition-opacity hover:opacity-90">Explore listings</a>
          </div>
          <HeroSlideshow />
        </section>

        <InvertedSection theme="dark" className="px-6 py-24 sm:px-10">
          <div className="grid gap-12 sm:grid-cols-2">
            <div>
              <p className="font-data text-xs uppercase tracking-wide text-brass">About us</p>
              <h2 className="mt-4 font-display text-3xl">Built on trust, plot by plot.</h2>
              <p className="mt-6 font-body text-base opacity-80">
                We help families and investors buy, build, and grow across Wah Cantt and the surrounding areas.
              </p>
            </div>
            <div className="min-h-[320px] overflow-hidden rounded-2xl border border-cream/20">
              <HouseRotationViewer />
            </div>
          </div>
        </InvertedSection>

        <InvertedSection theme="dark" className="px-6 py-24 sm:px-10">
          <p className="font-data text-xs uppercase tracking-wide text-brass">03 &mdash; Services</p>
          <h2 className="mt-4 font-display text-3xl">What we do</h2>
          <div className="mt-10 grid gap-12 sm:grid-cols-2">
            <div className="space-y-6">
              {['Property', 'Construction', 'Consultancy', 'Floor Plan'].map((service) => (
                <div key={service} className="border-b border-cream/15 pb-4">
                  <p className="font-display text-lg">{service}</p>
                </div>
              ))}
              <a href="/services" className="mt-4 inline-block rounded-full bg-brick-clay px-6 py-2.5 font-display text-sm text-cream">View all services</a>
            </div>
          </div>
        </InvertedSection>

        <InvertedSection theme="light" className="px-6 py-24 sm:px-10">
          <p className="font-data text-xs uppercase tracking-wide">Featured</p>
          <h2 className="mt-4 font-display text-3xl">Live listings</h2>
          <div className="mt-10">
            {featuredProperties.map((property) => <PropertyPanelCard key={property.id} property={property} />)}
            <a href="/properties" className="mt-6 inline-block font-display text-sm underline">View all listings</a>
          </div>
        </InvertedSection>

        <InvertedSection theme="dark" className="px-6 py-24 sm:px-10">
          <p className="font-data text-xs uppercase tracking-wide text-brass">Featured</p>
          <h2 className="mt-4 font-display text-3xl">Our projects</h2>
          <div className="mt-10">
            {featuredProjects.map((project) => <ProjectPanelCard key={project.id} project={project} />)}
            <a href="/projects" className="mt-6 inline-block font-display text-sm underline">View all projects</a>
          </div>
        </InvertedSection>

        <InvertedSection theme="dark" className="px-6 py-24 sm:px-10">
          <h2 className="font-display text-3xl">Why Land Holdings</h2>
          <p className="mt-4 font-body text-sm text-cream/60">TODO: real trust-signal numbers from the client</p>
        </InvertedSection>

        <InvertedSection theme="light" className="px-6 py-24 text-center sm:px-10">
          <h2 className="font-display text-3xl">Ready to talk?</h2>
          <a href="/book-consultation?type=consultation" className="mt-8 inline-block rounded-full bg-brick-clay px-8 py-3 font-display text-sm text-cream">Book a consultation</a>
        </InvertedSection>
      </main>
    </PageTheme>
  )
}
