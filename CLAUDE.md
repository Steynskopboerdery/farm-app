# Notes for Claude

- **Only push to GitHub (which publishes the app on Cloudflare) when Nicholas says so.** Commit locally as you work, then ask before pushing.
- **When Nicholas asks for something, just do it** (code, database changes, adding farm data, test functions) without asking again. Ask only when something is genuinely unclear or would cost money.
- Nicholas is not a developer: explain in plain language, keep setup steps short, ask before anything that costs money or is hard to undo.
- Live app: https://farm-app.nbsteyn.workers.dev (Cloudflare Workers, builds on every push to `main`).
- Supabase project `eozzivvksyhuhwidoobj`. Migrations in `supabase/migrations/` are already applied to it; apply new ones with the Supabase tools.
- Secrets (Web Push keys, notify secret) live in Supabase Vault, never in the repo.
