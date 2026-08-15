'use client'

import { useEffect, useState } from 'react'

const SLIDES = ['/hero/hero-1.png', '/hero/hero-2.png', '/hero/hero-3.png', '/hero/hero-4.png']
const INTERVAL_MS = 6000

export function HeroSlideshow() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % SLIDES.length)
    }, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      className="absolute inset-y-0 right-0 h-full w-full sm:w-1/2"
      style={{
        WebkitMaskImage: 'radial-gradient(ellipse 85% 90% at 60% 50%, black 55%, transparent 85%)',
        maskImage: 'radial-gradient(ellipse 85% 90% at 60% 50%, black 55%, transparent 85%)',
      }}
    >
      {SLIDES.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms]"
          style={{ opacity: i === active ? 1 : 0 }}
        />
      ))}
    </div>
  )
}
