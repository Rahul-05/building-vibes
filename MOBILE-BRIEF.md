# Building Vibes — Mobile polish pass (Phase 4.5, user flagged Oct 20)

Mobile is the PRIMARY surface for this product (the user's words: NYC users mostly use it on phones). Audit and fix the whole app at phone width (~390 CSS px). The style rule from QUEUE.md binds all copy (no hyphens in our own text).

## Known bug (the one the user screenshotted)
In the Court cases card (Deeper record), the line "10 cases opened in the last 5 years" is followed by an inline yellow "1 pending" pill that SPLITS across two lines at phone width (the number sits on line one, the word wraps inside the pill shape onto line two). Fix the pattern, not just the instance: any badge or pill that accompanies text must be structurally unbreakable — heading rows become flex containers that wrap BETWEEN elements, pills get nowrap and never shrink, and on narrow screens a badge drops whole to its own line rather than breaking internally.

## Audit list (check every one at mobile width)
- Deeper record cards: Building status, Court cases, Bedbugs, Ownership (long owner and agent names must wrap, never overflow), last sale rows.
- Flag tiles and the flags list; the "How we pick flags" explainer.
- Results hero: address title, mood line, mascot, disclaimer chip.
- Story, Ask, landlord questions, vibe card.
- NEW Phase 4 surfaces: the context/percentile block, trend block and sparkline, fix rate block, the compare tray and the comparison view (cards stack; nothing scrolls sideways; remove buttons reachable).
- Landing: search box, suggestions dropdown, example chips.
- Global: no horizontal scrolling anywhere; tap targets at least ~40px; text never clips against card edges (check the longest realistic strings, e.g. "MANAGEGEMENT" style owner names and multi word case types).

## Also in this pass (from QUEUE.md polish note)
When a building is NOT on the AEP list, Building status gains a quiet line saying so ("Not on the Alternative Enforcement Program list"), so the fact does not live only in the AI story.

## Verify
1. `npm run build` passes.
2. SSR renders of landing, a full results page, and the compare view; inspect the markup/classes for the badge pattern fix and stacking.
3. A short list in your summary: every place you changed layout for mobile, and anything you could not verify without a real device (say so plainly, the user will device check).
End with that summary.
