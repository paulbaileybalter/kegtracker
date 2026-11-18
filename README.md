# Balter Brewing — Keg Ordering Portal

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
- `config.js` — optional cloud sync settings (disabled by default)
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
- **Packaging** — kegs packaged that day (manual entry).
- **Inbounds** — kegs arriving that day. Leave blank and use **Auto-suggest
  deliveries** (in the Delivery schedule card) to have the tool propose
  which day(s) each week's loads should land on to keep the week's closing
  stock at target — or type over any cell to set it yourself.
- **Daily total stock on hand** — computed, highlighted red if it's below
  target for that day, green if at/above.

Each week block also has a Weekly Notes field, matching the spreadsheet.

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
- Loads are flexible, not rigid multiples of 560 — a delivery is trimmed
  down to exactly what's needed (rounded to the nearest 10 kegs) whenever
  less than a full load gets the job done, so you don't see a big
  unnecessary overshoot on the last top-up of a week.
- It never touches "This week (remaining)" — those deliveries are already
  locked in from previous orders — and never overwrites a day you've
  already entered a number into yourself.

### 05 · Order history
Log of confirmed weekly orders.

### Build order email
Renders the Delivery schedule list as a formatted email (same layout as your
current CUB order), with **Copy formatted email** (paste into Outlook/Gmail
with formatting intact), plain-text copy, or download as an image.

## Multi-device sync (optional)

Off by default. To sync across the office laptop, your phone, and the
warehouse tablet, open `config.js` and follow the instructions inside:
create a free JSONBin.io bin, paste the Bin ID and API key, set
`enabled: true`. Use a separate bin from the Logistics Daily Handover sheet.

## Deploying

### Netlify
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the whole `balter-keg-ordering` folder onto the page — **if you're
   redeploying over an existing site, drag the folder onto that site's own
   deploy page (or delete the old deploy first)** so old files don't linger
3. Netlify gives you a live URL immediately

### Cloudflare Pages
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Upload
   assets**
2. Upload the contents of this folder
3. Deploy

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
- **Planned: drag-and-drop import from the Live Brewery Board.** The goal
  is to drop that export straight onto the Daily tracking card and have it
  auto-fill Packaging (and Stock on hand) for the coming three weeks,
  the same way the Production Plan Attainment dashboard reads an uploaded
  workbook client-side (via SheetJS) — nothing would be sent anywhere, it's
  all read in the browser. This needs a sample export of the Live Brewery
  Board's actual file format (column layout, sheet names, date format)
  before it can be built correctly, since guessing the structure risks
  silently mis-mapping numbers.
