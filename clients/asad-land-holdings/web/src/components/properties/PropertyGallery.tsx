'use client'

import { useState } from 'react'
import type { PropertyMedia } from '@/lib/types'

export function PropertyGallery({ media }: { media: PropertyMedia[] }) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (media.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center border border-blueprint-blue/30 bg-paper-card font-data text-sm text-muted sm:h-96">
        No photos yet
      </div>
    )
  }

  const active = media[activeIndex]

  return (
    <div>
      <div className="h-64 w-full overflow-hidden border border-blueprint-blue/30 bg-paper-card sm:h-96">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active.url} alt="" className="h-full w-full object-cover" />
      </div>
      {media.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {media.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setActiveIndex(i)}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden border ${
                i === activeIndex ? 'border-blueprint-blue' : 'border-blueprint-blue/25'
              }`}
              aria-label={`View photo ${i + 1}`}
              aria-current={i === activeIndex}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}