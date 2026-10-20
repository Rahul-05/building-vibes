# Building Vibes — Style sweep + Worker robustness (Oct 20)

## A. No hyphens anywhere in the site's own text (user rule, Oct 20)
Sweep ALL user facing copy that WE author and remove every hyphen, em dash and en dash by rephrasing:
- Frontend: components, `src/lib/` (templates in plainLanguage/summary, questions, scoring explainer text), landing and results copy, button and label text, fallback sentences, the vibe card text.
- Worker (`worker/src/index.js`): the footer line loses its hyphen ("This is public record information, not advice."), and BASE_RULES gains a style rule for the model: "Do not use hyphens, em dashes or en dashes anywhere in your answer. Do not write hyphenated compounds. Rephrase instead: write 'public record' not 'public-record', 'every day' style splits where natural, and use commas or separate sentences where a dash would go."
- Do NOT touch: quoted city record text (violation and complaint descriptions stay exactly as published), code identifiers, CSS class names, URLs, dataset IDs, or numbers and dates from the data. In our own sentences inside templates, restructure so nothing needs a hyphen (watch for: public-record, follow-up, per-unit is Phase 4's problem, well-known compounds, date ranges written with dashes in our labels).
- Audit method: grep the built bundle's source strings and `src/` plus `worker/` for the characters and eyeball every hit in user facing strings.

## B. Worker model chain robustness (diagnosed Oct 20)
Live testing showed the two lite models (`gemini-3.5-flash-lite`, `gemini-flash-lite-latest`) return 400 "invalid argument" when the request includes `generationConfig.thinkingConfig` — they reject that field. And a 400 currently stops the whole chain, which can kill a request even when a later model would work.
- Send `thinkingConfig: { thinkingBudget: 0 }` only to models that accept it (gemini-3.5-flash, gemini-flash-latest, gemini-3.6-flash, gemini-3.8-flash); omit it for the two lites.
- A 400 response from a model now skips that model and continues the chain (it signals a model specific incompatibility). 401 and 403 still stop everything (a bad key fails everywhere). 404, 429, 503 and per attempt timeouts already continue.

## Verify
1. `npm run build` passes. `cd worker && npx wrangler deploy --dry-run` passes.
2. Stubbed fetch logic checks: lite model without thinkingConfig in its request body; a 400 from the first racer followed by a 200 from the fallback returns text; 401 still stops.
3. Grep report: list any remaining hyphen characters in user facing strings you intentionally left (should be only quoted city text and code), and confirm the footer and the model style rule are in place.
End with a summary of copy changed (files and rough count of phrases rephrased) plus the Worker changes.
