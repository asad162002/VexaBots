'use client'

import { useEffect, useRef, useState } from 'react'

const UNIT_HEIGHT = 320

function unitPath(width: number, mirror: boolean): string {
  const m = mirror ? -1 : 1
  const cx = Math.min(60, width * 0.05)
  return `c ${40 * m} 30, ${-20 * m} 90, ${10 * m} 140 s ${50 * m} 40, ${5 * m} 100 s ${-35 * m} 30, ${cx * 0} 80`
}

function buildFixedPath(width: number, height: number): string {
  const baseX = Math.min(50, width * 0.04)
  const swing = Math.min(70, width * 0.05)
  let d = `M ${baseX} 0`
  let y = 0
  let dir = 1
  while (y < height) {
    const step = 260 + Math.random() * 120
    const midY = y + step * 0.5
    d += ` C ${baseX + swing * dir} ${midY - 40}, ${baseX + swing * dir} ${midY + 40}, ${baseX} ${y + step}`
    dir *= -1
    y += step
  }
  return d
}

function computeGeometry(): { width: number; docHeight: number; pathD: string } {
  const width = window.innerWidth
  const docHeight = document.documentElement.scrollHeight
  return { width, docHeight, pathD: buildFixedPath(width, docHeight) }
}

export function ScrollLine() {
  const pathRef = useRef<SVGPathElement>(null)
  const [geometry, setGeometry] = useState(computeGeometry)
  const totalLengthRef = useRef(0)

  useEffect(() => {
    function handleResize() {
      setGeometry(computeGeometry())
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!pathRef.current || !geometry.pathD) return
    totalLengthRef.current = pathRef.current.getTotalLength()

    let ticking = false
    function update() {
      const path = pathRef.current
      if (!path) return
      const total = totalLengthRef.current
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const scrollFraction = maxScroll > 0 ? window.scrollY / maxScroll : 0
      const baseReveal = window.innerHeight * 0.5
      const revealLength = Math.min(total, baseReveal + scrollFraction * (total - baseReveal))
      path.style.strokeDasharray = String(total)
      path.style.strokeDashoffset = String(total - revealLength)
      ticking = false
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update)
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => window.removeEventListener('scroll', onScroll)
  }, [geometry.pathD])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg className="absolute left-0 top-0 h-full w-full" viewBox={`0 0 ${geometry.width} ${geometry.docHeight}`} preserveAspectRatio="none">
        <path ref={pathRef} d={geometry.pathD} stroke="var(--color-brick-clay)" strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.65} />
      </svg>
    </div>
  )
}