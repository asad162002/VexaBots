import { PageTheme } from '@/components/shared/PageTheme'
import { Nav } from '@/components/shared/Nav'
import { ContactForm } from '@/components/contact/ContactForm'

const PANELS = [
  { title: 'Have our team reach out', desc: 'Tell us what you need, we\u2019ll get back to you.', action: '#form' },
  { title: 'WhatsApp us now', desc: 'Message us directly for a quick answer.', action: 'https://wa.me/' },
  { title: 'Book a consultation', desc: 'Sit down with our team, in person or on a call.', action: '/book-consultation?type=consultation' },
  { title: 'Schedule a site visit', desc: 'See a plot or project in person.', action: '/book-consultation?type=site_visit' },
]

export default function ContactPage() {
  return (
    <PageTheme value="dark">
      <Nav />
      <main className="min-h-screen bg-cocoa px-6 pt-28 text-cream sm:px-10">
        {/* TODO: headline copy needs client review, e.g. "Let's build your next move together" */}
        <h1 className="font-display text-4xl">Let&apos;s find your next move.</h1>
        <p className="mt-3 max-w-xl font-body text-base opacity-80">
          Need a house, a commercial space, or a plot of land? We&apos;d love to hear from you.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PANELS.map((panel) => (
            <a key={panel.title} href={panel.action} className="block border border-cream/20 p-6 transition-colors hover:border-brick-clay">
              <div className="flex h-16 w-16 items-center justify-center border border-cream/20">
                <p className="font-data text-[10px] text-cream/40">TODO: doodle art</p>
              </div>
              <p className="mt-4 font-display text-lg">{panel.title}</p>
              <p className="mt-1 font-body text-sm opacity-70">{panel.desc}</p>
            </a>
          ))}
        </div>

        <div id="form" className="mt-16 max-w-md">
          <ContactForm />
        </div>
      </main>
    </PageTheme>
  )
}
