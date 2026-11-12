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

export const guessMapping = (col: string): string | null => {
  const lower = col.toLowerCase().trim();
  if (lower.includes('name') && (lower.includes('business') || lower.includes('company') || lower.includes('title'))) return 'title';
  if (lower.includes('website') || lower.includes('url') || lower.includes('site')) return 'website';
  if (lower.includes('phone') || lower.includes('mobile')) return 'phone';
  if (lower.includes('city')) return 'city';
  if (lower.includes('country')) return 'country_code';
  if (lower.includes('owner') && lower.includes('name')) return 'owner_name';
  if (lower.includes('owner') && lower.includes('role')) return 'owner_role';
  if (lower.includes('linkedin')) return 'owner_linkedin_url';
  if (lower.includes('size') || lower.includes('employees')) return 'company_size_estimate';
  if (lower.includes('note') || lower.includes('comment')) return 'notes';
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
