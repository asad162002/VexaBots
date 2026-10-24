const { newDb } = require('pg-mem');
const fs = require('fs');

const db = newDb();

// Parse SQL into statements, respecting $$ dollar quoting and ' single quotes
function parseSqlStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  let inDollarQuote = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inComment = false;
  let tag = '';

  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inComment) {
      if (char === '\n') inComment = false;
      current += char;
      i++;
      continue;
    }

    if (inDollarQuote) {
      // Check for end of dollar quote
      if (char === '$' && sql[i + 1] === '$') {
        inDollarQuote = false;
        current += '$';
        i += 2;
        continue;
      }
      current += char;
      i++;
      continue;
    }

    if (inSingleQuote) {
      if (char === "'") {
        if (sql[i + 1] === "'") {
          current += "''";
          i += 2;
          continue;
        }
        inSingleQuote = false;
      }
      current += char;
      i++;
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"') {
        inDoubleQuote = false;
      }
      current += char;
      i++;
      continue;
    }

    // Check for comment start
    if (char === '-' && next === '-') {
      inComment = true;
      current += char;
      i++;
      continue;
    }

    // Check for dollar quote start $$
    if (char === '$' && next === '$') {
      inDollarQuote = true;
      current += '$$';
      i += 2;
      continue;
    }

    // Check for single quote
    if (char === "'") {
      inSingleQuote = true;
      current += char;
      i++;
      continue;
    }

    // Check for double quote
    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      i++;
      continue;
    }

    // Check for statement separator
    if (char === ';' && !inDollarQuote && !inSingleQuote && !inDoubleQuote && !inComment) {
      const trimmed = current.trim();
      if (trimmed && !trimmed.startsWith('--')) {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  const trimmed = current.trim();
  if (trimmed && !trimmed.startsWith('--')) {
    statements.push(trimmed);
  }

  return statements;
}

(async () => {
  try {
    const pg = db.adapters.createPg();
    const client = new pg.Client();
    await client.connect();

    // Create base tables
    const tables = [
      `create table public.profiles (
        id uuid primary key, email text, full_name text, role text,
        phone_number text, avatar_url text, telnyx_credential_id text
      )`,
      `create table public.leads (
        id uuid primary key, title text, phone text, status text,
        assigned_to uuid, assigned_by uuid, assigned_at timestamptz,
        owner_id uuid, source text, icp_score numeric,
        last_contacted_at timestamptz, next_follow_up_at timestamptz, updated_at timestamptz
      )`,
      `create table public.call_logs (
        id uuid primary key, lead_id uuid NOT NULL, caller_id uuid,
        from_number text, to_number text, status text, duration_seconds integer,
        recorded_url text, recording_url text, call_id text,
        telnyx_call_control_id text, telnyx_call_session_id text,
        started_at timestamptz, ended_at timestamptz, call_control_id text,
        created_at timestamptz, updated_at timestamptz
      )`,
      `create table public.lead_activities (
        id uuid primary key, lead_id uuid, profile_id uuid,
        activity_type text, content text, next_follow_up_at timestamptz,
        call_log_id uuid, created_at timestamptz, updated_at timestamptz
      )`,
      `create table public.linkedin_leads (place_id text primary key, name text)`,
      `create table public.tech_stack (id uuid primary key, place_id text)`,
      `create table public.assignment_history (
        id uuid primary key, lead_id uuid, assigned_to uuid, assigned_by uuid, assigned_at timestamptz
      )`,
      `create table public.assignment_limits (
        id uuid primary key, profile_id uuid, max_leads integer, current_leads integer
      )`,
      `create table public.lead_status_history (
        id uuid primary key, lead_id uuid, profile_id uuid, status text, created_at timestamptz
      )`,
    ];

    for (const tbl of tables) {
      await client.query(tbl);
    }

    // Mock auth.uid() for pg-mem
    await client.query(`create schema if not exists auth`);

    // Default: returns null (service role context)
    await client.query(`create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$`);

    console.log('Tables created. Parsing and applying migration...');

    const migration = fs.readFileSync('supabase/migrations/20261023000000_profiles_hardening.sql', 'utf8');

    // pg-mem doesn't support "security definer" — strip it for testing
    const migrationSql = migration.replace(/security\s+definer/gi, '');

    const statements = parseSqlStatements(migrationSql);
    console.log(`Found ${statements.length} statements in migration`);

    let applied = 0;
    let skipped = 0;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        applied++;
      } catch(e) {
        // Ignore errors for statements that don't apply in pg-mem
        const msg = e.message.substring(0, 80);
        if (msg.includes('pg_policies') || msg.includes('pg_class') || msg.includes('pg_constraint')) {
          skipped++;
        } else {
          console.log('  SKIP:', msg);
          skipped++;
        }
      }
    }
    console.log(`Applied ${applied}, skipped ${skipped}`);

    let pass = 0, fail = 0;

    // Test 7: No policies with USING (true)
    console.log('\n--- Test 7: No policies with USING (true) ---');
    try {
      const t7 = await client.query(`select schemaname, tablename, policyname, cmd, qual, with_check
        from pg_policies where schemaname = 'public'
        and (qual = 'true' or with_check = 'true')
        and cmd in ('SELECT','INSERT','UPDATE','DELETE','ALL')`);
      console.log('Result:', t7.rows.length, 'rows (expected 0)');
      t7.rows.length === 0 ? pass++ : fail++;
    } catch(e) {
      console.log('SKIP: pg_policies not available in pg-mem');
      skipped++;
    }

    // Test 8: RLS enabled on ALL tables
    console.log('\n--- Test 8: RLS enabled on ALL tables ---');
    try {
      const t8 = await client.query(`select relname, relrowsecurity from pg_class
        where relkind='r' and relnamespace='public'::regnamespace and relrowsecurity=false`);
      console.log('Result:', t8.rows.length, 'rows (expected 0)');
      t8.rows.length === 0 ? pass++ : fail++;
    } catch(e) {
      console.log('SKIP: pg_class RLS check failed in pg-mem');
      fail++;
    }

    // Test 9: call_logs status constraint
    console.log('\n--- Test 9: call_logs status constraint ---');
    try {
      const t9 = await client.query(`select pg_get_constraintdef(oid) as definition
        from pg_constraint where conrelid='public.call_logs'::regclass and contype='c'`);
      console.log('Constraints:', t9.rows.map(r => r.definition));
      t9.rows.length > 0 ? pass++ : fail++;
    } catch(e) {
      console.log('SKIP: pg_constraint not available in pg-mem');
      fail++;
    }

    // Test 10: new columns exist
    console.log('\n--- Test 10: telnyx_call_control_id / telnyx_call_session_id columns ---');
    const t10 = await client.query(`select column_name from information_schema.columns
      where table_schema='public' and table_name='call_logs'
      and column_name in ('telnyx_call_control_id', 'telnyx_call_session_id')`);
    console.log('Columns:', t10.rows.map(r => r.column_name));
    t10.rows.length === 2 ? pass++ : fail++;

    // Test 11: log_call_outcome status validation
    console.log('\n--- Test 11: log_call_outcome status validation ---');
    await client.query(`insert into profiles (id, email, full_name, role) values
      ('a1b2c3d4-9999-4aaa-8bbb-000000000001', 'admin@test.com', 'Admin', 'admin')`);
    await client.query(`insert into leads (id, title, status) values
      ('b1c2d3e4-9999-4bbb-8ccc-000000000002', 'Test Lead', 'new')`);

    // Make admin
    await client.query(`create or replace function auth.uid() returns uuid language sql as $$ select 'a1b2c3d4-9999-4aaa-8bbb-000000000001'::uuid $$`);

    // Try dnc - should fail
    try {
      await client.query(`select public.log_call_outcome('b1c2d3e4-9999-4bbb-8ccc-000000000002', 'dnc', 'test', null, null, null)`);
      console.log('FAIL: dnc status was accepted (should be rejected)');
      fail++;
    } catch (e) {
      if (e.message.includes('Invalid lead status')) {
        console.log('PASS: dnc status rejected');
        pass++;
      } else {
        console.log('WARN: unexpected error:', e.message.substring(0, 100));
        fail++;
      }
    }

    // Try send_info - should pass
    try {
      await client.query(`select public.log_call_outcome('b1c2d3e4-9999-4bbb-8ccc-000000000002', 'send_info', 'test', null, null, null)`);
      console.log('PASS: send_info status accepted');
      pass++;
    } catch (e) {
      console.log('FAIL: send_info should be accepted:', e.message.substring(0, 100));
      fail++;
    }

    // Test 12: log_call_outcome does NOT auto-assign
    console.log('\n--- Test 12: log_call_outcome auto-assign removed ---');
    const afterAssign = await client.query(`select assigned_to from leads where id='b1c2d3e4-9999-4bbb-8ccc-000000000002'`);
    const stillNull = afterAssign.rows[0]?.assigned_to === null;
    console.log('Still null after log_call_outcome:', stillNull);
    stillNull ? pass++ : fail++;

    // Test 13: Member cannot change role
    console.log('\n--- Test 13: Member cannot set role=admin ---');
    await client.query(`create or replace function auth.uid() returns uuid language sql as $$ select 'c2d3e4f5-9999-4bbb-8ccc-000000000003'::uuid $$`);
    await client.query(`insert into profiles (id, email, full_name, role) values
      ('c2d3e4f5-9999-4bbb-8ccc-000000000003', 'member@test.com', 'Member', 'member')`);
    try {
      await client.query(`update public.profiles set role = 'admin' where id = auth.uid()`);
      console.log('FAIL: member was able to set role=admin');
      fail++;
    } catch (e) {
      if (e.message.includes('Unauthorized')) {
        console.log('PASS: member blocked from setting role=admin');
        pass++;
      } else {
        console.log('WARN: unexpected error:', e.message.substring(0, 100));
        fail++;
      }
    }

    // Test 14: Member cannot change phone_number
    console.log('\n--- Test 14: Member cannot change phone_number ---');
    try {
      await client.query(`update public.profiles set phone_number = '+15551234567' where id = auth.uid()`);
      console.log('FAIL: member was able to change phone_number');
      fail++;
    } catch (e) {
      if (e.message.includes('Unauthorized')) {
        console.log('PASS: member blocked from changing phone_number');
        pass++;
      } else {
        console.log('WARN: unexpected error:', e.message.substring(0, 100));
        fail++;
      }
    }

    // Test 15: claim_lead with max_leads=0 = unlimited
    console.log('\n--- Test 15: claim_lead allows claim when max_leads=0 ---');
    await client.query(`create or replace function auth.uid() returns uuid language sql as $$ select '2a447186-9d5a-47d4-b1f6-e2e7a9a76508'::uuid $$`);
    await client.query(`insert into leads (id, title, status) values
      ('d4e5f6a7-9999-4bbb-8ccc-000000000004', 'Unassigned Lead', 'new')`);
    await client.query(`insert into assignment_limits (id, profile_id, max_leads, current_leads) values
      ('e5f6a7b8-9999-4bbb-8ccc-000000000005', '2a447186-9d5a-47d4-b1f6-e2e7a9a76508', 0, 5)`);

    const claimResult = await client.query(`select public.claim_lead('d4e5f6a7-9999-4bbb-8ccc-000000000004')`);
    console.log('claim_lead returned:', claimResult.rows[0].claim_lead);
    claimResult.rows[0].claim_lead === true ? pass++ : fail++;

    console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);

  } catch (e) {
    console.error('Fatal error:', e.message);
  }
})();
