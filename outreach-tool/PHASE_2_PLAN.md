# Phase 2: Lead Assignment & Bulk Actions

## Requirements
- Assign leads to team members
- Bulk select leads (10k scale)
- UI that's easy for multi-select
- Fast filtering/sorting

## Architecture Plan

### 1. Data Model Changes (Supabase)
```sql
-- Add assignee to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Add status change log (for audit trail)
CREATE TABLE IF NOT EXISTS public.assignment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Add notes field (already exists, but let's make sure)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes TEXT;
```

### 2. Team Members Table
```sql
-- Store team member info alongside auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'caller', 'manager')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. UI Components to Build

#### A. Assignee Badge on Lead Card
- Show avatar/initials of assigned member
- Show "Unassigned" pill if not assigned
- Click to open assignment dropdown

#### B. Bulk Action Toolbar
Appears when 1+ leads selected:
- Checkbox: Select all
- Counter: "X leads selected"
- Action buttons: Assign To, Change Status, Add Tag, Export
- Clear selection button

#### C. Smart Selection
- Select by current page (50 items)
- Select all matching filters (all 10k with search/filters applied)
- Inverse selection (deselect selected, select rest on page)

### 4. Implementation Plan (Step by Step)

**Step 1: Backend**
- Add columns to leads table (assigned_to, assigned_at)
- Create profiles table with team members
- Add RLS policies for assignment
- Create assignment_log table

**Step 2: Lead Detail Page**
- Add "Assign To" dropdown with team members
- Show assigned member badge
- Show assignment history timeline

**Step 3: Dashboard List (Main Leads Page)**
- Add select checkboxes per row
- Bulk action toolbar (select all, assign, change status)
- Column for assignee (sortable)
- Filter by assignee
- "Select all matching filters" feature

**Step 4: Performance Optimizations**
- Paginated API calls (only load 50 at a time)
- Virtual scrolling for the list (react-window)
- Server-side filtering (don't load 10k rows in browser)
- Optimistic UI updates for assignments

**Step 5: Assignment Modal**
- Modal with team members list
- Keyboard search/filter
- Recent assignees first
- Bulk assign to selected members

### 5. Tech Decisions

**Pagination:**
- Server-side pagination with limit/offset
- 50 items per page
- Show total count (10k) but only load current page

**Bulk Select Strategy:**
- Local selection = checkboxes on current page
- Global selection = API call to assign all matching IDs
- Store selected IDs in browser (sessionStorage) for persistence

**Search Performance:**
- Use Supabase full-text search on title/city/address
- Debounce search input (300ms)
- Server-side filtering

**Virtual Scrolling:**
- Use `react-window` or similar
- Only render visible rows
- Smooth scrolling for 10k items

### 6. User Flow
1. User lands on dashboard with 50 leads loaded
2. User filters by city/status/search
3. User sees "Showing 1-50 of 3,420"
4. User selects checkbox = selects 50 on page
5. User clicks "Select all 3,420 matching"
6. Bulk action toolbar appears: "3,420 leads selected"
7. User clicks "Assign To" -> picks team member
8. API assigns all matching leads in batch
9. UI updates instantly (optimistic)
10. User can see assigned members on cards

### 7. Files to Create/Modify

NEW:
- `src/components/bulk-actions.tsx` - Bulk action toolbar
- `src/components/assignee-badge.tsx` - Assignee display component
- `src/components/lead-row.tsx` - Individual lead row with checkbox
- `src/app/dashboard/assign/page.tsx` - Assignment management page
- `src/hooks/use-bulk-selection.ts` - Bulk selection hook

MODIFY:
- `src/app/dashboard/page.tsx` - Add checkboxes, bulk toolbar
- `src/app/dashboard/leads/[id]/page.tsx` - Add assignee dropdown
- `src/lib/supabase.ts` - Add typed queries
- `supabase_schema.v1.sql` - Add assignment columns

### 8. MVP vs Future Features

**MVP (Do First):**
- Add assigned_to column
- Assignee dropdown on lead detail
- Bulk assign from dashboard (current page only)
- Basic filtering by assignee

**Future:**
- "Select all matching" for >100 leads
- Assignment history/timeline
- Role-based permissions
- Export assigned leads
- Assignment notifications
