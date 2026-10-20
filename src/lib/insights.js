// Phase 4 "Smarts": building facts, per apartment rates, borough comparison, trend and fix rate.
// All of it is context computed from the fetched record. None of it adds or removes a flag or
// changes the mascot's mood (scoring.js only borrows the apartment count from here).

import { BENCHMARKS, benchmarksMeta } from '../data/index.js'
import { isHousingComplaint, plural } from './plainLanguage.js'

// Keep in sync with sizeGroup() in scripts/build-benchmarks.mjs.
export const sizeGroup = (units) => (units >= 3 ? 'apartments' : 'homes')

// Residential units on the tax lot, or null when PLUTO didn't load or has no count.
export function unitsFor(record) {
  const b = record?.building
  return b && !b.error && b.unitsRes > 0 ? b.unitsRes : null
}

// "about 1 for every 9 apartments" / "about 2.4 per apartment"
export function ratePhrase(count, units) {
  if (!units || !count) return ''
  const every = units / count
  if (every >= 1.5) return `about 1 for every ${Math.round(every).toLocaleString()} apartments`
  const per = count / units
  return `about ${per < 10 ? String(Math.round(per * 10) / 10) : Math.round(per).toLocaleString()} per apartment`
}

// "Built 1927 · 84 apartments"
export function buildingFactsLine(record) {
  const b = record?.building
  if (!b || b.error) return null
  const parts = []
  if (b.yearBuilt) parts.push(`Built ${b.yearBuilt}`)
  if (b.unitsRes) parts.push(b.buildings > 1 ? `${plural(b.unitsRes, 'apartment')} across ${b.buildings} buildings on this tax lot` : plural(b.unitsRes, 'apartment'))
  return parts.length ? parts.join(' · ') : null
}

// ---------------------------------------------------------------- borough comparison

const monthYear = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
const boroughPlace = (name) => (name === 'Bronx' ? 'the Bronx' : name)
const round4 = (x) => Math.round(x * 10000) / 10000

// Shares strictly below and strictly above a rate, read off the stored 1st..99th percentiles.
// Resolution is one percentage point, which is why the UI always says "about".
function position(dist, rate) {
  const x = round4(rate)
  return {
    below: dist.percentiles.filter((p) => p < x).length,
    above: dist.percentiles.filter((p) => p > x).length,
  }
}

function compareLine(dist, count, units, { what, zeroWhat, peers }) {
  if (count === 0) return `No ${zeroWhat}, like about ${Math.round(dist.zeroShare * 100)}% of ${peers}.`
  const { below, above } = position(dist, count / units)
  return below >= 50 || below >= above
    ? `More ${what} per apartment than about ${below}% of ${peers}.`
    : `Fewer ${what} per apartment than about ${above}% of ${peers}.`
}

/**
 * Where this lot's open violations per apartment sit among same borough, same size group lots
 * in the committed snapshot. Returns { lines, basis, peers, below, ... } or { unavailable: reason }.
 */
export function benchmarkFor(record) {
  const v = record?.violations
  const units = unitsFor(record)
  const borough = BENCHMARKS[record?.place?.boroId]
  if (!v || v.error) return { unavailable: 'HPD violations didn’t load, so there’s nothing to compare.' }
  if (record?.building?.error) return { unavailable: 'The apartment count (PLUTO) didn’t load, so there’s no borough comparison this time.' }
  if (!units) return { unavailable: 'PLUTO has no apartment count for this tax lot, so there’s no borough comparison.' }
  if (!borough) return { unavailable: 'No borough comparison is available for this address.' }

  const size = sizeGroup(units)
  const group = borough.groups[size]
  const place = boroughPlace(borough.name)
  const peers = size === 'apartments' ? `${borough.name} buildings with 3 or more apartments` : `${borough.name} homes with 1 or 2 apartments`
  const all = compareLine(group.all, v.openTotal, units, { what: 'open violations', zeroWhat: 'open violations right now', peers })
  const classC = compareLine(group.classC, v.openByClass.C, units, { what: 'open Class C violations', zeroWhat: 'open Class C violations', peers })

  return {
    peers,
    lots: group.lots,
    rate: v.openTotal / units,
    below: v.openTotal ? position(group.all, v.openTotal / units).below : 0,
    lines: { all, classC },
    basis: `Compared with buildings across ${place}. NYC Open Data snapshot, ${monthYear(benchmarksMeta.snapshotDate)}.`,
  }
}

// ---------------------------------------------------------------- trend

const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
function monthsBack(now, n) {
  return ym(new Date(now.getFullYear(), now.getMonth() - n, 1))
}

/**
 * Yearly buckets plus last 12 full months vs the 12 before, for HPD violations issued and
 * building related 311 complaints. The current month is left out of the 12 month comparison
 * so a half finished month can't make things look calmer than they are.
 */
export function trendFor(record, now = new Date()) {
  const vh = record?.violationHistory
  const ch = record?.complaintHistory
  const hasV = vh && !vh.error
  const hasC = ch && !ch.error
  if (!hasV && !hasC) return { unavailable: true }

  const vMonths = hasV ? vh.monthly.map((m) => ({ month: m.month, count: m.issued })) : []
  const cMonths = hasC ? ch.monthly.filter((m) => isHousingComplaint(m.type)) : []

  const lastStart = monthsBack(now, 12)
  const priorStart = monthsBack(now, 24)
  const current = ym(now)
  const sumBetween = (rows, from, to) => rows.filter((r) => r.month >= from && r.month < to).reduce((n, r) => n + r.count, 0)

  const last = { violations: sumBetween(vMonths, lastStart, current), complaints: sumBetween(cMonths, lastStart, current) }
  const prior = { violations: sumBetween(vMonths, priorStart, lastStart), complaints: sumBetween(cMonths, priorStart, lastStart) }
  const lastTotal = (hasV ? last.violations : 0) + (hasC ? last.complaints : 0)
  const priorTotal = (hasV ? prior.violations : 0) + (hasC ? prior.complaints : 0)

  let direction = 'flat'
  if (lastTotal + priorTotal < TREND.minReports) direction = 'quiet'
  else if (lastTotal >= priorTotal * TREND.up && lastTotal - priorTotal >= TREND.minChange) direction = 'up'
  else if (lastTotal <= priorTotal * TREND.down && priorTotal - lastTotal >= TREND.minChange) direction = 'down'

  const thisYear = now.getFullYear()
  const years = []
  for (let y = thisYear - 4; y <= thisYear; y++) {
    const inYear = (rows) => rows.filter((r) => r.month.startsWith(`${y}-`)).reduce((n, r) => n + r.count, 0)
    years.push({ year: y, violations: hasV ? inYear(vMonths) : null, complaints: hasC ? inYear(cMonths) : null, partial: y === thisYear })
  }

  const counts = (p) => [hasV && plural(p.violations, 'HPD violation'), hasC && plural(p.complaints, 'building complaint') + ' to 311'].filter(Boolean).join(' and ')
  const detail = `Last 12 full months: ${counts(last)}. The 12 months before: ${counts(prior)}.`

  return {
    direction,
    headline: TREND_HEADLINES[direction],
    detail,
    last,
    prior,
    lastTotal,
    priorTotal,
    years,
    sources: { violations: hasV, complaints: hasC },
  }
}

export const TREND = { up: 1.25, down: 0.8, minChange: 3, minReports: 10 }
const TREND_HEADLINES = {
  up: 'Reports are climbing',
  down: 'Reports have eased over the last year',
  flat: 'Reports are holding about steady',
  quiet: 'Too few reports to call a trend',
}

// ---------------------------------------------------------------- fix rate

/**
 * Record facts about how violations get closed: share of the last 5 years' violations marked
 * closed, median days from notice to close, and open violations issued more than a year ago.
 */
export function fixRateFor(record, now = new Date()) {
  const vh = record?.violationHistory
  if (!vh || vh.error) return { unavailable: true }

  const issued = vh.monthly.reduce((n, m) => n + m.issued, 0)
  const closed = vh.monthly.reduce((n, m) => n + m.closed, 0)
  const yearAgo = new Date(now)
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const cutoff = yearAgo.toISOString().slice(0, 10)
  const old = vh.openByDay.filter((d) => d.date < cutoff)
  const openOverYear = old.reduce((n, d) => n + d.count, 0)
  const oldestOpenYear = old.length ? Number(old[0].date.slice(0, 4)) : null
  const median = vh.daysToClose.counted >= FIX.minClosedForMedian ? vh.daysToClose.median : null

  const sentences = []
  if (issued) {
    const share = Math.round((closed / issued) * 100)
    sentences.push(`Of the ${plural(issued, 'violation')} issued in the last 5 years, ${share}% ${share === 1 ? 'is' : 'are'} marked closed.`)
    if (median !== null) sentences.push(`The typical fix took about ${plural(median, 'day')}.`)
  } else {
    sentences.push('No HPD violations were issued here in the last 5 years.')
  }
  if (openOverYear) sentences.push(`${plural(openOverYear, 'open violation')} ${openOverYear === 1 ? 'was' : 'were'} issued more than a year ago, the oldest in ${oldestOpenYear}.`)

  return {
    issued,
    closed,
    closedShare: issued ? closed / issued : null,
    medianDays: median,
    medianSampled: vh.daysToClose.sampled,
    openOverYear,
    oldestOpenYear,
    sentence: sentences.join(' '),
  }
}

export const FIX = { minClosedForMedian: 3 }

// Everything above in one object, for the results page, the AI summary and compare mode.
export function computeInsights(record) {
  return {
    units: unitsFor(record),
    factsLine: buildingFactsLine(record),
    benchmark: benchmarkFor(record),
    trend: trendFor(record),
    fixRate: fixRateFor(record),
  }
}
