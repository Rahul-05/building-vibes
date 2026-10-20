import { DATASETS } from './config.js'
import { preferBin, querySocrata } from './http.js'

// "Aep Round 18" → "Round 18"
const plainRound = (s) => (s || '').replace(/^aep\s*/i, '').replace(/^round/i, 'Round').trim() || null

/**
 * Has this building been picked for HPD's Alternative Enforcement Program (the city's
 * worst-conditions list)? Joined on the dataset's numeric `bbl`, narrowed by BIN when possible.
 * Returns { active, scope, listings: [{ round, startDate, dischargeDate, active, units, violationsAtStart }] }
 * newest first; listings is empty when the building has never been selected.
 */
export async function fetchAep(place, opts) {
  const rows = await querySocrata(DATASETS.aep, {
    select: 'bin, aep_round, aep_start_date, discharge_date, current_status, total_units, of_b_c_violations_at_start',
    where: `bbl=${Number(place.bbl)}`,
    order: 'aep_start_date DESC',
    limit: 20,
  }, opts)

  const { rows: mine, scope } = preferBin(rows, place.bin)
  const listings = mine.map((r) => ({
    round: plainRound(r.aep_round),
    startDate: r.aep_start_date || null,
    dischargeDate: r.discharge_date || null,
    active: r.current_status === 'AEP Active',
    units: r.total_units ? Number(r.total_units) : null,
    violationsAtStart: r.of_b_c_violations_at_start ? Number(r.of_b_c_violations_at_start) : null,
  }))

  return { active: listings.some((l) => l.active), scope, listings }
}
