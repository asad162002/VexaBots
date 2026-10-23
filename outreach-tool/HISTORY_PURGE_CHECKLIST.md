# History Purge Checklist

## When to use this
If real secrets (actual API keys, JWTs, passwords) are found in git history.
Current scan result: NO actual secrets found in committed history.
The `.env.local` file is git-ignored and not committed.

## Step 1: Rotate all exposed keys (do this first, before purging)

1. **Supabase service_role key**:
   - Go to https://supabase.com/dashboard → your project → Settings → API → Service Role
   - Click "Reset" or "Regenerate" the service_role key
   - **WARNING**: This will break all integrations until updated

2. **Supabase access token / PAT** (if used with MCP):
   - Go to https://supabase.com/dashboard → your profile → Access Tokens
   - Revoke the old token

3. **Telnyx API key** (if exposed):
   - Go to https://portal.telnyx.com → Settings → API Keys
   - Delete the old key, generate a new one

4. **Telnyx webhook public key**:
   - Only the public key is safe to expose. If the private key was leaked, generate a new credential connection.

## Step 2: Update environment after rotation

1. Update `.env.local` with the new keys
2. Update the Hetzner server:
   ```bash
   ssh root@your-hetzner-ip
   # Edit the environment file (e.g., /etc/systemd/system/app.service or .env)
   systemctl restart your-app-service
   ```

## Step 3: Purge secrets from git history (if needed)

If you discover actual secret values in committed history, purge them:

### Option A: git filter-repo (recommended)

```bash
# Install git-filter-repo
pip install git-filter-repo

# Create a replace-text file
cat > /tmp/replace-secrets.txt << 'EOF'
REPLACE_OLD_SECRET==REDACTED==
eyJhbG.*PhD0==eyJhbG...REDACTED==
EOF

# Run the purge (BEFORE running this, make sure all collaborators have pushed)
git filter-repo --replace-text /tmp/replace-secrets.txt --force

# Force-push (this will break collaborators' local clones)
git push --force-with-lease
```

### Option B: BFG Repo-Cleaner

```bash
# Download BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.16.0/bfg-1.16.0.jar

# Clean secrets
java -jar bfg-1.16.0.jar --replace-text /tmp/replace-secrets.txt

# Force-push
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force-with-lease
```

## Step 4: Make the repo private (recommended)

```bash
# Set repo to private (requires GitHub CLI)
gh repo edit --visibility private
```

Or go to GitHub → repo Settings → Manage access → "Change visibility"

## Step 5: Notify collaborators

After force-push, all collaborators must re-clone:
```bash
git clone <new-repo-url>
cd outreach-tool
git checkout <their-branch>
```

## Current status scan

Files scanned: all committed SQL, TS, TSX, MD files
Secrets found in committed history: NONE (only env var references, no actual values)
.env.local: git-ignored, not committed
.env.example: safe (contains only variable names)

## Additional recommendations

- Add a pre-commit hook to scan for secrets: `pip install detect-secrets && detect-secrets-hook --baseline .secrets.baseline`
- Enable GitHub secret scanning for the repo
- Add `secretlint` or `gitleaks` to CI
