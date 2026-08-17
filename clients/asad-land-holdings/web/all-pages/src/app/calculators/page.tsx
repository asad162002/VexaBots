'use client'

import { useState } from 'react'
import { PageTheme } from '@/components/shared/PageTheme'
import { Nav } from '@/components/shared/Nav'

type Tab = 'construction' | 'property'

export default function CalculatorsPage() {
  const [tab, setTab] = useState<Tab>('construction')

  return (
    <PageTheme value="dark">
      <Nav />
      <main className="min-h-screen bg-cocoa px-6 pt-28 text-cream sm:px-10">
        <h1 className="font-display text-4xl">Our property calculators</h1>
        <p className="mt-3 font-body text-base opacity-80">
          {/* TODO: copy needs client review for tone/professionalism */}
          Get a real estimate in minutes, no waiting on a call back.
        </p>

        <div className="mt-10 flex gap-3">
          <button
            onClick={() => setTab('construction')}
            className={'rounded-full px-6 py-2.5 font-display text-sm ' + (tab === 'construction' ? 'bg-brick-clay text-cream' : 'border border-cream/30')}
          >
            Construction Cost Estimator
          </button>
          <button
            onClick={() => setTab('property')}
            className={'rounded-full px-6 py-2.5 font-display text-sm ' + (tab === 'property' ? 'bg-brick-clay text-cream' : 'border border-cream/30')}
          >
            Property Value Evaluator
          </button>
        </div>

        <div className="mt-10 rounded-2xl bg-cream p-8 text-cocoa">
          {tab === 'construction' ? (
            <div>
              <h2 className="font-display text-xl">Construction Cost Estimator</h2>
              <p className="mt-2 font-body text-sm opacity-70">
                {/* TODO: blocked — needs get_construction_estimate's full signature before real fields can be built */}
                Field set pending confirmation of the calculator&apos;s backend parameters.
              </p>
            </div>
          ) : (
            <div>
              <h2 className="font-display text-xl">Property Value Evaluator</h2>
              <p className="mt-2 font-body text-sm opacity-70">
                {/* TODO: blocked — needs PROPERTY_ESTIMATOR_IMPLEMENTATION.md */}
                Field set pending confirmation of the property estimator&apos;s webhook contract.
              </p>
            </div>
          )}
        </div>
      </main>
    </PageTheme>
  )
}
