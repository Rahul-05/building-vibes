import { DATASETS } from './config.js'
import { querySocrata } from './http.js'

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v))

/**
 * Building facts for this tax lot from PLUTO: apartment count, year built, building class.
 * PLUTO is one row per tax lot, keyed by a numeric `bbl`. Counts cover the whole lot, the
 * same scope as the HPD violation and 311 counts they're divided into.
 * Returns { unitsRes, unitsTotal, yearBuilt, buildingClass, buildings, version }, or null when
 * PLUTO has no row for the lot. Zero values (unknown or none) come back as null.
 */
export async function fetchBuildingFacts(place, opts) {
  const rows = await querySocrata(DATASETS.pluto, {
    select: 'unitsres, unitstotal, yearbuilt, bldgclass, numbldgs, version',
    where: `bbl=${Number(place.bbl)}`,
    limit: 1,
  }, opts)
  const r = rows[0]
  if (!r) return null
  const positive = (v) => (num(v) > 0 ? num(v) : null)
  return {
    unitsRes: positive(r.unitsres),
    unitsTotal: positive(r.unitstotal),
    yearBuilt: positive(r.yearbuilt),
    buildingClass: r.bldgclass || null,
    buildings: positive(r.numbldgs),
    version: r.version || null,
  }
}
