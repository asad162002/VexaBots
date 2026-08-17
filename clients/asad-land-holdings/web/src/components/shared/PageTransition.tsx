'use client'

import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

const BRICK_COLS = 8

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      {children}
      <div key={pathname} className="pointer-events-none fixed inset-0 z-50 flex">
        {Array.from({ length: BRICK_COLS }).map((_, i) => (
          <motion.div
            key={i}
            className="h-full flex-1 bg-cocoa"
            initial={{ y: '-100%' }}
            animate={{ y: ['-100%', '0%', '0%', '100%'] }}
            transition={{ duration: 0.9, delay: i * 0.03, times: [0, 0.35, 0.55, 1], ease: 'easeInOut' }}
          />
        ))}
      </div>
    </>
  )
}