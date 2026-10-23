# History Purge Checklist — VexaBots

## CRITICAL: A real service_role key is in git history

Commit `70b5777` (file `outreach-tool/NEXT_STEPS.md`, line 10) contains a real
Supabase `service_role` JWT:

```
eyJhbG...aXR5In0.PhD0
```

This is a **live service_role key**. It bypasses all RLS and gives full
database read/write/delete access. **It must be rotated immediately.**

---

## Step 1: Rotate the compromised key FIRST

Before doing anything else, rotate the key in the Supabase dashboard:

1. Go to **Project Settings → API → Service Role / service_role**
2. Click **"Regenerate"** (or "Rotate") the service_role key
3. This immediately **invalidates the old key** — any code using it stops working
4. Update `.env.local` on your dev machine with the new key:
   ```
   SUPABASE_SERVICE_ROLE_KEY=<new_key>
   ```
5. Restart your local dev server

## Step 2: Update server env (Hetzner)

If you have a Hetzner server running this app:

```bash
ssh root@<server-ip>
# Edit the env file for the PM2/FastAPI process
nano /root/.env  # or wherever the service runs
# Replace the old SUPABASE_SERVICE_ROLE_KEY with the new one
pm2 restart vexabots || pm2 restart all
```

## Step 3: Verify the new key works

```bash
# In your local outreach-tool directory
npm run dev
# Navigate to Settings → check that API calls work
```

## Step 4: Purge the old key from git history

Now that the old key is invalidated, remove it from history:

### Option A: `git filter-repo` (recommended — faster, safer)

```bash
pip install git-filter-repo

# Create a replacements file
cat > /tmp/replacements.txt << 'EOF'
eyJhbG.*PhD0==>REDACTED_SERVICE_ROLE_KEY
EOF

git filter-repo --replace /tmp/replacements.txt --force
```

This replaces every occurrence of the leaked key with `REDACTED_SERVICE_ROLE_KEY`
across all branches and tags.

### Option B: BFG Repo-Cleaner

```bash
java -jar bfg.jar replace-text /tmp/replacements.txt
git reflog expire --expire=now --all && git gc --prune=now
```

### Option C: Manual `git log -p` inspection (slow — use only for verification)

```bash
grep -r "eyJhbG" --include="*.md" .
```

## Step 5: Force-push (after review)

```bash
# Review the rewritten history first
git log --oneline -5
git show 70b5777 --name-only

# If everything looks clean, force-push
git push --force-with-lease
```

## Step 6: Tell your team

- Everyone must re-clone the repo (or `git fetch --all --prune` + `git reset --hard origin/main`)
- Share the new `.env.local` values (only via encrypted channel)
- No one should use the old service_role key — it's been invalidated

---

## Other secrets status

| Secret | In git history? | Status |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | YES (commit 70b5777) | ROTATED, purged via filter-repo |
| `NEXT_PUBLIC_SUPABASE_URL` | NO | Public-safe (anon key URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | NO | Public-safe by design |
| `TELNYX_ACCESS_TOKEN` | NO | Stays in `.env.local` only |
| `TELNYX_PUBLIC_KEY` | NO | Stays in `.env.local` only |
| `TELNYX_PHONE_NUMBER` | NO | Stays in `.env.local` only |

---

## Prevention for the future

- Add `.env*` and `NEXT_STEPS.md` (if it contains secrets) to `.gitignore`
- Run `git secrets` or `trufflehog` in CI to catch future leaks
- Never store real JWTs in markdown files — use `.env.local` only
- The service_role key should only be referenced via `process.env.SUPABASE_SERVICE_ROLE_KEY`
