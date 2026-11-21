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

// Splits a whole CSV file into records, honouring quoted fields. A
// google-maps-scraper export writes competitor names, review text and opening hours
// with real newlines inside quotes, so splitting the file on newlines first turns
// one record into several broken ones. This is the reader the import and the
// preview both use.
export const parseCSVRecords = (text: string): string[][] => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  const endRecord = () => {
    record.push(field.trim());
    field = '';
    // Blank lines and trailing newlines are not records.
    if (record.some((value) => value !== '')) records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      record.push(field.trim());
      field = '';
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRecord();
      continue;
    }

    field += char;
  }

  endRecord();
  return records;
};

export const normalizePhoneForDedup = (phone: unknown): string => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.substring(1);
  return digits;
};

// Two rows are the same person when they point at the same LinkedIn profile, so
// the profile slug is the identity. The slug is taken out of any LinkedIn profile
// URL shape and lowercased, which is what the unique index on linkedin_username
// expects.
export const extractLinkedInUsername = (url: unknown): string | null => {
  if (!url) return null;
  const match = String(url).match(/linkedin\.com\/(?:in|pub)\/([^/?#]+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).trim().toLowerCase() || null;
  } catch {
    return match[1].trim().toLowerCase() || null;
  }
};

const normalizeHeader = (col: string): string => col.toLowerCase().trim().replace(/[\s-]+/g, '_');

// Targets that describe a person and belong to linkedin_leads rather than leads.
export const CONTACT_FIELDS = [
  'lead_name',
  'person_title',
  'person_email',
  'person_email_status',
  'person_linkedin_url',
];

export const hasContactFields = (fieldMap: Record<string, string>): boolean =>
  Object.values(fieldMap).some((field) => CONTACT_FIELDS.includes(field));

// A contact export carries people, not businesses, which changes what the "title"
// column means: in this shape it is the person's job title, not the company name.
export const looksLikeContactExport = (headers: string[]): boolean => {
  const keys = headers.map(normalizeHeader);
  if (keys.includes('lead_name') || keys.includes('headline') || keys.includes('seniority')) return true;
  return keys.includes('linkedin_url') && keys.some((k) => k === 'email' || k === 'email_status');
};

// Apollo's people export carries these; they are what makes the difference between
// a LinkedIn owner search and an Apollo enrichment when labelling the source.
export const looksLikeApolloExport = (headers: string[]): boolean => {
  const keys = headers.map(normalizeHeader);
  return ['seniority', 'functions', 'departments', 'headline', 'credit_cost', 'enrichment_error'].some((k) => keys.includes(k));
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
  lead_name: 'lead_name',
  contact_name: 'lead_name',
  company_size: 'company_size_estimate',
  company_size_estimate: 'company_size_estimate',
  notes: 'notes',
  note: 'notes',
  comments: 'notes',
};

export const guessMapping = (col: string): string | null => {
  const key = col.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (EXACT_MAPPINGS[key]) return EXACT_MAPPINGS[key];

  // Scraper columns that hold JSON blobs, aggregates or a second URL rather than
  // the single value the lead field expects. Left unmapped so the mapper does not
  // offer the same field three times, and so a social or photo URL cannot overwrite
  // the real website.
  if (/(keyword|featured|per_rating|images?|photos?|avatar|posts?|times|hours|menu|updates|competitors|on_site|about|reviews_link|twitter|facebook|github|instagram|youtube|tiktok|pinterest|threads)/.test(key)) {
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

// Columns that describe the person rather than the business, used when the file is
// a contact export. The company column of the same name stays where it is.
const CONTACT_COLUMN_TARGETS: Record<string, string> = {
  title: 'person_title',
  email: 'person_email',
  email_status: 'person_email_status',
  linkedin_url: 'person_linkedin_url',
};

// In a contact export, city, state and country are where the person lives, not
// where the business is, so they are left unmapped rather than written onto the
// company as if they were its address.
const CONTACT_COLUMN_SKIPS = ['city', 'town', 'postal_code', 'zip', 'zip_code', 'country', 'country_code'];

export const buildInitialMappings = (headers: string[]): ColumnMapping[] => {
  const contactExport = looksLikeContactExport(headers);

  return headers.map((col) => {
    const key = normalizeHeader(col);

    if (contactExport) {
      if (CONTACT_COLUMN_TARGETS[key]) return { csvColumn: col, leadField: CONTACT_COLUMN_TARGETS[key] };
      if (CONTACT_COLUMN_SKIPS.includes(key)) return { csvColumn: col, leadField: null };
    }

    return { csvColumn: col, leadField: guessMapping(col) };
  });
};

export const parseCSVPreview = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
  const records = parseCSVRecords(text);
  if (records.length < 2) return { headers: [], rows: [] };

  const headers = records[0];
  const rows: Record<string, string>[] = [];

  for (const values of records.slice(1, 6)) {
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
  // The profile slug is what a person is deduplicated on, and the company's
  // number is copied down so the contact can be called from My Queue.
  linkedin_username: extractLinkedInUsername(owner!.linkedin_url),
  phone: typeof lead.phone === 'string' ? lead.phone : null,
  source: 'linkedin_owner_search',
});

// PostgREST sends one INSERT for an array, so every object in a batch has to carry
// the same keys or the request is refused. Missing values are filled with null
// rather than left out. Rows are only ever added with ignoreDuplicates, so filling
// a gap can never overwrite something already stored.
export const normalizeBatchKeys = (rows: Record<string, unknown>[]): Record<string, unknown>[] => {
  if (rows.length === 0) return rows;

  const keys = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));

  return rows.map((row) => {
    const filled: Record<string, unknown> = {};
    keys.forEach((key) => {
      filled[key] = row[key] === undefined ? null : row[key];
    });
    return filled;
  });
};

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
  /** Source written on linkedin_leads rows. */
  contactSource?: string;
}

export interface CsvLeadResult {
  /** Row for the leads table, when the row describes a business. */
  lead?: Record<string, unknown>;
  /** Row for linkedin_leads, when the row describes a person. */
  contact?: Record<string, unknown>;
  /** Why this row could not become a lead. */
  error?: string;
  /** Something worth telling the user about a value that was dropped. */
  note?: string;
}

// Turns one CSV row into the rows it describes. It lives here rather than in the
// page so it can be read and exercised on its own. A contact export produces one
// row for the business and one for the person, which is why the two are separate:
// they go to different tables and are deduplicated on different keys.
export const buildCsvLead = (
  row: Record<string, string>,
  fieldMap: Record<string, string>,
  options: CsvLeadOptions,
): CsvLeadResult => {
  const contactMode = hasContactFields(fieldMap);

  const lead: Record<string, unknown> = {
    source: options.source,
    status: 'new',
    category_name: options.category || null,
  };
  const person: Record<string, unknown> = {};
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

    // Person columns belong to linkedin_leads.
    if (CONTACT_FIELDS.includes(leadField)) {
      switch (leadField) {
        case 'lead_name':
          person.lead_name = raw.trim();
          break;
        case 'person_title':
          person.title = raw.trim();
          break;
        case 'person_email':
          person.email = raw.trim();
          break;
        case 'person_email_status':
          person.email_status = raw.trim();
          break;
        case 'person_linkedin_url':
          person.linkedin_url = raw.trim();
          break;
      }
      continue;
    }

    const coerced = coerceCsvValue(leadField, raw);
    if (coerced.ok) lead[leadField] = coerced.value;
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

  if (contactMode) {
    if (!person.lead_name) {
      return { error: 'the column mapped to Contact Name is empty' };
    }

    const contact: Record<string, unknown> = {
      lead_name: person.lead_name,
      title: person.title ?? null,
      email: person.email ?? null,
      email_status: person.email_status ?? (person.email ? 'verified' : 'not_found'),
      linkedin_url: person.linkedin_url ?? null,
      linkedin_username: extractLinkedInUsername(person.linkedin_url),
      // The company the person works at, and its number, so the contact can be
      // called from My Queue without looking the business up again.
      place_id: typeof lead.place_id === 'string' ? lead.place_id : null,
      phone: typeof lead.phone === 'string' ? lead.phone : null,
      source: options.contactSource ?? 'linkedin_owner_search',
    };

    // The business row is only worth writing when the file named it.
    const hasCompany = typeof lead.title === 'string' && lead.title.length > 0;
    return { lead: hasCompany ? lead : undefined, contact, note };
  }

  // Business Name is the one required field. Without it there is nothing to show
  // in any list, so the row is refused with a reason instead of being dropped.
  if (!lead.title) {
    return { error: 'the column mapped to Business Name is empty' };
  }

  return { lead, note };
};
