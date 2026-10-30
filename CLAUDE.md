# Notes for Claude

- **Only push to GitHub (which publishes the app on Cloudflare) when Nicholas says so.** Commit locally as you work, then ask before pushing.
- **Also ask before adding or changing farm data in the live database** (fields, animals, reminders, notes, sample data…): show what will go where, and only write it after Nicholas says yes.
- Nicholas is not a developer: explain in plain language, keep setup steps short, ask before anything that costs money or is hard to undo.
- Live app: https://farm-app.nbsteyn.workers.dev (Cloudflare Workers, builds on every push to `main`).
- Supabase project `eozzivvksyhuhwidoobj`. Migrations in `supabase/migrations/` are already applied to it; apply new ones with the Supabase tools.
- Secrets (Web Push keys, notify secret) live in Supabase Vault, never in the repo.
