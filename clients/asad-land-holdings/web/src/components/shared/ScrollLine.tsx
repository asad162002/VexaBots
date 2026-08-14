'use client'

import { useEffect, useRef } from 'react'

export function ScrollLine() {
  const line1Ref = useRef<SVGSVGElement>(null)
  const line2Ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let ticking = false

    function updatePositions() {
      const y = window.scrollY
      if (line1Ref.current) {
        line1Ref.current.style.transform = `translateY(${y * -0.4}px)`
      }
      if (line2Ref.current) {
        line2Ref.current.style.transform = `translateY(${y * -0.25}px) translateX(${y * 0.08}px)`
      }
      ticking = false
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(updatePositions)
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    updatePositions()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg
        ref={line1Ref}
        className="absolute left-2 top-0 h-[200vh] w-16 opacity-40 sm:left-6"
        viewBox="0 0 60 800"
        preserveAspectRatio="none"
      >
        <path
          d="M30 0 Q 10 100 40 200 T 20 400 Q 45 500 15 600 T 35 800"
          stroke="var(--color-brick-clay)"
          strokeWidth="3"
          fill="none"
        />
      </svg>
      <svg
        ref={line2Ref}
        className="absolute right-2 top-0 h-[200vh] w-16 opacity-30 sm:right-6"
        viewBox="0 0 60 800"
        preserveAspectRatio="none"
      >
        <path
          d="M30 0 Q 50 120 20 240 T 40 480 Q 15 580 45 700 T 25 900"
          stroke="var(--color-brick-clay)"
          strokeWidth="3"
          fill="none"
        />
      </svg>
    </div>
  )
}