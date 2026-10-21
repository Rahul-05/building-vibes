# Building Vibes — build queue (ordered; one phase at a time, deploy + verify between phases)
1. Phase 1 — core lookup + flags + mascot — DONE, live Oct 20
2. Phase 2 — AI story + Q&A (Worker + Gemini model race) — DONE, live Oct 20
3. Phase 3 — Data pack (PHASE3-BRIEF.md) — IN PROGRESS Oct 20
4. Phase 4 — Smarts (PHASE4-BRIEF.md): PLUTO facts + per-unit scoring, borough percentile benchmarks, trend + fix-rate, compare mode — DEPLOYED Oct 20 (~3:30pm, at the user's direct request, ahead of the full mobile pass)
4.5. MOBILE POLISH PASS (user flagged Oct 20): core badge fix DEPLOYED Oct 20; the full card by card phone width audit was finished in the Oct 20 4pm run alongside 4.6 and DEPLOYED Oct 20 (~4:40pm). A real device check by the user is still owed (tray height above keyboard, suggestions list height, iPhone keyboard on Ask focus).

4.6. FIXES ROUND 3 (FIXES3-BRIEF.md, user feedback Oct 20 ~3:37pm): trend + fix rate move to the END of the results page; floating Ask Vibe button bottom right; compare popup gains its own address search. Built in the one time Oct 20 4pm run and DEPLOYED Oct 20 (~4:40pm); live site verified (bundle hash match, SSR markup checks all pass on 1520 Sedgwick Ave).
5. Phase 5 — Wow amended (PHASE5-BRIEF.md): listing-vs-record checker + ALL-languages mode (full Google Translate list ~240; UI pre-translated at build time by Gemini, AI answers natively per language). Shareable image EXCLUDED by user. Section 1 (listing checker) BUILT Oct 21, Worker /check DEPLOYED and verified; site deploy to gh-pages pending. Section 2 (languages) QUEUED
Polish note (Oct 20): when a building is NOT on the AEP list, the Deeper record cards show no AEP line (the fact only appears in the AI story). Add a quiet "Not on the Alternative Enforcement Program list" line to Building status for completeness. DONE (the line was added in Phase 4; confirmed rendering on 1520 Sedgwick Ave, Oct 21).
Standing rules: BRIEF.md (flags never verdicts, no accounts/storage, free, owner names only — no portfolio mapping).
STYLE RULE (user, Oct 20): NO hyphens anywhere in the site's own text — no hyphenated compounds, no em or en dashes — in UI copy, templates, generated questions, explainers, the i18n dictionary, and AI output (the Worker must instruct the model to rephrase instead). Quoted city record text stays exactly as published.
