import { DATASETS, LOOKBACK_YEARS } from './config.js'
import { querySocrata, soqlString, yearsAgoIso } from './http.js'

// HPD violations are keyed by boroid/block/lot (numeric columns, unpadded).
function buildingWhere({ boroId, block, lot }) {
  return `boroid=${Number(boroId)} AND block=${Number(block)} AND lot=${Number(lot)}`
}

/**
 * Returns:
 *  openByClass: { A, B, C, I } counts of currently open violations (any age)
 *  recentTotal: all violations (open or closed) issued in the lookback window
 *  openItems:   most telling open violations, Class C first, newest first
 */
export async function fetchHpdViolations(place, opts) {
  const where = buildingWhere(place)
  const since = yearsAgoIso(LOOKBACK_YEARS.violations)
  const id = DATASETS.hpdViolations

  const [openGroups, recentCount, openItems] = await Promise.all([
    querySocrata(id, {
      select: 'class, count(*) AS n',
      where: `${where} AND violationstatus=${soqlString('Open')}`,
      group: 'class',
    }, opts),
    querySocrata(id, {
      select: 'count(*) AS n',
      where: `${where} AND inspectiondate > ${soqlString(since)}`,
    }, opts),
    querySocrata(id, {
      select: 'violationid, class, novdescription, currentstatus, inspectiondate, apartment, rentimpairing',
      where: `${where} AND violationstatus=${soqlString('Open')}`,
      order: 'class DESC, inspectiondate DESC',
      limit: 60,
    }, opts),
  ])

  const openByClass = { A: 0, B: 0, C: 0, I: 0 }
  for (const row of openGroups) {
    if (row.class in openByClass) openByClass[row.class] = Number(row.n)
  }

  return {
    openByClass,
    openTotal: openByClass.A + openByClass.B + openByClass.C,
    recentTotal: Number(recentCount[0]?.n || 0),
    openItems: openItems.map((r) => ({
      id: r.violationid,
      class: r.class,
      description: r.novdescription || '',
      status: r.currentstatus || '',
      date: r.inspectiondate || null,
      apartment: r.apartment || null,
      rentImpairing: r.rentimpairing === 'Y',
    })),
  }
}
