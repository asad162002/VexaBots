import Link from 'next/link'
import type { Property } from '@/lib/types'

function formatPrice(price: number | null) {
  if (price === null) return 'Price on request'
  if (price >= 10000000) return `PKR ${(price / 10000000).toFixed(2)} Cr`
  if (price >= 100000) return `PKR ${(price / 100000).toFixed(1)} Lac`
  return `PKR ${price.toLocaleString()}`
}

const COMPASS: Record<string, string> = {
  north: '↑', south: '↓', east: '→', west: '←',
  northeast: '↗', northwest: '↖', southeast: '↘', southwest: '↙',
}

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link
      href={`/properties/${property.slug}`}
      className="group relative block bg-paper-card border border-blueprint-blue/35 p-4 transition-colors hover:border-blueprint-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
    >
      <span className="absolute left-0 top-0 h-2.5 w-2.5 border-l-2 border-t-2 border-blueprint-blue" />
      <span className="absolute right-0 top-0 h-2.5 w-2.5 border-r-2 border-t-2 border-blueprint-blue" />
      <span className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b-2 border-l-2 border-blueprint-blue" />
      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 border-b-2 border-r-2 border-blueprint-blue" />

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-[11px] uppercase tracking-wide text-blueprint-blue">
            {property.property_type ?? 'Property'}
          </p>
          <h3 className="font-display text-base text-ink">{property.location}</h3>
        </div>
        {property.facing_direction && (
          <span
            className="font-data text-base text-blueprint-blue"
            title={`Facing ${property.facing_direction}`}
            aria-label={`Facing ${property.facing_direction}`}
          >
            {COMPASS[property.facing_direction.toLowerCase()] ?? ''}
          </span>
        )}
      </div>

      <p className="mt-3 font-data font-medium text-lg text-brass">{formatPrice(property.price_pkr)}</p>

      <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-data text-[11px] text-ink/70">
        <div><dt className="inline text-muted">size </dt><dd className="inline">{property.size}</dd></div>
        {property.dimensions_length_ft && property.dimensions_width_ft && (
          <div>
            <dt className="inline text-muted">dims </dt>
            <dd className="inline">{property.dimensions_length_ft}&apos; × {property.dimensions_width_ft}&apos;</dd>
          </div>
        )}
      </dl>
      {(property.is_corner_plot || property.near_main_road) && (
        <p className="mt-1.5 font-data text-[11px] text-blueprint-blue">
          {property.is_corner_plot && '◆ corner plot '}
          {property.near_main_road && '◆ main road'}
        </p>
      )}
    </Link>
  )
}