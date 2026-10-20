import { DATASETS } from './config.js'
import { preferBin, querySocrata, soqlString } from './http.js'

/**
 * Landlord-filed annual bedbug reports. Joined on the dataset's text `bbl`, narrowed by BIN.
 * Owners can amend a filing, so the same period can appear twice; the newest filing wins.
 * Returns { latest, filings, scope } or { latest: null, filings: 0 } when nothing was filed.
 * latest: { filedOn, periodStart, periodEnd, units, infested, eradicated, reinfested }
 */
export async function fetchBedbugs(place, opts) {
  const rows = await querySocrata(DATASETS.bedbugs, {
    select: 'bin, of_dwelling_units, infested_dwelling_unit_count, eradicated_unit_count, re_infested_dwelling_unit, filing_date, filing_period_start_date, filling_period_end_date',
    where: `bbl=${soqlString(place.bbl)}`,
    order: 'filing_date DESC',
    limit: 60,
  }, opts)

  const { rows: mine, scope } = preferBin(rows, place.bin)
  if (!mine.length) return { latest: null, filings: 0, scope }

  // On a multi-building lot without a BIN match, add up each building's newest filing.
  const newestPerBin = new Map()
  for (const r of mine) if (!newestPerBin.has(r.bin)) newestPerBin.set(r.bin, r)
  const latestRows = [...newestPerBin.values()]
  const sum = (field) => latestRows.reduce((n, r) => n + Number(r[field] || 0), 0)
  const first = latestRows[0]

  return {
    scope,
    filings: mine.length,
    buildings: latestRows.length,
    latest: {
      filedOn: first.filing_date || null,
      periodStart: first.filing_period_start_date || null,
      // (sic) the dataset's column really is spelled "filling_period_end_date"
      periodEnd: first.filling_period_end_date || null,
      units: sum('of_dwelling_units'),
      infested: sum('infested_dwelling_unit_count'),
      eradicated: sum('eradicated_unit_count'),
      reinfested: sum('re_infested_dwelling_unit'),
    },
  }
}
