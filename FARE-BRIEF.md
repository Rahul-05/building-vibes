# FARE Act Fee Checker — a new tool inside Building Vibes (user's explicit call, Oct 21, 2026)

## What it is
A guided "check a broker fee" flow inside the existing site, next to the listing checker. A renter answers a few plain questions about a fee they were charged (or are being asked to pay) and gets: the rule that applies to their situation in plain language, whether their answers match the pattern the law bans, what the charge adds up to, and the exact next steps and complaint routes. Same product family as the rest of the site: free, no login, nothing stored, mobile first.

## The law (VERIFY every fact below against official sources during the build; do not ship from this brief alone)
- The NYC FARE Act took effect June 11, 2025. Core rule: the broker fee is paid by whoever hires the broker. A broker who represents the landlord, or lists and shows the landlord's apartment, may not charge the tenant a fee. It applies to leases signed on or after the effective date (verify renewal treatment).
- Pre existing rules that interact: application fees are capped at $20; security deposit is capped at one month of rent (2019 HSTPA).
- Reported workarounds since the law (Bloomberg, Aug 2026): the same fee relabeled as a processing fee, a listing fee, or an access fee; tenants pushed to sign fine print saying they hired the broker themselves.
- Enforcement and complaints: NYC DCWP takes FARE Act complaints (311 and nyc.gov); brokers are licensed by the NY Department of State; tenants can also pursue the money in court. Verify the current complaint URLs, the fine schedule, and any time limits during the build and link only to official pages.

## Question flow (short, plain, one thing per screen on mobile)
1. When did you sign the lease, or when will you sign? (Before or after the law took effect decides whether the FARE Act applies at all.)
2. Who brought the broker in? Options in plain words: I hired my own broker to search for me / the broker was advertising or showing this apartment / not sure.
3. Were you charged anything beyond the first month, a deposit of one month or less, and an application fee of $20 or less? Capture each extra charge: what it was called, and how much.
4. Did anyone have you sign a paper saying you hired the broker? (Yes / no / not sure.)
5. Monthly rent (optional, used only to show the charge as a share of a year of rent).

## Output rules (binding, same discipline as the rest of the site)
- Information, never legal verdicts. Never print "you were illegally charged" or "this is illegal." Say the pattern plainly instead: your answers match the pattern the law bans, or your answers look consistent with the law, or it is genuinely unclear and here is what would decide it.
- Green, yellow, red flag pattern and the mascot, consistent with building results.
- Always show: the total of extra charges, each charge's label as the user typed it next to what the law says about that kind of charge, and the disclaimer line: this is public information about the law, not legal advice.
- Next steps, concrete and ordered: (1) a short written script the renter can send asking for the money back and naming the law; (2) what evidence to keep (lease, receipts, the listing, messages); (3) official complaint routes with links (DCWP via 311, NY Department of State for the broker's license, court as the last resort). All wording is a template, flagged as such.
- Rule based and deterministic. NO AI call for the assessment itself (legal accuracy beats flourish). AI is not needed anywhere in this tool.
- Style rule applies: no hyphens in the site's own text. The law's own quoted words stay exact where quoted.

## Integration
- Entry points: a card on the home screen ("Charged a broker fee? Check it"), a link at the end of building results ("About to sign? Check the fee first"), and a hint inside the listing checker when pasted listing text mentions a broker fee or a similar charge under another label.
- i18n: every new string goes into src/i18n/en.json and gets translated by scripts/translate-ui.mjs into the SAME 40 languages as the current set. No new languages (the user capped the set at 40 on Oct 21).
- Data: none. No city dataset, no network calls, answers never leave the device.

## Done means
Flow builds and passes npm run build; SSR spot check of the flow in English and one translated language; each of the three outcomes (green, yellow, red) reachable and screenshotted in the SSR check against scripted answer sets; deployed to gh-pages WITH the base path (vite config already pins it; verify the live bundle path after deploy); QUEUE.md updated.
