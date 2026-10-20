// Compact, plain-language summary of an already-fetched building record. This is the ONLY
// thing sent to the AI Worker, and the only thing the AI may talk about, so it carries
// exactly what the results page shows: flags, counts, and the top items in plain words.

import { MOOD_COPY, bedbugFilingIsRecent } from './scoring.js'
import { groupViolations, isHousingComplaint, plainComplaintType, plainViolation, plural } from './plainLanguage.js'

const day = (iso) => (iso ? iso.slice(0, 10) : null)
const UNAVAILABLE = 'unavailable right now'

function violationsSummary(v) {
  if (!v) return null
  if (v.error) return UNAVAILABLE
  return {
    openTotal: v.openTotal,
    openByClass: { C: v.openByClass.C, B: v.openByClass.B, A: v.openByClass.A },
    issuedLast5Years: v.recentTotal,
    topOpenIssues: groupViolations(v.openItems).slice(0, 6).map((g) => ({
      issue: plainViolation(g.description, 110),
      class: g.class,
      count: g.count,
      latest: day(g.date),
    })),
  }
}

function complaintsSummary(c) {
  if (!c) return null
  if (c.error) return UNAVAILABLE
  const housing = c.byType.filter((t) => isHousingComplaint(t.type))
  const street = c.byType.filter((t) => !isHousingComplaint(t.type))
  return {
    buildingComplaintsLast2Years: housing.reduce((n, t) => n + t.count, 0),
    themes: housing.slice(0, 6).map((t) => ({ theme: plainComplaintType(t.type), count: t.count, latest: day(t.lastDate) })),
    streetOrNeighborhoodComplaints: street.reduce((n, t) => n + t.count, 0),
  }
}

function dobSummary(d) {
  if (!d) return 'no DOB building ID matched this address'
  if (d.error) return UNAVAILABLE
  return {
    totalLast3Years: d.total,
    active: d.active,
    recent: d.items.slice(0, 4).map((i) => ({ complaint: i.label, status: i.status, date: i.date })),
  }
}

function evictionsSummary(e) {
  if (!e) return null
  if (e.error) return UNAVAILABLE
  return { residentialLast5Years: e.total, mostRecent: day(e.lastDate), byYear: e.byYear }
}

const sameLotNote = (x) => (x?.scope === 'lot' ? 'record is for another building on the same tax lot' : undefined)

function aepSummary(a) {
  if (!a) return null
  if (a.error) return UNAVAILABLE
  const l = a.listings[0]
  return {
    onAepListNow: a.active,
    everListed: a.listings.length > 0,
    latestListing: l ? { round: l.round, started: day(l.startDate), discharged: day(l.dischargeDate), openBCViolationsAtStart: l.violationsAtStart } : undefined,
    note: sameLotNote(a),
  }
}

function vacateSummary(v) {
  if (!v) return null
  if (v.error) return UNAVAILABLE
  return {
    total: v.orders.length,
    notLifted: v.inEffect,
    orders: v.orders.slice(0, 3).map((o) => ({ reason: o.reason, type: o.type, units: o.units, effective: day(o.effectiveDate), lifted: o.lifted ? day(o.rescindedDate) : 'not lifted' })),
    note: sameLotNote(v),
  }
}

function litigationSummary(l) {
  if (!l) return null
  if (l.error) return UNAVAILABLE
  return {
    casesAllTime: l.total,
    openedLast5Years: l.recentTotal,
    stillPending: l.open,
    harassmentFindingsLast5Years: l.recentHarassmentFindings,
    last5YearsByType: l.byType.slice(0, 5),
    mostRecent: l.latest ? { type: l.latest.type, status: l.latest.status, opened: day(l.latest.openedOn) } : undefined,
    note: sameLotNote(l),
  }
}

function bedbugSummary(b) {
  if (!b) return null
  if (b.error) return UNAVAILABLE
  if (!b.latest) return 'no landlord bedbug filing found (not a green flag: only some buildings must file)'
  const f = b.latest
  return {
    latestFiling: { filed: day(f.filedOn), period: `${day(f.periodStart)} to ${day(f.periodEnd)}`, apartments: f.units, infested: f.infested, eradicated: f.eradicated, reinfested: f.reinfested },
    filingIsRecent: bedbugFilingIsRecent(b),
    note: sameLotNote(b),
  }
}

function ownershipSummary(o, s) {
  const out = {}
  if (o?.error) out.owner = UNAVAILABLE
  else if (o) Object.assign(out, { owner: o.owners.join('; ') || undefined, managingAgent: o.managingAgent || undefined, hpdRegistrationLastFiled: day(o.registeredOn) })
  if (s?.error) out.lastSale = UNAVAILABLE
  else if (s?.lastDeed) {
    const deed = (d) => ({ date: day(d.date), amount: d.amount ? `$${Math.round(d.amount).toLocaleString()}` : 'no price recorded ($0)', taxLotsInDeed: d.lots > 1 ? d.lots : undefined })
    out.lastDeed = deed(s.lastDeed)
    if (s.lastPricedSale) out.lastDeedWithPrice = deed(s.lastPricedSale)
  }
  return Object.keys(out).length ? out : null
}

// Phase 4 context: building facts, per apartment rates, borough comparison, trend, fix rate.
function buildingSummary(record, insights) {
  const b = record.building
  if (b?.error) return UNAVAILABLE
  if (!b) return 'no PLUTO tax lot record found'
  return { yearBuilt: b.yearBuilt || undefined, apartments: b.unitsRes || undefined, buildingsOnTaxLot: b.buildings > 1 ? b.buildings : undefined, note: insights.units ? undefined : 'no apartment count, so flags use plain counts' }
}

function perApartmentSummary(record, units) {
  const v = record.violations
  if (!units || !v || v.error) return undefined
  const r = (n) => Math.round((n / units) * 100) / 100
  return { openViolations: r(v.openTotal), openClassC: r(v.openByClass.C) }
}

function comparisonSummary(b) {
  if (b.unavailable) return b.unavailable
  return { openViolations: b.lines.all, openClassC: b.lines.classC, basis: b.basis, note: 'context from the record, not a ranking of quality' }
}

function trendSummary(t) {
  if (t.unavailable) return UNAVAILABLE
  return {
    direction: t.headline,
    detail: t.detail,
    byYear: t.years.map((y) => ({ year: y.partial ? `${y.year} so far` : y.year, hpdViolations: y.violations ?? undefined, buildingComplaints311: y.complaints ?? undefined })),
  }
}

function fixRateSummary(f) {
  if (f.unavailable) return UNAVAILABLE
  return {
    summary: f.sentence,
    violationsIssuedLast5Years: f.issued,
    percentMarkedClosed: f.issued ? Math.round(f.closedShare * 100) : undefined,
    medianDaysToClose: f.medianDays ?? undefined,
    openMoreThanAYear: f.openOverYear,
    oldestOpenYear: f.oldestOpenYear ?? undefined,
  }
}

export function buildSummary(record, { flags, counts, mood }, insights) {
  return {
    address: [record.place.name, record.place.borough].filter(Boolean).join(', '),
    checkedOn: day(record.fetchedAt),
    overall: MOOD_COPY[mood].label,
    flagCounts: counts,
    flags: flags.map((f) => ({ level: f.level, title: f.title, detail: f.reason })),
    hpdViolations: violationsSummary(record.violations),
    complaints311: complaintsSummary(record.complaints311),
    dobComplaints: dobSummary(record.dob),
    evictions: evictionsSummary(record.evictions),
    alternativeEnforcementProgram: aepSummary(record.aep),
    vacateOrders: vacateSummary(record.vacateOrders),
    hpdHousingCourtCases: litigationSummary(record.litigations),
    bedbugReports: bedbugSummary(record.bedbugs),
    ownershipAndLastSale: ownershipSummary(record.ownership, record.lastSale),
    ...(insights && {
      building: buildingSummary(record, insights),
      openViolationsPerApartment: perApartmentSummary(record, insights.units),
      comparedWithBorough: comparisonSummary(insights.benchmark),
      trend: trendSummary(insights.trend),
      fixRate: fixRateSummary(insights.fixRate),
    }),
  }
}

// Offline fallback for "This building's story" when the AI helper is unavailable.
export function templateStory(summary) {
  const { red, yellow, green } = summary.flagCounts
  const parts = [`The public record for ${summary.address} shows ${plural(red, 'red flag')}, ${plural(yellow, 'yellow flag')}, and ${plural(green, 'green flag')}.`]

  const topIssue = summary.hpdViolations?.topOpenIssues?.[0]
  const topTheme = summary.complaints311?.themes?.[0]
  if (topTheme) parts.push(`The most common 311 topic in the last 2 years is ${topTheme.theme.toLowerCase()} (${plural(topTheme.count, 'complaint')}).`)
  if (topIssue) parts.push(`Among the open HPD violations: “${topIssue.issue}” (${plural(topIssue.count, 'listing')}).`)
  if (summary.alternativeEnforcementProgram?.onAepListNow) parts.push('It is currently in HPD’s Alternative Enforcement Program, the city’s list of buildings with the worst conditions.')
  if (summary.trend?.direction) parts.push(`${summary.trend.direction}. ${summary.trend.detail}`)
  if (summary.comparedWithBorough?.openViolations) parts.push(summary.comparedWithBorough.openViolations)
  if (summary.vacateOrders?.notLifted) parts.push(`HPD has ${plural(summary.vacateOrders.notLifted, 'vacate order')} here that hasn’t been lifted.`)
  const loaded = [summary.hpdViolations, summary.complaints311].every((s) => s && typeof s === 'object')
  if (!topIssue && !topTheme && loaded) parts.push('Not much shows up in the recent records we checked.')
  return parts.join(' ')
}
