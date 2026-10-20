# Building Vibes — Fix Round Brief (Oct 20, user feedback + live diagnosis)

## Fix 1 — AI Worker model failure (worker/src/index.js) — ROOT CAUSE FOUND
The live Worker fails every request because Google retired access to `gemini-2.5-flash` for new accounts (404: "no longer available to new users"). Verified working on this account today: `gemini-3.5-flash` and `gemini-flash-latest` (both returned 200). `gemini-3.8-flash` and `gemini-3.1-flash-lite` currently 503 (high demand).

Change `generate()` to try an ordered model chain: `["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.8-flash"]` — build the URL per model; on 404, 429, or 503 move to the next model; only throw after all three fail. Keep the request body, rules, banned-word check, CORS, and error shape exactly as they are. Keep thinkingBudget 0 (verified accepted by 3.5-flash).

## Fix 2 — Mascot motion: premium, not cartoony (user: "moves a bit too cartoony, make it premium")
- Replace bouncy/springy/elastic eases and squash-and-stretch with a slow, gentle float: small amplitude (max ~4px), long duration (3.5–5s), sine/power1 in-out easing, infinite yoyo.
- Mood changes: soft crossfade/scale 0.98→1, no popping or overshoot.
- Keep GSAP, keep reduced-motion support. Everything else about behavior stays.

## Fix 3 — Mascot art: stroke eyes only, soft expressions (user, Oct 20: "the eyes are creepy on the building — don't have [big] eyes, just have stroke eyes that showcase expressions softly")
The current mascot has large filled googly eyes (white sclera, big pupils) — REMOVE them entirely. Redesign the face in Mascot.jsx as minimal line art:
- Eyes are simple STROKE curves only (no fills, no sclera, no pupils): e.g. happy = two gentle upward arcs (like closed happy eyes); mixed/content = two short soft curves or tiny arcs; worried = two slightly angled strokes with a subtle brow line. Same stroke width as the rest of the character.
- Mouth: one small stroke curve that changes subtly per mood (gentle smile / flat-soft / small downturn). Blush and sparkles: drop them or reduce to near-nothing — premium and calm is the target.
- Keep the building body (rounded rectangle, door, two windows), cleaner geometry, consistent stroke widths, softer sophisticated palette. The whole face should read as soft expression, never cartoonish or creepy.

## Fix 4 — Avatar clipped at top during animation, everywhere (user-reported)
The floating mascot gets its top cut off while animating — confirmed by the user's screenshot of the LANDING hero (the pink mascot's head is cropped against its backdrop at the top of the float), and it also happens in the results hero, the Ask section, and the vibe card. Diagnose the clipping (overflow-hidden ancestors and/or insufficient headroom for the float + shadow) and fix it in all three placements: padded wrapper around the animated element, overflow visible where safe, transform values that stay inside the padded box. The full character (including any antenna) plus its shadow must remain visible at every point of the animation.

## Fix 5 — Address suggestions dropdown renders under other content (user-reported)
When typing in the address search, the GeoSearch suggestion list appears underneath following page elements and gets visually blocked. Make the dropdown: absolutely positioned directly under the input inside a relative wrapper, z-index above everything on the page (50+), solid background with border + shadow matching the design, and ensure no ancestor clips it. It must read cleanly over whatever is below the search box, on landing and results contexts alike.

## Verify before finishing
1. `npm run build` passes.
2. `cd worker && npx wrangler deploy --dry-run` passes.
3. SSR-render smoke check (see AGENTS.md method) of the landing view + a results view: confirm the dropdown markup/stacking context and the mascot wrapper changes are in place.
End with a summary per fix: what changed and in which files.
