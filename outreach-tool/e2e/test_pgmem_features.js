const { newDb } = require('pg-mem');
const db = newDb();
const pg = db.adapters.createPg();
const c = new pg.Client();
c.connect().then(async () => {
  // Try create function without security definer
  try {
    await c.query('create or replace function public.test() returns void as $$ begin end $$;');
    console.log('Function: OK');
  } catch(e) { console.log('Function:', e.message.substring(0,80)); }

  // Try create trigger
  try {
    await c.query('create table t (id int)');
    await c.query('create or replace function trig() returns trigger as $$ begin return NULL; end $$ language plpgsql;');
    await c.query('create trigger tr before update on t for each row execute function trig();');
    console.log('Trigger: OK');
  } catch(e) { console.log('Trigger:', e.message.substring(0,80)); }

  // Try create policy
  try {
    await c.query('create policy "test" on t for select using (true)');
    console.log('Policy: OK');
  } catch(e) { console.log('Policy:', e.message.substring(0,80)); }

  // Try enable RLS
  try {
    await c.query('alter table t enable row level security');
    console.log('RLS: OK');
  } catch(e) { console.log('RLS:', e.message.substring(0,80)); }

  db.close();
}).catch(e => console.log('Connect error:', e.message));
