import { DATASETS, LOOKBACK_YEARS } from './config.js'
import { preferBin, querySocrata, yearsAgoIso } from './http.js'

// HPD case types in plain words. Unknown types fall back to the raw label.
const CASE_TYPES = {
  'Tenant Action': 'Tenant repair case (HP action)',
  'Tenant Action/Harrassment': 'Tenant repair and harassment case',
  'Heat and Hot Water': 'Heat and hot water case',
  'Heat Supplemental Cases': 'Heat and hot water case, second round',
  Comprehensive: 'HPD case over many repairs',
  'Comp Supplemental Cases': 'Second round of an HPD repairs case',
  'Access Warrant - Non-Lead': 'HPD court order to get in and inspect or repair',
  'Access Warrant - lead': 'HPD court order to get in for lead paint work',
  'False Certification Non-Lead': 'Repairs reported done that HPD disputed',
  'Lead False Certification': 'Lead paint repairs reported done that HPD disputed',
  CONH: 'Certification of No Harassment review',
  '7A': '7A case (administrator appointed by the court)',
  'Failure to Register Only': 'Failure to register the building with HPD',
  'HLD - Other Case Type': 'Other HPD housing case',
}
export const plainCaseType = (t) => CASE_TYPES[t] || t || 'HPD housing case'

// "PENDING" and "APPLICATION PENDING" are still open; everything else (CLOSED, GRANTED - date,
// Rejected-, WithDrawn/Abandoned-, ...) is finished one way or another.
const isOpen = (status) => /PENDING/i.test(status || '')
// findingofharassment is "No Harassment", or "After Inquest"/"After Trial" when harassment was found.
const harassmentFound = (f) => /^After (Inquest|Trial)/i.test(f || '')

/**
 * HPD housing court cases for this lot. Joined on boroid/block/lot (never null in this dataset;
 * the text `bbl` column is blank for a few hundred rows), narrowed by BIN. Returns
 * { scope, total, open, recentTotal, recentHarassmentFindings, byType, latest } where "recent" means opened in the lookback window.
 */
export async function fetchLitigations(place, opts) {
  const lotRows = await querySocrata(DATASETS.litigations, {
    select: 'litigationid, bin, casetype, casestatus, caseopendate, casejudgement, findingofharassment',
    where: `boroid=${Number(place.boroId)} AND block=${Number(place.block)} AND lot=${Number(place.lot)}`,
    order: 'caseopendate DESC',
    limit: 1000,
  }, opts)
  const { rows, scope } = preferBin(lotRows, place.bin)

  const since = yearsAgoIso(LOOKBACK_YEARS.litigations)
  const recent = rows.filter((r) => r.caseopendate && r.caseopendate > since)

  const byType = {}
  for (const r of recent) {
    const t = plainCaseType(r.casetype)
    byType[t] = (byType[t] || 0) + 1
  }

  const toCase = (r) => ({
    type: plainCaseType(r.casetype),
    status: isOpen(r.casestatus) ? 'Open' : 'Closed',
    openedOn: r.caseopendate || null,
    judgement: r.casejudgement === 'YES',
    harassmentFound: harassmentFound(r.findingofharassment),
  })

  return {
    scope,
    total: rows.length,
    open: rows.filter((r) => isOpen(r.casestatus)).length,
    recentTotal: recent.length,
    recentHarassmentFindings: recent.filter((r) => harassmentFound(r.findingofharassment)).length,
    byType: Object.entries(byType).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    recent: recent.slice(0, 8).map(toCase),
    latest: rows[0] ? toCase(rows[0]) : null,
  }
}
