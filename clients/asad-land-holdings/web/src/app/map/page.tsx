import { PageTheme } from '@/components/shared/PageTheme'
import { Nav } from '@/components/shared/Nav'

export default function MapPage() {
  return (
    <PageTheme value="light">
      <Nav />
      <main className="min-h-screen bg-cream px-6 pt-28 text-cocoa sm:px-10">
        <h1 className="font-display text-3xl">Map</h1>
        <p className="mt-3 font-body text-sm opacity-70">
          {/* TODO: blocked — build once everything else is done. Google Maps Platform,
              satellite/hybrid map type, plotting properties.latitude/longitude */}
          Coming soon.
        </p>
      </main>
    </PageTheme>
  )
}
