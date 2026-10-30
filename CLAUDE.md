# Notes for Claude

- **Publish when work is finished and tested** (push to `main`; Cloudflare rebuilds the app). No need to ask first. Batch changes into sensible pushes.
- **When Nicholas asks for something, just do it** (code, database changes, adding farm data, test functions) without asking again. Ask only when something is genuinely unclear or would cost money.
- Nicholas is not a developer: explain in plain language, keep setup steps short, ask before anything that costs money or is hard to undo.
- Live app: https://farm-app.nbsteyn.workers.dev (Cloudflare Workers, builds on every push to `main`).
- Supabase project `eozzivvksyhuhwidoobj`. Migrations in `supabase/migrations/` are already applied to it; apply new ones with the Supabase tools.
- Secrets (Web Push keys, notify secret) live in Supabase Vault, never in the repo.
