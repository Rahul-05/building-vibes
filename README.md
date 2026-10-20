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

## Phase 2 notes
- **Normalize by building size.** Thresholds are absolute counts right now, so a 300-unit building looks worse than a 6-unit one with the same per-unit record. Pull unit counts from PLUTO (`64uk-42ks`, `unitsres`) or HPD Buildings and score per unit.
- **Shareable vibe card:** export to PNG (e.g. `html-to-image`) and add `?bbl=` deep links so a result can be shared without any server.
- **DOB category labels:** add the post-2021 codes once DOB publishes an updated list. Consider merging DOB ECB/OATH violations.
- **More context:** HPD litigation (`59kj-x8nc`), rent stabilization (DHCR), heat-season-only filtering for heat complaints, trend over time ("getting better/worse").
- **Accessibility pass** with real assistive-tech testing. Phase 1 has reduced-motion support, labeled controls, and a keyboard-navigable combobox.
- **Translations** (Spanish, Chinese, etc.) for UI copy and question templates.
- **Tests:** unit tests for `plainLanguage.js` and `scoring.js`, plus recorded API fixtures for the data layer.
- **Self-host fonts.** Phase 1 loads Bricolage Grotesque and DM Sans from Google Fonts, the one third-party request besides the city APIs.
- Out of scope by design: landlord portfolio mapping, tenant reviews, comments, accounts.
