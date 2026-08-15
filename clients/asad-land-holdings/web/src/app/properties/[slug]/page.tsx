import { notFound } from 'next/navigation'
import { PageTheme } from '@/components/shared/PageTheme'
import { Nav } from '@/components/shared/Nav'
import { PropertyGallery } from '@/components/properties/PropertyGallery'
import { getPropertyBySlug } from '@/lib/properties'
import { getPropertyMedia } from '@/lib/property-media'

function formatPrice(price: number | null): string {
  if (price === null) return 'Price on request'
  if (price >= 10000000) return 'PKR ' + (price / 10000000).toFixed(2) + ' Cr'
  if (price >= 100000) return 'PKR ' + (price / 100000).toFixed(1) + ' Lac'
  return 'PKR ' + price.toLocaleString()
}

export default async function PropertyDetailPage(props: PageProps<'/properties/[slug]'>) {
  const { slug } = await props.params
  const { data: property, error } = await getPropertyBySlug(slug)
  if (error || !property) notFound()

  const { data: media } = await getPropertyMedia(property.id)

  const specs: [string, string | number | null][] = [
    ['Location', property.location],
    ['Type', property.property_type],
    ['Size', property.size],
    ['Bedrooms', property.bedrooms],
    ['Bathrooms', property.bathrooms],
    ['Plot shape', property.plot_shape],
    ['Facing', property.facing_direction],
    ['Corner plot', property.is_corner_plot ? 'Yes' : 'No'],
    ['Near main road', property.near_main_road ? 'Yes' : 'No'],
  ]

  return (
    <PageTheme value="light">
      <Nav />
      <main className="min-h-screen bg-cream px-6 pt-28 text-cocoa sm:px-10">
        <div className="mx-auto max-w-4xl">
          <p className="font-display text-xs uppercase tracking-wide">{property.property_type}</p>
          <h1 className="mt-1 font-display text-2xl">{property.location}</h1>
          <p className="mt-2 font-data text-2xl text-brick-clay">{formatPrice(property.price_pkr)}</p>

          {property.description && <p className="mt-6 font-body text-base opacity-80">{property.description}</p>}

          <div className="mt-8">
            <PropertyGallery propertyId={property.id} media={media ?? []} />
          </div>

          <dl className="mt-10 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-cocoa/20 pt-6 sm:grid-cols-2">
            {specs.filter(([, v]) => v !== null && v !== undefined).map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-cocoa/10 pb-2">
                <dt className="font-body text-sm opacity-60">{label}</dt>
                <dd className="font-data text-sm">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href={'/api/properties/' + property.slug + '/brochure'} className="bg-cocoa px-6 py-3 font-display text-sm text-cream">Download brochure</a>
            <a href={'/contact?property=' + property.id} className="border border-cocoa/30 px-6 py-3 font-display text-sm">Enquire about this property</a>
          </div>
        </div>
      </main>
    </PageTheme>
  )
}
