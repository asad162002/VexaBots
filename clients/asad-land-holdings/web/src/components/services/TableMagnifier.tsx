'use client'

import { useState } from 'react'

const TABLE_IMAGE = '/services/table.png'

const HOTSPOTS = [
  { key: 'floor-plan', label: 'Floor Plan', x: 30, y: 45 },
  { key: 'checklist', label: 'Checklist', x: 68, y: 40 },
  { key: 'construction-material', label: 'Construction Material', x: 28, y: 78 },
  { key: 'phone-note', label: 'Consultation', x: 72, y: 78 },
]

const LENS_SIZE = 220
const ZOOM = 2.4

export function TableMagnifier({ activeKey }: { activeKey: string | null }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const effectiveKey = activeKey ?? hovered
  const hotspot = HOTSPOTS.find((h) => h.key === effectiveKey) ?? null

  return (
    <div className="relative w-full overflow-hidden rounded-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={TABLE_IMAGE} alt="Our tools" className="w-full object-cover" />

      {HOTSPOTS.map((h) => (
        <button
          key={h.key}
          onMouseEnter={() => setHovered(h.key)}
          onMouseLeave={() => setHovered(null)}
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cream bg-brick-clay/80"
          style={{ left: h.x + '%', top: h.y + '%' }}
          aria-label={h.label}
        />
      ))}

      {hotspot && (
        <div
          className="pointer-events-none absolute rounded-full border-4 border-cream shadow-2xl transition-all duration-500 ease-out"
          style={{
            width: LENS_SIZE,
            height: LENS_SIZE,
            left: hotspot.x + '%',
            top: hotspot.y + '%',
            transform: 'translate(-50%, -50%)',
            backgroundImage: 'url(' + TABLE_IMAGE + ')',
            backgroundSize: (100 * ZOOM) + '% auto',
            backgroundPosition: hotspot.x + '% ' + hotspot.y + '%',
          }}
        />
      )}
    </div>
  )
}
