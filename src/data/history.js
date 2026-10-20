import { DATASETS, LOOKBACK_YEARS } from './config.js'
import { querySocrata, soqlString, yearsAgoIso } from './http.js'

// Phase 4 "trend and fix rate". Kept apart from hpd.js / complaints311.js so a slow or failed
// history query only drops the trend, never the main sections.

const lotWhere = ({ boroId, block, lot }) => `boroid=${Number(boroId)} AND block=${Number(block)} AND lot=${Number(lot)}`
const month = (iso) => (iso ? iso.slice(0, 7) : null)
const DAY_MS = 86400000
const CLOSED_SAMPLE = 5000

/**
 * HPD violations over the lookback window (same window as hpd.js's recentTotal), plus the
 * age of every currently open A/B/C violation. Returns:
 *  monthly:      [{ month: 'YYYY-MM', issued, closed }] by inspection month
 *  daysToClose:  { median, counted, sampled } from notice date to the date the status changed to closed
 *  openByDay:    [{ date: 'YYYY-MM-DD', count }] open A/B/C violations by inspection date (any age)
 */
export async function fetchViolationHistory(place, opts) {
  const where = lotWhere(place)
  const since = yearsAgoIso(LOOKBACK_YEARS.violations)
  const id = DATASETS.hpdViolations
  const recent = `${where} AND inspectiondate > ${soqlString(since)}`

  const [byMonth, closedRows, openRows] = await Promise.all([
    querySocrata(id, {
      select: 'date_trunc_ym(inspectiondate) AS m, violationstatus, count(*) AS n',
      where: recent,
      group: 'm, violationstatus',
      limit: 1000,
    }, opts),
    querySocrata(id, {
      select: 'inspectiondate, novissueddate, currentstatusdate',
      where: `${recent} AND violationstatus=${soqlString('Close')}`,
      order: 'inspectiondate DESC',
      limit: CLOSED_SAMPLE,
    }, opts),
    querySocrata(id, {
      select: 'date_trunc_ymd(inspectiondate) AS d, count(*) AS n',
      where: `${where} AND violationstatus=${soqlString('Open')} AND class in('A','B','C')`,
      group: 'd',
      order: 'd',
      limit: 5000,
    }, opts),
  ])

  const months = new Map()
  for (const r of byMonth) {
    const m = month(r.m)
    if (!m) continue
    const row = months.get(m) || { month: m, issued: 0, closed: 0 }
    row.issued += Number(r.n)
    if (r.violationstatus === 'Close') row.closed += Number(r.n)
    months.set(m, row)
  }

  const days = []
  for (const r of closedRows) {
    const start = r.novissueddate || r.inspectiondate
    if (!start || !r.currentstatusdate) continue
    const d = Math.round((Date.parse(r.currentstatusdate) - Date.parse(start)) / DAY_MS)
    if (d >= 0) days.push(d)
  }
  days.sort((a, b) => a - b)
  const median = days.length ? (days.length % 2 ? days[(days.length - 1) / 2] : Math.round((days[days.length / 2 - 1] + days[days.length / 2]) / 2)) : null

  return {
    monthly: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    daysToClose: { median, counted: days.length, sampled: closedRows.length >= CLOSED_SAMPLE },
    openByDay: openRows.filter((r) => r.d).map((r) => ({ date: r.d.slice(0, 10), count: Number(r.n) })),
  }
}

/**
 * 311 requests at this BBL by month and complaint type over the violations lookback window
 * (longer than the 2 year complaints section, so the trend has history). Returns
 * { monthly: [{ month: 'YYYY-MM', type, count }] }; the UI keeps only building complaints.
 */
export async function fetch311History(place, opts) {
  const since = yearsAgoIso(LOOKBACK_YEARS.violations)
  const rows = await querySocrata(DATASETS.serviceRequests311, {
    select: 'date_trunc_ym(created_date) AS m, complaint_type, count(*) AS n',
    where: `bbl=${soqlString(place.bbl)} AND created_date > ${soqlString(since)}`,
    group: 'm, complaint_type',
    limit: 10000,
  }, opts)
  return {
    monthly: rows.filter((r) => r.m).map((r) => ({ month: month(r.m), type: r.complaint_type || 'Other', count: Number(r.n) })),
  }
}
