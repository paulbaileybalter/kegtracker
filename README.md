# Balter Brewing — Keg Tracker

Replaces the "2026 Keg Tracking Platform" tab of the keg movements
spreadsheet. Built in the same visual design system as the Logistics Daily
Handover and Production Plan Attainment sites (gradient topbar, Lexend
typeface, top-accent cards, tabbed sections, date banner, data tables,
email-preview modal, optional multi-device sync, decorative rising-bubbles
background).

**This version tracks day-by-day, exactly like the Excel sheet** — Opening
Inventory, Packaging, and Inbounds for every day Monday→Sunday, chained
day-by-day and week→week, with a Daily Total Stock On Hand row that carries
forward automatically. The order output is the same day-by-day delivery
list you currently send to CUB (weekday, date, "1 Load", "Backload"), not a
weekly summary.

## Files

- `index.html` — page structure
- `style.css` — shared design system (brand colours, cards, tables, buttons,
  modal, plus the daily-tracking grid and delivery-list components)
- `app.js` — calculation and interaction logic
- `config.js` — cloud sync settings (optional overrides only — see "Multi-
  device sync" below)
- `worker.js` — Cloudflare Worker entry point; serves the static site and
  backs multi-device sync via Cloudflare KV (`/api/keg-state`)
- `wrangler.toml` — Worker configuration (name, static-asset binding, KV
  namespace binding)
- `bubbles.js` — decorative background effect (skips itself under
  prefers-reduced-motion)
- `manifest.json` — home-screen icon metadata
- `fonts/lexend-latin-wght-normal.woff2` — self-hosted Lexend, used across
  all three Balter Brewing tools
- `assets/favicon.svg`, `favicon-16.png`, `favicon-32.png`,
  `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `email-logo.png` —
  your Smiley Box brand assets; `email-logo.png` is embedded (base64) into
  the generated order email itself, since inline SVG isn't reliable across
  email clients

## How it works

### 01 · Stock on hand
Enter the kegs counted at this week's stocktake. This is the same value as
the "Opening inventory" cell for your stocktake date in the Daily tracking
grid below — they're linked.

### 02 · Daily tracking
A week block per week, each with a Monday–Sunday (or partial, for the
current week) grid of:
- **Opening inventory** — carries forward automatically from the prior day's
  closing stock. If an actual recount on any day differs from the
  projection, just type over that cell — exactly like overwriting a formula
  in Excel. Everything after it re-chains from your override.
- **Packaging** — kegs packaged that day. Type it in, or drop the Live
  Brewery Board workbook on the import zone above the grid to fill it in
  automatically (see "Live Brewery Board import" below).
- **Inbounds** — kegs arriving that day. Leave blank and use **Auto-suggest
  deliveries** (in the Delivery schedule card) to have the tool propose
  which day(s) each week's loads should land on to keep the week's closing
  stock at target — or type over any cell to set it yourself.
- **Daily total stock on hand** — computed, highlighted red if it's below
  target for that day, green if at/above.

Each week block also has a Weekly Notes field, matching the spreadsheet.

#### Live Brewery Board import
Drop the Live Brewery Board workbook (the one with a `WC <date>` tab per
week, a "Date" header row, and a "Kegs" row block) onto the dashed zone at
the top of this card, or click it to choose the file. It's read entirely
in your browser (nothing is uploaded anywhere) and:
- scans every tab for a "Date" row and the "Kegs" row block beneath it —
  it doesn't matter which tab a given week lives in or how it's named,
  since dates are read directly from the sheet rather than guessed from
  the tab title;
- for each day, sums every quantity in that day's Kegs block — a plain
  number, or the number following an **"NZ EX ##"** export tag (those kegs
  still come out of the same physical pool, so they count too);
- fills that total into the day's **Packaging** cell for any day currently
  shown in the Daily tracking grid — but only if that cell is still blank,
  so it never overwrites something you've typed in yourself. Clear a cell
  first if you want it re-imported after an updated board export.

### 03 · Delivery schedule
The day-by-day order list — exactly the format you send to CUB. Shows every
weekday across the 4-week window, with "1 Load" (or more) on days with an
inbound quantity, and a Backload tag on the delivery that lands on your
configured cadence (every 3rd delivery by default).

**Confirm & log this week's order** records this week's real load count and
backload flag in Order History, advances the backload counter, and rolls the
stocktake date forward to next Wednesday — the daily ledger itself doesn't
shift, since every day is stored by its actual calendar date, so nothing is
lost or duplicated as weeks roll on.

### 04 · Settings
Kegs per load (560, editable), target stock at week's end (1000), the hard
floor — never drop below (900), the soft ceiling (1500, flexible) and hard
ceiling — never exceed (2000), backload cadence (every 3, editable), the
running delivery counter, and your supplier/sender details for the email.

**Auto-suggest deliveries** follows these rules:
- Never drop below 900 kegs on hand at any point.
- Close each week as close to 1000 as possible, without exceeding 2000 at
  any point (and preferring to stay under the softer 1500 ceiling where
  that's achievable without breaching the floor).
- Deliveries land Monday–Thursday by default; Friday is only used as a
  fallback when no Mon–Thu day is available in time to prevent a breach or
  hit the target.
- Every suggested delivery is a full load (560, editable) — it never
  proposes a partial amount. If a real delivery ever comes in at a
  different quantity, just edit that day's Inbound cell by hand.
- It never touches "This week (remaining)" — those deliveries are already
  locked in from previous orders — and never overwrites a day you've
  already entered a number into yourself.

### 05 · Order history
Log of confirmed weekly orders.

### Build order email
Renders the Delivery schedule list as a formatted email (same layout as your
current CUB order), with **Copy formatted email** (paste into Outlook/Gmail
with formatting intact), plain-text copy, or download as an image.

## Password protection

The whole site (pages and the sync API) sits behind one shared password,
enforced by `worker.js`. The password is **never stored in the repo** — it's
a Worker secret:

1. Cloudflare dashboard → **Workers & Pages → kegtracker → Settings →
   Variables and Secrets → Add** → type **Secret**, name **`SITE_PASSWORD`**,
   value = your chosen password → Deploy.
2. To change it later, edit that secret. Changing it signs everyone out.

Sessions last 30 days per device; **Sign out** is in the top bar. Until the
secret is set the site stays locked (shows a setup message). After 10 wrong
attempts from one IP, logins are paused for 15 minutes. Use a long password
or passphrase.

## Multi-device sync — Cloudflare KV

Syncs the office laptop, your phone, and the warehouse tablet automatically
— no account or API key to create. It's handled by this project's own
Cloudflare **Worker** (`worker.js`), which serves the site itself and also
runs the `/api/keg-state` route backed by a Cloudflare KV namespace. If the
KV binding isn't set up yet, every sync call just fails harmlessly and the
tool keeps working perfectly well as a single-device, localStorage-only
sheet.

No setup needed: `wrangler.toml` declares the `KEG_KV` binding without an
id, so Wrangler creates the KV namespace automatically on the first deploy
and reuses it afterwards (needs Wrangler 4.45 or newer, which Cloudflare's
build uses by default).

After that, every device that opens the site reads and writes the same KV
key, polling for changes every ~15 seconds and whenever the tab regains
focus — the "Save status" pill shows **Synced across devices** once it's
confirmed the connection; until then it shows **Saved to this device**,
which just means it hasn't reached the KV endpoint yet.

Use a **separate KV namespace** from any other Balter Brewing tool — don't
point two tools at the same one, or they'll overwrite each other's data.

## Deploying

### Cloudflare Workers (recommended — enables multi-device sync)
This site deploys as a **Worker with static assets**, not a classic Pages
project — `worker.js` + `wrangler.toml` are the pieces that make that work.

1. Via Wrangler CLI: from this folder, run `npx wrangler deploy` (installs
   Wrangler on first run if needed). Before your first deploy, check
   `wrangler.toml` — `name` should match the Worker name you want (it
   becomes `<name>.<your-subdomain>.workers.dev`).
2. Or, if deploying through a Git-connected Cloudflare build pipeline,
   the **Deploy command** in that project's **Settings → Builds &
   deployments** must be `npx wrangler deploy` (the default) — do **not**
   use `wrangler pages deploy`, which is for classic Pages projects only.
3. Multi-device sync turns itself on — the KV namespace is created
   automatically on first deploy.

### Netlify
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the whole site folder onto the page, **excluding `worker.js` and
   `wrangler.toml`** (Netlify can't run either) — if you're redeploying
   over an existing site, drag onto that site's own deploy page (or delete
   the old deploy first) so old files don't linger
3. Netlify gives you a live URL immediately — this works great for a single
   device, but multi-device sync needs the Cloudflare Worker above, since
   Netlify can't run `worker.js`

Nothing needs building — static files only. If you deployed an earlier
version of this tool already, make sure this folder fully replaces the old
one on your host rather than being added alongside it, or the browser may
keep serving cached old files.

## Notes for next iteration

- "Auto-suggest deliveries" fills in any blank inbound cell, day by day,
  within a week — it never overwrites a day you've already entered
  something into, but it won't skip the rest of a week just because one
  day in it already has a value. Clear a cell to let it be recomputed.
- The email template lives in `buildEmailHtml` / `buildEmailPlain` in
  `app.js` if you want to tweak wording or add a PO field.
- The Live Brewery Board import only fills **Packaging** — Stock on hand is
  still your Wednesday stocktake count, entered by hand, since that's not a
  number the board itself carries.
- If the Live Brewery Board's layout ever changes (a renamed "Kegs"/"Date"
  row label, or a different number of columns per weekday), the parser in
  `extractKegsByDate` in `app.js` is the place to adjust — it locates things
  by label and merged-cell span rather than hardcoded row numbers, so small
  layout shifts (extra staffing rows, etc.) shouldn't break it, but a
  structural change to the weekly tab layout would need a matching tweak
  here.
