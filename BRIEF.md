# Building Vibes — Phase 1 Build Brief

## What this is
A free, public-interest web tool for NYC renters, built for an Awesome Foundation NYC grant application (deadline Oct 31, 2026). A user types any NYC address and instantly sees that building's public record — housing violations, 311 complaints, building complaints, evictions — translated into plain language with green/yellow/red FLAGS (never verdicts like "walk away"), plus a character mascot whose mood reflects the record.

## Non-negotiables
- NO login, NO accounts, NO user data stored. Everything runs client-side.
- NO heavy verdicts. Never say "walk away", "don't sign", or give advice. Use flag language: green flags / yellow flags / red flags, plus "questions to ask the landlord".
- Every results view carries the line: "Based on public records, not advice."
- Do NOT build: landlord portfolio mapping, tenant reviews, comments, accounts.
- 100% free stack only.

## Stack
React + Vite + Tailwind CSS (v4) + GSAP for animation. Plain JavaScript (not TypeScript). Custom components only, no component libraries. Lucide icons via `lucide-react`.

## Design brief (this is the edge — take it seriously)
Artsy, colorful, bubbly, shapely — NOT sleek corporate. Vibrant campaign-poster energy: bold color blocks, playful rounded shapes, a character mascot. Buttery-smooth GSAP animations, celebratory micro-moments (e.g., confetti burst when a building's record is clean). Delightful but never crowded. Super-simple UX: one input, instant payoff. Mobile-first.

Mascot: an SVG blob/building character rendered as a React component with mood states driven by the data:
- `happy` (mostly green flags): bouncy idle animation, bright colors, sparkles
- `mixed` (yellow flags): curious tilt, one raised eyebrow
- `worried` (red flags): droopy, side-eye, sweat drop
Mood is computed from a simple transparent scoring of the fetched record (e.g., counts of open Class C violations, recent heat complaints, evictions). The mascot's mood + flag counts carry the "soft judgment" — the text stays informational.

## Data layer (NYC Open Data, Socrata API, NO key required — call from the browser)
1. Address → BBL: use the NYC GeoSearch API (https://geosearch.planninglabs.nyc/v2/search?text=<address>&size=1) — free, no key. Extract `properties.addendum.pad.bbl` (10-digit BBL: digit 1 = borough, next 5 = block, last 4 = lot).
2. HPD violations: https://data.cityofnewyork.us/resource/wvxf-dwi5.json — filter by boroid/block/lot (padded as in BBL). Fields: class (A/B/C), novdescription, currentstatus, inspectiondate. Focus on OPEN violations; Class C = immediately hazardous.
3. 311 service requests: https://data.cityofnewyork.us/resource/erm2-nwe9.json — filter by `bbl` and recent dates; group by complaint_type (HEAT/HOT WATER, pests, PLUMBING, etc.).
4. DOB complaints: https://data.cityofnewyork.us/resource/eabe-havv.json — filter by bin or address fields available; if the schema differs, verify against the Socrata catalog API (https://data.cityofnewyork.us/api/1/metadataset/eabe-havv) and adapt.
5. Evictions: https://data.cityofnewyork.us/resource/6z8x-wfk4.json — verify schema via the catalog API and filter by address/bbl fields available; if it can't be reliably filtered by building, SKIP evictions in Phase 1 and note it in your summary.

Keep queries bounded ($limit, $where on the building + recent years) so responses stay fast. Handle "no records found" and "address not found" gracefully with friendly UI states.

## Phase 1 scope (build ONLY this)
1. Vite + React + Tailwind scaffold in this directory.
2. Landing view: big bubbly headline, ONE address input with autocomplete-lite (debounced GeoSearch suggestions are a bonus, not required), mascot in happy idle state.
3. Results view: mascot with computed mood (animated transition), flag summary (green/yellow/red counts with plain-language reasons), sections for violations / 311 complaints / DOB complaints with the most telling items in plain language (translate violation descriptions minimally: strip codes, sentence-case), "Questions to ask the landlord" (generated from the top red/yellow flags via templates), disclaimer line, shareable vibe card summary block (static visual for now — a styled card with address, mood, flag counts).
4. Loading state with playful animation; error/empty states.
5. A `src/data/` module isolating all Socrata/GeoSearch calls.
6. README.md: what it is, how to run, dataset IDs used + verification date, Phase 2 notes.

## Verify before finishing
- `npm install` then `npm run build` must succeed.
- Test the data layer against one real address with known records (e.g., a large Manhattan rental building) using curl against the same Socrata queries the app makes, and confirm non-empty results.
- In your final summary: list files created, dataset IDs actually used (and any you dropped + why), and the build result.

Keep the code modular and commented lightly. This is Phase 1 of several — clean seams matter more than completeness.
