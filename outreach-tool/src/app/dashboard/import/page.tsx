'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LeadSource } from '@/lib/types';
import { FileJson, FileText, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import Spinner from '@/components/ui/spinner';

interface ColumnMapping {
  csvColumn: string | null;
  leadField: string | null;
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
  { key: 'category_name', label: 'Category', required: false },
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

type FileType = 'csv' | 'json';

export default function ImportPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileType>('csv');
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [source, setSource] = useState<LeadSource>('csv_import');
  const [category, setCategory] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ total: number; inserted: number; skipped: number; enriched?: number } | null>(null);

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

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const isJson = selectedFile.name.toLowerCase().endsWith('.json');
    const isCsv = selectedFile.name.toLowerCase().endsWith('.csv');

    if (!isJson && !isCsv) {
      setError('Please upload a CSV or JSON file.');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File is too large. Max 5MB.');
      return;
    }

    setError('');
    setFile(selectedFile);
    setFileType(isJson ? 'json' : 'csv');
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;

      if (isJson) {
        try {
          const jsonData = JSON.parse(text);
          const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];

          // For JSON files, we auto-map google-maps-scraper format
          const preview = dataArray.slice(0, 3).map((item: Record<string, unknown>) => {
            const row: Record<string, string> = {};
            const simpleItem: Record<string, string> = {};
            for (const [key, value] of Object.entries(item)) {
              if (typeof value === 'object' && value !== null) {
                simpleItem[key] = JSON.stringify(value);
              } else {
                simpleItem[key] = String(value ?? '');
              }
              row[key] = typeof value === 'object' && value !== null
                ? JSON.stringify(value).substring(0, 50)
                : String(value ?? '');
            }
            return row;
          });

          setHeaders(Object.keys(preview[0] || {}));
          setPreviewRows(preview);
          setMappings([]);
          return;
        } catch {
          setError('Invalid JSON file.');
          return;
        }
      }

      // CSV parsing
      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
      if (lines.length < 2) {
        setError('CSV file is empty or has only a header row.');
        setHeaders([]);
        setPreviewRows([]);
        return;
      }

      const parsedHeaders = parseCSVLine(lines[0]);
      setHeaders(parsedHeaders);

      const initialMappings: ColumnMapping[] = parsedHeaders.map((col) => {
        const lower = col.toLowerCase().trim();
        let field: string | null = null;

        if (lower.includes('name') && (lower.includes('business') || lower.includes('company') || lower.includes('title'))) {
          field = 'title';
        } else if (lower.includes('website') || lower.includes('url') || lower.includes('site')) {
          field = 'website';
        } else if (lower.includes('phone') || lower.includes('mobile')) {
          field = 'phone';
        } else if (lower.includes('city')) {
          field = 'city';
        } else if (lower.includes('country')) {
          field = 'country_code';
        } else if (lower.includes('owner') && lower.includes('name')) {
          field = 'owner_name';
        } else if (lower.includes('owner') && lower.includes('role')) {
          field = 'owner_role';
        } else if (lower.includes('linkedin')) {
          field = 'owner_linkedin_url';
        } else if (lower.includes('size') || lower.includes('employees')) {
          field = 'company_size_estimate';
        } else if (lower.includes('note') || lower.includes('comment')) {
          field = 'notes';
        }

        return { csvColumn: col, leadField: field };
      });

      setMappings(initialMappings);

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

  const updateMapping = (index: number, field: string | null) => {
    setMappings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], leadField: field };
      return updated;
    });
  };

  // ─── JSON Import (google-maps-scraper format) ──────────────────────
  const handleJsonImport = async (jsonData: unknown[]) => {
    const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];

    let inserted = 0;
    let skipped = 0;
    let enriched = 0;

    for (const item of dataArray as Record<string, unknown>[]) {
      const detailed_address = item.detailed_address as Record<string, string> | undefined;
      const city = detailed_address?.city || '';
      const owner = item.owner as Record<string, string> | undefined;
      const leads_array = item.leads as Record<string, unknown>[] | undefined;
      const tech_stack = item.tech_stack as Record<string, unknown> | undefined;

      // Map to leads table
      const lead: Record<string, unknown> = {
        title: item.name || '',
        category_name: item.main_category || category || '',
        categories: Array.isArray(item.categories) ? item.categories.join(', ') : null,
        phone: item.phone || '',
        address: item.address || '',
        city: city,
        postal_code: detailed_address?.postal_code || '',
        country_code: detailed_address?.country_code || '',
        website: item.website || '',
        total_score: item.rating || 0,
        reviews_count: item.reviews || 0,
        place_id: item.place_id || '',
        is_advertisement: item.is_spending_on_ads || false,
        search_string: item.query || '',
        url: (item.link as string) || '',
        domain: (item.website as string) ? new URL(item.website as string).hostname : '',
        source: 'google_maps',
        status: 'new',
        ad_running: item.is_spending_on_ads || false,
        source_details: JSON.stringify({
          rating: item.rating,
          reviews: item.reviews,
          coordinates: item.coordinates,
        }),
        // Owner enrichment
        owner_name: owner?.name || null,
        owner_role: owner?.title || owner?.role || null,
        owner_linkedin_url: owner?.linkedin_url || null,
        owner_snippet: owner?.snippet || null,
        owner_found: !!owner?.name,
      };

      // Clean empty strings
      for (const key of Object.keys(lead)) {
        if (lead[key] === '') lead[key] = null;
      }

      // Upsert to leads table
      const { error: upsertError } = await supabase
        .from('leads')
        .upsert(lead, { onConflict: 'place_id' });

      if (upsertError) {
        // Try PATCH as fallback
        const { error: patchError } = await supabase
          .from('leads')
          .update(lead)
          .eq('place_id', lead.place_id);
        if (patchError) {
          skipped++;
          continue;
        }
      }
      inserted++;

      // Upload enriched leads to linkedin_leads (only for LinkedIn-sourced imports, not Google Maps)
      if (owner?.name && lead.source !== 'google_maps') {
        const enriched_record = {
          place_id: lead.place_id,
          lead_name: owner.name,
          title: owner.title || owner.role || null,
          email: owner.email || null,
          email_status: owner.email ? 'verified' : 'not_found',
          linkedin_url: owner.linkedin_url || null,
          source: 'linkedin_owner_search',
        };

        const { error: enrichedError } = await supabase
          .from('linkedin_leads')
          .insert(enriched_record);

        if (!enrichedError) enriched++;
      }

      if (Array.isArray(leads_array)) {
        for (const lead_item of leads_array as Record<string, unknown>[]) {
          const record = {
            place_id: lead.place_id,
            lead_name: lead_item.name || '',
            title: lead_item.title || null,
            email: lead_item.email || null,
            email_status: lead_item.email ? 'verified' : 'not_found',
            linkedin_url: (lead_item.linkedin_url as string) || (lead_item.linkedin as string) || null,
            source: 'apollo_enrichment',
          };

          const { error: apolloError } = await supabase
            .from('linkedin_leads')
            .insert(record);

          if (!apolloError) enriched++;
        }
      }

      // Upload tech stack
      if (tech_stack) {
        const ts_record = {
          place_id: lead.place_id,
          running_google_ads: !!(tech_stack.google_ads),
          running_fb_ads: !!(tech_stack.facebook_ads),
          tech_stack: Array.isArray(tech_stack.tech_stack)
            ? tech_stack.tech_stack.join(', ')
            : (tech_stack.tech_stack as string) || null,
        };

        await supabase.from('tech_stack').upsert(ts_record, { onConflict: 'place_id' });
      }
    }

    return { total: dataArray.length, inserted, skipped, enriched };
  };

  // ─── CSV Import ────────────────────────────────────────────────────
  const handleCsvImport = async () => {
    if (!file || headers.length === 0) return;

    setImporting(true);
    setError('');

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    const rows = lines.slice(1);

    // Build field mapping
    const fieldMap: Record<string, string> = {};
    mappings.forEach((m) => {
      if (m.csvColumn && m.leadField) {
        fieldMap[m.csvColumn] = m.leadField;
      }
    });

    let inserted = 0;
    let skipped = 0;

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
          category_name: category || null,
        };

        for (const [csvCol, leadField] of Object.entries(fieldMap)) {
          if (row[csvCol] && row[csvCol].trim()) {
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

        if (!lead.title) continue;
        leads.push(lead);
      }

      if (leads.length === 0) continue;

      const { error: insertError } = await supabase.from('leads').insert(leads);
      if (insertError) {
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

    setSuccess({ total: rows.length, inserted, skipped });
    setImporting(false);
  };

  const handleImport = async () => {
    if (!file) return;

    if (fileType === 'json') {
      // Parse JSON
      const text = await file.text();
      try {
        const jsonData = JSON.parse(text);
        setImporting(true);
        setError('');
        const result = await handleJsonImport(jsonData);
        if (result) {
          setSuccess({
            total: result.total,
            inserted: result.inserted,
            skipped: result.skipped,
            enriched: result.enriched,
          });
        }
        setImporting(false);
      } catch (e) {
        setError('Invalid JSON file: ' + (e instanceof Error ? e.message : 'Unknown error'));
        setImporting(false);
      }
    } else {
      await handleCsvImport();
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Import Leads</h1>
        <p className="text-sm text-gray-400 mt-1">
          Upload a CSV or JSON file (google-maps-scraper format) to import leads.
        </p>
      </div>

      <div className="space-y-6">
        {/* File upload step */}
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">1. Upload File</h2>

          {!file ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#3f3f46] rounded-xl p-8 cursor-pointer hover:border-blue-500/50 transition">
              <Upload className="w-8 h-8 text-gray-500 mb-3" />
              <p className="text-sm text-gray-400 mb-1">
                <span className="text-blue-400 font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-600">CSV or JSON file, max 5MB</p>
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleFile}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between bg-[#27272a] rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                {fileType === 'json' ? (
                  <FileJson className="w-5 h-5 text-blue-400" />
                ) : (
                  <FileText className="w-5 h-5 text-green-400" />
                )}
                <div>
                  <p className="text-sm text-white font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  fileType === 'json'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-green-500/20 text-green-300'
                }`}>
                  {fileType.toUpperCase()}
                </span>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={handleFile}
                    className="hidden"
                  />
                  <span className="text-xs text-blue-400 hover:text-blue-300">Change</span>
                </label>
              </div>
            </div>
          )}

          {error && !file && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>

        {/* JSON detection message */}
        {file && fileType === 'json' && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
            <p className="text-sm text-blue-200">
              <strong>JSON file detected.</strong> This will auto-map google-maps-scraper format
              and import owner enrichment data (LinkedIn profiles, Apollo emails) into separate tables.
            </p>
            <div className="mt-3">
              <label className="block text-xs font-medium text-blue-200 mb-1.5 uppercase tracking-wide">
                Category (optional)
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. restaurant, construction"
                className="w-full sm:w-[200px] bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
          </div>
        )}

        {/* Preview + mapping step */}
        {headers.length > 0 && fileType === 'csv' && (
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">2. Map Columns</h2>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
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

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Category (e.g. restaurant, construction)
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Enter category name"
                className="w-full sm:w-[200px] bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              <p className="text-xs text-gray-500 mt-1">Optional: groups these leads together for filtering</p>
            </div>

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

            <p className="text-xs text-gray-500 mb-3">Map each CSV column to a lead field. Leave unmapped to skip.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {headers.map((col, index) => {
                const mapping = mappings[index] || { csvColumn: col, leadField: null };
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 bg-[#27272a] rounded-lg px-3 py-2 border border-[#3f3f46]"
                  >
                    <span className="text-xs text-gray-400 min-w-[120px] truncate flex-1" title={col}>
                      {col}
                    </span>
                    <select
                      value={mapping.leadField ?? ''}
                      onChange={(e) => updateMapping(index, e.target.value || null)}
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
        {file && (
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">3. Import</h2>

            {success ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-white font-medium">Import complete</p>
                <p className="text-sm text-gray-400 mt-1">
                  {success.total} rows processed — {success.inserted} added, {success.skipped} skipped
                  {success.enriched ? ` (${success.enriched} enriched leads added)` : ''}
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
                      <Upload className="w-4 h-4" />
                      Import {file.name}
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

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </div>
        )}

        {/* Status message */}
        {fileType === 'json' && previewRows.length > 0 && (
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Data Preview</h2>
            <p className="text-sm text-gray-400 mb-3">
              {previewRows.length} rows detected. The script will auto-map all fields:
            </p>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Basic business info → <span className="text-white">leads</span> table</li>
              <li>• Owner/LinkedIn/Apollo contacts → <span className="text-white">linkedin_leads</span> table</li>
              <li>• Tech stack data → <span className="text-white">tech_stack</span> table</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}