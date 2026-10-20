# Building Vibes — Phase 3 Brief: the Data Pack (user's pick, Oct 20)

Phases 1–2 are live (record lookup + flags + mascot + AI story/Q&A via the Worker). Read BRIEF.md for the standing product rules — they still bind: flags never verdicts, plain language, "based on public records, not advice", no login, no stored user data, free everything, partial failures degrade quietly per-source.

## Goal
Add six public-record sources to every building's page, joined by BBL (BIN as fallback), each verified against the dataset's REAL schema before use (`https://data.cityofnewyork.us/api/views/<id>.json`). If a join proves unreliable for a source, ship without that source and say so plainly in your final summary — never fake or approximate a join (Phase 1 dropped nothing, but honesty beats coverage).

## The six sources
1. **AEP list** — `hcir-3275` (Buildings Selected for the Alternative Enforcement Program). Is this building on the city's worst-conditions list, and for which period/cycle? This is the loudest single signal in the pack.
2. **Bedbug reports** — `wz6d-d3jb` (Bedbug Reporting). Landlord-filed annual reports: latest filing period, number of infested units / units reported, whether a filing exists at all. Phrasing care: "no report found" is neutral information, NOT a green flag (larger buildings are required to file).
3. **Housing litigations** — `59kj-x8nc` (Housing Litigations). Count of HPD litigation cases for the building, open vs closed if the schema supports it, most recent case date/type in plain language where mappable.
4. **Vacate orders** — `tb8q-a3ar` (Order to Repair/Vacate Orders). Any vacate/repair orders, dates, and current status if present; distinguish full vs partial if the data carries it.
5. **Owner & agent** — `tesw-yqqr` (Multiple Dwelling Registrations) + `feu5-w2e2` (Registration Contacts). The legal owner's name and the managing agent/head officer from the current registration. Names only — do NOT build portfolio/“other buildings by this owner” features (explicit product rule).
6. **Last sale (ACRIS)** — find the right ACRIS datasets via the Socrata catalog (Real Property Master / Legals / Parties family), join deeds to this BBL, and extract the most recent sale: date + amount (and deed type if clean). ACRIS is the most complex join here — verify carefully against a known building; if it isn't reliable, drop sales only and report that.

## Integration
- **Data layer:** one new module per source under `src/data/`, same patterns as the existing modules (config, http, partial-failure tolerance, one retry). Wire into the existing record assembly in `src/data/index.js`.
- **Scoring (`src/lib/scoring.js`):** extend conservatively in the existing style. Floors: current AEP listing and any vacate order not clearly lifted/rescinded are red-flag tier. Litigation count and bedbug infestation counts feed yellow/red by sensible thresholds — document every new rule in the in-app "How we pick flags" text exactly as the code implements it.
- **UI:** add a “Deeper record” area to the results view in the existing design language: building status (AEP, vacate), court cases (litigations), bedbugs, and an “Ownership & last sale” block (owner, managing agent, last sale date/amount). Empty/absent sources render as a quiet “No [X] found in the public record” line where that's meaningful (bedbugs, litigations), or are omitted where absence isn't informative.
- **AI summary:** extend the compact summary sent to the Worker with the new facts (onAepList, litigation count/status, latest bedbug filing summary, vacate summary, owner name, last sale) so the story and Q&A can use them. Keep the payload small (still well under the Worker's 16KB cap). No Worker changes should be needed — if you find one is required, note it in your summary instead of changing the Worker.
- **Landlord questions:** add data-driven questions where warranted (AEP → repair timeline question; vacate history → what happened and when it was lifted; recent sale → new management/plans question), in the existing questions style.
- **README:** document the new datasets (IDs, join keys, verification date) alongside the existing ones.

## Verify before finishing
1. `npm run build` passes.
2. Live-data checks per source with curl/the data layer against TWO real buildings: 1520 Sedgwick Ave, Bronx (BBL 2028800017) and one more of your choosing likely to exercise bedbug/litigation paths; report what each source returned for each building, including honest zeros.
3. SSR smoke render of a results view (AGENTS.md method) with the new sections populated.

End with a summary: per source — joined how, what it returned in tests, anything dropped and why; files changed; any Worker follow-up needed.
