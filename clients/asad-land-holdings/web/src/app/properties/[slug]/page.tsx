import { notFound } from 'next/navigation'
import { getPropertyBySlug } from '@/lib/properties'
import { getPropertyMedia } from '@/lib/property-media'
import { PropertyGallery } from '@/components/properties/PropertyGallery'

function formatPrice(price: number | null) {
  if (price === null) return 'Price on request'
  if (price >= 10000000) return `PKR ${(price / 10000000).toFixed(2)} Cr`
  if (price >= 100000) return `PKR ${(price / 100000).toFixed(1)} Lac`
  return `PKR ${price.toLocaleString()}`
}

export default async function PropertyDetailPage(
  props: PageProps<'/properties/[slug]'>
) {
  const { slug } = await props.params

  const { data: property, error } = await getPropertyBySlug(slug)

  if (error || !property) {
    notFound()
  }

  const { data: media } = await getPropertyMedia(property.id)

  const specs: [string, string | number | null][] = [
    ['Location', property.location],
    ['Type', property.property_type],
    ['Size', property.size],
    ['Plot shape', property.plot_shape],
    ['Facing', property.facing_direction],
    ['Constructed', property.is_constructed ? `Yes, ${property.construction_age_years ?? '?'} yrs` : 'No'],
    ['Corner plot', property.is_corner_plot ? 'Yes' : 'No'],
    ['Near main road', property.near_main_road ? 'Yes' : 'No'],
    ['Proximity to markaz', property.proximity_markaz],
    ['Proximity to park', property.proximity_park],
  ]

  return (
    <main
      className="min-h-screen px-4 py-10 sm:px-6 lg:px-8"
      style={{
        backgroundColor: 'var(--color-paper)',
        backgroundImage:
          'linear-gradient(rgba(43,76,126,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(43,76,126,0.06) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="mx-auto max-w-4xl">
        <p className="font-display text-xs uppercase tracking-wide text-blueprint-blue">
          {property.property_type}
        </p>
        <h1 className="font-display text-2xl text-ink">{property.location}</h1>
        <p className="mt-1 font-data text-2xl font-medium text-brass">{formatPrice(property.price_pkr)}</p>

        <div className="mt-6">
          <PropertyGallery media={media ?? []} />
        </div>

        <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-blueprint-blue/20 pt-6 sm:grid-cols-2">
          {specs
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-blueprint-blue/10 pb-2">
                <dt className="font-body text-sm text-muted">{label}</dt>
                <dd className="font-data text-sm text-ink">{value}</dd>
              </div>
            ))}
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={`/api/properties/${property.slug}/brochure`}
            className="bg-blueprint-blue px-6 py-3 font-display text-sm text-paper-card"
          >
            Download brochure
          </a>

          <a
            href="/contact"
            className="border border-ink/30 px-6 py-3 font-display text-sm text-ink"
          >
            Enquire about this property
          </a>
        </div>
      </div>
    </main>
  )
}