'use client'

import { useEffect, useRef, useState } from 'react'

const GUTTER_LEFT = 8
const GUTTER_RIGHT = 92
const LOOP_HEIGHT = 260

function buildScribblePath(height: number): string {
  let d = `M ${GUTTER_LEFT} 0`
  let x = GUTTER_LEFT
  let side: 'left' | 'right' = 'left'
  let sinceLastCross = 0

  for (let y = LOOP_HEIGHT; y <= height + LOOP_HEIGHT; y += LOOP_HEIGHT) {
    sinceLastCross++
    // Every ~5 loops, deliberately swing across to the other gutter
    // (the sparse, multi-section-apart crossing agreed on earlier)
    const doCross = sinceLastCross >= 5
    if (doCross) {
      side = side === 'left' ? 'right' : 'left'
      sinceLastCross = 0
    }

    const base = side === 'left' ? GUTTER_LEFT : GUTTER_RIGHT
    const loopOut = side === 'left' ? base + 16 : base - 16
    const midY = y - LOOP_HEIGHT / 2

    // Loop-de-loop: swing out, curl back across itself, land near base again
    d += ` C ${loopOut} ${midY - 60}, ${base - (side === 'left' ? 10 : -10)} ${midY - 20}, ${loopOut} ${midY + 20}`
    d += ` C ${base + (side === 'left' ? 14 : -14)} ${midY + 60}, ${base} ${y - 30}, ${base} ${y}`

    x = base
  }

  return d
}

export function ScrollLine() {
  const groupRef = useRef<SVGGElement>(null)
  const [pathD, setPathD] = useState('')
  const [docHeight, setDocHeight] = useState(0)

  useEffect(() => {
    function measure() {
      const height = document.documentElement.scrollHeight
      setDocHeight(height)
      setPathD(buildScribblePath(height))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])


useEffect(() => {
  let ticking = false
  function update() {
    const y = window.scrollY
    const wobble = Math.sin(y * 0.008) * 10 + Math.sin(y * 0.023) * 5
    if (groupRef.current) {
      groupRef.current.style.transform = `translate(${wobble}px, ${y * -0.3}px)`
    }
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
}, [])

  if (!docHeight) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg
        className="absolute left-0 top-0 h-full w-full"
        viewBox={`0 0 100 ${docHeight}`}
        preserveAspectRatio="none"
      >
        <g ref={groupRef}>
          <path
            d={pathD}
            stroke="var(--color-brick-clay)"
            strokeWidth={7}
            fill="none"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.55}
          />
        </g>
      </svg>
    </div>
  )
}