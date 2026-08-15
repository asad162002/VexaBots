'use client'

import { useRef, useState } from 'react'

const TOTAL_FRAMES = 36

function frameSrc(frameNumber: number): string {
  const padded = String(frameNumber).padStart(2, '0')
  return '/house-rotation/house_360_' + padded + '_of_36.png'
}

const HOTSPOTS = [
  { label: 'Bedroom', frame: 5, image: '/house-hotspots/bedroom.webp' },
  { label: 'Washroom', frame: 14, image: '/house-hotspots/washroom.webp' },
  { label: 'Living Room', frame: 23, image: '/house-hotspots/living-room.webp' },
  { label: 'Kitchen', frame: 32, image: '/house-hotspots/kitchen.webp' },
]

export function HouseRotationViewer() {
  const [frame, setFrame] = useState(1)
  const [hotspotIndex, setHotspotIndex] = useState<number | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const dragStartX = useRef<number | null>(null)
  const dragStartFrame = useRef(1)
  const didDrag = useRef(false)
  const animatingRef = useRef(false)

  function handlePointerDown(e: React.PointerEvent) {
    dragStartX.current = e.clientX
    dragStartFrame.current = frame
    didDrag.current = false
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (dragStartX.current === null || animatingRef.current) return
    const deltaX = e.clientX - dragStartX.current
    if (Math.abs(deltaX) > 4) didDrag.current = true
    const framesShifted = Math.round(deltaX / 12)
    let next = (dragStartFrame.current - framesShifted - 1) % TOTAL_FRAMES
    if (next < 0) next += TOTAL_FRAMES
    setFrame(next + 1)
    if (showDetail) setShowDetail(false)
  }

  function handlePointerUp() {
    if (!didDrag.current) {
      handleTap()
    }
    dragStartX.current = null
  }

  function animateToFrame(targetFrame: number, onDone: () => void) {
    animatingRef.current = true
    setShowDetail(false)
    const step = () => {
      setFrame((current) => {
        if (current === targetFrame) {
          animatingRef.current = false
          onDone()
          return current
        }
        const forwardDist = (targetFrame - current + TOTAL_FRAMES) % TOTAL_FRAMES
        const backwardDist = TOTAL_FRAMES - forwardDist
        const next = forwardDist <= backwardDist
          ? (current % TOTAL_FRAMES) + 1
          : ((current - 2 + TOTAL_FRAMES) % TOTAL_FRAMES) + 1
        return next
      })
      setTimeout(step, 40)
    }
    step()
  }

  function handleTap() {
    if (animatingRef.current) return
    const nextIndex = hotspotIndex === null ? 0 : (hotspotIndex + 1) % HOTSPOTS.length
    setHotspotIndex(nextIndex)
    animateToFrame(HOTSPOTS[nextIndex].frame, () => setShowDetail(true))
  }

  const activeHotspot = hotspotIndex !== null ? HOTSPOTS[hotspotIndex] : null

  return (
    <div className="relative select-none overflow-hidden" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={frameSrc(frame)} alt="House exterior" className="h-full w-full object-contain" draggable={false} />

      {showDetail && activeHotspot && (
        <div className="absolute inset-0 flex items-end justify-center bg-cocoa/40 p-6 transition-opacity duration-300">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-cream shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeHotspot.image} alt={activeHotspot.label} className="aspect-square w-full object-cover" />
            <p className="p-4 text-center font-display text-sm text-cocoa">{activeHotspot.label}</p>
          </div>
        </div>
      )}

      <p className="pointer-events-none absolute bottom-2 left-2 font-data text-[10px] text-cream/50">Drag to rotate. Tap to explore rooms.</p>
    </div>
  )
}
