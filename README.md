# FarmPlans


Live app: https://farm-app.nbsteyn.workers.dev

A phone-first farm app for a mixed crop and livestock farm near Swellendam. It covers fields and grazing camps on a satellite map, crops, animals, sales and invoices.

- **App:** React + TypeScript (Vite). Installable on a phone ("Add to Home Screen") and opens offline.
- **Database, login and files:** Supabase (Postgres with Row Level Security). Each farm only ever sees its own data.
- **Map:** Leaflet + Geoman drawing tool + Esri World Imagery satellite photos. Free, with no billing account.
- **Hosting:** Cloudflare Workers free plan (Netlify setup kept as a fallback).
- **Languages:** English and Afrikaans. Switch on the login screen or in Settings.

---

## Run it on a computer

You need [Node.js](https://nodejs.org) version 22 or newer.

```bash
npm install
npm run dev                    # opens on http://localhost:3000
npm test                       # runs the calculation tests
```

The app connects to the farm's Supabase project using the public address and *publishable* key in `src/lib/config.ts`. These are not secrets: every browser receives them, and the database security rules protect the data. To use a different project, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (copy `.env.example`) or in the host's build variables.

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
   - **Site URL:** the live link, `https://farm-app.nbsteyn.workers.dev`.
   - **Redirect URLs:** add `https://farm-app.nbsteyn.workers.dev/**` and `http://localhost:3000/**`.
2. **Authentication → Emails → Magic Link** template: add the line `Your code: {{ .Token }}` so the email also contains a 6-digit code. On an iPhone, the installed app can't open email links, so you type the code instead.
3. **Passwords:** anyone can set a password under **Settings → Password**, then log in on another device with email + password, with no email needed. A login link only works from the newest email: asking for a new one cancels the old links.
4. **Email sending limits:** Supabase's built-in email service sends only a few emails per hour, and only to people on your Supabase team. That's fine for you alone. Before workers log in, connect a free email service (for example Resend) under **Authentication → Emails → SMTP Settings**.

## Put it online (Cloudflare, free; recommended)

Netlify's free plan allows only about 20 updates a month, so the app is hosted on Cloudflare Workers, which rebuilds for free on every push to `main`:

1. Sign up at dash.cloudflare.com → **Workers & Pages → Create → Import a repository** → choose `farm-app`.
2. Build command `npm run build`, deploy command `npx wrangler deploy` (the defaults). No variables are needed: `wrangler.jsonc` points Cloudflare at `dist` and makes every path load the app, and `.node-version` picks Node 22.
3. The link looks like `https://farm-app.<account>.workers.dev`.
4. In Supabase → Authentication → URL Configuration: set that link as **Site URL** and add `<link>/**` to **Redirect URLs**.

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
| `rain.ts` | Rain gauge totals: per day (average of gauges), month, year to date vs earlier years, rain while a crop grows |
| `vehicles.ts` | Fuel use (L/hour or L/100 km) from meter readings, when the next service is due |
| `headcount.ts` | Counted vs expected animals, missing animals, groups not counted lately |
| `leave.ts` | Working days (SA public holidays, Easter, Sunday → Monday), leave balances (BCEA defaults) |
| `activity.ts` | Turns the change history into "what this person did" per day |
| `exportData.ts` | SA tax year (1 Mar – end Feb), VAT summary (charged on invoices less paid on costs) |
| `../outbox.ts` | Tells "no signal" apart from a real refusal, so offline saves are retried and refusals are shown |

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

### Crop icons and home photo (done)
- Drawn icons for wheat, canola, barley, oats, lupins and other crops: in field lists, field cards, crop overview, quick add, and a tap-to-pick crop grid when planting.
- Home screen photo: a drawn Overberg wheat field with a tractor by default (`public/hero-default.svg`, made for this app, free to use).
  Owners press and hold the photo (or tap 📷) to choose their own. It is shrunk to max 1600 px and stored privately in Supabase Storage (`farm-photos` bucket, folder per farm; members can view, owners can change).

### Several farms (done)
- Welcome screen with the FarmPlans logo for about 2 seconds when the app opens.
- People with more than one farm choose a farm after the welcome screen; with one farm the app goes straight in.
- Tap the farm name (top bar, or home header) to switch farms or add another farm. Each farm keeps its own data, people, photo and weather location.

### Phase 3: livestock (done)
- **Animals** tab (bottom menu; Settings moved to the ⚙ gear at the top): totals per species and kind, group cards with camp.
- Group page: head count, camp, reminders, breeding (joining → lambing/calving = joining + pregnancy days, editable),
  shearing (planned, done, kg wool), events (birth, vaccination, dosing, weighing, moved, sale, death, other), individual tagged animals, change history.
- Births add to the count, sales and deaths take away (tick box shows old → new); moving camp updates the group's camp;
  selling or losing a tagged animal marks it sold/dead. Vaccination/dosing can create a reminder for the next one.
- Calendar for the next 12 months (joining, lambing, calving, shearing, reminders) with countdowns; the next five also on the home screen.
- Camp pages list the animals grazing there. Quick add (+) has "Animal event".

### Phase 4: sales and invoices (done)
- **Menu** (☰ at the top, and on the home photo): Sales & invoices, Weather, Settings; Reports, Inventory and Grazing tiles show their coming phase.
- Customers (name, contact, phone, email, address, VAT number) with their invoices and what they owe.
- New invoice: customer (or add a new one on the spot), date, pay-by date (from payment terms in Settings), lines with quantity, unit and price,
  VAT per line at the farm's rate (or none if not VAT registered), live totals. Numbers come from the database (`next_invoice_number`), so they never repeat.
- Invoice page: on-screen preview, **Share** (WhatsApp/email via the phone's share menu) or **Download PDF** (A4, made in the app with @react-pdf/renderer).
  "TAX INVOICE" when VAT registered; farm, VAT and bank details from Settings. A copy is kept in the private `invoices` Storage bucket (owners only).
- Draft → Sent → Paid. Record payments (full or part); the balance updates and the invoice turns Paid when covered. Drafts can be edited or deleted; sent invoices are locked.
- Debtors: what each customer owes on sent invoices, days overdue, totals; "Unpaid invoices" card on the home screen for owners. Workers never see sales.

### Phase 5: reports, inventory and costs (done)
- **Inventory & costs** (Menu): store items (seed, fertiliser, chemicals, feed, other) with stock on hand, stock received (with price) and used, low-stock warning level.
  Fertiliser and spray records can take their product **from the store**; the amount used comes off the stock (and is given back if the record is removed).
- **Costs** (owners): fuel, labour, machinery, other; supplier; optional field, animal group and season; **receipt photo or PDF** kept privately (`receipts` bucket).
- **Reports** (owners), each a table with a "Show graph" button (Recharts, colour-blind-safe series order):
  yield per field and season, cost and profit per field (income estimated from planning prices), fertiliser and chemicals used,
  costs by kind (stacked per season), spending by supplier, animal numbers over time (rebuilt from the count history),
  lambing and calving percentage, and a budget from editable planning figures.

### AI photo reader (done, needs an Anthropic API key)
- **Receipts:** on a cost, add a receipt photo and tap "Read the receipt for me (AI)": supplier, date, total, VAT and kind of cost are filled in for checking.
- **Old farm maps:** Fields → "Import from an old farm map": the AI lists the fields and camps with names, sizes (morgen converted to ha) and crops;
  tick, edit and add them in one go. "Lay it over the satellite map" shows the photo see-through on the map (free, no AI) so outlines can be traced.
- Runs in the Supabase function `read-photo` with Claude Opus 5.5 (structured JSON output; server-side fallback if a request is declined). Owners only.
  About US$0.04–0.06 per photo, billed by Anthropic to prepaid credit.
- **Setup:** create an API key at console.anthropic.com (Settings → API keys, add credit under Billing), then in Supabase:
  Edge Functions → Secrets → add `ANTHROPIC_API_KEY`. Never put the key in the app or the repository.

### Phase 6: grazing and minerals, rotation, offline entry, worker permissions (done)
- **Grazing & minerals** (Menu): pasture tests per camp (protein, P, Ca, Mg as % of dry matter), the animals grazing each camp,
  and supplement suggestions from editable advice rules (5 starting rules per farm, e.g. low phosphorus → phosphate lick,
  low magnesium for cattle → grass tetany risk). Always shown as advice to confirm with a vet or animal nutritionist.
- **Crop rotation advice** on each field page from its history: same crop repeated, long cereal runs, canola or lupins too soon; plus crops that could fit next season.
- **No signal:** changes made offline wait and are sent automatically when signal returns (a blue banner shows how many are waiting).
  The app must stay open until they are sent; reading recent data offline already worked.
- **Worker permissions** (Settings → People): per worker, switch on recording field work, animal events, tasks or pasture tests.
  Enforced by the database (`private.can`), not just the screens. Workers with animal permission can change a group's count and camp only.
  Workers never get access to sales, invoices, costs, customers or settings.
- Weather alerts (frost, heavy rain, strong wind, heat) were added with the weather update.

### Phase 7: farm records (done)
- **Rain gauge** (Menu, and + button): readings per day (several gauges averaged), last 7 days, month, year, % of earlier years, rain per month table/graph.
  Field pages show rain while the crop grew; Reports has "Rain and yield".
- **Profit per field**: invoice lines can be linked to a field and a season. The field page (owners) and Reports use real sales when linked, otherwise the harvest × planning price.
- **Spray conditions**: time, wind, gusts, direction, temperature and humidity on every spray record, filled in from the forecast for that hour
  (or typed in), with warnings for drift, heat, cold and dry air. Shown on the field page and in the export.
- **Map pins** (anyone): fence, water, erosion, weeds, animal, other, with a photo (private `pin-photos` bucket). Make a task from a pin, mark it dealt with, directions. Pins list in the Menu.
- **Export** (owners): Excel workbook (summary with VAT, costs, invoices, payments, field records, plantings, harvests, animal events, rain, fuel) or a one-page PDF summary,
  for the tax year, last tax year, a calendar year or any dates. Uses `write-excel-file`; files are shared or downloaded on the phone.
- **Head counts**: count a group in the veld; the app compares with the records and warns on the home screen when animals are missing.
- **Tractors & fuel** (anyone logs, owners add vehicles): fuel, services and repairs with meter readings, L/hour or L/100 km, service due warnings.
  Fuel from the farm tank comes off the store stock automatically (database trigger, so workers don't need store permission).

### Phase 8: team (done)
- **Team** (Menu): Schedule (week by day, who works where and when, copy last week, shows who is on leave), Staff and Leave tabs for owners; "My work" for workers.
- **Staff** records for everyone, also people without a phone: job, phone, ID number, address, emergency contact, start date, work days, leave rules, optional link to their app login.
  Personal details are visible to owners only; a worker sees only their own record (POPIA).
- **Leave**: workers ask (with a doctor's note or form attached), owners approve or decline with a note, or record leave themselves.
  Working days leave out weekends and SA public holidays. Balances follow the BCEA defaults (15 working days annual, 30 sick days per 3 years, 3 family days), editable per person.
- **Documents**: CVs, doctor's notes, leave forms, contracts, ID copies in the private `staff-docs` bucket (owner and that person only).
- **Work diary** ("what I did today") and **Done in the app**: everything a person recorded or ticked off, day by day, from the change history.
- **Messages**: private chats between two people (only they can read them) and **Everyone** broadcasts from owners. Live updates; unread count at the top.

### Phase 9: phone notifications and offline saving (done)
- **Notifications** (Settings → Phone notifications, per phone): new messages and broadcasts, leave requests and answers, tasks given to someone,
  and a 07:30 morning summary (tasks due, withholding ending, lambing / calving / shearing in a week or today, leave waiting;
  on Mondays low stock, services due, missing animals, open pins for owners). In English or Afrikaans as chosen in the app.
  Web Push from the Supabase function `notify`, called by database triggers and `pg_cron` through `pg_net`.
  The VAPID private key and the shared secret are in Supabase Vault (`farm_push_private`, `farm_notify_secret`), never in the code.
  iPhones need the app added to the home screen first.
- **Offline saving that survives closing the app**: rain, fuel, head counts, diary, ticking off tasks, map pins (without photo) and leave requests (without attachment)
  are kept on the phone without signal and sent by themselves later (new rows get their id on the phone, so nothing is saved twice).
  Anything the database refuses is shown at the top with "Try again" / "Throw away". Other forms still wait while the app stays open.
