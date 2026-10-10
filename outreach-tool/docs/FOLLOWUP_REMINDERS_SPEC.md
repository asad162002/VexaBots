# Follow-Up Reminders Spec

## Goal
When a cold caller (Asad or Ramzan) logs an activity with a follow-up date on the lead detail page, they should receive a notification reminding them to follow up.

## Current State
- Activity log form on lead detail page has `next_follow_up_at` field
- When activity is saved with a follow-up date, it updates `lead.next_follow_up_at`
- Leads with upcoming follow-ups appear on the dashboard (yellow reminder banner)

## Reminder System Architecture

### Reminder Storage
Reminders will be stored in a new `reminders` table:

```sql
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES auth.users, -- who should follow up
  follow_up_at TIMESTAMP WITH TIME ZONE,
  reminder_type TEXT, -- 'email', 'dashboard', 'both'
  status TEXT DEFAULT 'pending', -- pending/sent/done/snoozed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Reminder Logic
When `handleLogActivity` saves an activity with `nextFollowUp`:
1. Create/update a reminder record
2. Set `profile_id` to the assigned lead owner (or current user if unassigned)
3. Set `follow_up_at` to the follow-up date/time
4. Set `reminder_type` based on user preference (default: 'dashboard')

### Dashboard Reminder Display
- Yellow banner at top of dashboard showing upcoming reminders
- Only shows reminders for the current user (assigned leads or logged activities)
- Shows within 24h and 1h windows:
  - "24h reminder" - follow-up due in 24h
  - "1h reminder" - follow-up due in 1h

### Reminder Checks
- Server-side check on page load via `fetchFollowUpReminders`
- Query: leads where `next_follow_up_at` is between now and now+24h, ordered by soonest first
- Filter to leads assigned to current user OR leads with activities logged by current user

## Cold Caller Workflow
1. Cold caller opens a lead detail page
2. Logs a call activity with follow-up date (e.g., "Follow up tomorrow at 2pm")
3. The activity is logged, notes updated, follow-up date set
4. Reminder banner appears on their dashboard
5. When they log in later, banner shows: "Follow up with [lead title] in 3h"
6. Clicking the lead link takes them directly to the lead

## Future Enhancements
- Email/SMS notifications (when email campaigns are enabled later)
- Snooze reminder feature
- Recurring reminders (default: reminder every 2 hours if due)
