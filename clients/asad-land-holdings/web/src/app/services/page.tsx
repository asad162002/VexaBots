'use client'

import { useState } from 'react'
import { PageTheme } from '@/components/shared/PageTheme'
import { Nav } from '@/components/shared/Nav'
import { TableMagnifier } from '@/components/services/TableMagnifier'

const SERVICES = [
  { name: 'Property', hotspot: 'checklist', desc: 'Buy and sell plots, homes, and commercial land.', calcHref: '/calculators?tab=property' },
  { name: 'Construction', hotspot: 'construction-material', desc: 'Full builds, costed and tracked to handover.', calcHref: '/calculators?tab=construction' },
  { name: 'Consultancy', hotspot: 'phone-note', desc: 'Valuation and advice before you commit.', calcHref: '/book-consultation?type=consultation' },
  { name: 'Floor Plan', hotspot: 'floor-plan', desc: 'Site surveys and floor plans for your build.', calcHref: '/book-consultation?type=consultation' },
]

export default function ServicesPage() {
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null)

  return (
    <PageTheme value="dark">
      <Nav />
      <main className="min-h-screen bg-cocoa px-6 pt-28 text-cream sm:px-10">
        <h1 className="font-display text-3xl">Services</h1>

        <div className="mt-10 grid gap-12 lg:grid-cols-2">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <TableMagnifier activeKey={activeHotspot} />
          </div>

          <div>
            {SERVICES.map((service) => (
              <div
                key={service.name}
                onMouseEnter={() => setActiveHotspot(service.hotspot)}
                onMouseLeave={() => setActiveHotspot(null)}
                className="border-b border-cream/15 py-8"
              >
                <h2 className="font-display text-2xl">{service.name}</h2>
                <p className="mt-2 font-body text-sm opacity-80">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 mt-16 flex gap-3 border-t border-cream/20 bg-cocoa py-4">
          <a href="/calculators" className="rounded-full bg-brick-clay px-6 py-2.5 font-display text-sm text-cream">Try the calculator</a>
          <a href="/book-consultation?type=consultation" className="rounded-full border border-cream/30 px-6 py-2.5 font-display text-sm">Book a consultation</a>
        </div>
      </main>
    </PageTheme>
  )
}
