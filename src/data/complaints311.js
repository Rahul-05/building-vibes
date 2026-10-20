import { DATASETS, LOOKBACK_YEARS } from './config.js'
import { querySocrata, soqlString, yearsAgoIso } from './http.js'

/**
 * 311 requests at this BBL over the lookback window, grouped by complaint type.
 * Returns { total, byType: [{ type, count, lastDate }] } sorted by count desc.
 */
export async function fetch311Complaints(place, opts) {
  const since = yearsAgoIso(LOOKBACK_YEARS.complaints311)
  const rows = await querySocrata(DATASETS.serviceRequests311, {
    select: 'complaint_type, count(*) AS n, max(created_date) AS last_date',
    where: `bbl=${soqlString(place.bbl)} AND created_date > ${soqlString(since)}`,
    group: 'complaint_type',
    order: 'n DESC',
    limit: 50,
  }, opts)

  const byType = rows.map((r) => ({
    type: r.complaint_type || 'Other',
    count: Number(r.n),
    lastDate: r.last_date || null,
  }))

  return { total: byType.reduce((sum, t) => sum + t.count, 0), byType }
}
