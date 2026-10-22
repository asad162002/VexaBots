'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LeadSource } from '@/lib/types';
import { FileJson, Upload, Shield } from 'lucide-react';
import Spinner from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';
import ImportUpload, { CsvColumnMapper, JsonPreviewNotice } from '@/components/import/ImportUpload';
import { LEAD_FIELDS, type ColumnMapping } from '@/components/import/import-utils';
import ImportResult from '@/components/import/ImportResult';

type FileType = 'csv' | 'json';

function ImportPageWrapper() {
  const router = useRouter();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!user?.id) {
        setLoadingRole(false);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setIsAdmin(profile?.role === 'admin');
      setLoadingRole(false);
    };
    checkRole();
  }, [user]);

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-3 text-gray-400">
          <Spinner size="md" />
          <span>Checking permissions...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
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

  return <ImportPageContent />;
}

function ImportPageContent() {
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

          const preview = dataArray.slice(0, 3).map((item: Record<string, unknown>) => {
            const row: Record<string, string> = {};
            for (const [key, value] of Object.entries(item)) {
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
        parsedHeaders.forEach((h, idx) => {
          row[h] = values[idx] ?? '';
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

      // Upload enriched leads for LinkedIn-sourced imports
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
            lead_name: (lead_item.name as string) || '',
            title: (lead_item.title as string) || null,
            email: (lead_item.email as string) || null,
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

  const handleReset = () => {
    setFile(null);
    setHeaders([]);
    setPreviewRows([]);
    setMappings([]);
    setError('');
    setSuccess(null);
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
        {/* Step 1: Upload */}
        <ImportUpload
          file={file}
          fileType={fileType}
          handleFile={handleFile}
          error={error}
        />

        {/* JSON preview notice */}
        {file && fileType === 'json' && (
          <JsonPreviewNotice />
        )}

        {/* Step 2: Column mapping (CSV only) */}
        {headers.length > 0 && fileType === 'csv' && (
          <CsvColumnMapper
            source={source}
            setSource={setSource}
            category={category}
            setCategory={setCategory}
            headers={headers}
            mappings={mappings}
            previewRows={previewRows}
            updateMapping={updateMapping}
            LEAD_FIELDS={LEAD_FIELDS}
          />
        )}

        {/* JSON preview data */}
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

        {/* Step 3: Import */}
        {file && (
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">3. Import</h2>
            <ImportResult
              success={success}
              onImport={handleImport}
              onReset={handleReset}
              importing={importing}
              file={file}
            />
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportPageWrapper;
