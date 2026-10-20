# Building Vibes — Fixes round 3 (user feedback Oct 20, from real phone use)

Three changes from the user, plus the unfinished mobile audit from MOBILE-BRIEF.md (its first run died on the Claude session limit partway — audit what is already fixed and complete the rest). Standing rules bind: no verdicts, no hyphens in our own copy, mobile first, no login, no storage.

## 1. Trend and fix rate move to the end
On the results page, the trend block ("Reports have eased over the last year" and its chart) and the fix rate block ("76% marked closed · Typical fix about 121 days") currently sit in the middle of the page. Move BOTH to the very end of the results content — below the Deeper record and the landlord questions — so they are the last substantive thing a reader reaches (the vibe card, if it currently sits last, moves above them). Nothing about their content changes, only placement. Check the compare view keeps its own sensible order (this move is about the single building results page).

## 2. Floating Ask button, bottom right
Add a floating button fixed at the bottom right of the results view: the mascot face plus "Ask Vibe". Tapping it smooth scrolls to the Ask section and focuses the question input. Rules: it must never cover card content at phone width (give the page enough bottom padding), it sits above the compare tray if both are present (offset it upward when the tray is visible), it is at least 48px tall for thumbs, and it hides while the Ask section itself is on screen if that is simple to do cleanly (if not simple, leave it always visible and say so in the summary).

## 3. Compare popup gets its own search
Today: hit "Compare this building", a popup/tray appears, and there is NO way to type or search for another apartment inside it — the user has to leave the flow. Fix: the compare popup/tray contains a working address search (reuse the existing AddressSearch component and its suggestion dropdown, z-index above the popup) so a second and third building can be found and added without leaving the popup; adding one updates the comparison in place; the existing cap of 3 and remove controls keep working; the popup must behave at phone width (the search input and suggestions fully visible, nothing clipped).

## Verify
1. `npm run build` passes.
2. SSR renders: results page (trend and fix rate markup now AFTER the deeper record markup), the floating button present, the compare popup containing a search input.
3. In the summary: the new section order, how the floating button behaves, how compare search was wired, the state of the MOBILE-BRIEF audit list item by item (fixed already / fixed now / still open and why).
End with that summary.
