import { DATASETS, LOOKBACK_YEARS } from './config.js'
import { querySocrata, soqlString, yearsAgoIso } from './http.js'
import { DOB_CATEGORIES } from './dobCategories.js'

// Codes that most directly affect people living in the building (structure, exits, boiler,
// gas, electrical, elevators, plumbing, upkeep, unpermitted work in occupied buildings).
export const LIVABILITY_CODES = new Set([
  '10', '28', '30', '37', '38', '39', '40', '41', '43', '54', '56', '57', '58', '59',
  '62', '63', '64', '65', '6M', '6S', '73', '7J', '84', '94', '2K', '2L',
])

// date_entered is stored as MM/DD/YYYY text, so date filtering happens here, not in SoQL.
// Returns an ISO date string (YYYY-MM-DD) so it sorts and compares as text.
function parseUsDate(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '')
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null
}

/**
 * DOB complaints for this BIN within the lookback window.
 * Returns { total, active, items: [{ id, code, label, status, date, livability }] } newest first.
 * Returns null when the building has no usable BIN.
 */
export async function fetchDobComplaints(place, opts) {
  if (!place.bin) return null

  const rows = await querySocrata(DATASETS.dobComplaints, {
    select: 'complaint_number, status, date_entered, complaint_category',
    where: `bin=${soqlString(place.bin)}`,
    // complaint_number is a fixed-width numeric string, so text order ≈ chronological.
    order: 'complaint_number DESC',
    limit: 300,
  }, opts)

  const cutoff = yearsAgoIso(LOOKBACK_YEARS.dob).slice(0, 10)

  const items = rows
    .map((r) => {
      const date = parseUsDate(r.date_entered)
      const code = (r.complaint_category || '').toUpperCase()
      return {
        id: r.complaint_number,
        code,
        label: DOB_CATEGORIES[code] || `Building complaint (DOB category ${code || 'unknown'})`,
        status: r.status === 'ACTIVE' ? 'Active' : 'Closed',
        date,
        livability: LIVABILITY_CODES.has(code),
      }
    })
    .filter((item) => item.date && item.date >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    total: items.length,
    active: items.filter((i) => i.status === 'Active').length,
    items,
  }
}
