# Building Vibes

A free, public-interest web tool for NYC renters. Type any NYC address and you get that building's public record (housing violations, 311 complaints, Department of Buildings complaints, evictions) in plain language, sorted into **green / yellow / red flags**. A building-blob mascot's mood reflects the record.

**Based on public records, not advice.** The tool shows what the city has on file. It doesn't tell anyone whether to rent.

- No login, no accounts, nothing stored. Everything runs in the browser.
- All data comes from free, keyless, CORS-enabled public APIs.
- Stack: React 19 + Vite + Tailwind CSS v4 + GSAP, plain JavaScript, `lucide-react` icons. No component libraries.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the build
```

`dist/` is a static site, so it can go on any free static host (GitHub Pages, Netlify, Cloudflare Pages).

## How it works

```
address text ──► NYC GeoSearch ──► BBL + BIN
                                     │
          ┌──────────────┬───────────┼──────────────┬──────────────┐
          ▼              ▼           ▼              ▼              │
   HPD violations   311 requests  DOB complaints  Evictions        │  (parallel, each
   (boro/block/lot)  (bbl)         (bin)          (bbl)            │   can fail alone)
          └──────────────┴───────────┴──────────────┘              │
                                     ▼                             │
                     src/lib/scoring.js → flags + mascot mood ◄────┘
                     src/lib/questions.js → questions to ask the landlord
```

### Code layout

| Path | What it is |
|---|---|
| `src/data/` | **All network calls.** UI code imports only from `src/data/index.js`. |
| `src/data/config.js` | Endpoints, dataset IDs, lookback windows. |
| `src/data/http.js` | `fetch` wrapper: timeout, one retry on 429/5xx/timeout, SoQL URL builder. |
| `src/data/geosearch.js` | Address → place (`bbl`, `bin`, borough/block/lot); autocomplete suggestions. |
| `src/data/hpd.js`, `complaints311.js`, `dob.js`, `evictions.js` | One module per dataset, each returns a small normalized object. |
| `src/data/aep.js`, `bedbugs.js`, `litigations.js`, `vacateOrders.js`, `ownership.js`, `sales.js` | Phase 3 "Deeper record" sources, same pattern. |
| `src/data/pluto.js`, `history.js` | Phase 4: PLUTO building facts; violation and 311 history for the trend and fix rate. |
| `src/data/benchmarks.json`, `benchmarks.js` | Phase 4: committed borough benchmark snapshot (built by `scripts/build-benchmarks.mjs`) and its `benchmarksMeta`. |
| `src/lib/insights.js` | Phase 4: apartment count, borough comparison, trend, fix rate (context only, never flags). |
| `src/data/dobCategories.js` | DOB complaint category code → description (from DOB's official list). |
| `src/lib/scoring.js` | Transparent flag rules + mood. The same rule text is shown in the UI under "How we pick flags". |
| `src/lib/plainLanguage.js` | Strips legal citations from HPD text, sentence-cases it, labels 311 types. |
| `src/lib/questions.js` | Question templates keyed by flag id. |
| `src/components/` | Mascot, search, loading, results sections, vibe card, confetti, backdrop. |

## Datasets (schemas verified 2026-10-20)

| Dataset | ID | Filter used | Window |
|---|---|---|---|
| NYC GeoSearch (Planning Labs) | `geosearch.planninglabs.nyc/v2` | `search?text=…&size=1` → `properties.addendum.pad.bbl` / `.bin` | n/a |
| HPD Housing Maintenance Code Violations | `wvxf-dwi5` | `boroid`, `block`, `lot` (numeric columns) + `violationstatus='Open'` | open (any age); totals over last 5 yrs |
| 311 Service Requests from 2010 to Present | `erm2-nwe9` | `bbl` + `created_date`, grouped by `complaint_type` | last 2 yrs |
| DOB Complaints Received | `eabe-havv` | `bin` | last 3 yrs (filtered client-side) |
| Evictions | `6z8x-wfk4` | `bbl` + `residential_commercial_ind='Residential'` + `executed_date` | last 5 yrs |

All four datasets were used; none were dropped.

Verified against 1520 Sedgwick Ave, Bronx (BBL 2028800017, BIN 2009171), which returned non-empty results from every source.

### Schema notes and quirks
- **The brief's catalog URL `/api/1/metadataset/<id>` returns 404.** Use `https://data.cityofnewyork.us/api/views/<id>.json` to get column names and types.
- **HPD `block`/`lot` are numeric columns.** Padded and unpadded values both match. We send them unpadded, as numbers.
- **DOB `date_entered` is MM/DD/YYYY *text***, so SoQL can't range-filter it. We fetch the newest 300 complaints for the BIN (ordered by `complaint_number`, which is fixed-width) and filter by date in JS.
- **DOB `complaint_category` is a code.** Labels come from DOB's official "Complaint Categories" PDF (Rev. 9/21, https://www.nyc.gov/assets/buildings/pdf/complaint_category.pdf). Some codes in current data (e.g. `2V`) are newer than that list, so they show a generic label.
- **GeoSearch sometimes returns placeholder "million BINs"** (`1000000`, `3000000`…) for lots without a real building. We treat these as "no BIN" and skip DOB, because querying one would match unrelated buildings.
- GeoSearch can resolve ambiguous text to the wrong borough (e.g. "75 West End Ave Manhattan" → Brooklyn). The results page shows the resolved address and borough. Autocomplete suggestions help users pick the right one.
- The 311 data includes street-level complaints (noise, parking) tied to the BBL. Those are counted separately as "neighborhood" and don't affect flags. Housing complaints are the HPD-routed types (uppercase in the data) plus a short list in `plainLanguage.js`.
- Pest, mold, and lead keyword checks scan the 60 most severe open violations that we fetch. When a building has more open violations than that, the flag text says so.

## Phase 3: the Deeper record (schemas verified 2026-10-20)

Six more sources, shown in a "Deeper record" area on the results page (building status, court cases, bedbugs, ownership & last sale) and added to the AI summary. Each one is fetched in parallel with the others and can fail on its own.

| Dataset | ID | Join used | Notes |
|---|---|---|---|
| Buildings Selected for the Alternative Enforcement Program | `hcir-3275` | `bbl` (numeric column), narrowed by `bin` | `current_status` is `AEP Active` or `AEP Discharged`; `aep_round`, `aep_start_date`, `discharge_date` |
| Bedbug Reporting | `wz6d-d3jb` | `bbl` (**text** column), narrowed by `bin` | Annual landlord filings. The end-date column really is spelled `filling_period_end_date`. |
| Housing Litigations | `59kj-x8nc` | `boroid` + `block` + `lot`, narrowed by `bin` | `casestatus` mostly `CLOSED`/`PENDING` (plus a few `GRANTED - <date>`, `Rejected-`, ...); `findingofharassment` is `No Harassment`, `After Inquest`, or `After Trial` |
| Order to Repair/Vacate Orders | `tb8q-a3ar` | `bbl` (numeric), narrowed by `bin` | `vacate_type` is `Entire Building` or `Partial`; lifted = `actual_rescind_date` on or before today |
| Multiple Dwelling Registrations | `tesw-yqqr` | `boroid` + `block` + `lot`, then must match `bin` (or be the lot's only building) | Newest `lastregistrationdate` wins |
| Registration Contacts | `feu5-w2e2` | `registrationid` | Owner = `CorporateOwner`/`IndividualOwner`/`JointOwner`; plus `Agent` and `HeadOfficer`. **Names only**: contact addresses are never selected. |
| ACRIS Real Property Legals | `8h5j-fqxa` | `borough` + `block` + `lot` → `document_id` | Found via the Socrata catalog API |
| ACRIS Real Property Master | `bnx9-e6tj` | `document_id in (...)` (batches of 120) + `doc_type` in `DEED`, `DEEDO`, `DEED, RC`, `DEEDP` | Most recent deed's `document_date` + `document_amt`. Also shows the last deed with a non-zero price, since many recent deeds are $0 transfers. |

Live checks, 2026-10-20:

| Source | 1520 Sedgwick Ave, Bronx (2028800017) | 1631 Grand Ave, Bronx (2028660020) |
|---|---|---|
| AEP | never listed | **AEP Active**, Round 18, since Jan 31 2025 (1,829 B/C violations at start) |
| Bedbugs | filing for Nov 2024–Oct 2025: 0 of 102 units infested | filing for Nov 2024–Oct 2025, amended Aug 19 2026: **14 of 42** infested (an earlier filing for the same period said 0) |
| Litigations | 32 cases all time, 10 opened in last 5 yrs, 1 pending (heat & hot water, May 2026) | 14 all time, 3 in last 5 yrs, 0 pending |
| Vacate orders | 1 partial (fire damage, 3 units), Nov 2022, rescinded Feb 2024 | none |
| Owner / agent | WFHA 1520 SEDGWICK LP / M H R MANAGEGEMENT INC (sic) | CAP 1631 Grand Ave Property Owner LLC / CAM Property MGMT |
| Last deed | Jun 28 2012, $0; last priced: Feb 16 2012, $363,572 (referee's deed) | Jul 26 2022, $0; last priced: Jul 18 2017, $6,990,000 |

The ACRIS join was cross-checked with the Parties dataset (`636b-3b5g`). In both buildings, the grantee on the deed is the same company HPD lists as the current owner.

### Phase 3 quirks
- **The `bbl` column type differs between datasets** (number in AEP and vacate orders, text in bedbugs and litigations). Each module quotes it to match.
- **Litigation `bbl`/`bin` are blank on 318 rows**, but `boroid/block/lot` are never blank, so we join on those. In every Phase 3 dataset, rows with a blank `bbl` also have a blank `bin`, so BIN can't fill that gap. BIN is used to pick out this building on lots that hold several (`preferBin` in `http.js`). If no row matches the BIN, the lot's rows are shown and labeled "another building on the same tax lot". Ownership is left out in that case rather than guessed.
- **Bedbug filings get amended.** The newest `filing_date` wins, even when the reporting period is the same.
- **HPD registration end dates** in the current extract (e.g. 2026-09-01) can be earlier than today because the dataset updates less often than renewals happen. We show "last filed" and make no claim about whether a registration has expired.
- **Condo buildings**: ACRIS records deeds against each unit's own lot, not the building's billing lot, so the last-sale line usually doesn't appear for condos.
- **No portfolio features.** Owner and agent names are shown for this building only and are never used to look up other buildings.

## Phase 4: Smarts (schemas verified 2026-10-20)

| Dataset | ID | Filter used | Notes |
|---|---|---|---|
| PLUTO (Primary Land Use Tax Lot Output) | `64uk-42ks` | numeric `bbl` | `unitsres`, `unitstotal`, `yearbuilt`, `bldgclass`, `numbldgs`; version 26v2. One row per tax lot; 0 means unknown. |

- **Building facts** in the header: "Built 1969 · 101 apartments" (plus "across N buildings on this tax lot" when PLUTO lists more than one).
- **Per apartment scoring.** Where PLUTO has `unitsres`, the Class C red, Class B, heat, plumbing and eviction thresholds also need a rate of at least 1 for every N apartments (`EVERY` in `scoring.js`). Small buildings clear the rate as soon as they clear the count, so nothing changes for them; big buildings aren't flagged for size alone. Elevator, court cases, DOB and the city lists stay plain counts. No apartment count (or PLUTO down) means the plain thresholds, and the explainer says which basis was used.
- **How it compares.** `node scripts/build-benchmarks.mjs` (about 2 minutes) pages through every PLUTO lot with residential units (767,563) and HPD open Class A/B/C violations grouped by `bbl` (147,504 lots), joins them on BBL (98.6% of open violations land on a residential lot), and writes per borough, per size group (1 to 2 apartments, 3 or more) percentiles and deciles of open violations per apartment, all classes and Class C. The app reads the snapshot; nothing is computed against the whole city at runtime. Current snapshot: 2026-10-20. Rerun the script to refresh it.
- **Trend** (`trendFor`): HPD violations issued plus building related 311 complaints, last 12 full months against the 12 before, and a per year sparkline over 5 years.
- **Fix rate** (`fixRateFor`): share of the last 5 years' violations marked closed, median days from notice to close (`currentstatusdate` minus `novissueddate`), open violations older than a year.
- **Compare mode**: pin up to 3 buildings into a tray held in React state only (no storage); "View comparison" shows a factual side by side table (stacked cards on phones). No winner.
- Network errors (dropped connections) now get the same single retry as timeouts, since a lookup makes more requests than before.

## Flag rules (Phase 1)
See `RULES` in `src/lib/scoring.js`. They're shown verbatim in the app. In summary:
- Open Class C violations: 3+ red, 1–2 yellow, 0 green. Open Class B: 10+ yellow.
- Lead-paint mentions in open violations: red. Pest or mold mentions: yellow.
- Heat/hot-water 311 complaints in 2 yrs: 10+ red, 3–9 yellow, 0 green. Plumbing/leaks 10+ yellow. Elevator 5+ yellow.
- Active DOB complaints about safety or upkeep: yellow. No DOB complaints in 3 yrs: green.
- Residential evictions in 5 yrs: 6+ red, 2–5 yellow, 0 green.
- Phase 3: currently in AEP → red. Vacate order not lifted → red (yellow for both if the record is for another building on the same lot). HPD court cases opened in 5 yrs: 15+ red, 5–14 or any pending yellow, 0 green. Harassment finding in 5 yrs → red. Latest bedbug filing (reporting year ended within 2 yrs): 5+ infested units or 10%+ of units red, 1+ yellow. A missing or zero filing never counts as green.
- Phase 4: where the apartment count is known, the Class C red, Class B, heat, plumbing and eviction thresholds also need a minimum rate per apartment (see above).
- Mascot mood: 2+ red or 4+ yellow → worried. 1 red or 2–3 yellow → mixed. Otherwise happy.

## Phase 2: AI building story + Q&A

Two additions to the results page:
- **This building's story**: 2–3 short, plain paragraphs about the record, ending with "This is public-record information, not advice." While it loads, the section shows a bubbly loading state. If the AI helper is slow (20s timeout), down, or not configured, it quietly shows a template sentence instead (`templateStory` in `src/lib/summary.js`).
- **Ask about this building**: a text box plus three suggested questions. The mascot answers in a speech bubble. Answers use only the record on the page, and when the record doesn't cover something it says "The public record I have doesn't mention that."

### Architecture

```
browser (GitHub Pages)                    Cloudflare Worker                 Gemini API
  record from NYC Open Data  ──►  POST /story { address, summary }  ──►  gemini-2.5-flash
  buildSummary() (~3 KB)          POST /ask   { address, summary,        (key stays in the
                                               question }                 Worker as a secret)
```

- The browser still fetches all NYC data itself. The Worker **never** calls NYC APIs. It only gets the compact summary from `src/lib/summary.js`: flag counts and reasons, open/total HPD violations with the top plain-language issues, 311 complaint themes, DOB counts, and eviction counts. No user data.
- The Gemini API key lives only in the Worker as a secret. It is not in the frontend, the repo, or `wrangler.toml`.
- The system instruction keeps the model to the summary, to flag language, and away from verdicts or advice. As a backstop, the Worker rejects any output containing "avoid", "walk away", "don't rent", "safe", "unsafe", or "good/bad building" (quoted official record names are exempt). The frontend then shows its fallback.
- Worker guards: POST only (405), CORS for `https://rahul-05.github.io` and `http://localhost:5173` only (other origins get 403), body up to 16 KB (413), missing fields (400), questions up to 300 characters, any upstream failure → 502 JSON. Payloads and model output are never logged.

| Path | What it is |
|---|---|
| `worker/src/index.js` | The Worker: `/story`, `/ask`, CORS, guards, Gemini call. |
| `worker/wrangler.toml` | Worker config (`building-vibes-ai`). No secrets. |
| `src/lib/summary.js` | `buildSummary(record, scored)` → compact summary; `templateStory()` fallback. |
| `src/data/ai.js` | `fetchStory(summary)`, `askBuilding(summary, question)`. 20s timeout, throws on non-200. |
| `src/components/BuildingStory.jsx`, `AskBuilding.jsx` | The two new results sections. |

### Deploy the Worker

```bash
cd worker
npx wrangler login                        # once
npx wrangler secret put GEMINI_API_KEY    # paste a key from https://aistudio.google.com/apikey
npx wrangler deploy                       # prints https://building-vibes-ai.<subdomain>.workers.dev
npx wrangler deploy --dry-run             # validate without deploying (no login needed)
```

Then set `WORKER_URL` in `src/data/config.js`. Replace `PLACEHOLDER` in this line with your workers.dev subdomain, then rebuild and redeploy the site:

```js
export const WORKER_URL = 'https://building-vibes-ai.PLACEHOLDER.workers.dev'
```

While the URL still contains `PLACEHOLDER`, the frontend skips the network call and uses the template fallbacks, so the site works before the Worker exists.

Smoke test (the Worker requires an allowed `Origin`):

```bash
curl -s https://building-vibes-ai.<subdomain>.workers.dev/ask \
  -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' \
  -d '{"address":"1520 Sedgwick Ave, Bronx","summary":{"flagCounts":{"red":1,"yellow":0,"green":2}},"question":"Anything recent?"}'
```

If the site moves off `rahul-05.github.io`, update `ALLOWED_ORIGINS` in `worker/src/index.js`.

### Free-tier notes
- **Cloudflare Workers free plan:** 100,000 requests/day and 10 ms CPU per request. Time spent waiting on Gemini doesn't count as CPU, so this Worker stays well inside the limit.
- **Gemini API free tier** (`gemini-2.5-flash`): Google applies per-minute and per-day rate limits per project, and they change over time (check https://ai.google.dev/gemini-api/docs/rate-limits). When the limit is hit, Gemini returns 429, the Worker returns 502, and the page falls back quietly. Thinking is turned off (`thinkingBudget: 0`) and outputs are short, which keeps token use low. Note that free-tier prompts may be used by Google to improve its products. The summary contains only public records.
- One story request per results view, plus one request per question asked.

## Phase 2 notes (backlog)
- **Normalize by building size.** Thresholds are absolute counts right now, so a 300-unit building looks worse than a 6-unit one with the same per-unit record. Pull unit counts from PLUTO (`64uk-42ks`, `unitsres`) or HPD Buildings and score per unit.
- **Shareable vibe card:** export to PNG (e.g. `html-to-image`) and add `?bbl=` deep links so a result can be shared without any server.
- **DOB category labels:** add the post-2021 codes once DOB publishes an updated list. Consider merging DOB ECB/OATH violations.
- **More context:** rent stabilization (DHCR), heat-season-only filtering for heat complaints, trend over time ("getting better/worse").
- **Accessibility pass** with real assistive-tech testing. Phase 1 has reduced-motion support, labeled controls, and a keyboard-navigable combobox.
- **Translations** (Spanish, Chinese, etc.) for UI copy and question templates.
- **Tests:** unit tests for `plainLanguage.js` and `scoring.js`, plus recorded API fixtures for the data layer.
- **Self-host fonts.** Phase 1 loads Bricolage Grotesque and DM Sans from Google Fonts, the one third-party request besides the city APIs.
- Out of scope by design: landlord portfolio mapping, tenant reviews, comments, accounts.
