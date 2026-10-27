# Farm Manager

[![Netlify Status](https://api.netlify.com/api/v1/badges/382ffec5-a892-4478-9f96-8d1d7be4de0e/deploy-status)](https://app.netlify.com/projects/farmplans/deploys)

Live app: https://farmplans.netlify.app

A phone-first farm app for a mixed crop and livestock farm near Swellendam. It covers fields and grazing camps on a satellite map, crops, animals, sales and invoices.

- **App:** React + TypeScript (Vite). Installable on a phone ("Add to Home Screen") and opens offline.
- **Database, login and files:** Supabase (Postgres with Row Level Security). Each farm only ever sees its own data.
- **Map:** Leaflet + Geoman drawing tool + Esri World Imagery satellite photos. Free, with no billing account.
- **Hosting:** Netlify free plan.
- **Languages:** English and Afrikaans. Switch on the login screen or in Settings.

---

## Run it on a computer

You need [Node.js](https://nodejs.org) version 22 or newer.

```bash
npm install
npm run dev                    # opens on http://localhost:3000
npm test                       # runs the calculation tests
```

The app connects to the farm's Supabase project using the public address and *publishable* key in `src/lib/config.ts`. These are not secrets: every browser receives them, and the database security rules protect the data. To use a different project, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (copy `.env.example`) or in Netlify.

The **secret / service_role** key must never be put in the app or the repo.

## Database

The database setup lives in `supabase/migrations/` and has already been applied to the Supabase project `farm-app`. If you ever need a fresh project, run the files in order in the Supabase SQL editor, or use `supabase db push` with the Supabase CLI.

**Who can do what**

| | Owner (farmer) | Worker |
|---|---|---|
| Fields, camps, crops, animals | see and change | see only |
| Tasks | create, change, delete | see and tick off |
| Sales, invoices, costs, customers, bank details | yes | no |
| Change history | see | no |

Records are never really deleted from the app. "Remove" hides them, and every change is kept in a change history (who, what, when).

## One-time Supabase login settings (do these once)

In the Supabase dashboard for **farm-app**:

1. **Authentication → URL Configuration**
   - **Site URL:** your Netlify link, for example `https://farmplans.netlify.app`.
   - **Redirect URLs:** add `https://farmplans.netlify.app/**` and `http://localhost:3000/**`.
2. **Authentication → Emails → Magic Link** template: add the line `Your code: {{ .Token }}` so the email also contains a 6-digit code. On an iPhone, the installed app can't open email links, so you type the code instead.
3. **Passwords:** anyone can set a password under **Settings → Password**, then log in on another device with email + password, with no email needed. A login link only works from the newest email: asking for a new one cancels the old links.
4. **Email sending limits:** Supabase's built-in email service sends only a few emails per hour, and only to people on your Supabase team. That's fine for you alone. Before workers log in, connect a free email service (for example Resend) under **Authentication → Emails → SMTP Settings**.

## Put it online (Netlify, free)

1. Sign up at [netlify.com](https://app.netlify.com/signup) with your GitHub account.
2. **Add new site → Import an existing project → GitHub →** choose `farm-app`.
3. The build settings fill in from `netlify.toml`: build command `npm run build`, publish folder `dist`.
4. Click **Deploy**. No environment variables are needed. You get a link like `https://something.netlify.app`. You can rename it under **Site configuration → Change site name**.
5. Put that link into Supabase (step 1 of the login settings above).

After that, every change saved to GitHub updates the app automatically.

## Install on a phone

- **Android (Chrome):** open the link, tap the **⋮** menu, then **Add to Home screen** (or **Install app**).
- **iPhone (Safari):** open the link, tap the **Share** button, then **Add to Home Screen**.

It then opens like a normal app, full screen, with its own icon.

## Map imagery: attribution and terms

- The satellite photos come from **Esri World Imagery**. The credit "Esri, Maxar, Earthstar Geographics" must stay visible on the map, and it does.
- Esri's free public tiles are fine for light use like a single farm. The app doesn't store tiles for offline use, because Esri's terms don't allow that. Your phone's normal browser cache still keeps recently viewed areas.
- Satellite photos can be 1–3 years old.
- If Esri ever requires a key, the fallback is MapTiler's free plan (about 100 000 tiles a month, with a free key).
- Google satellite images are not used: Google's terms don't allow them outside Google's own map tools.

## Calculations and tests

Calculations live in `src/lib/calc/`, and each file has a test next to it. Run them with `npm test`.

| File | What it does |
|---|---|
| `area.ts` | Hectares from a drawn outline (allows for the curve of the earth) |
| `dates.ts` | Lambing / calving dates: joining date + pregnancy days (sheep 147, cattle 283, editable) |
| `yield.ts` | Tons per hectare; planned income, cost and margin per field |
| `invoice.ts` | Invoice line totals, VAT (15%, optional) and total in Rand; sequential invoice numbers |
| `withholding.ts` | Warns when a spray's withholding period runs past the planned harvest date |

## Folder layout

```
src/
  auth/         login (email link or 6-digit code)
  farm/         which farm you're on, and your role
  features/
    dashboard/  home screen
    map/        satellite map, drawing and editing outlines
    land/       fields and camps: list, details, change history
    settings/   farm, invoices, bank, seasons, pregnancy days, people, sample data
  lib/          database connection, calculations, text (English/Afrikaans), formatting
supabase/
  migrations/   database tables, security rules, change history, functions
  functions/    weather: fetches the MET Norway forecast for the app
  seed.sql      how sample data is loaded
```

## What each phase added

### Phase 1: setup, login, map (done)
- Database for the whole farm (all tables for later phases too), with each farm's data kept private and a change history.
- Login by email link, or by password once one is set in Settings. Owner and worker roles; invite people by email.
- Farm settings: business details, VAT, invoice numbering, bank details, seasons with a notes box per year, pregnancy lengths.
- Fields and camps: list, add, edit, remove (hidden, history kept).
- Satellite map: see all outlines coloured by crop (camps dashed green), tap for details, draw / edit / remove outlines. Hectares are calculated from the outline. "My location" button.
- Sample data (labelled SAMPLE), loaded or removed with one button.
- English / Afrikaans switch, installable on a phone, opens offline.

### Phase 2: crop records (done)
- Field page per season (tap the year chips): crop planted, fertiliser, sprays, other work, harvests.
- Quick forms: totals fill in from rate × field size; cost from price per kg/L; yield worked out as you type.
- Sprays show "safe to harvest from". Warnings when that is after the planned harvest date: on the field page, the harvest form, and the home screen.
- Season totals (inputs used per product, costs, cost per hectare, tons, t/ha) and a season history table per field.
- Reminders per field (spray, fertilise, plant, harvest), ticked off on the home screen or the field page.
- Change history on a field now includes its plantings, field work and harvests.
- Sample data now includes fertiliser, sprays and a 2025 season with harvests. (Remove and reload sample data in Settings to get it.)

### New look and weather (done)
- Modern design: deep green and lime, rounded cards, Plus Jakarta Sans font (built in, works offline), floating bottom menu.
- Green **+** button: quick add a spray, fertiliser, harvest, planting, other work or reminder for any field.
- Home: greeting header with current weather, stat tiles, field cards with satellite pictures, weather card.
- Weather (MET Norway via the Supabase `weather` function): chance-of-rain ring, wind dial, humidity, 7-day strip with rain bars,
  "good to spray" times (wind 3–15 km/h, dry for 3 hours, 5–30 °C, daylight), frost / heavy rain / wind / heat warnings,
  and a full forecast page (48 hours + coming days). Set the farm's weather location in Settings.
- Weather terms: MET Norway data is free, also for business use, under CC BY 4.0. The app shows "Weather data: MET Norway".
  The function identifies the app to MET with a User-Agent, as MET requires.

### Phase 3: livestock (next)
Groups and animals, health events, breeding and shearing calendar, dashboard reminders.
