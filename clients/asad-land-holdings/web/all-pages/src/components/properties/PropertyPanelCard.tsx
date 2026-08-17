import Link from 'next/link'
import type { Property } from '@/lib/types'

function formatPrice(price: number | null): string {
  if (price === null) return 'Price on request'
  if (price >= 10000000) return 'PKR ' + (price / 10000000).toFixed(2) + ' Cr'
  if (price >= 100000) return 'PKR ' + (price / 100000).toFixed(1) + ' Lac'
  return 'PKR ' + price.toLocaleString()
}

export function PropertyPanelCard({ property }: { property: Property }) {
  return (
    <Link href={'/properties/' + property.slug} className="block border-b border-current/15 py-6 transition-opacity hover:opacity-80">
      <p className="font-display text-xs uppercase tracking-wide opacity-70">{property.property_type ?? 'Property'}</p>
      <h3 className="mt-1 font-display text-xl">{property.location}</h3>
      <p className="mt-2 font-data text-lg">{formatPrice(property.price_pkr)}</p>
      <p className="mt-1 font-data text-xs opacity-70">{property.size}</p>
    </Link>
  )
}
