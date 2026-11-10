# VexaBots Outreach Tool - Project Context

## Tech Stack
- Next.js 16.3.5 (App Router, Turbopack)
- TypeScript
- Supabase (PostgreSQL + RLS)
- Playwright (E2E testing)
- Telnyx WebRTC (voice calling)
- Tailwind CSS

## Dev Server
- URL: http://localhost:3000
- Login admin: asad@vexabots.com / test1234
- Login member: asadisdying007@gmail.com / test1234

## Test Commands
- Typecheck: npx tsc --noEmit
- E2E: npx playwright test
- Dev: npm run dev

## File Structure
- src/app/dashboard/ - All dashboard pages
- src/app/api/ - API routes
- src/components/ - Reusable components
- src/hooks/ - Custom React hooks
- src/lib/ - Utilities

## Critical Rules
- Never commit secrets or API keys
- Telnyx API keys are server-side only
- Supabase service_role key never exposed client-side
- Always run typecheck before committing
- Use upsert with onConflict for linkedin_leads and leads tables
- Branch: refactor/my-queue-workspace

## DB Tables (public schema)
- leads: main leads table (place_id unique)
- linkedin_leads: LinkedIn leads (place_id conflict key)
- tech_stack: tech stack per place_id
- call_logs, lead_activities, assignment_log, assignment_history, lead_status_history
- profiles, team_members, assignment_limits

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
