'use client'

import { useState, FormEvent } from 'react'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMessage(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    const payload = {
      phone: formData.get('phone'),
      name: formData.get('name'),
      property_type: formData.get('property_type'),
      location: formData.get('location'),
      budget: formData.get('budget'),
      message: formData.get('message'),
    }

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setStatus('error')
        setErrorMessage(data.error ?? 'Something went wrong. Try again.')
        return
      }

      setStatus('success')
      form.reset()
    } catch {
      setStatus('error')
      setErrorMessage('Couldn\u2019t reach the server. Check your connection and try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="border border-blueprint-blue/30 bg-paper-card p-6">
        <p className="font-display text-lg text-blueprint-blue">Thanks — we&apos;ve got your details.</p>
        <p className="mt-2 font-body text-sm text-muted">Someone from our team will reach out shortly.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block font-body text-sm text-ink">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          className="mt-1 w-full border border-blueprint-blue/30 bg-paper-card px-3 py-2 font-body text-sm text-ink focus:border-blueprint-blue focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block font-body text-sm text-ink">
          Phone <span className="text-brick-clay">*</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          className="mt-1 w-full border border-blueprint-blue/30 bg-paper-card px-3 py-2 font-body text-sm text-ink focus:border-blueprint-blue focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="property_type" className="block font-body text-sm text-ink">Looking for</label>
        <select
          id="property_type"
          name="property_type"
          className="mt-1 w-full border border-blueprint-blue/30 bg-paper-card px-3 py-2 font-body text-sm text-ink focus:border-blueprint-blue focus:outline-none"
        >
          <option value="">Select one</option>
          <option value="residential plot">Residential plot</option>
          <option value="commercial">Commercial</option>
          <option value="house">House</option>
          <option value="agricultural">Agricultural</option>
          <option value="construction">Construction project</option>
        </select>
      </div>

      <div>
        <label htmlFor="location" className="block font-body text-sm text-ink">Preferred location</label>
        <input
          id="location"
          name="location"
          type="text"
          className="mt-1 w-full border border-blueprint-blue/30 bg-paper-card px-3 py-2 font-body text-sm text-ink focus:border-blueprint-blue focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="budget" className="block font-body text-sm text-ink">Budget</label>
        <input
          id="budget"
          name="budget"
          type="text"
          placeholder="e.g. 50 Lac – 1 Cr"
          className="mt-1 w-full border border-blueprint-blue/30 bg-paper-card px-3 py-2 font-body text-sm text-ink focus:border-blueprint-blue focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="message" className="block font-body text-sm text-ink">Message</label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="mt-1 w-full border border-blueprint-blue/30 bg-paper-card px-3 py-2 font-body text-sm text-ink focus:border-blueprint-blue focus:outline-none"
        />
      </div>

      {status === 'error' && (
        <p className="font-body text-sm text-brick-clay">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="bg-blueprint-blue px-6 py-3 font-display text-sm text-paper-card disabled:opacity-60"
      >
        {status === 'submitting' ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  )
}