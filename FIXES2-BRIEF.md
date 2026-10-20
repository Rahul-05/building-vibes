# Building Vibes — Fix Round 2: AI reliability (Oct 20 diagnosis)

## What is happening (verified live, Oct 20)
The Gemini free-tier models are intermittently overloaded: the same model returns 200 one minute and 503 "high demand" the next, sometimes fast, sometimes after ~15s. The current sequential chain + the frontend's short timeout means visitors coin-flip between a real AI answer and the fallback. Verified working on this account today: gemini-3.5-flash, gemini-flash-latest, gemini-3.6-flash, gemini-3.5-flash-lite, gemini-flash-lite-latest (all 200 at least once), gemini-3.8-flash (exists, often 503).

## Change 1 — Worker (worker/src/index.js): race + widen the model net
Restructure `generate()` only; prompts, validation, banned-word check, footer logic, CORS, and error shape stay identical.
- Candidate models, in preference order: `gemini-3.5-flash`, `gemini-flash-latest`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-flash-lite-latest`, `gemini-3.8-flash`.
- Strategy: fire the first TWO candidates in parallel (each with its own AbortController, 20s per-attempt timeout) and take the first success (Promise.any-style). If both fail, try the remaining candidates one at a time, same 20s cap. Move on immediately on 404/429/503 or abort; a non-retryable error (400/401/403) still stops everything.
- Apply the existing output cleaning + banned-word check to the winning response as today (a winner that fails the verdict check counts as a failure for that attempt — continue to the next candidate if any remain; simplest: run the check inside the attempt).
- Keep maxOutputTokens and thinkingBudget 0 as they are.

## Change 2 — Frontend (src/data/ai.js): more patience
- Raise the fetch timeout: story 75 seconds, ask 60 seconds (they are currently ~20s). The loading states already cover the wait; make sure the story section keeps its bubbly loading state for the full window and only falls back after the timeout or a non-200.

## Verify before finishing
1. `npm run build` passes.
2. `cd worker && npx wrangler deploy --dry-run` passes.
3. Node-based logic check of the new generate() flow with stubbed fetch: (a) first model 503 + second 200 → returns second's text; (b) both racers hang → abort fires and a fallback model answers; (c) all fail → throws.
End with a short summary of the changes.
