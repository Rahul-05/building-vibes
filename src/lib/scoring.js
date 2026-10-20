// Transparent, rule-based flags. Every rule is a plain threshold on a public count,
// and the same rules are shown to users in "How we pick flags". No hidden weights.
//
// Flag shape: { id, level: 'red'|'yellow'|'green', title, reason, source }

import { plural } from './plainLanguage.js'

const PEST_RE = /\b(MICE|ROACHES|RATS|BED ?BUGS|VERMIN|INFESTATION)\b/i
const MOLD_RE = /\bMOLD\b/i
const LEAD_RE = /\bLEAD\b/i
const HEAT_RE = /\b(HEAT|HOT WATER)\b/i

export const RULES = [
  'Open Class C (immediately hazardous) HPD violations: 3 or more is a red flag, 1 or 2 is yellow, none is green.',
  'Open Class B (hazardous) HPD violations: 10 or more is a yellow flag.',
  'Open HPD violations mentioning lead paint: any is a red flag.',
  'Open HPD violations mentioning pests or mold: any is a yellow flag.',
  'Heat or hot water 311 complaints in the last 2 years: 10 or more is red, 3 to 9 is yellow, none is green.',
  'Plumbing or leak 311 complaints in the last 2 years: 10 or more is a yellow flag.',
  'Elevator 311 complaints in the last 2 years: 5 or more is a yellow flag.',
  'Active DOB complaints about safety or upkeep: any is a yellow flag. No DOB complaints in 3 years is green.',
  'Residential evictions in the last 5 years: 6 or more is red, 2 to 5 is yellow, none is green.',
  'Currently in HPD’s Alternative Enforcement Program (the city’s list of buildings with the worst conditions): red flag. If the listing is for a different building on the same tax lot, yellow. A past, finished AEP listing is shown but not flagged.',
  'HPD vacate order that hasn’t been lifted (no rescind date on or before today): red flag, or yellow if it’s for a different building on the same tax lot. Lifted orders are shown but not flagged.',
  'HPD housing court cases opened in the last 5 years: 15 or more is red, 5 to 14 is yellow, none is green. Any case still pending makes it at least yellow. If none of the lot’s cases match this exact building, the lot’s cases are counted and labeled that way.',
  'An HPD court finding of tenant harassment in the last 5 years: red flag.',
  'Landlord’s latest bedbug filing, only if its reporting year ended in the last 2 years: 5 or more infested apartments, or 10% or more of the apartments, is red; any other number above zero is yellow. Zero infested, or no filing at all, raises no flag either way. If we can’t match this exact building on a tax lot with several buildings, the newest filing of each building on the lot is added up.',
  'Mascot mood: 2 or more red or 4 or more yellow flags means worried; 1 red or 2 or 3 yellow means mixed; otherwise happy.',
]

function count311(complaints, predicate) {
  if (!complaints || complaints.error) return null
  return complaints.byType.filter((t) => predicate(t.type)).reduce((n, t) => n + t.count, 0)
}

function violationFlags(v, flags) {
  if (!v || v.error) return
  const { C, B } = v.openByClass

  if (C >= 3) flags.push({ id: 'class-c', level: 'red', source: 'HPD', title: 'Open hazardous violations', reason: `${plural(C, 'open Class C violation')}. Class C is HPD's "immediately hazardous" category.` })
  else if (C > 0) flags.push({ id: 'class-c', level: 'yellow', source: 'HPD', title: 'Open hazardous violation', reason: `${plural(C, 'open Class C violation')}. Class C is HPD's "immediately hazardous" category.` })
  else flags.push({ id: 'class-c', level: 'green', source: 'HPD', title: 'No open Class C violations', reason: 'No "immediately hazardous" HPD violations are currently open.' })

  if (B >= 10) flags.push({ id: 'class-b', level: 'yellow', source: 'HPD', title: 'Many open Class B violations', reason: `${plural(B, 'open Class B violation')}. Class B is HPD's "hazardous" category.` })

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

function complaintFlags(c, flags) {
  const heat = count311(c, (t) => HEAT_RE.test(t))
  if (heat === null) return

  if (heat >= 10) flags.push({ id: 'heat', level: 'red', source: '311', title: 'Frequent heat complaints', reason: `${plural(heat, 'heat or hot water complaint')} to 311 in the last 2 years.` })
  else if (heat >= 3) flags.push({ id: 'heat', level: 'yellow', source: '311', title: 'Some heat complaints', reason: `${plural(heat, 'heat or hot water complaint')} to 311 in the last 2 years.` })
  else if (heat === 0) flags.push({ id: 'heat', level: 'green', source: '311', title: 'No heat complaints', reason: 'No heat or hot water complaints to 311 in the last 2 years.' })

  const plumbing = count311(c, (t) => /PLUMBING|WATER LEAK/i.test(t) && !/Construction/i.test(t))
  if (plumbing >= 10) flags.push({ id: 'plumbing', level: 'yellow', source: '311', title: 'Plumbing & leak complaints', reason: `${plural(plumbing, 'plumbing or leak complaint')} to 311 in the last 2 years.` })

  const elevator = count311(c, (t) => /^ELEVATOR$/i.test(t))
  if (elevator >= 5) flags.push({ id: 'elevator', level: 'yellow', source: '311', title: 'Elevator complaints', reason: `${plural(elevator, 'elevator complaint')} to 311 in the last 2 years.` })
}

function dobFlags(d, flags) {
  if (!d || d.error) return
  const activeSafety = d.items.filter((i) => i.status === 'Active' && i.livability).length
  if (activeSafety) flags.push({ id: 'dob-active', level: 'yellow', source: 'DOB', title: 'Open building safety complaints', reason: `${plural(activeSafety, 'active DOB complaint')} about safety or upkeep.` })
  else if (d.total === 0) flags.push({ id: 'dob-clear', level: 'green', source: 'DOB', title: 'No DOB complaints', reason: 'No Department of Buildings complaints in the last 3 years.' })
}

function evictionFlags(e, flags) {
  if (!e || e.error) return
  if (e.total >= 6) flags.push({ id: 'evictions', level: 'red', source: 'Marshals', title: 'Many evictions', reason: `${plural(e.total, 'residential eviction')} carried out in the last 5 years.` })
  else if (e.total >= 2) flags.push({ id: 'evictions', level: 'yellow', source: 'Marshals', title: 'Some evictions', reason: `${plural(e.total, 'residential eviction')} carried out in the last 5 years.` })
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
  // The city's own lists go first: the sort below is stable, so they lead their tier.
  aepFlags(record.aep, flags)
  vacateFlags(record.vacateOrders, flags)
  violationFlags(record.violations, flags)
  complaintFlags(record.complaints311, flags)
  dobFlags(record.dob, flags)
  evictionFlags(record.evictions, flags)
  litigationFlags(record.litigations, flags)
  bedbugFlags(record.bedbugs, flags)
  flags.sort((a, b) => ORDER[a.level] - ORDER[b.level])

  const counts = { red: 0, yellow: 0, green: 0 }
  for (const f of flags) counts[f.level]++

  let mood = 'happy'
  if (counts.red >= 2 || counts.yellow >= 4) mood = 'worried'
  else if (counts.red >= 1 || counts.yellow >= 2) mood = 'mixed'

  return { flags, counts, mood }
}

export const MOOD_COPY = {
  happy: { label: 'Mostly green flags', blurb: 'The public record here looks pretty calm.' },
  mixed: { label: 'Some yellow flags', blurb: 'A few things in the record worth asking about.' },
  worried: { label: 'Several red flags', blurb: 'The record shows some serious recurring issues.' },
}
