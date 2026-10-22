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

export interface ColumnMapping {
  csvColumn: string | null;
  leadField: string | null;
}

export { LEAD_FIELDS };
