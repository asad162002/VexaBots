import { ContactForm } from '@/components/contact/ContactForm'

export default function ContactPage() {
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
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl text-blueprint-blue">Get in touch</h1>
        <p className="mt-1 font-body text-sm text-muted">
          Tell us what you&apos;re looking for and we&apos;ll be in touch.
        </p>
        <div className="mt-6">
          <ContactForm />
        </div>
      </div>
    </main>
  )
}