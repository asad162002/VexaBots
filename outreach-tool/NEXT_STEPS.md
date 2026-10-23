# Next Steps & Lessons Learned

## What's Done
1. Two separate dashboard views (Google Maps leads + LinkedIn Leads)
2. LinkedIn Lead detail page with notes
3. Infinite scroll on LinkedIn leads list
4. Cold caller data on lead detail (Google Maps link, address, rating, competitors, copyable phone)
5. Admin import page (CSV + JSON scraper format)
6. Upload script for n8n automation
7. **Phase 1 (Basic CRUD)**: Basic CRUD on leads table, LinkedIn/Apollo enrichment tables, upload script + web import
8. **Phase 2 (Scoring & Prioritization)**: ICP score calculation, lead scoring, assignment/claiming for team members
9. **Phase 3 (Outreach Tracking)**: Activity logging (calls, texts, emails, meetings), follow-up scheduling, activity timeline, assignment limits, status audit trail
10. **Invite team members** via Settings page (now working with service_role key)
11. **All E2E tests passing (68 tests)** covering login, dashboard, lead detail, assignment, activity logging, JSON/CSV import

## What's Next (Priority Order)
### 1. Test the Web Import Page
- Upload a JSON file via the /dashboard/import page
- Verify it splits data correctly into 3 tables (leads, linkedin_leads, tech_stack)

### 2. Phase 4 - n8n Integration
- Deploy the upload script as an n8n node
- Auto-import from scraper output
- Webhook receiver for real-time updates

### 3. Phase 5 - Production Deployment
- Deploy to Vercel
- Move from dev to prod Supabase
- Team access control (role-based)

## RLS Policies
- The leads table shows data correctly via anon key
- But LinkedIn leads were initially failing - fixed by adding RLS policies
- **Assignment update failing**: The `leads_update_own` policy only allowed `auth.uid() = owner_id`, but leads with NULL owner_id were blocked. Fixed by adding `(owner_id IS NULL)` condition to update policy.

## Key Supabase Lessons (Don't Forget!)
### PAT Token Issues
- The Pat token (see .env.local) works for Management API but NOT for REST API
- The JWT service_role key works for REST API (read/write/upsert/delete)
- The anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) can read + insert but NOT delete/update existing owned rows

### JWT Key Gotchas
- JWT verification was failing on Management API for service_role key
- Management API requires: Bearer token format
- REST API accepts the JWT fine for reads, writes, deletes, patches
- BUT deletes via anon key return 204 (success) WITHOUT actually deleting - it's silently skipped due to RLS
- Solution: Use service_role JWT for deletes, not anon key

### User Invite API
- The Management API endpoint no longer works
- Use the Supabase Admin SDK (`supabase.auth.admin.inviteUserByEmail()`) with the service_role key instead
- The service_role key is redacted — see .env.local
- Note: Supabase has email rate limits on invites - 3 invites per hour for the same email by default

### Execute SQL via MCP
- MCP server's `execute_sql` works with the PAT token
- For triggers: PostgreSQL doesn't support `IF NOT EXISTS` on triggers - use `DROP TRIGGER IF EXISTS` first
- Column creation works via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

### Table Creation Workflow
1. Use MCP server with `execute_sql` (not `apply_migration` - needs project permissions)
2. Use `DROP TRIGGER IF EXISTS` instead of `CREATE TRIGGER IF EXISTS`
3. Run the SQL to create tables: linkedin_leads, tech_stack
4. Add RLS policies after table creation
5. Use `gen_random_uuid()` default instead of UUIDs

### Key Endpoints
- Project URL: see .env.local
- REST API: see .env.local
- Database: PostgreSQL (hosted)

## Environment Notes
- Server: npm run dev on port 3000 (may need kill -9 PID if stuck)
- Windows username: asadf (not asad)
- Paths: /mnt/c/Users/asadf/Desktop/ on Linux = C:\Users\asadf\Desktop\ on Windows
- Python: use python3, pip modules need manual install
