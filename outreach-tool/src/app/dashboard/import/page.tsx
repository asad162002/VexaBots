'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LeadSource } from '@/lib/types';
import { FileJson, FileText, Upload, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import Spinner from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';

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

// Main wrapper component - handles auth check
export default function ImportPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setIsAdmin(profile?.role === 'admin');
      setLoading(false);
    };
    checkRole();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-500">
          <Spinner size="md" />
          <span>Checking permissions...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  return <ImportPageContent />;
}

function AccessDenied() {
  const router = useRouter();
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-white mb-2">Access Restricted</h1>
            <p className="text-gray-300 mb-4">
              Import leads is an admin-only feature. You need admin permissions to upload CSV or JSON files.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-400 hover:text-blue-300 font-medium text-sm"
            >
              Go back to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Separate component for the import form
function ImportPageContent() {
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

  // JSON Import (google-maps-scraper format)
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

  // CSV Import
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
        </div>

        {/* Column mapping step */}
        {file && (
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">2. Map Columns</h2>

            {headers.length === 0 && fileType === 'json' ? (
              <p className="text-sm text-gray-500">JSON files are automatically mapped.</p>
            ) : (
              <div className="space-y-3">
                {mappings.map((mapping, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-1/2">
                      <p className="text-sm text-gray-300 truncate">{mapping.csvColumn}</p>
                    </div>
                    <div className="w-1/2">
                      <select
                        value={mapping.leadField ?? 'none'}
                        onChange={(e) => {
                          const value = e.target.value === 'none' ? null : e.target.value;
                          updateMapping(index, value);
                        }}
                        className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      >
                        {mapping.csvColumn && (
                          <option value="none" className="bg-[#1a1a1a]">-- Select field --</option>
                        )}
                        {LEAD_FIELDS.map((field) => (
                          <option key={field.key} value={field.key} className="bg-[#1a1a1a]">
                            {field.label}{field.required && ' *'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Source selection */}
        {file && headers.length === 0 && fileType === 'json' && (
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">2. Select Source</h2>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as LeadSource)}
              className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                  {opt.label}
                </option>
              ))}
            </select>
            {source === 'google_maps' && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                  Category (optional)
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. restaurants, real estate"
                  className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
            )}
          </div>
        )}

        {/* Import button */}
        {file && (
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
            <button
              onClick={handleImport}
              disabled={importing || (headers.length === 0 && fileType === 'csv' && mappings.filter(m => m.leadField).length === 0)}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-lg px-6 py-3 text-sm transition disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing ? (
                <>
                  <Spinner size="sm" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Import {fileType.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Success display */}
        {success && (
          <div className="flex items-start gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-green-400 font-medium">
                Import complete! {success.inserted} leads imported, {success.skipped} skipped.
              </p>
              {success.enriched && success.enriched > 0 && (
                <p className="text-green-400 mt-0.5">
                  {success.enriched} enriched contacts added to LinkedIn Leads.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
