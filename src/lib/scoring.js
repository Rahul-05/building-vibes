// Transparent, rule-based flags. Every rule is a plain threshold on a public count,
// and the same rules are shown to users in "How we pick flags". No hidden weights.
//
// Flag shape: { id, level: 'red'|'yellow'|'green', title, reason, source }

import { plural } from './plainLanguage.js'
import { FIX, TREND, ratePhrase, unitsFor } from './insights.js'

const PEST_RE = /\b(MICE|ROACHES|RATS|BED ?BUGS|VERMIN|INFESTATION)\b/i
const MOLD_RE = /\bMOLD\b/i
const LEAD_RE = /\bLEAD\b/i
const HEAT_RE = /\b(HEAT|HOT WATER)\b/i

// Phase 4 fairness fix: where PLUTO gives the apartment count, a count must reach its old raw
// threshold AND a rate of at least 1 for every N apartments. Small buildings are unchanged
// (they clear the rate as soon as they clear the count); big buildings aren't flagged just for size.
// Without an apartment count, only the raw thresholds apply, exactly as before.
export const EVERY = {
  classCRed: 10,
  classBYellow: 2,
  heatRed: 5,
  heatYellow: 20,
  plumbing: 5,
  evictionsRed: 20,
  evictionsYellow: 50,
}

// count reaches "at least 1 for every `every` apartments" (always true when units are unknown).
const meetsRate = (count, units, every) => !units || count * every >= units

export const RULES = [
  `Open Class C (immediately hazardous) HPD violations: 3 or more is a red flag when that is also at least 1 for every ${EVERY.classCRed} apartments; any other number above zero is yellow; none is green.`,
  `Open Class B (hazardous) HPD violations: 10 or more, and at least 1 for every ${EVERY.classBYellow} apartments, is a yellow flag.`,
  'Open HPD violations mentioning lead paint: any is a red flag.',
  'Open HPD violations mentioning pests or mold: any is a yellow flag.',
  `Heat or hot water 311 complaints in the last 2 years: 10 or more, and at least 1 for every ${EVERY.heatRed} apartments, is red; 3 or more, and at least 1 for every ${EVERY.heatYellow} apartments, is yellow; none is green.`,
  `Plumbing or leak 311 complaints in the last 2 years: 10 or more, and at least 1 for every ${EVERY.plumbing} apartments, is a yellow flag.`,
  'Elevator 311 complaints in the last 2 years: 5 or more is a yellow flag. This stays a plain count, since one elevator serves the whole building.',
  'Active DOB complaints about safety or upkeep: any is a yellow flag. No DOB complaints in 3 years is green.',
  `Residential evictions in the last 5 years: 6 or more, and at least 1 for every ${EVERY.evictionsRed} apartments, is red; 2 or more, and at least 1 for every ${EVERY.evictionsYellow} apartments, is yellow; none is green.`,
  'Apartment counts: the “for every N apartments” parts use the residential unit count for the whole tax lot from the city’s PLUTO data, the same lot the violation, 311 and eviction counts cover. A small building clears the rate as soon as it clears the count, so its flags work just as before. When PLUTO has no apartment count for the lot (or doesn’t load), those parts are skipped and the plain counts alone decide.',
  'Currently in HPD’s Alternative Enforcement Program (the city’s list of buildings with the worst conditions): red flag. If the listing is for a different building on the same tax lot, yellow. A past, finished AEP listing is shown but not flagged.',
  'HPD vacate order that hasn’t been lifted (no rescind date on or before today): red flag, or yellow if it’s for a different building on the same tax lot. Lifted orders are shown but not flagged.',
  'HPD housing court cases opened in the last 5 years: 15 or more is red, 5 to 14 is yellow, none is green. Any case still pending makes it at least yellow. If none of the lot’s cases match this exact building, the lot’s cases are counted and labeled that way.',
  'An HPD court finding of tenant harassment in the last 5 years: red flag.',
  'Landlord’s latest bedbug filing, only if its reporting year ended in the last 2 years: 5 or more infested apartments, or 10% or more of the apartments, is red; any other number above zero is yellow. Zero infested, or no filing at all, raises no flag either way. If we can’t match this exact building on a tax lot with several buildings, the newest filing of each building on the lot is added up.',
  'Mascot mood: 2 or more red or 4 or more yellow flags means worried; 1 red or 2 or 3 yellow means mixed; otherwise happy.',
]

// Context shown next to the flags. Documented here so the explainer matches the code; none of it
// adds or removes a flag or moves the mascot.
export const CONTEXT_RULES = [
  'How it compares, the trend and the fix rate are context only. They never add or remove a flag and never change the mascot’s mood.',
  'How it compares: open HPD violations (Class A, B and C) divided by the lot’s apartment count, placed among every tax lot in the same borough and size group (1 or 2 apartments, or 3 or more) in a snapshot of NYC Open Data. Lots with no open violations count as zero. The snapshot stores each group’s percentiles, so the share is given to the nearest point and always says “about”.',
  `Trend: HPD violations issued plus 311 complaints about conditions in the building, in the last 12 full months compared with the 12 months before. At least ${Math.round((TREND.up - 1) * 100)}% more (and at least ${TREND.minChange} more) reads as climbing; at least ${Math.round((1 - TREND.down) * 100)}% fewer (and at least ${TREND.minChange} fewer) reads as eased; anything else reads as about steady. Fewer than ${TREND.minReports} reports across both years is too few to call.`,
  `Fix rate: of the HPD violations issued in the last 5 years, the share whose status is closed (HPD counts dismissed ones as closed too). The typical fix is the median number of days from the notice to the date the status changed to closed, shown once at least ${FIX.minClosedForMedian} are closed. “More than a year old” counts open Class A, B and C violations issued over a year ago.`,
]

function count311(complaints, predicate) {
  if (!complaints || complaints.error) return null
  return complaints.byType.filter((t) => predicate(t.type)).reduce((n, t) => n + t.count, 0)
}

// "12 open Class C violations, about 1 for every 8 apartments"
const withRate = (text, count, units) => (units ? `${text}, ${ratePhrase(count, units)}` : text)

function violationFlags(v, flags, units) {
  if (!v || v.error) return
  const { C, B } = v.openByClass

  const cReason = `${withRate(plural(C, 'open Class C violation'), C, units)}. Class C is HPD's "immediately hazardous" category.`
  if (C >= 3 && meetsRate(C, units, EVERY.classCRed)) flags.push({ id: 'class-c', level: 'red', source: 'HPD', title: 'Open hazardous violations', reason: cReason })
  else if (C > 0) flags.push({ id: 'class-c', level: 'yellow', source: 'HPD', title: C === 1 ? 'Open hazardous violation' : 'Open hazardous violations', reason: cReason })
  else flags.push({ id: 'class-c', level: 'green', source: 'HPD', title: 'No open Class C violations', reason: 'No "immediately hazardous" HPD violations are currently open.' })

  if (B >= 10 && meetsRate(B, units, EVERY.classBYellow)) flags.push({ id: 'class-b', level: 'yellow', source: 'HPD', title: 'Many open Class B violations', reason: `${withRate(plural(B, 'open Class B violation'), B, units)}. Class B is HPD's "hazardous" category.` })

  // Keyword checks run on the sample of open violations we fetched (up to 60, most severe first).
  const descs = v.openItems.map((i) => i.description)
  const lead = descs.filter((d) => LEAD_RE.test(d)).length
  const pests = descs.filter((d) => PEST_RE.test(d)).length
  const mold = descs.filter((d) => MOLD_RE.test(d)).length

  // Phrase honestly when we only checked a sample of a large open-violation list.
  const checked = v.openItems.length
  const mentions = (n, what) =>
    checked < v.openTotal
      ? `${n} of the ${checked} most serious open violations we checked ${n === 1 ? "mentions" : "mention"} ${what}.`
      : `${n === 1 ? '1 open violation mentions' : `${n} open violations mention`} ${what}.`

  if (lead) flags.push({ id: 'lead', level: 'red', source: 'HPD', title: 'Lead paint violations', reason: mentions(lead, 'lead paint') })
  if (pests) flags.push({ id: 'pests', level: 'yellow', source: 'HPD', title: 'Pest violations', reason: mentions(pests, 'mice, roaches, rats, or bedbugs') })
  if (mold) flags.push({ id: 'mold', level: 'yellow', source: 'HPD', title: 'Mold violations', reason: mentions(mold, 'mold') })
}

function complaintFlags(c, flags, units) {
  const heat = count311(c, (t) => HEAT_RE.test(t))
  if (heat === null) return

  const heatReason = `To 311 in the last 2 years: ${withRate(plural(heat, 'heat or hot water complaint'), heat, units)}.`
  if (heat >= 10 && meetsRate(heat, units, EVERY.heatRed)) flags.push({ id: 'heat', level: 'red', source: '311', title: 'Frequent heat complaints', reason: heatReason })
  else if (heat >= 3 && meetsRate(heat, units, EVERY.heatYellow)) flags.push({ id: 'heat', level: 'yellow', source: '311', title: 'Some heat complaints', reason: heatReason })
  else if (heat === 0) flags.push({ id: 'heat', level: 'green', source: '311', title: 'No heat complaints', reason: 'No heat or hot water complaints to 311 in the last 2 years.' })

  const plumbing = count311(c, (t) => /PLUMBING|WATER LEAK/i.test(t) && !/Construction/i.test(t))
  if (plumbing >= 10 && meetsRate(plumbing, units, EVERY.plumbing)) flags.push({ id: 'plumbing', level: 'yellow', source: '311', title: 'Plumbing & leak complaints', reason: `To 311 in the last 2 years: ${withRate(plural(plumbing, 'plumbing or leak complaint'), plumbing, units)}.` })

  const elevator = count311(c, (t) => /^ELEVATOR$/i.test(t))
  if (elevator >= 5) flags.push({ id: 'elevator', level: 'yellow', source: '311', title: 'Elevator complaints', reason: `${plural(elevator, 'elevator complaint')} to 311 in the last 2 years.` })
}

function dobFlags(d, flags) {
  if (!d || d.error) return
  const activeSafety = d.items.filter((i) => i.status === 'Active' && i.livability).length
  if (activeSafety) flags.push({ id: 'dob-active', level: 'yellow', source: 'DOB', title: 'Open building safety complaints', reason: `${plural(activeSafety, 'active DOB complaint')} about safety or upkeep.` })
  else if (d.total === 0) flags.push({ id: 'dob-clear', level: 'green', source: 'DOB', title: 'No DOB complaints', reason: 'No Department of Buildings complaints in the last 3 years.' })
}

function evictionFlags(e, flags, units) {
  if (!e || e.error) return
  const reason = `Carried out in the last 5 years: ${withRate(plural(e.total, 'residential eviction'), e.total, units)}.`
  if (e.total >= 6 && meetsRate(e.total, units, EVERY.evictionsRed)) flags.push({ id: 'evictions', level: 'red', source: 'Marshals', title: 'Many evictions', reason })
  else if (e.total >= 2 && meetsRate(e.total, units, EVERY.evictionsYellow)) flags.push({ id: 'evictions', level: 'yellow', source: 'Marshals', title: 'Some evictions', reason })
  else if (e.total === 0) flags.push({ id: 'evictions', level: 'green', source: 'Marshals', title: 'No evictions', reason: 'No residential evictions carried out in the last 5 years.' })
}

// Wording for rows that belong to another building on the same tax lot (no BIN match).
const sameLot = (scope) => (scope === 'lot' ? ' (for a building on the same tax lot)' : '')

function aepFlags(a, flags) {
  if (!a || a.error || !a.active) return
  const current = a.listings.find((l) => l.active)
  const detail = [current?.round, current?.startDate && `since ${current.startDate.slice(0, 4)}`].filter(Boolean).join(', ')
  flags.push({
    id: 'aep',
    level: a.scope === 'lot' ? 'yellow' : 'red',
    source: 'HPD AEP',
    title: 'On the city’s worst conditions list',
    reason: `Currently in HPD’s Alternative Enforcement Program${detail ? ` (${detail})` : ''}${sameLot(a.scope)}.`,
  })
}

function vacateFlags(v, flags) {
  if (!v || v.error || !v.inEffect) return
  flags.push({
    id: 'vacate',
    level: v.scope === 'lot' ? 'yellow' : 'red',
    source: 'HPD',
    title: 'Vacate order not lifted',
    reason: `${plural(v.inEffect, 'HPD vacate order')} not lifted as of today${sameLot(v.scope)}.`,
  })
}

function litigationFlags(l, flags) {
  if (!l || l.error) return
  const n = l.recentTotal
  const pending = l.open ? ` ${l.open} still pending.` : ''
  const reason = `${plural(n, 'HPD housing court case')} opened in the last 5 years${sameLot(l.scope)}.${pending}`
  if (n >= 15) flags.push({ id: 'litigation', level: 'red', source: 'HPD court', title: 'Many housing court cases', reason })
  else if (n >= 5 || l.open > 0) flags.push({ id: 'litigation', level: 'yellow', source: 'HPD court', title: l.open && n < 5 ? 'Pending housing court case' : 'Several housing court cases', reason })
  else if (n === 0) flags.push({ id: 'litigation', level: 'green', source: 'HPD court', title: 'No recent housing court cases', reason: 'No HPD housing court cases opened in the last 5 years.' })

  if (l.recentHarassmentFindings > 0) flags.push({ id: 'harassment', level: 'red', source: 'HPD court', title: 'Harassment finding', reason: `${plural(l.recentHarassmentFindings, 'HPD court case')} in the last 5 years ended with a finding of tenant harassment.` })
}

export function bedbugFilingIsRecent(b, now = new Date()) {
  const end = b?.latest?.periodEnd
  if (!end) return false
  const cutoff = new Date(now)
  cutoff.setFullYear(cutoff.getFullYear() - 2)
  return end.slice(0, 10) >= cutoff.toISOString().slice(0, 10)
}

function bedbugFlags(b, flags) {
  if (!b || b.error || !b.latest || !bedbugFilingIsRecent(b)) return
  const { infested, units } = b.latest
  if (!infested) return
  const share = units ? infested / units : 0
  const reason = `The landlord’s latest bedbug filing reports ${infested} of ${plural(units, 'apartment')} infested${sameLot(b.scope)}.`
  if (infested >= 5 || share >= 0.1) flags.push({ id: 'bedbugs', level: 'red', source: 'Bedbug filing', title: 'Bedbugs reported', reason })
  else flags.push({ id: 'bedbugs', level: 'yellow', source: 'Bedbug filing', title: 'Some bedbugs reported', reason })
}

const ORDER = { red: 0, yellow: 1, green: 2 }

export function scoreRecord(record) {
  const flags = []
  const units = unitsFor(record)
  // The city's own lists go first: the sort below is stable, so they lead their tier.
  aepFlags(record.aep, flags)
  vacateFlags(record.vacateOrders, flags)
  violationFlags(record.violations, flags, units)
  complaintFlags(record.complaints311, flags, units)
  dobFlags(record.dob, flags)
  evictionFlags(record.evictions, flags, units)
  litigationFlags(record.litigations, flags)
  bedbugFlags(record.bedbugs, flags)
  flags.sort((a, b) => ORDER[a.level] - ORDER[b.level])

  const counts = { red: 0, yellow: 0, green: 0 }
  for (const f of flags) counts[f.level]++

  let mood = 'happy'
  if (counts.red >= 2 || counts.yellow >= 4) mood = 'worried'
  else if (counts.red >= 1 || counts.yellow >= 2) mood = 'mixed'

  return { flags, counts, mood, units }
}

// One line for the explainer saying which way this building was scored.
export function scoringBasis(record) {
  const units = unitsFor(record)
  if (units) return `For this building, the rates use ${plural(units, 'apartment')} from PLUTO.`
  if (record?.building?.error) return 'For this building, the apartment count (PLUTO) didn’t load, so only the plain counts were used.'
  return 'For this building, PLUTO has no apartment count, so only the plain counts were used.'
}

export const MOOD_COPY = {
  happy: { label: 'Mostly green flags', blurb: 'The public record here looks pretty calm.' },
  mixed: { label: 'Some yellow flags', blurb: 'A few things in the record worth asking about.' },
  worried: { label: 'Several red flags', blurb: 'The record shows some serious recurring issues.' },
}
