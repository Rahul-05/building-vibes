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

## Flag rules (Phase 1)
See `RULES` in `src/lib/scoring.js`. They're shown verbatim in the app. In summary:
- Open Class C violations: 3+ red, 1–2 yellow, 0 green. Open Class B: 10+ yellow.
- Lead-paint mentions in open violations: red. Pest or mold mentions: yellow.
- Heat/hot-water 311 complaints in 2 yrs: 10+ red, 3–9 yellow, 0 green. Plumbing/leaks 10+ yellow. Elevator 5+ yellow.
- Active DOB complaints about safety or upkeep: yellow. No DOB complaints in 3 yrs: green.
- Residential evictions in 5 yrs: 6+ red, 2–5 yellow, 0 green.
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
- **More context:** HPD litigation (`59kj-x8nc`), rent stabilization (DHCR), heat-season-only filtering for heat complaints, trend over time ("getting better/worse").
- **Accessibility pass** with real assistive-tech testing. Phase 1 has reduced-motion support, labeled controls, and a keyboard-navigable combobox.
- **Translations** (Spanish, Chinese, etc.) for UI copy and question templates.
- **Tests:** unit tests for `plainLanguage.js` and `scoring.js`, plus recorded API fixtures for the data layer.
- **Self-host fonts.** Phase 1 loads Bricolage Grotesque and DM Sans from Google Fonts, the one third-party request besides the city APIs.
- Out of scope by design: landlord portfolio mapping, tenant reviews, comments, accounts.
