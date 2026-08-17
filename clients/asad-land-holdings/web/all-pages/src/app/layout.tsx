import type { Metadata } from 'next'
import { Space_Grotesk, Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { ScrollLineLoader } from '@/components/shared/ScrollLineLoader'
import { PageTransition } from '@/components/shared/PageTransition'
import { Footer } from '@/components/shared/Footer'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500'], variable: '--font-space-grotesk', display: 'swap' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-inter', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'Land Holdings',
  description: 'Property, construction, and consultancy in Wah Cantt and surrounding areas.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={spaceGrotesk.variable + ' ' + inter.variable + ' ' + plexMono.variable}>
      <body>
        <ScrollLineLoader />
        <PageTransition>
          {children}
          <Footer />
        </PageTransition>
      </body>
    </html>
  )
}
