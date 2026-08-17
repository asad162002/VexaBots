'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { TransitionLink } from './TransitionLink'
import { usePageTheme } from './PageTheme'
import { supabase } from '@/lib/supabase'

const LINKS = [
  { href: '/properties', label: 'Listings' },
  { href: '/projects', label: 'Projects' },
  { href: '/services', label: 'Services' },
  { href: '/calculators', label: 'Calculators' },
  { href: '/map', label: 'Map' },
]

function renderNavLink(link: { href: string; label: string }, textColor: string) {
  return <TransitionLink key={link.href} href={link.href} className={'font-body text-sm ' + textColor}>{link.label}</TransitionLink>
}

function FacebookIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.16 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.78 8.44-4.94 8.44-9.94Z"/></svg>
}
function InstagramIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c2.72 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.21.6 1.76 1.15.5.5.9 1.1 1.15 1.76.25.64.42 1.37.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.9 4.9 0 0 1-1.15 1.76 4.9 4.9 0 0 1-1.76 1.15c-.64.25-1.37.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47a4.9 4.9 0 0 1-1.76-1.15 4.9 4.9 0 0 1-1.15-1.76c-.25-.64-.42-1.37-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.47-2.43.26-.66.6-1.21 1.15-1.76a4.9 4.9 0 0 1 1.76-1.15c.64-.25 1.37-.42 2.43-.47C8.94 2.01 9.28 2 12 2Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM17.4 6.6a1.17 1.17 0 1 1-2.34 0 1.17 1.17 0 0 1 2.34 0Z"/></svg>
}
function YoutubeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.8 8.2s-.2-1.4-.8-2c-.8-.8-1.7-.8-2.1-.9C16 5 12 5 12 5s-4 0-6.9.3c-.4 0-1.3.1-2.1.9-.6.6-.8 2-.8 2S2 9.9 2 11.6v1.2C2 14.5 2.2 16.2 2.2 16.2s.2 1.4.8 2c.8.8 1.9.8 2.3.9C6.9 19.3 12 19.3 12 19.3s4 0 6.9-.3c.4 0 1.3-.1 2.1-.9.6-.6.8-2 .8-2s.2-1.7.2-3.4v-1.2c0-1.7-.2-3.4-.2-3.4ZM9.9 14.9V8.7l5.4 3.1-5.4 3.1Z"/></svg>
}
function TiktokIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 2h-3.3v13.6a2.7 2.7 0 1 1-2.3-2.7v-3.3a6 6 0 1 0 5.6 6V8.8a7.8 7.8 0 0 0 4.5 1.4V6.9a4.5 4.5 0 0 1-4.5-4.5V2Z"/></svg>
}

const SOCIAL_ICONS: Record<string, () => React.ReactElement> = {
  social_facebook: FacebookIcon,
  social_instagram: InstagramIcon,
  social_youtube: YoutubeIcon,
  social_tiktok: TiktokIcon,
}

export function Nav() {
  const theme = usePageTheme()
  const pathname = usePathname()
  const isHome = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [socials, setSocials] = useState<Record<string, string>>({})

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    async function loadSocials() {
      const { data } = await supabase.from('site_settings').select('key, value').in('key', Object.keys(SOCIAL_ICONS))
      if (data) {
        const map: Record<string, string> = {}
        for (const row of data) {
          if (row.value) map[row.key] = row.value
        }
        setSocials(map)
      }
    }
    loadSocials()
  }, [])

  const translucent = scrolled || !isHome
  const barBg = translucent
    ? theme === 'dark'
      ? 'bg-cocoa/70 backdrop-blur-md'
      : 'bg-cream/70 backdrop-blur-md'
    : 'bg-transparent'
  const textColor = theme === 'dark' ? 'text-cream' : 'text-cocoa'

  return (
    <header className={barBg + ' fixed inset-x-0 top-0 z-40 transition-all duration-300'}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
        <TransitionLink href="/" className={textColor}>
  <img src="/logo.svg" alt="Land Holdings" className="h-6 w-auto" style={{ filter: 'none' }} />

</TransitionLink>

        <nav className="hidden gap-8 sm:flex">{LINKS.map((link) => renderNavLink(link, textColor))}</nav>
        <div className="flex items-center gap-4">
          <div className={'hidden items-center gap-3 sm:flex ' + textColor}>
            {Object.entries(SOCIAL_ICONS).map(([key, Icon]) =>
              socials[key] ? (
                <a key={key} href={socials[key]} target="_blank" rel="noopener noreferrer" className="opacity-70 transition-opacity hover:opacity-100">
                  <Icon />
                </a>
              ) : null
            )}
          </div>
          <TransitionLink href="/contact" className="rounded-full bg-brick-clay px-6 py-2.5 font-display text-sm text-cream shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-brick-clay/30">
            Contact Us
          </TransitionLink>
        </div>
      </div>
    </header>
  )
}