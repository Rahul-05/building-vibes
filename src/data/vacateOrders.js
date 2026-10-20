import { DATASETS } from './config.js'
import { preferBin, querySocrata } from './http.js'

/**
 * HPD vacate orders (full or partial). Joined on the dataset's numeric `bbl`, narrowed by BIN.
 * An order counts as lifted only if it carries an actual rescind date on or before today.
 * Returns { orders: [...newest first], inEffect, scope }.
 */
export async function fetchVacateOrders(place, opts) {
  const rows = await querySocrata(DATASETS.vacateOrders, {
    select: 'bin, vacate_order_number, primary_vacate_reason, vacate_type, vacate_effective_date, actual_rescind_date, number_of_vacated_units',
    where: `bbl=${Number(place.bbl)}`,
    order: 'vacate_effective_date DESC',
    limit: 50,
  }, opts)

  const today = new Date().toISOString().slice(0, 10)
  const { rows: mine, scope } = preferBin(rows, place.bin)
  const orders = mine.map((r) => {
    const rescinded = r.actual_rescind_date || null
    return {
      id: r.vacate_order_number,
      reason: r.primary_vacate_reason || 'Reason not listed',
      // Dataset values: "Entire Building" or "Partial".
      type: /entire/i.test(r.vacate_type || '') ? 'Entire building' : r.vacate_type ? 'Partial' : null,
      effectiveDate: r.vacate_effective_date || null,
      rescindedDate: rescinded,
      lifted: Boolean(rescinded && rescinded.slice(0, 10) <= today),
      units: r.number_of_vacated_units ? Number(r.number_of_vacated_units) : null,
    }
  })

  return { orders, inEffect: orders.filter((o) => !o.lifted).length, scope }
}
