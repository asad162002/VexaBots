import { PageTheme } from '@/components/shared/PageTheme'
import { Nav } from '@/components/shared/Nav'

export default function BookConsultationPage() {
  return (
    <PageTheme value="light">
      <Nav />
      <main className="min-h-screen bg-cream px-6 pt-28 text-cocoa sm:px-10">
        <h1 className="font-display text-3xl">Book a consultation</h1>
        <p className="mt-3 font-body text-sm opacity-70">
          {/* TODO: blocked — needs the Cal.com account set up, then embed here and wire
              to create_consultation_booking via the webhook route */}
          Scheduling embed pending Cal.com setup.
        </p>
      </main>
    </PageTheme>
  )
}
