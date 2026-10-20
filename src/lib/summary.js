// Compact, plain-language summary of an already-fetched building record. This is the ONLY
// thing sent to the AI Worker, and the only thing the AI may talk about, so it carries
// exactly what the results page shows: flags, counts, and the top items in plain words.

import { MOOD_COPY } from './scoring.js'
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

export function buildSummary(record, { flags, counts, mood }) {
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
  const loaded = [summary.hpdViolations, summary.complaints311].every((s) => s && typeof s === 'object')
  if (!topIssue && !topTheme && loaded) parts.push('Not much shows up in the recent records we checked.')
  return parts.join(' ')
}
