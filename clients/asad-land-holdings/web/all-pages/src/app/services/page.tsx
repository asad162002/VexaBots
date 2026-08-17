import { PageTheme } from '@/components/shared/PageTheme'
import { Nav } from '@/components/shared/Nav'

const SERVICES = [
  { name: 'Property', desc: 'Buy and sell plots, homes, and commercial land.', calcHref: '/calculators?tab=property' },
  { name: 'Construction', desc: 'Full builds, costed and tracked to handover.', calcHref: '/calculators?tab=construction' },
  { name: 'Consultancy', desc: 'Valuation and advice before you commit.', calcHref: '/book-consultation?type=consultation' },
  { name: 'Map-Making', desc: 'Site surveys and plot mapping for your build.', calcHref: '/book-consultation?type=consultation' },
]

export default function ServicesPage() {
  return (
    <PageTheme value="dark">
      <Nav />
      <main className="min-h-screen bg-cocoa px-6 pt-28 text-cream sm:px-10">
        <h1 className="font-display text-3xl">Services</h1>

        <div className="mt-10 grid gap-12 lg:grid-cols-2">
          <div className="flex min-h-[400px] items-center justify-center border border-cream/20 lg:sticky lg:top-28 lg:self-start">
            <p className="font-data text-xs text-cream/40">TODO: MagnifierLens — tools rotation, moves as each card scrolls into view</p>
          </div>

          <div>
            {SERVICES.map((service) => (
              <div key={service.name} className="border-b border-cream/15 py-8">
                <h2 className="font-display text-2xl">{service.name}</h2>
                <p className="mt-2 font-body text-sm opacity-80">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sticky action bar — TODO: labels/links should update to match whichever
            service card is currently in view, not stay generic */}
        <div className="sticky bottom-0 mt-16 flex gap-3 border-t border-cream/20 bg-cocoa py-4">
          <a href="/calculators" className="rounded-full bg-brick-clay px-6 py-2.5 font-display text-sm text-cream">Try the calculator</a>
          <a href="/book-consultation?type=consultation" className="rounded-full border border-cream/30 px-6 py-2.5 font-display text-sm">Book a consultation</a>
        </div>
      </main>
    </PageTheme>
  )
}
