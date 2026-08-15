import { PageTheme } from '@/components/shared/PageTheme'
import { Nav } from '@/components/shared/Nav'
import { PropertyPanelCard } from '@/components/properties/PropertyPanelCard'
import { getProperties } from '@/lib/properties'

export default async function PropertiesPage() {
  const { data: properties, error } = await getProperties()

  return (
    <PageTheme value="light">
      <Nav />
      <main className="min-h-screen bg-cream px-6 pt-28 text-cocoa sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl">Listings</h1>
            <p className="mt-1 font-body text-sm opacity-70">{properties?.length ?? 0} available</p>
          </div>
          <div>
            {/* TODO: Notify Me modal — writes into saved_searches via a new /api/notify-me route */}
            <button className="rounded-full border border-brick-clay px-6 py-2.5 font-display text-sm">Notify Me</button>
            <p className="mt-1 text-right font-data text-xs opacity-60">Create a custom alert straight to your WhatsApp</p>
          </div>
        </div>

        {/* TODO: filter bar — property_type chips (using property_types.category), location search, price range */}

        {error && <p className="mt-8 font-body text-sm text-brick-clay">Couldn&apos;t load listings right now. Try refreshing.</p>}
        {!error && properties?.length === 0 && <p className="mt-8 font-body text-sm opacity-70">No listings match right now. Check back soon.</p>}

        <div className="mt-10 grid gap-12 lg:grid-cols-2">
          <div className="flex min-h-[400px] items-center justify-center border border-cocoa/20 lg:sticky lg:top-28 lg:self-start">
            <p className="font-data text-xs opacity-40">TODO: looping listing photos, or default fallback illustration when a listing has no media</p>
          </div>
          <div>
            {properties?.map((property) => <PropertyPanelCard key={property.id} property={property} />)}
          </div>
        </div>
      </main>
    </PageTheme>
  )
}
