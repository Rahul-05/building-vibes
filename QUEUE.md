# Building Vibes — build queue (ordered; one phase at a time, deploy + verify between phases)
1. Phase 1 — core lookup + flags + mascot — DONE, live Oct 20
2. Phase 2 — AI story + Q&A (Worker + Gemini model race) — DONE, live Oct 20
3. Phase 3 — Data pack (PHASE3-BRIEF.md) — IN PROGRESS Oct 20
4. Phase 4 — Smarts (PHASE4-BRIEF.md): PLUTO facts + per-unit scoring, borough percentile benchmarks, trend + fix-rate, compare mode — BUILT Oct 20 (not yet deployed)
4.5. MOBILE POLISH PASS (user flagged Oct 20, runs right after Phase 4, before Phase 5): mobile is the PRIMARY surface. Known bug: the "1 pending" pill in the Court cases card splits across two lines at phone width. Audit every card, badge and pill at ~390px width: badges never split (unbreakable pills, sensible stacking), long owner names wrap, flag tiles and tables stack cleanly, hero type scales, tap targets stay comfortable, mascot and vibe card hold together. Verify with SSR renders at mobile width plus a real device check by the user.
5. Phase 5 — Wow amended (PHASE5-BRIEF.md): listing-vs-record checker + ALL-languages mode (full Google Translate list ~240; UI pre-translated at build time by Gemini, AI answers natively per language). Shareable image EXCLUDED by user — QUEUED
Polish note (Oct 20): when a building is NOT on the AEP list, the Deeper record cards show no AEP line (the fact only appears in the AI story). Add a quiet "Not on the Alternative Enforcement Program list" line to Building status for completeness.
Standing rules: BRIEF.md (flags never verdicts, no accounts/storage, free, owner names only — no portfolio mapping).
STYLE RULE (user, Oct 20): NO hyphens anywhere in the site's own text — no hyphenated compounds, no em or en dashes — in UI copy, templates, generated questions, explainers, the i18n dictionary, and AI output (the Worker must instruct the model to rephrase instead). Quoted city record text stays exactly as published.
