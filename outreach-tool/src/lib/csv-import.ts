import { supabase } from '@/lib/supabase';
import { type LeadSource } from '@/lib/types';
import {
  buildCsvLead,
  looksLikeApolloExport,
  normalizeBatchKeys,
  normalizePhoneForDedup,
} from '@/lib/import-helpers';

// The two ways a CSV can be imported. A business file writes to leads, where a
// business is identified by its Place ID and otherwise by its phone number. A
// contact file writes each person to linkedin_leads, where a person is identified
// by their LinkedIn profile slug, which is what allows several people at one
// company to be stored.
//
// Kept out of the page so the page only has to decide which one to run, and so this
// can be read on its own.

// Reads one stored column a page at a time, so an upload can be checked against what
// is already saved without one query per row.
async function readStoredValues(table: string, column: string) {
  const values: unknown[] = [];
  let error: string | null = null;

  for (let from = 0; ; from += 1000) {
    const { data, error: pageError } = await supabase.from(table).select(column).range(from, from + 999);
    if (pageError) {
      error = pageError.message;
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data as unknown as Record<string, unknown>[]) values.push(row[column]);
    if (data.length < 1000) break;
  }

  return { values, error };
}

export interface CsvImportOptions {
  /** The data records, already split into fields by parseCSVRecords. */
  records: string[][];
  headers: string[];
  fieldMap: Record<string, string>;
  source: LeadSource;
  category: string;
}

export interface CsvImportOutcome {
  inserted: number;
  skipped: number;
  details: string[];
}

export async function importBusinessRows({
  records,
  headers,
  fieldMap,
  source,
  category,
}: CsvImportOptions): Promise<CsvImportOutcome> {
  const details: string[] = [];
  let inserted = 0;
  let skipped = 0;

  const existingPlaceIds = new Set<string>();
  const existingPhones = new Set<string>();

  const placeIdRead = await readStoredValues('leads', 'place_id');
  if (placeIdRead.error) details.push(`Could not read existing leads: ${placeIdRead.error}`);
  placeIdRead.values.forEach((value) => {
    if (typeof value === 'string' && value) existingPlaceIds.add(value);
  });

  const phoneRead = await readStoredValues('leads', 'phone');
  if (phoneRead.error) details.push(`Could not read existing phone numbers: ${phoneRead.error}`);
  phoneRead.values.forEach((value) => {
    const phone = normalizePhoneForDedup(value);
    if (phone) existingPhones.add(phone);
  });

  const seenKeys = new Set<string>();

  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const leadsToInsert: Record<string, unknown>[] = [];

    for (let j = 0; j < batch.length; j++) {
      const lineNumber = i + j + 2; // +1 for the header, +1 because lines are 1-based
      const values = batch[j];
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? '';
      });

      const built = buildCsvLead(row, fieldMap, { source, category });
      if (built.note) details.push(`Line ${lineNumber}: ${built.note}`);
      if (!built.lead) {
        skipped++;
        details.push(`Skipped line ${lineNumber}: ${built.error}`);
        continue;
      }
      const lead = built.lead;

      // Deduplicate inside the file first, then against the database.
      const normalizedPhone = normalizePhoneForDedup(lead.phone);
      const placeId = typeof lead.place_id === 'string' ? lead.place_id : '';
      const dedupKey = placeId
        ? `place:${placeId}`
        : `phone:${normalizedPhone}|${(lead.title as string).toLowerCase().trim()}`;

      if (seenKeys.has(dedupKey)) {
        skipped++;
        details.push(`Skipped duplicate in file: ${lead.title}`);
        continue;
      }
      seenKeys.add(dedupKey);

      if (placeId && existingPlaceIds.has(placeId)) {
        skipped++;
        details.push(`Skipped, already saved (same Place ID): ${lead.title}`);
        continue;
      }
      if (normalizedPhone && existingPhones.has(normalizedPhone)) {
        skipped++;
        details.push(`Skipped, already saved (same phone): ${lead.title}`);
        continue;
      }

      // Claim these now so a later row in the same file cannot repeat them.
      if (placeId) existingPlaceIds.add(placeId);
      if (normalizedPhone) existingPhones.add(normalizedPhone);

      leadsToInsert.push(lead);
    }

    if (leadsToInsert.length === 0) continue;

    const { error: insertError } = await supabase.from('leads').insert(normalizeBatchKeys(leadsToInsert));
    if (insertError) {
      // One bad row fails the whole batch, so retry them singly to find it.
      for (const lead of leadsToInsert) {
        const { error: singleError } = await supabase.from('leads').insert([lead]);
        if (singleError) {
          skipped++;
          details.push(`Skipped ${lead.title}: ${singleError.message}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += leadsToInsert.length;
    }
  }

  return { inserted, skipped, details };
}

export async function importContactRows({
  records,
  headers,
  fieldMap,
  source,
  category,
}: CsvImportOptions): Promise<CsvImportOutcome> {
  const details: string[] = [];
  let inserted = 0;
  let skipped = 0;

  const usernameRead = await readStoredValues('linkedin_leads', 'linkedin_username');
  if (usernameRead.error) details.push(`Could not read existing contacts: ${usernameRead.error}`);
  const existingKeys = new Set<string>();
  usernameRead.values.forEach((value) => {
    if (typeof value === 'string' && value) existingKeys.add(`username:${value}`);
  });

  // An Apollo people export and a plain LinkedIn owner search are labelled
  // differently, and the LinkedIn Leads filter works off that label.
  const contactSource: string = source === 'csv_import'
    ? (looksLikeApolloExport(headers) ? 'apollo_enrichment' : 'linkedin_owner_search')
    : source;

  const contacts: Record<string, unknown>[] = [];
  const businesses = new Map<string, Record<string, unknown>>();

  for (let i = 0; i < records.length; i++) {
    const lineNumber = i + 2;
    const values = records[i];
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });

    const built = buildCsvLead(row, fieldMap, { source, category, contactSource });
    if (built.note) details.push(`Line ${lineNumber}: ${built.note}`);
    if (!built.contact) {
      skipped++;
      details.push(`Skipped line ${lineNumber}: ${built.error}`);
      continue;
    }

    const contact = built.contact;
    const username = typeof contact.linkedin_username === 'string' ? contact.linkedin_username : '';
    const contactKey = username
      ? `username:${username}`
      : `name:${String(contact.lead_name).toLowerCase().trim()}|${String(contact.email ?? '').toLowerCase()}`;

    if (existingKeys.has(contactKey)) {
      skipped++;
      details.push(`Skipped, already saved (same ${username ? 'LinkedIn profile' : 'name and email'}): ${contact.lead_name}`);
      continue;
    }
    existingKeys.add(contactKey);
    contacts.push(contact);

    // The business the person works at, so the contact has something to be opened
    // and called from rather than sitting on its own.
    if (built.lead) {
      const placeId = typeof built.lead.place_id === 'string' ? built.lead.place_id : '';
      const businessKey = placeId ? `place:${placeId}` : `name:${String(built.lead.title).toLowerCase().trim()}`;
      if (!businesses.has(businessKey)) businesses.set(businessKey, built.lead);
    }
  }

  const businessRows = Array.from(businesses.values());
  for (let i = 0; i < businessRows.length; i += 50) {
    const { data, error } = await supabase
      .from('leads')
      .upsert(normalizeBatchKeys(businessRows.slice(i, i + 50)), { onConflict: 'place_id', ignoreDuplicates: true })
      .select('id');

    if (error) {
      details.push(`Could not save the business these contacts belong to: ${error.message}`);
    } else if (data && data.length > 0) {
      details.push(`Saved ${data.length} business${data.length === 1 ? '' : 'es'} for these contacts`);
    }
  }

  for (let i = 0; i < contacts.length; i += 200) {
    const chunk = normalizeBatchKeys(contacts.slice(i, i + 200));
    const { data, error } = await supabase
      .from('linkedin_leads')
      .upsert(chunk, { onConflict: 'linkedin_username', ignoreDuplicates: true })
      .select('id');

    if (!error) {
      inserted += (data ?? []).length;
      continue;
    }

    // One bad row fails the batch, so retry them singly to find it.
    for (const contact of chunk) {
      const { error: singleError } = await supabase
        .from('linkedin_leads')
        .upsert(contact, { onConflict: 'linkedin_username', ignoreDuplicates: true });
      if (singleError) {
        skipped++;
        details.push(`Skipped ${contact.lead_name}: ${singleError.message}`);
      } else {
        inserted++;
      }
    }
  }

  return { inserted, skipped, details };
}
