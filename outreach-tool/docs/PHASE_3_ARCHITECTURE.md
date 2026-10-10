# Phase 3 Architecture: Outreach Tracking & Admin Features

## Overview
Built on top of Phase 1 (basic CRUD) and Phase 2 (lead enrichment), Phase 3 adds full outreach tracking capabilities for Asad and Ramzan to log activities, track progress, enforce assignment limits, and audit status changes.

## Database Schema Changes

### 1. `lead_activities` Table
Stores all outreach activities (calls, texts, emails, meetings, notes) for each lead.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `lead_id` | UUID (FK to leads) | Which lead this activity relates to |
| `profile_id` | UUID (FK to auth.users) | Who logged the activity |
| `activity_type` | TEXT | call/text/email/note/meeting/other |
| `content` | TEXT | Details of what happened |
| `outcome` | TEXT (nullable) | Result of the activity (e.g., "left voicemail") |
| `next_follow_up_at` | TIMESTAMP (nullable) | When to follow up next |
| `created_at` | TIMESTAMP | When activity was logged |

**RLS Policies:**
- All authenticated users can view and insert

**Indexes:**
- `lead_id` for quick filtering by lead
- `lead_id, created_at DESC` for ordered activity history

### 2. `assignment_limits` Table
Sets per-member lead assignment caps.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `profile_id` | UUID (FK, unique) | Team member |
| `max_leads` | INTEGER | Maximum assigned leads allowed |
| `current_leads` | INTEGER | Current count (auto-updated on assignment) |
| `updated_at` | TIMESTAMP | When limit was last changed |

**RLS Policies:**
- All authenticated users can view and upsert (set by admin)

### 3. `lead_status_history` Table
Audit trail for all status changes on leads.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `lead_id` | UUID (FK to leads) | Which lead status changed |
| `profile_id` | UUID (nullable) | Who changed the status |
| `old_status` | TEXT (nullable) | Previous status value |
| `new_status` | TEXT | New status value |
| `changed_at` | TIMESTAMP | When the change occurred |
| `reason` | TEXT (nullable) | Optional reason for change |

**RLS Policies:**
- All authenticated users can view and insert

**Indexes:**
- `lead_id` for filtering by lead
- `lead_id, changed_at DESC` for ordered history

## Feature Implementations

### 1. Activity Log (Lead Detail Page)
**File:** `src/app/dashboard/leads/[id]/page.tsx`

- Added activity log section below lead details
- Form to log new activities: type dropdown, content textarea, outcome field, follow-up date
- Existing activities displayed chronologically
- When an activity with `next_follow_up_at` is logged:
  - Lead's `notes` field is appended with the activity content
  - Lead's `next_follow_up_at` is updated
  - `last_contacted_at` is set

### 2. Activity Feed (Dashboard)
**File:** `src/app/dashboard/activity-feed/page.tsx`

- Central timeline showing recent activities across all leads
- Color-coded activity type badges (call=gray, text=blue, email=purple, note=yellow)
- Each activity shows: lead title (linked), activity content, outcome, who logged, timestamp
- "X minutes/hours/days ago" relative time formatting

### 3. Assignment Limits (Dashboard + Settings)
**Files:** 
- `src/components/bulk-actions.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/settings/page.tsx`

**Dashboard:**
- Fetches assignment limits from `assignment_limits` table
- Passes limits to `BulkActions` component
- Enforces limits in `handleBulkAssign`:
  - If member has limit and would exceed it, shows alert/confirmation
  - Blocks assignment if limit already reached
  - Prompts to proceed with available slots
- Auto-increments `current_leads` after successful assignment

**Settings Page:**
- Admin-only "Assignment Limits" section
- Shows each team member with current count / max limit
- Progress bar visualization
- Number input to set max leads (0 = unlimited)
- Real-time update on change

### 4. Status Audit Trail (Lead Detail Page)
**File:** `src/app/dashboard/leads/[id]/page.tsx`

- When lead status changes (in `handleSave`):
  - Log old status, new status, who changed, timestamp to `lead_status_history`
  - `last_contacted_at` updated for non-new statuses

## API Endpoints
No new endpoints were needed. All features use existing Supabase client connections in the frontend.

## Navigation
- Added "Activity Feed" item to dashboard sidebar nav (layout.tsx)
