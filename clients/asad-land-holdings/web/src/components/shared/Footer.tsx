import Link from 'next/link'
import { getSiteSettings } from '@/lib/site-settings'

const quickLinks = [
  { label: 'Properties', href: '/properties' },
  { label: 'Projects', href: '/projects' },
  { label: 'Services', href: '/services' },
  { label: 'Calculators', href: '/calculators' },
  { label: 'Contact', href: '/contact' },
]

export default async function Footer() {
  const settings = await getSiteSettings()

  const hasSocials =
    settings.social_facebook || settings.social_instagram || settings.social_youtube
  const hasContact = settings.office_phone || settings.office_location

  return (
    <footer className="bg-cocoa text-cream px-6 py-12 sm:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-3">
          {/* TODO: replace with real logo SVG once available */}
          <span className="font-display text-2xl text-cream">LAND HOLDINGS</span>
          <p className="font-body text-sm text-cream/80">Real estate on real rates.</p>

          {hasSocials && (
            <div className="flex gap-4 pt-2">
              {settings.social_facebook && (
                <a
                  href={settings.social_facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="text-cream/80 transition-colors hover:text-cream"
                >
                  <FacebookIcon />
                </a>
              )}
              {settings.social_instagram && (
                <a
                  href={settings.social_instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="text-cream/80 transition-colors hover:text-cream"
                >
                  <InstagramIcon />
                </a>
              )}
              {settings.social_youtube && (
                <a
                  href={settings.social_youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="text-cream/80 transition-colors hover:text-cream"
                >
                  <YoutubeIcon />
                </a>
              )}
            </div>
          )}
        </div>

        <nav aria-label="Quick links" className="flex flex-col gap-2">
          <span className="font-display text-sm uppercase tracking-wide text-cream/60">
            Quick links
          </span>
          <ul className="flex flex-col gap-2">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="font-body text-sm text-cream/90 hover:text-cream"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {hasContact && (
          <div className="flex flex-col gap-2">
            <span className="font-display text-sm uppercase tracking-wide text-cream/60">
              Contact
            </span>
            {settings.office_phone && (
              <span className="font-body text-sm text-cream/90">{settings.office_phone}</span>
            )}
            {settings.office_location && (
              <span className="font-body text-sm text-cream/90">
                {settings.office_location}
              </span>
            )}
          </div>
        )}
      </div>
    </footer>
  )
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.5.5.6.3 1.1.6 1.6 1.1.5.5.9 1 1.1 1.6.3.7.5 1.4.5 2.5.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.5 2.5-.3.6-.6 1.1-1.1 1.6-.5.5-1 .9-1.6 1.1-.7.3-1.4.5-2.5.5-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.5-.5-.6-.3-1.1-.6-1.6-1.1-.5-.5-.9-1-1.1-1.6-.3-.7-.5-1.4-.5-2.5C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.5-2.5.3-.6.6-1.1 1.1-1.6.5-.5 1-.9 1.6-1.1.7-.3 1.4-.5 2.5-.5C8.9 2 9.3 2 12 2Zm0 1.8c-2.6 0-3 0-4 .1-.9 0-1.4.2-1.7.3-.4.2-.7.4-1 .7-.3.3-.5.6-.7 1-.1.3-.3.8-.3 1.7-.1 1-.1 1.4-.1 4s0 3 .1 4c0 .9.2 1.4.3 1.7.2.4.4.7.7 1 .3.3.6.5 1 .7.3.1.8.3 1.7.3 1 .1 1.4.1 4 .1s3 0 4-.1c.9 0 1.4-.2 1.7-.3.4-.2.7-.4 1-.7.3-.3.5-.6.7-1 .1-.3.3-.8.3-1.7.1-1 .1-1.4.1-4s0-3-.1-4c0-.9-.2-1.4-.3-1.7-.2-.4-.4-.7-.7-1-.3-.3-.6-.5-1-.7-.3-.1-.8-.3-1.7-.3-1-.1-1.4-.1-4-.1Zm0 3.5a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Zm0 1.8a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Zm4.9-2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z" />
    </svg>
  )
}

function YoutubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.6 7.2s-.2-1.5-.8-2.1c-.8-.8-1.7-.8-2.1-.9C15.9 4 12 4 12 4h0s-3.9 0-6.7.2c-.4.1-1.3.1-2.1.9-.6.6-.8 2.1-.8 2.1S2.2 9 2.2 10.7v1.6C2.2 14 2.4 15.8 2.4 15.8s.2 1.5.8 2.1c.8.8 1.8.8 2.3.9 1.7.1 7.1.2 7.1.2s3.9 0 6.7-.2c.4-.1 1.3-.1 2.1-.9.6-.6.8-2.1.8-2.1s.2-1.8.2-3.5v-1.6c0-1.7-.2-3.5-.2-3.5ZM9.9 14.3V8.9l5.4 2.7-5.4 2.7Z" />
    </svg>
  )
}
