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
import {
  parseCSVLine,
  normalizePhoneForDedup,
  buildInitialMappings,
  parseCSVPreview,
  parseJsonPreview,
  buildGoogleMapsLead,
  buildEnrichedRecord,
} from '@/lib/import-helpers';

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
        <div className="flex items-center gap-3 text-muted">
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
              <h1 className="text-xl font-bold text-foreground mb-2">Access Restricted</h1>
              <p className="text-muted mb-4">
                Import leads is an admin-only feature. You need admin permissions to upload CSV or JSON files.
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-accent hover:text-accent font-medium text-sm"
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
  const [skippedDetails, setSkippedDetails] = useState<string[]>([]);

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
    setSkippedDetails([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;

      if (isJson) {
        try {
          const { headers: jsonHeaders, rows: jsonRows } = parseJsonPreview(text);
          setHeaders(jsonHeaders);
          setPreviewRows(jsonRows);
          setMappings([]);
          return;
        } catch {
          setError('Invalid JSON file.');
          return;
        }
      }

      // CSV parsing
      const { headers: csvHeaders, rows: csvRows } = parseCSVPreview(text);
      if (csvHeaders.length === 0) {
        setError('CSV file is empty or has only a header row.');
        setHeaders([]);
        setPreviewRows([]);
        return;
      }

      setHeaders(csvHeaders);
      setMappings(buildInitialMappings(csvHeaders));
      setPreviewRows(csvRows);
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
    const skipDetails: string[] = [];
    const seenKeys = new Set<string>();

    for (const item of dataArray as Record<string, unknown>[]) {
      const owner = item.owner as Record<string, string> | undefined;
      const leads_array = item.leads as Record<string, unknown>[] | undefined;
      const tech_stack = item.tech_stack as Record<string, unknown> | undefined;
      const lead = buildGoogleMapsLead(item, category);

      // Deduplicate: normalized phone + title
      const normalizedPhoneJson = normalizePhoneForDedup(lead.phone);
      const dedupKeyJson = `${normalizedPhoneJson}|${(lead.title as string).toLowerCase().trim()}`;
      if (seenKeys.has(dedupKeyJson)) {
        skipped++;
        skipDetails.push(`Skipped duplicate in file: ${lead.title}`);
        continue;
      }
      seenKeys.add(dedupKeyJson);

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
          skipDetails.push(`Skipped ${lead.title}: duplicate or error`);
          continue;
        }
      }
      inserted++;

      // Upload enriched leads for LinkedIn-sourced imports
      if (owner?.name && lead.source !== 'google_maps') {
        const enriched_record = buildEnrichedRecord(lead, owner);
        const enriched_rest = {
        };

        const { error: enrichedError } = await supabase
          .from('linkedin_leads')
          .upsert(enriched_record, { onConflict: 'place_id', ignoreDuplicates: true });
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
            .upsert(record, { onConflict: 'place_id', ignoreDuplicates: true });
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

    return { total: dataArray.length, inserted, skipped, enriched, skipDetails: skipDetails };
  };

  const handleCsvImport = useCallback(async () => {
    if (!file || headers.length === 0) return;
    setImporting(true);
    setError('');
    setSkippedDetails([]);

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
    const seenKeys = new Set<string>();
    const skipDetails: string[] = [];

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const leadsToInsert: Record<string, unknown>[] = [];

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

        // Deduplicate: normalized phone + title (case-insensitive)
        const normalizedPhone = normalizePhoneForDedup(lead.phone);
        const dedupKey = `${normalizedPhone}|${(lead.title as string).toLowerCase().trim()}`;

        if (seenKeys.has(dedupKey)) {
          skipped++;
          skipDetails.push(`Skipped duplicate in file: ${lead.title}`);
          continue;
        }
        seenKeys.add(dedupKey);

        // Check if a lead with this phone already exists in the DB
        if (normalizedPhone) {
          const { data: existing } = await supabase
            .from('leads')
            .select('id')
            .eq('phone', normalizedPhone)
            .maybeSingle();
          if (existing) {
            skipped++;
            skipDetails.push(`Skipped existing lead (same phone): ${lead.title}`);
            continue;
          }
        }

        leadsToInsert.push(lead);
      }

      if (leadsToInsert.length === 0) continue;

      // Batch insert the deduplicated leads
      const { error: insertError } = await supabase.from('leads').insert(leadsToInsert);
      if (insertError) {
        for (const lead of leadsToInsert) {
          const { error: singleError } = await supabase.from('leads').insert([lead]);
          if (singleError) {
            skipped++;
            skipDetails.push(`Skipped (insert error): ${(lead.title as string)}`);
          } else {
            inserted++;
          }
        }
      } else {
        inserted += leadsToInsert.length;
      }
    }

    setSuccess({ total: rows.length, inserted, skipped });
    setSkippedDetails(skipDetails);
    setImporting(false);
  }, [file, headers, mappings, source, category]);

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
          setSkippedDetails(result.skipDetails);
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
    setSkippedDetails([]);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Import Leads</h1>
        <p className="text-sm text-muted mt-1">
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

        {/* Step 3: Import button */}
        {file && (
          <div className="flex items-center gap-3">
            {fileType === 'csv' && headers.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="bg-primary hover:bg-primary disabled:bg-primary text-foreground font-semibold rounded-lg px-4 py-2 text-sm transition disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <Spinner size="sm" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Import Leads</span>
                  </>
                )}
              </button>
            )}
            {fileType === 'json' && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="bg-primary hover:bg-primary disabled:bg-primary text-foreground font-semibold rounded-lg px-4 py-2 text-sm transition disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <Spinner size="sm" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Import JSON</span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleReset}
              disabled={importing}
              className="text-muted hover:text-foreground text-sm font-medium transition"
            >
              Reset
            </button>
          </div>
        )}

        {/* Show import result */}
        {success && (
          <ImportResult
            success={success}
            skippedDetails={skippedDetails}
            onImport={handleImport}
            onReset={handleReset}
            importing={importing}
            file={file}
          />
        )}
      </div>
    </div>
  );
}

export default ImportPageWrapper;
