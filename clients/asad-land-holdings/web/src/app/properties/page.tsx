import { getProperties } from '@/lib/properties'
import { PropertyCard } from '@/components/properties/PropertyCard'

export default async function PropertiesPage() {
  const { data: properties, error } = await getProperties()

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
      <h1 className="font-display text-2xl text-blueprint-blue">Listings</h1>
      <p className="mt-1 font-body text-sm text-muted">{properties?.length ?? 0} available</p>

      {error && (
        <p className="mt-6 font-body text-sm text-brick-clay">
          Couldn&apos;t load listings right now — try refreshing.
        </p>
      )}

      {!error && properties?.length === 0 && (
        <p className="mt-6 font-body text-sm text-muted">No listings match right now — check back soon.</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties?.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </main>
  )
}