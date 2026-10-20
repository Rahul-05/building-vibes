import { DATASETS } from './config.js'
import { querySocrata, soqlString } from './http.js'

// ACRIS deed types that convey ownership. Correction, confirmatory, timeshare, life-estate and
// in-rem deeds are left out: they don't represent a sale of the building.
const DEED_TYPES = { DEED: 'Deed', DEEDO: 'Deed (other)', 'DEED, RC': 'Deed with restrictive covenant', DEEDP: 'Deed (from before the RPT tax)' }
const BATCH = 120 // document ids per IN (...) query, keeps URLs a few KB

/**
 * Most recent deed for this exact tax lot, from ACRIS.
 * Join: Real Property Legals (borough/block/lot → document_id) then Real Property Master
 * (document_id → doc_type, document_date, document_amt). Verified 2026-10-20 against
 * 1520 Sedgwick Ave: the Feb 2012 deed's buyer (Parties dataset) is the same company HPD lists as owner.
 * Returns { lastDeed, lastPricedSale } (either may be null), or null when no deed is on file
 * (common for condo buildings, whose deeds are recorded against each unit's own lot).
 */
export async function fetchLastSale(place, opts) {
  const legals = await querySocrata(DATASETS.acrisLegals, {
    select: 'document_id',
    where: `borough=${Number(place.boroId)} AND block=${Number(place.block)} AND lot=${Number(place.lot)}`,
    limit: 2000,
  }, opts)

  // Modern ids start with the recording date (YYYYMMDD...); older ones are FT_/BK_ prefixed.
  // Newest-first, so the first batch usually contains the answer.
  const ids = [...new Set(legals.map((l) => l.document_id))].sort((a, b) => {
    const da = /^\d/.test(a), db = /^\d/.test(b)
    return da === db ? b.localeCompare(a) : da ? -1 : 1
  })
  if (!ids.length) return null

  const batches = []
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH))
  const types = Object.keys(DEED_TYPES).map(soqlString).join(',')
  const deedsIn = (batch) => querySocrata(DATASETS.acrisMaster, {
    select: 'document_id, doc_type, document_date, recorded_datetime, document_amt',
    where: `document_id in(${batch.map(soqlString).join(',')}) AND doc_type in(${types})`,
    limit: 500,
  }, opts)

  let deeds = await deedsIn(batches[0])
  if (batches.length > 1) {
    const rest = await Promise.all(batches.slice(1).map(deedsIn))
    deeds = deeds.concat(rest.flat())
  }
  if (!deeds.length) return null

  const toSale = (r) => ({
    date: r.document_date || r.recorded_datetime || null,
    amount: Number(r.document_amt || 0),
    type: DEED_TYPES[r.doc_type] || r.doc_type,
    documentId: r.document_id,
  })
  const sales = deeds.map(toSale).filter((s) => s.date).sort((a, b) => b.date.localeCompare(a.date))
  if (!sales.length) return null

  const lastDeed = sales[0]
  const lastPricedSale = sales.find((s) => s.amount > 0) || null

  // A deed can cover several tax lots, in which case the amount is for the whole package.
  const priced = [lastDeed, lastPricedSale].filter(Boolean)
  const lots = await querySocrata(DATASETS.acrisLegals, {
    select: 'document_id, borough, block, lot',
    where: `document_id in(${[...new Set(priced.map((s) => s.documentId))].map(soqlString).join(',')})`,
    limit: 2000,
  }, opts).catch(() => [])
  for (const s of priced) {
    const mine = lots.filter((l) => l.document_id === s.documentId)
    s.lots = new Set(mine.map((l) => `${l.borough}-${l.block}-${l.lot}`)).size || 1
  }

  return { lastDeed, lastPricedSale: lastPricedSale === lastDeed ? null : lastPricedSale }
}
