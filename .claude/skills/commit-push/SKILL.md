---
name: commit-push
description: Stage, commit, and push changes to the remote repository
disable-model-invocation: true
allowed-tools: Bash, Read, Grep, Glob
argument-hint: [commit message or leave blank for auto-generated]
---

Commit and push all current changes. If an argument is provided, use it as the commit message summary. Otherwise, auto-generate one from the changes.

## Steps

1. Run these in parallel to understand the current state:
   ```bash
   git status
   git diff
   git diff --staged
   git log --oneline -5
   ```

2. Analyze the changes and draft a commit message:
   - Summarize the nature of the changes (new feature, enhancement, bug fix, refactor, etc.)
   - Keep the first line concise (under 72 chars)
   - Add a blank line then a brief body if the changes warrant explanation
   - Do NOT commit files that look like secrets (.env, credentials, etc.)
   - If `$ARGUMENTS` was provided, use it as the summary line

3. Stage relevant files by name (prefer specific files over `git add -A`). Common files to exclude:
   - `.cardmaker-data.json.bak`
   - `*.tsbuildinfo`
   - `client/vite.config.d.ts`, `client/vite.config.js` (build artifacts)

4. Create the commit using a HEREDOC for the message:
   ```bash
   git commit -m "$(cat <<'EOF'
   Summary line here

   Optional body here.

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

5. Push to the remote:
   ```bash
   git push
   ```

6. Run `git status` to confirm clean state.

Report the commit hash and pushed status when done.
