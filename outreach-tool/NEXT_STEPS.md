# Next Steps & Lessons Learned

## What's Done
1. Two separate dashboard views (Google Maps leads + LinkedIn Leads)
2. LinkedIn Lead detail page with notes
3. Infinite scroll on LinkedIn leads list
4. Cold caller data on lead detail (Google Maps link, address, rating, competitors, copyable phone)
5. Admin import page (CSV + JSON scraper format)
6. Upload script for n8n automation

## What's Next (Priority Order)

### 1. Fix Upload Script Integration
- The Python script uses direct REST API calls (not supabase-py) since supabase-py wasn't installed
- Need to save it to Windows Desktop for your workflow
- Update the service_role key placeholder

### 2. Test the Web Import Page
- Upload a JSON file via the /dashboard/import page
- Verify it splits data correctly into 3 tables

### RLS Policies
- The leads table shows data correctly via anon key
- But LinkedIn leads were initially failing - fixed by adding RLS policies
- **Assignment update failing**: The `leads_update_own` policy only allowed `auth.uid() = owner_id`, but leads with NULL owner_id were blocked. Fixed by adding `(owner_id IS NULL)` condition to update policy.

## Key Supabase Lessons (Don't Forget!)

### PAT Token Issues
- The Pat token `sbp_fc3a...` works for Management API but NOT for REST API
- The JWT service_role key works for REST API (read/write/upsert/delete)
- The anon key (sb_publishable_...) can read + insert but NOT delete/update existing owned rows

### JWT Key Gotchas
- The JWT says `iat: 1789394521` (2026) and `exp: 2104970521` (2036) - but JWT verification was failing on Management API
- Management API requires: Bearer token format, but still got "JWT failed verification"
- REST API accepts the JWT fine for reads, writes, deletes, patches
- BUT deletes via anon key return 204 (success) WITHOUT actually deleting - it's silently skipped due to RLS
- Solution: Use service_role JWT for deletes, not anon key

### Execute SQL via MCP
- MCP server's `execute_sql` works with the PAT token
- For triggers: PostgreSQL 14 doesn't support `IF NOT EXISTS` on triggers - use `DROP TRIGGER IF EXISTS` first
- Column creation works via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

### Table Creation Workflow
1. Use MCP server with `execute_sql` (not `apply_migration` - needs project permissions)
2. Use `DROP TRIGGER IF EXISTS` instead of `CREATE TRIGGER IF NOT EXISTS`
3. Run the SQL to create tables: linkedin_leads, tech_stack
4. Add RLS policies after table creation
5. Use `gen_random_uuid()` default instead of UUIDs

### Key Endpoints
- Project URL: https://zmygclofyxanprwklema.supabase.co
- REST API: https://zmygclofyxanprwklema.supabase.co/rest/v1/
- Database: PostgreSQL (hosted)

## Next Phase Planning (Vexabots Lead Tool)

### Phase 1 (Current) - Done
- Basic CRUD on leads table
- LinkedIn/Apollo enrichment tables
- Upload script + web import

### Phase 2 - Scoring & Prioritization
- Implement ICP score calculation properly
- Lead scoring based on ad signals, owner data, company size
- Lead assignment/claiming for team members

### Phase 3 - Outreach Tracking
- Log calls, texts, emails per lead
- Follow-up scheduling and reminders
- Activity timeline per lead

### Phase 4 - n8n Integration
- Deploy the upload script as an n8n node
- Auto-import from scraper output
- Webhook receiver for real-time updates

### Phase 5 - Production Deployment
- Deploy to Vercel
- Move from dev to prod Supabase
- Team access control (role-based)

## Environment Notes
- Server: npm run dev on port 3000 (may need kill -9 PID if stuck)
- Windows username: asadf (not asad)
- Paths: /mnt/c/Users/asadf/Desktop/ on Linux = C:\Users\asadf\Desktop\ on Windows
- Python: use python3, pip modules need manual install