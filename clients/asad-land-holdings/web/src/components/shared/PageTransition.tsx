'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

const BRICK_COLS = 8

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
      <BrickWipeOverlay pathname={pathname} />
    </>
  )
}

function BrickWipeOverlay({ pathname }: { pathname: string }) {
  return (
    <motion.div
      key={pathname + '-wipe'}
      className="pointer-events-none fixed inset-0 z-50 flex"
      initial="visible"
      animate="hidden"
    >
      {Array.from({ length: BRICK_COLS }).map((_, i) => (
        <motion.div
          key={i}
          className="h-full flex-1 bg-cocoa"
          variants={{
            visible: { y: 0 },
            hidden: { y: '-100%' },
          }}
          transition={{ duration: 0.35, delay: i * 0.03, ease: 'easeInOut' }}
        />
      ))}
    </motion.div>
  )
}