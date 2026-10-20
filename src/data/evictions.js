import { DATASETS, LOOKBACK_YEARS } from './config.js'
import { querySocrata, soqlString, yearsAgoIso } from './http.js'

/**
 * Residential evictions executed by NYC Marshals at this BBL in the lookback window.
 * Returns { total, lastDate, byYear: { 2025: n, ... } }.
 */
export async function fetchEvictions(place, opts) {
  const since = yearsAgoIso(LOOKBACK_YEARS.evictions)
  const rows = await querySocrata(DATASETS.evictions, {
    select: 'executed_date',
    where: `bbl=${soqlString(place.bbl)} AND residential_commercial_ind=${soqlString('Residential')} AND executed_date > ${soqlString(since)}`,
    order: 'executed_date DESC',
    limit: 500,
  }, opts)

  const byYear = {}
  for (const r of rows) {
    const year = r.executed_date?.slice(0, 4)
    if (year) byYear[year] = (byYear[year] || 0) + 1
  }

  return { total: rows.length, lastDate: rows[0]?.executed_date || null, byYear }
}
