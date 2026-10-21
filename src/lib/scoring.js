// Transparent, rule-based flags. Every rule is a plain threshold on a public count,
// and the same rules are shown to users in "How we pick flags". No hidden weights.
//
// Flag shape: { id, level: 'red'|'yellow'|'green', title, reason, source }

import { EN } from '../i18n/translator.js'
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

// The explainer lines, in the visitor's language (rules.* in the dictionary).
export function rulesFor(t = EN) {
  const keys = Array.from({ length: 16 }, (_, i) => `rules.${i + 1}`)
  const vars = {
    'rules.1': { every: EVERY.classCRed },
    'rules.2': { every: EVERY.classBYellow },
    'rules.5': { red: EVERY.heatRed, yellow: EVERY.heatYellow },
    'rules.6': { every: EVERY.plumbing },
    'rules.9': { red: EVERY.evictionsRed, yellow: EVERY.evictionsYellow },
  }
  return keys.map((k) => t(k, vars[k]))
}

// Context shown next to the flags. Documented here so the explainer matches the code; none of it
// adds or removes a flag or moves the mascot.
export function contextRulesFor(t = EN) {
  return [
    t('rules.context1'),
    t('rules.context2'),
    t('rules.context3', { upPct: t.pct(TREND.up - 1), downPct: t.pct(1 - TREND.down), minChange: TREND.minChange, minReports: TREND.minReports }),
    t('rules.context4', { minClosed: FIX.minClosedForMedian }),
  ]
}

function count311(complaints, predicate) {
  if (!complaints || complaints.error) return null
  return complaints.byType.filter((t) => predicate(t.type)).reduce((n, t) => n + t.count, 0)
}

// "12 open Class C violations, about 1 for every 8 apartments"
const withRate = (text, count, units, t) => (units ? t('rate.with', { text, rate: ratePhrase(count, units, t) }) : text)

function violationFlags(v, flags, units, t) {
  if (!v || v.error) return
  const { C, B } = v.openByClass

  const cReason = t('flag.classC.reason', { count: withRate(t.count('openClassC', C), C, units, t) })
  if (C >= 3 && meetsRate(C, units, EVERY.classCRed)) flags.push({ id: 'class-c', level: 'red', source: 'HPD', title: t('flag.classC.title', { n: C }), reason: cReason })
  else if (C > 0) flags.push({ id: 'class-c', level: 'yellow', source: 'HPD', title: t('flag.classC.title', { n: C }), reason: cReason })
  else flags.push({ id: 'class-c', level: 'green', source: 'HPD', title: t('flag.classC.greenTitle'), reason: t('flag.classC.greenReason') })

  if (B >= 10 && meetsRate(B, units, EVERY.classBYellow)) flags.push({ id: 'class-b', level: 'yellow', source: 'HPD', title: t('flag.classB.title'), reason: t('flag.classB.reason', { count: withRate(t.count('openClassB', B), B, units, t) }) })

  // Keyword checks run on the sample of open violations we fetched (up to 60, most severe first).
  const descs = v.openItems.map((i) => i.description)
  const lead = descs.filter((d) => LEAD_RE.test(d)).length
  const pests = descs.filter((d) => PEST_RE.test(d)).length
  const mold = descs.filter((d) => MOLD_RE.test(d)).length

  // Phrase honestly when we only checked a sample of a large open-violation list.
  const checked = v.openItems.length
  const mentions = (n, what) => t(checked < v.openTotal ? 'flag.mentionsSample' : 'flag.mentionsAll', { n, checked, what: t(`flag.what.${what}`) })

  if (lead) flags.push({ id: 'lead', level: 'red', source: 'HPD', title: t('flag.lead.title'), reason: mentions(lead, 'lead') })
  if (pests) flags.push({ id: 'pests', level: 'yellow', source: 'HPD', title: t('flag.pests.title'), reason: mentions(pests, 'pests') })
  if (mold) flags.push({ id: 'mold', level: 'yellow', source: 'HPD', title: t('flag.mold.title'), reason: mentions(mold, 'mold') })
}

function complaintFlags(c, flags, units, t) {
  const heat = count311(c, (type) => HEAT_RE.test(type))
  if (heat === null) return

  const heatReason = t('flag.to311', { count: withRate(t.count('heatComplaint', heat), heat, units, t) })
  if (heat >= 10 && meetsRate(heat, units, EVERY.heatRed)) flags.push({ id: 'heat', level: 'red', source: '311', title: t('flag.heat.redTitle'), reason: heatReason })
  else if (heat >= 3 && meetsRate(heat, units, EVERY.heatYellow)) flags.push({ id: 'heat', level: 'yellow', source: '311', title: t('flag.heat.yellowTitle'), reason: heatReason })
  else if (heat === 0) flags.push({ id: 'heat', level: 'green', source: '311', title: t('flag.heat.greenTitle'), reason: t('flag.heat.greenReason') })

  const plumbing = count311(c, (type) => /PLUMBING|WATER LEAK/i.test(type) && !/Construction/i.test(type))
  if (plumbing >= 10 && meetsRate(plumbing, units, EVERY.plumbing)) flags.push({ id: 'plumbing', level: 'yellow', source: '311', title: t('flag.plumbing.title'), reason: t('flag.to311', { count: withRate(t.count('plumbingComplaint', plumbing), plumbing, units, t) }) })

  const elevator = count311(c, (type) => /^ELEVATOR$/i.test(type))
  if (elevator >= 5) flags.push({ id: 'elevator', level: 'yellow', source: '311', title: t('flag.elevator.title'), reason: t('flag.elevator.reason', { count: t.count('elevatorComplaint', elevator) }) })
}

function dobFlags(d, flags, t) {
  if (!d || d.error) return
  const activeSafety = d.items.filter((i) => i.status === 'Active' && i.livability).length
  if (activeSafety) flags.push({ id: 'dob-active', level: 'yellow', source: 'DOB', title: t('flag.dob.title'), reason: t('flag.dob.reason', { count: t.count('activeDob', activeSafety) }) })
  else if (d.total === 0) flags.push({ id: 'dob-clear', level: 'green', source: 'DOB', title: t('flag.dob.greenTitle'), reason: t('flag.dob.greenReason') })
}

function evictionFlags(e, flags, units, t) {
  if (!e || e.error) return
  const source = t('flagSource.marshals')
  const reason = t('flag.evictions.reason', { count: withRate(t.count('residentialEviction', e.total), e.total, units, t) })
  if (e.total >= 6 && meetsRate(e.total, units, EVERY.evictionsRed)) flags.push({ id: 'evictions', level: 'red', source, title: t('flag.evictions.redTitle'), reason })
  else if (e.total >= 2 && meetsRate(e.total, units, EVERY.evictionsYellow)) flags.push({ id: 'evictions', level: 'yellow', source, title: t('flag.evictions.yellowTitle'), reason })
  else if (e.total === 0) flags.push({ id: 'evictions', level: 'green', source, title: t('flag.evictions.greenTitle'), reason: t('flag.evictions.greenReason') })
}

// Wording for rows that belong to another building on the same tax lot (no BIN match).
const sameLot = (scope, t) => (scope === 'lot' ? ` ${t('flag.sameLot')}` : '')

// "Round 18" from the AEP data, in the visitor's language when it has that shape.
export function aepRound(round, t = EN) {
  const m = /^Round (\d+)$/.exec(round || '')
  return m ? t('deeper.status.round', { round: m[1] }) : round
}

function aepFlags(a, flags, t) {
  if (!a || a.error || !a.active) return
  const current = a.listings.find((l) => l.active)
  const detail = [aepRound(current?.round, t), current?.startDate && t('flag.aep.since', { year: current.startDate.slice(0, 4) })].filter(Boolean).join(', ')
  flags.push({
    id: 'aep',
    level: a.scope === 'lot' ? 'yellow' : 'red',
    source: t('flagSource.aep'),
    title: t('flag.aep.title'),
    reason: t('flag.aep.reason', { extra: `${detail ? ` (${detail})` : ''}${sameLot(a.scope, t)}` }),
  })
}

function vacateFlags(v, flags, t) {
  if (!v || v.error || !v.inEffect) return
  flags.push({
    id: 'vacate',
    level: v.scope === 'lot' ? 'yellow' : 'red',
    source: 'HPD',
    title: t('flag.vacate.title'),
    reason: t('flag.vacate.reason', { count: t.count('hpdVacateOrder', v.inEffect), extra: sameLot(v.scope, t) }),
  })
}

function litigationFlags(l, flags, t) {
  if (!l || l.error) return
  const n = l.recentTotal
  const source = t('flagSource.court')
  const pending = l.open ? ` ${t('flag.litigation.pending', { n: l.open })}` : ''
  const reason = t('flag.litigation.reason', { count: t.count('housingCourtCase', n), extra: sameLot(l.scope, t) }) + pending
  if (n >= 15) flags.push({ id: 'litigation', level: 'red', source, title: t('flag.litigation.redTitle'), reason })
  else if (n >= 5 || l.open > 0) flags.push({ id: 'litigation', level: 'yellow', source, title: t(l.open && n < 5 ? 'flag.litigation.pendingTitle' : 'flag.litigation.yellowTitle'), reason })
  else if (n === 0) flags.push({ id: 'litigation', level: 'green', source, title: t('flag.litigation.greenTitle'), reason: t('flag.litigation.greenReason') })

  if (l.recentHarassmentFindings > 0) flags.push({ id: 'harassment', level: 'red', source, title: t('flag.harassment.title'), reason: t('flag.harassment.reason', { count: t.count('hpdCourtCase', l.recentHarassmentFindings) }) })
}

export function bedbugFilingIsRecent(b, now = new Date()) {
  const end = b?.latest?.periodEnd
  if (!end) return false
  const cutoff = new Date(now)
  cutoff.setFullYear(cutoff.getFullYear() - 2)
  return end.slice(0, 10) >= cutoff.toISOString().slice(0, 10)
}

function bedbugFlags(b, flags, t) {
  if (!b || b.error || !b.latest || !bedbugFilingIsRecent(b)) return
  const { infested, units } = b.latest
  if (!infested) return
  const share = units ? infested / units : 0
  const source = t('flagSource.bedbug')
  const reason = t('flag.bedbugs.reason', { infested, count: t.count('apartment', units), extra: sameLot(b.scope, t) })
  if (infested >= 5 || share >= 0.1) flags.push({ id: 'bedbugs', level: 'red', source, title: t('flag.bedbugs.redTitle'), reason })
  else flags.push({ id: 'bedbugs', level: 'yellow', source, title: t('flag.bedbugs.yellowTitle'), reason })
}

const ORDER = { red: 0, yellow: 1, green: 2 }

// t: translator for the flag titles and reasons (English for the AI summary).
export function scoreRecord(record, t = EN) {
  const flags = []
  const units = unitsFor(record)
  // The city's own lists go first: the sort below is stable, so they lead their tier.
  aepFlags(record.aep, flags, t)
  vacateFlags(record.vacateOrders, flags, t)
  violationFlags(record.violations, flags, units, t)
  complaintFlags(record.complaints311, flags, units, t)
  dobFlags(record.dob, flags, t)
  evictionFlags(record.evictions, flags, units, t)
  litigationFlags(record.litigations, flags, t)
  bedbugFlags(record.bedbugs, flags, t)
  flags.sort((a, b) => ORDER[a.level] - ORDER[b.level])

  const counts = { red: 0, yellow: 0, green: 0 }
  for (const f of flags) counts[f.level]++

  let mood = 'happy'
  if (counts.red >= 2 || counts.yellow >= 4) mood = 'worried'
  else if (counts.red >= 1 || counts.yellow >= 2) mood = 'mixed'

  return { flags, counts, mood, units }
}

// One line for the explainer saying which way this building was scored.
export function scoringBasis(record, t = EN) {
  const units = unitsFor(record)
  if (units) return t('basis.units', { count: t.count('apartment', units) })
  if (record?.building?.error) return t('basis.plutoError')
  return t('basis.noUnits')
}

export const MOODS = ['happy', 'mixed', 'worried']
export const moodLabel = (mood, t = EN) => t(`mood.${mood}.label`)
export const moodBlurb = (mood, t = EN) => t(`mood.${mood}.blurb`)
