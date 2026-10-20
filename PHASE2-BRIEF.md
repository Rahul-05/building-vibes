# Building Vibes — Phase 2 Brief (AI building story + Q&A)

Read BRIEF.md first for the product rules (they still bind: flags never verdicts, "based on public records, not advice", no login, no stored user data, everything free). Phase 1 is built and live. Phase 2 adds the AI layer.

## Architecture (fixed — do not redesign)
Static frontend (GitHub Pages) → Cloudflare Worker (holds the Gemini key as a secret) → Gemini API free tier (`gemini-2.5-flash`). The API key must NEVER appear in frontend code, the repo, or any committed file. The Worker receives a compact summary of the building record that the frontend already fetched from NYC Open Data — the Worker does NOT call NYC APIs itself.

## 1. Worker — new `worker/` directory in the repo
- Plain JS module Worker (`worker/src/index.js`) + `worker/wrangler.toml` (`name = "building-vibes-ai"`, `compatibility_date` recent, `main = "src/index.js"`).
- Endpoints (POST only, JSON in/out):
  - `POST /story` — body: `{ address, summary }` where summary is the compact record (flag counts, top plain-language issues with counts, open/total violations, complaint themes, eviction count, DOB count). Returns `{ story }`: 2–3 short paragraphs, warm and plain, strictly grounded in the summary.
  - `POST /ask` — body: `{ address, summary, question }`. Returns `{ answer }`: answers ONLY from the summary; if the record doesn't say, it says so plainly ("The public record I have doesn't mention that.").
- Model call: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` with header `x-goog-api-key: <env.GEMINI_API_KEY>` and a system instruction enforcing: flags language only; NEVER verdicts or advice ("avoid", "walk away", "don't rent", "safe", "unsafe", "good/bad building" are banned); never invent facts not in the summary; keep it short; end story responses with one neutral line that this is public-record information, not advice.
- CORS: only `https://rahul-05.github.io` and `http://localhost:5173` origins; handle OPTIONS.
- Guards: reject non-POST (405), body > 16KB (413), missing fields (400 JSON error). Keep a generic try/catch → 502 JSON error. No logging of payloads.
- Validate locally with `npx wrangler deploy --dry-run` from `worker/` (no credentials needed) and note the result.

## 2. Frontend
- `src/data/config.js`: add `WORKER_URL` constant, placeholder value `https://building-vibes-ai.PLACEHOLDER.workers.dev` (the deploy step will replace PLACEHOLDER).
- `src/data/ai.js`: `fetchStory(summary)` and `askBuilding(summary, question)` calling the Worker; 20s timeout; throw on non-200 so the UI can fall back.
- Build the compact summary from the already-fetched record (reuse Phase 1 data structures — top issues in plain language, counts, flags). Keep it small.
- Results view additions (match the existing artsy/bubbly design + GSAP motion; reuse components where sensible):
  - "This building's story" section: loads after the record renders; bubbly loading state; on failure, quietly show a template-generated summary sentence instead (no error drama).
  - "Ask about this building" box: text input + 3 suggested-question chips ("What comes up most often?", "Anything recent?", "What should I ask the landlord?"); answer renders in a speech-bubble style tied to the mascot. Disable while asking. Disclaimer line under it: answers come only from the public record shown on this page.
- Do not change Phase 1 sections, scoring, or data modules except where integration requires.

## 3. Docs
- README: add a Phase 2 section — architecture, how to deploy the Worker (`cd worker && npx wrangler deploy`, `npx wrangler secret put GEMINI_API_KEY`), free-tier notes (Workers free plan, Gemini free tier), and how WORKER_URL gets set.

## Verify before you finish
1. `npm run build` passes.
2. `cd worker && npx wrangler deploy --dry-run` validates.
3. Unit-check the summary builder with the Sedgwick test data shape if practical (node script is fine).

End with a summary: files created/changed, the exact WORKER_URL placeholder line to replace, dry-run result, and anything the deploy step must know.
