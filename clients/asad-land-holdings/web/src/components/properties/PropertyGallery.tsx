'use client'

import { useState } from 'react'
import type { PropertyMedia } from '@/lib/types'
import { propertyFallbackImage } from '@/lib/fallback-images'

export function PropertyGallery({ propertyId, media }: { propertyId: string; media: PropertyMedia[] }) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (media.length === 0) {
    return (
      <div className="h-64 w-full overflow-hidden rounded-2xl sm:h-96">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={propertyFallbackImage(propertyId)} alt="" className="h-full w-full object-cover" />
      </div>
    )
  }

  const active = media[activeIndex]

  return (
    <div>
      <div className="h-64 w-full overflow-hidden rounded-2xl sm:h-96">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active.url} alt="" className="h-full w-full object-cover" />
      </div>
      {media.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {media.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setActiveIndex(i)}
              className={'h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border ' + (i === activeIndex ? 'border-brick-clay' : 'border-cocoa/20')}
              aria-label={'View photo ' + (i + 1)}
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
