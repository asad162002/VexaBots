import { type Lead, type LeadStatus, type LeadSource } from '@/lib/types';

const STATUS_OPTIONS: { value: LeadStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'send_info', label: 'Send Info' },
  { value: 'meeting_booked', label: 'Meeting' },
  { value: 'dead', label: 'Dead' },
];

const SOURCE_OPTIONS: { value: LeadSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'google_maps', label: 'Google Maps' },
  { value: 'manual', label: 'Manual' },
  { value: 'csv_import', label: 'CSV Import' },
  { value: 'apify_n8n', label: 'Apify/n8n' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other' },
];

interface LeadFiltersProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: LeadStatus | 'all';
  setStatusFilter: (s: LeadStatus | 'all') => void;
  sourceFilter: LeadSource | 'all';
  setSourceFilter: (s: LeadSource | 'all') => void;
  categoryFilter: string;
  setCategoryFilter: (s: string) => void;
  assignedFilter: 'all' | 'assigned' | 'unassigned';
  setAssignedFilter: (s: 'all' | 'assigned' | 'unassigned') => void;
  sortBy: 'newest' | 'icp_high' | 'follow_up';
  setSortBy: (s: 'newest' | 'icp_high' | 'follow_up') => void;
  availableCategories: string[];
}

export default function LeadFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  sourceFilter,
  setSourceFilter,
  categoryFilter,
  setCategoryFilter,
  assignedFilter,
  setAssignedFilter,
  sortBy,
  setSortBy,
  availableCategories,
}: LeadFiltersProps) {
  const inputClassName =
    "w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";

  const selectClassName =
    "w-full sm:w-[130px] bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Search */}
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
          Search
        </label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, company, phone..."
          className={inputClassName}
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
          Status
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}
          className={selectClassName}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-secondary">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Source */}
      <div>
        <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
          Source
        </label>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as LeadSource | 'all')}
          className={selectClassName}
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-secondary">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
          Category
        </label>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full sm:w-[150px] bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
        >
          <option value="all" className="bg-secondary">All Categories</option>
          {availableCategories.map((cat) => (
            <option key={cat} value={cat} className="bg-secondary">
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Assignment Status */}
      <div>
        <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
          Assignment
        </label>
        <select
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value as 'all' | 'assigned' | 'unassigned')}
          className="w-full sm:w-[140px] bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
        >
          <option value="all" className="bg-secondary">All</option>
          <option value="assigned" className="bg-secondary">Assigned</option>
          <option value="unassigned" className="bg-secondary">Unassigned</option>
        </select>
      </div>

      {/* Sort */}
      <div>
        <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
          Sort
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className={selectClassName}
        >
          <option value="newest" className="bg-secondary">Newest First</option>
          <option value="icp_high" className="bg-secondary">ICP Score (High)</option>
          <option value="follow_up" className="bg-secondary">Follow-up Due</option>
        </select>
      </div>
    </div>
  );
}
