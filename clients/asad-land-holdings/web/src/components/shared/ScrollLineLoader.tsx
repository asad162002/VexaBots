'use client'

import dynamic from 'next/dynamic'

const ScrollLine = dynamic(
  () => import('./ScrollLine').then((mod) => mod.ScrollLine),
  { ssr: false }
)

export function ScrollLineLoader() {
  return <ScrollLine />
}