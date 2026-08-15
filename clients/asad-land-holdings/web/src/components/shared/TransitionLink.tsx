'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function TransitionLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  const router = useRouter()
  const [drawing, setDrawing] = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (drawing) return
    setDrawing(true)
    setTimeout(() => {
      router.push(href)
      setDrawing(false)
    }, 180)
  }

  return (
    <a href={href} onClick={handleClick} className={'group relative inline-block ' + (className ?? '')}>
      {children}
      <svg
        className="pointer-events-none absolute -bottom-1 left-0 h-2 w-full overflow-visible"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M2 5 Q 20 1, 35 5 T 65 4 T 98 5"
          fill="none"
          stroke="var(--color-brick-clay)"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength="100"
          className={drawing ? 'scribble-path scribble-drawn' : 'scribble-path'}
        />
      </svg>
    </a>
  )
}