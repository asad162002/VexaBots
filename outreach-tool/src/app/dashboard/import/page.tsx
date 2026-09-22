'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LeadSource } from '@/lib/types';

interface ColumnMapping {
  csvColumn: string | null;
  leadField: keyof {
    title: never;
    website: never;
    phone: never;
    city: never;
    country_code: never;
    owner_name: never;
    owner_role: never;
    owner_linkedin_url: never;
    company_size_estimate: never;
    source: never;
    notes: never;
    place_id: never;
  };
}

const LEAD_FIELDS = [
  { key: 'title', label: 'Business Name', required: true },
  { key: 'website', label: 'Website', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'country_code', label: 'Country Code', required: false },
  { key: 'owner_name', label: 'Owner Name', required: false },
  { key: 'owner_role', label: 'Owner Role', required: false },
  { key: 'owner_linkedin_url', label: 'LinkedIn URL', required: false },
  { key: 'company_size_estimate', label: 'Company Size', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'place_id', label: 'Place ID', required: false },
];

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'csv_import', label: 'CSV Import' },
  { value: 'google_maps', label: 'Google Maps' },
  { value: 'manual', label: 'Manual' },
  { value: 'apify_n8n', label: 'Apify/n8n' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other' },
];

export default function ImportPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [source, setSource] = useState<LeadSource>('csv_import');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ total: number; inserted: number; skipped: number } | null>(null);

  // Called when a file is selected
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please upload a CSV file.');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File is too large. Max 5MB.');
      return;
    }

    setError('');
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');

      if (lines.length < 2) {
        setError('CSV file is empty or has only a header row.');
        setHeaders([]);
        setPreviewRows([]);
        return;
      }

      // Parse header
      const headerLine = lines[0];
      const parsedHeaders = parseCSVLine(headerLine);

      setHeaders(parsedHeaders);

      // Initialize mappings: first few columns auto-mapped to likely fields
      const initialMappings: ColumnMapping[] = parsedHeaders.map((col) => {
        const lower = col.toLowerCase().trim();
        let leadField: ColumnMapping['leadField'] = 'title';

        if (lower.includes('name') && (lower.includes('business') || lower.includes('company') || lower.includes('title'))) {
          leadField = 'title';
        } else if (lower.includes('website') || lower.includes('url') || lower.includes('site') || lower.includes('web')) {
          leadField = 'website';
        } else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('tel')) {
          leadField = 'phone';
        } else if (lower.includes('city') || lower.includes('town') || lower.includes('location')) {
          leadField = 'city';
        } else if (lower.includes('country')) {
          leadField = 'country_code';
        } else if (lower.includes('owner') && lower.includes('name')) {
          leadField = 'owner_name';
        } else if (lower.includes('owner') && lower.includes('role')) {
          leadField = 'owner_role';
        } else if (lower.includes('linkedin')) {
          leadField = 'owner_linkedin_url';
        } else if (lower.includes('size') || lower.includes('employees')) {
          leadField = 'company_size_estimate';
        } else if (lower.includes('note') || lower.includes('comment') || lower.includes('description')) {
          leadField = 'notes';
        }

        return { csvColumn: col, leadField };
      });

      setMappings(initialMappings);

      // Parse a few preview rows
      const previewLines = lines.slice(1, 6);
      const preview: Record<string, string>[] = [];
      for (const line of previewLines) {
        const values = parseCSVLine(line);
        const row: Record<string, string> = {};
        parsedHeaders.forEach((h, i) => {
          row[h] = values[i] ?? '';
        });
        preview.push(row);
      }
      setPreviewRows(preview);
    };
    reader.readAsText(selectedFile);
  }, []);

  // Parse a single CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const updateMapping = (index: number, field: ColumnMapping['leadField']) => {
    setMappings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], leadField: field };
      return updated;
    });
  };

  const clearMapping = (index: number) => {
    setMappings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], leadField: 'title' };
      return updated;
    });
  };

  const handleImport = async () => {
    if (!file || headers.length === 0) return;

    setImporting(true);
    setError('');
    setSuccess(null);

    try {
      // Read file content
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');

      // Build field mapping index
      const fieldMap: Record<string, string> = {};
      mappings.forEach((m) => {
        if (m.csvColumn && m.leadField !== 'title') {
          fieldMap[m.csvColumn] = m.leadField;
        }
      });

      // Process rows
      const rows = lines.slice(1); // skip header
      let inserted = 0;
      let skipped = 0;

      // Process in batches of 50
      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const leads: Record<string, unknown>[] = [];

        for (const line of batch) {
          const values = parseCSVLine(line);
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
            row[h] = values[idx] ?? '';
          });

          const lead: Record<string, unknown> = {
            source,
            status: 'new',
          };

          // Map CSV columns to lead fields
          for (const [csvCol, leadField] of Object.entries(fieldMap)) {
            if (row[csvCol] && row[csvCol].trim()) {
              // Special handling for company_size_estimate
              if (leadField === 'company_size_estimate') {
                const val = row[csvCol].toLowerCase().trim();
                if (['solo', 'small', 'medium', 'large'].includes(val)) {
                  lead[leadField] = val;
                }
              } else {
                lead[leadField] = row[csvCol].trim();
              }
            }
          }

          // If no title mapped, skip this row
          if (!lead.title) continue;

          leads.push(lead);
        }

        if (leads.length === 0) continue;

        const { error: insertError } = await supabase.from('leads').insert(leads);

        if (insertError) {
          console.error('Batch insert error:', insertError);
          // Count individual errors
          for (const lead of leads) {
            const { error: singleError } = await supabase.from('leads').insert([lead]);
            if (singleError) {
              skipped++;
            } else {
              inserted++;
            }
          }
        } else {
          inserted += leads.length;
        }
      }

      setSuccess({ total: rows.length, inserted, skipped: rows.length - inserted });
    } catch (err) {
      setError('Import failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }

    setImporting(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Import CSV</h1>
        <p className="text-sm text-gray-400 mt-1">
          Upload a CSV file and map its columns to lead fields.
        </p>
      </div>

      <div className="space-y-6">
        {/* File upload step */}
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">1. Upload CSV File</h2>

          {!file ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#3f3f46] rounded-xl p-8 cursor-pointer hover:border-blue-500/50 transition">
              <svg className="w-8 h-8 text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-400 mb-1">
                <span className="text-blue-400 font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-600">CSV file, max 5MB</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFile}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between bg-[#27272a] rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-white font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFile}
                  className="hidden"
                />
                <span className="text-xs text-blue-400 hover:text-blue-300 transition">Change file</span>
              </label>
            </div>
          )}

          {error && !file && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* Preview + mapping step */}
        {headers.length > 0 && (
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">2. Map Columns</h2>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                Default Source for imported leads
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as LeadSource)}
                className="w-full sm:w-[200px] bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview table */}
            {previewRows.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Preview (first {previewRows.length} rows):</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#3f3f46]">
                        {Object.keys(previewRows[0]).map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 text-xs text-gray-400 font-medium uppercase tracking-wider whitespace-nowrap"
                          >
                            {h.length > 20 ? h.slice(0, 20) + '...' : h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-b border-[#27272a]">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-3 py-2 text-gray-300 max-w-[150px] truncate">
                              {val || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Column mapping grid */}
            <p className="text-xs text-gray-500 mb-3">Map each CSV column to a lead field. Leave unmapped if not needed.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {headers.map((col, index) => {
                const mapping = mappings[index] || { csvColumn: col, leadField: 'title' };
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 bg-[#27272a] rounded-lg px-3 py-2 border border-[#3f3f46]"
                  >
                    <span className="text-xs text-gray-400 min-w-[120px] truncate flex-1" title={col}>
                      {col}
                    </span>
                    <select
                      value={mapping.leadField}
                      onChange={(e) => updateMapping(index, e.target.value as ColumnMapping['leadField'])}
                      className="bg-[#1a1a1a] border border-[#3f3f46] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                    >
                      <option value="" className="bg-[#1a1a1a]">— Skip —</option>
                      {LEAD_FIELDS.map((field) => (
                        <option key={field.key} value={field.key} className="bg-[#1a1a1a]">
                          {field.label}
                          {field.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Import button */}
        {headers.length > 0 && (
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">3. Import</h2>

            {success ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white font-medium">Import complete</p>
                <p className="text-sm text-gray-400 mt-1">
                  {success.total} rows processed — {success.inserted} added, {success.skipped} skipped
                </p>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
                >
                  View leads
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-lg px-6 py-2.5 text-sm transition disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Importing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Import {previewRows.length > 0 ? `(${previewRows.length}+ rows)` : ''}
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setFile(null);
                    setHeaders([]);
                    setPreviewRows([]);
                    setMappings([]);
                    setError('');
                    setSuccess(null);
                  }}
                  className="text-gray-400 hover:text-white text-sm transition"
                >
                  Start over
                </button>
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-red-400">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
