export interface ColumnMapping {
  csvColumn: string;
  leadField: string | null;
}

export const parseCSVLine = (line: string): string[] => {
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

export const normalizePhoneForDedup = (phone: unknown): string => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.substring(1);
  return digits;
};

// Column names seen in google-maps-scraper exports, matched exactly. Getting
// these right matters: the scraper calls the business name plain "name", and the
// old rule only accepted a column that also said business, company or title, so
// a straight scraper export auto-mapped nothing but website and phone.
const EXACT_MAPPINGS: Record<string, string> = {
  name: 'title',
  business_name: 'title',
  business: 'title',
  company_name: 'title',
  company: 'title',
  title: 'title',
  place_id: 'place_id',
  website: 'website',
  domain: 'domain',
  phone: 'phone',
  phone_number: 'phone',
  phone_international: 'phone',
  mobile: 'phone',
  address: 'address',
  formatted_address: 'address',
  detailed_address: 'detailed_address',
  city: 'city',
  town: 'city',
  postal_code: 'postal_code',
  zip: 'postal_code',
  zip_code: 'postal_code',
  country_code: 'country_code',
  country: 'country_code',
  main_category: 'category_name',
  category: 'category_name',
  category_name: 'category_name',
  categories: 'categories',
  rating: 'total_score',
  total_score: 'total_score',
  reviews: 'reviews_count',
  reviews_count: 'reviews_count',
  review_count: 'reviews_count',
  is_spending_on_ads: 'ad_running',
  ad_running: 'ad_running',
  query: 'search_string',
  search_string: 'search_string',
  link: 'url',
  url: 'url',
  google_maps_url: 'url',
  owner_name: 'owner_name',
  owner_role: 'owner_role',
  owner_title: 'owner_role',
  linkedin_url: 'owner_linkedin_url',
  company_size: 'company_size_estimate',
  company_size_estimate: 'company_size_estimate',
  notes: 'notes',
  note: 'notes',
  comments: 'notes',
};

export const guessMapping = (col: string): string | null => {
  const key = col.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (EXACT_MAPPINGS[key]) return EXACT_MAPPINGS[key];

  // Scraper columns that hold JSON blobs or aggregates rather than the single
  // value the lead field expects. Left unmapped so the mapper does not offer the
  // same field three times, and so nothing writes a blob into a number column.
  if (/(keyword|featured|per_rating|images?|photos?|posts?|times|hours|menu|updates|competitors|on_site|about|reviews_link)/.test(key)) {
    return null;
  }

  // Fuzzy fallbacks, most specific first. linkedin is checked before the generic
  // url rule, which used to swallow a linkedin_url column as the website.
  if (key.includes('linkedin')) return 'owner_linkedin_url';
  if (key.includes('phone') || key.includes('mobile')) return 'phone';
  if (key.includes('owner') && key.includes('name')) return 'owner_name';
  if (key.includes('owner') && key.includes('role')) return 'owner_role';
  if (key.includes('name') && (key.includes('business') || key.includes('company') || key.includes('title'))) return 'title';
  if (key.includes('postal') || key.includes('zip')) return 'postal_code';
  if (key.includes('country')) return 'country_code';
  if (key.includes('city') || key.includes('town')) return 'city';
  if (key.includes('address')) return 'address';
  if (key.includes('size') || key.includes('employees')) return 'company_size_estimate';
  if (key.includes('note') || key.includes('comment')) return 'notes';
  if (key.includes('rating') || key.includes('score')) return 'total_score';
  if (key.includes('review') && !key.includes('link')) return 'reviews_count';
  if (key.includes('website') || key.includes('url')) return 'website';
  return null;
};

export const buildInitialMappings = (headers: string[]): ColumnMapping[] =>
  headers.map((col) => ({ csvColumn: col, leadField: guessMapping(col) }));

export const parseCSVPreview = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1, 6)) {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
};

export const buildGoogleMapsLead = (item: Record<string, unknown>, category: string): Record<string, unknown> => {
  const detailed_address = item.detailed_address as Record<string, string> | undefined;
  const owner = item.owner as Record<string, string> | undefined;
  const lead: Record<string, unknown> = {
    title: item.name || '',
    category_name: item.main_category || category || '',
    categories: Array.isArray(item.categories) ? item.categories.join(', ') : null,
    phone: item.phone || '',
    address: item.address || '',
    city: detailed_address?.city || '',
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
  for (const key of Object.keys(lead)) {
    if (lead[key] === '') lead[key] = null;
  }
  return lead;
};

export const buildEnrichedRecord = (lead: Record<string, unknown>, owner: Record<string, string> | undefined) => ({
  place_id: lead.place_id,
  lead_name: owner!.name,
  title: owner!.title || owner!.role || null,
  email: owner!.email || null,
  email_status: owner!.email ? 'verified' : 'not_found',
  linkedin_url: owner!.linkedin_url || null,
  source: 'linkedin_owner_search',
});

export const parseJsonPreview = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
  const jsonData = JSON.parse(text);
  const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
  const rows = dataArray.slice(0, 3).map((item: Record<string, unknown>) => {
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(item)) {
      row[key] = typeof value === 'object' && value !== null
        ? JSON.stringify(value).substring(0, 50)
        : String(value ?? '');
    }
    return row;
  });
  return { headers: Object.keys(rows[0] || {}), rows };
};

// CSV values arrive as text, and a scraper export writes "-" for anything it did
// not find. Sending that straight into a boolean or numeric column fails the
// insert, so mapped values are converted here first and dropped when they do not
// convert.
export type CsvFieldType = 'text' | 'number' | 'integer' | 'boolean' | 'company_size';

export const CSV_FIELD_TYPES: Record<string, CsvFieldType> = {
  total_score: 'number',
  reviews_count: 'integer',
  ad_running: 'boolean',
  is_advertisement: 'boolean',
  company_size_estimate: 'company_size',
};

export interface CoercedValue {
  ok: boolean;
  value?: unknown;
}

export const coerceCsvValue = (field: string, raw: string): CoercedValue => {
  const value = raw.trim();

  switch (CSV_FIELD_TYPES[field]) {
    case 'number': {
      const n = Number(value.replace(/,/g, ''));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
    }
    case 'integer': {
      const n = parseInt(value.replace(/,/g, ''), 10);
      return Number.isNaN(n) ? { ok: false } : { ok: true, value: n };
    }
    case 'boolean': {
      const v = value.toLowerCase();
      if (['true', 'yes', 'y', '1'].includes(v)) return { ok: true, value: true };
      if (['false', 'no', 'n', '0', '-', ''].includes(v)) return { ok: true, value: false };
      return { ok: false };
    }
    case 'company_size': {
      const v = value.toLowerCase();
      return ['solo', 'small', 'medium', 'large'].includes(v)
        ? { ok: true, value: v }
        : { ok: false };
    }
    default:
      return { ok: true, value };
  }
};

export interface CsvLeadOptions {
  source: string;
  category: string;
}

export interface CsvLeadResult {
  lead?: Record<string, unknown>;
  /** Why this row could not become a lead. */
  error?: string;
  /** Something worth telling the user about a value that was dropped. */
  note?: string;
}

// Turns one CSV row into a leads row. It lives here rather than in the page so it
// can be read and exercised on its own, and because the page only needs to know
// whether the row became a lead.
export const buildCsvLead = (
  row: Record<string, string>,
  fieldMap: Record<string, string>,
  options: CsvLeadOptions,
): CsvLeadResult => {
  const lead: Record<string, unknown> = {
    source: options.source,
    status: 'new',
    category_name: options.category || null,
  };
  let note: string | undefined;

  for (const [csvCol, leadField] of Object.entries(fieldMap)) {
    const raw = row[csvCol];
    if (!raw || !raw.trim()) continue;

    // The scraper's detailed_address column is JSON holding the city, postal code
    // and country that the flat columns do not carry.
    if (leadField === 'detailed_address') {
      try {
        const parsed = JSON.parse(raw) as Record<string, string>;
        if (parsed.city) lead.city = parsed.city;
        if (parsed.postal_code) lead.postal_code = parsed.postal_code;
        if (parsed.country_code) lead.country_code = parsed.country_code;
      } catch {
        note = 'detailed address is not valid JSON, city and zip left empty';
      }
      continue;
    }

    const coerced = coerceCsvValue(leadField, raw);
    if (coerced.ok) lead[leadField] = coerced.value;
  }

  // Business Name is the one required field. Without it there is nothing to show
  // in any list, so the row is refused with a reason instead of being dropped.
  if (!lead.title) {
    return { error: 'the column mapped to Business Name is empty' };
  }

  // The scraper has no domain column, so take it from the website.
  if (lead.website && !lead.domain) {
    try {
      lead.domain = new URL(lead.website as string).hostname;
    } catch {
      // A malformed website is not worth failing the row over.
    }
  }

  // The scraper's ad flag feeds both columns, as the JSON import does.
  if (typeof lead.ad_running === 'boolean') {
    lead.is_advertisement = lead.ad_running;
  }

  return { lead, note };
};
