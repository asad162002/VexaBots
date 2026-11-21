const LEAD_FIELDS = [
  { key: 'title', label: 'Business Name', required: true },
  { key: 'place_id', label: 'Place ID', required: false },
  { key: 'website', label: 'Website', required: false },
  { key: 'domain', label: 'Domain', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'detailed_address', label: 'Detailed Address (JSON)', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'postal_code', label: 'Postal Code', required: false },
  { key: 'country_code', label: 'Country Code', required: false },
  { key: 'category_name', label: 'Category', required: false },
  { key: 'categories', label: 'All Categories', required: false },
  { key: 'total_score', label: 'Rating', required: false },
  { key: 'reviews_count', label: 'Review Count', required: false },
  { key: 'ad_running', label: 'Spending On Ads', required: false },
  { key: 'search_string', label: 'Search Query', required: false },
  { key: 'url', label: 'Google Maps URL', required: false },
  { key: 'owner_name', label: 'Owner Name', required: false },
  { key: 'owner_role', label: 'Owner Role', required: false },
  { key: 'owner_linkedin_url', label: 'LinkedIn URL', required: false },
  { key: 'company_size_estimate', label: 'Company Size', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

export interface ColumnMapping {
  csvColumn: string | null;
  leadField: string | null;
}

export { LEAD_FIELDS };
