# Building Vibes — Phase 4 Brief: Smarts (user's pick, Oct 20)

Builds on Phases 1–3 (wait for Phase 3's data pack to be in the tree). Standing rules still bind: flags never verdicts, plain language, disclaimers, no accounts, no stored user data, free everything, per-source graceful failure, flag rules documented in the "How we pick flags" text exactly as implemented. STYLE RULE (user, Oct 20): no hyphens anywhere in the site's own text — no hyphenated compounds, no em or en dashes — in any copy you write or touch; rephrase instead. Quoted city record text stays exactly as published.

## 1. Building facts + per-unit scoring (PLUTO)
- New data module for PLUTO/MapPLUTO (`64uk-42ks`, verify schema): fetch by BBL — residential/total units, year built, building class. Show year built + units in the header area ("Built 1927 · 84 apartments").
- Rework scoring inputs to per-unit rates where units are known (open violations per unit, complaints per unit), with thresholds documented in the flags explainer. If units are missing, fall back to current raw-count behavior and say so in the explainer. Keep Phase 1–3 flag meanings stable in spirit — this is a fairness fix for big buildings, not a regrade of the city.

## 2. Percentile context (borough benchmarks, snapshot method)
- Build-time script `scripts/build-benchmarks.mjs`: from NYC Open Data, compute per-BBL open-violation counts (all classes and Class C separately), join unit counts (PLUTO), and produce per-borough deciles of open-violations-per-unit. Output: small committed JSON `src/data/benchmarks.json` + a `benchmarksMeta` (source datasets, snapshot date) rendered in the UI as "Compared with buildings across the Bronx — NYC Open Data snapshot, <month year>."
- Time-box: if the full join is impractical, ship borough deciles of raw open-violation counts within unit-size bands (1–10, 11–50, 51+ units) instead, and label the method honestly in the UI and your summary. Never present a percentile you didn't actually compute.
- UI: a "How it compares" line/block in the flags area: e.g. "More open violations per apartment than ~80% of Bronx buildings." Mascot-neutral, factual. Feeds the AI summary too.

## 3. Trend + landlord fix-rate
- From data already fetched (extend windows if cheap): violations and 311 complaints bucketed by year (and last-12-months vs prior-12) → a small inline SVG sparkline + a plain-language trend line ("Reports have eased over the last year" / "Reports are climbing") with the counts behind it.
- Fix-rate from HPD violations: share of violations with a closed/corrected status, and median days-to-close where dates allow; open-and-ancient count (open > 1 year). Present as record facts: "Of the violations issued in the last 5 years, X% are marked closed. The typical fix took about N days." No landlord character judgments — the numbers speak.
- Both feed the AI summary and can generate landlord questions (e.g., long-open items → "These violations from 2024 are still open — what's the plan?").

## 4. Compare mode
- A visitor can pin up to 3 buildings (from any results page: "Compare this building" button) into a compare tray held in app state (no storage, no accounts). Tray is visible/editable; "View comparison" renders a side-by-side: mascot mini + mood, flag counts, per-unit open violations, percentile, trend arrow, fix-rate, AEP/vacate/litigation/bedbug highlights, owner, last sale, year built/units.
- Factual table only — no "winner" crown, no verdicts; the numbers sit side by side and the visitor decides. Disclaimer rides along.
- Must work on mobile (stacked columns are fine) and survive adding a building found via a fresh search without losing the tray.

## Verify
1. `npm run build` passes; benchmarks script runs and its output is validated (spot-check one borough decile against a hand-run Socrata query).
2. Live checks: Sedgwick (large building) shows per-unit + percentile + trend + fix-rate; one small building shows sane values or honest fallbacks.
3. SSR smoke render of results + compare view.
End with a summary: method actually used for benchmarks (+ snapshot date), files changed, anything dropped and why.
