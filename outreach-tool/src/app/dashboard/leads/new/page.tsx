'use client';

import { useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LeadSource } from '@/lib/types';

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'google_maps', label: 'Google Maps' },
  { value: 'manual', label: 'Manual' },
  { value: 'csv_import', label: 'CSV Import' },
  { value: 'apify_n8n', label: 'Apify/n8n' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other' },
];

const SIZE_OPTIONS = ['solo', 'small', 'medium', 'large'];

export default function AddLeadPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    title: '',
    website: '',
    phone: '',
    city: '',
    country_code: '',
    owner_name: '',
    owner_role: '',
    owner_linkedin_url: '',
    company_size_estimate: '' as string,
    source: 'manual' as LeadSource,
    notes: '',
    place_id: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess(false);

    const updates: Record<string, unknown> = {
      title: form.title || null,
      website: form.website || null,
      phone: form.phone || null,
      city: form.city || null,
      country_code: form.country_code || null,
      owner_name: form.owner_name || null,
      owner_role: form.owner_role || null,
      owner_linkedin_url: form.owner_linkedin_url || null,
      company_size_estimate: form.company_size_estimate || null,
      source: form.source,
      notes: form.notes || null,
      place_id: form.place_id || null,
      status: 'new',
      owner_id: user?.id ?? null,
    };

    const { error: insertError } = await supabase.from('leads').insert([updates]);

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);

    setTimeout(() => {
      router.push('/dashboard');
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Add Lead</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manually add a business to your outreach pipeline.
        </p>
      </div>

      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
            Lead added successfully. Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Required fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                Business Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="ABC Construction Co."
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                Source <span className="text-red-400">*</span>
              </label>
              <select
                name="source"
                value={form.source}
                onChange={handleChange}
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+92 300 1234567"
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                Website
              </label>
              <input
                type="url"
                name="website"
                value={form.website}
                onChange={handleChange}
                placeholder="https://example.com"
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                City
              </label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Islamabad"
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                Country Code
              </label>
              <input
                type="text"
                name="country_code"
                value={form.country_code}
                onChange={handleChange}
                placeholder="PK"
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Owner fields */}
          <div className="border-t border-[#27272a] pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Owner / Contact Person</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                  Owner Name
                </label>
                <input
                  type="text"
                  name="owner_name"
                  value={form.owner_name}
                  onChange={handleChange}
                  placeholder="John Manager"
                  className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                  Role / Title
                </label>
                <input
                  type="text"
                  name="owner_role"
                  value={form.owner_role}
                  onChange={handleChange}
                  placeholder="Owner / Director"
                  className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  name="owner_linkedin_url"
                  value={form.owner_linkedin_url}
                  onChange={handleChange}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                  Company Size
                </label>
                <select
                  name="company_size_estimate"
                  value={form.company_size_estimate}
                  onChange={handleChange}
                  className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                >
                  <option value="" className="bg-[#1a1a1a]">Select...</option>
                  {SIZE_OPTIONS.map((s) => (
                    <option key={s} value={s} className="bg-[#1a1a1a]">
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Extra fields */}
          <div className="border-t border-[#27272a] pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Additional</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                  Place ID (for dedup)
                </label>
                <input
                  type="text"
                  name="place_id"
                  value={form.place_id}
                  onChange={handleChange}
                  placeholder="ChIJ... (from Google Maps)"
                  className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>

              <div></div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                Notes
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Any notes about this lead..."
                rows={3}
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-800 text-white font-semibold rounded-lg px-6 py-2.5 text-sm transition disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding...' : 'Add Lead'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white text-sm transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
