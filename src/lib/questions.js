// Template questions keyed by flag id. Neutral, factual, and phrased so a renter can
// ask them out loud: no advice, no accusations.

import { EN } from '../i18n/translator.js'

// Flag ids that have a question (q.<id> in the dictionary).
const TEMPLATES = new Set(['class-c', 'class-b', 'lead', 'pests', 'mold', 'heat', 'plumbing', 'elevator', 'dob-active', 'evictions', 'aep', 'vacate', 'litigation', 'harassment', 'bedbugs'])

// Questions driven by facts that aren't flags on their own.
const RECENT_SALE_YEARS = 2

function recordQuestions(record, insights, t) {
  const qs = []
  const fix = insights?.fixRate
  if (fix?.openOverYear > 0) {
    qs.push({ id: 'long-open', level: 'yellow', text: t('q.longOpen', { n: fix.openOverYear, year: String(fix.oldestOpenYear) }) })
  }
  if (insights?.trend?.direction === 'up') {
    qs.push({ id: 'trend-up', level: 'general', text: t('q.trendUp') })
  }
  const lifted = record?.vacateOrders?.orders?.find((o) => o.lifted)
  if (lifted && !record.vacateOrders.inEffect) {
    const year = lifted.effectiveDate?.slice(0, 4)
    // The reason is the city's own wording, quoted as published (lowercased to sit in a sentence).
    qs.push({ id: 'vacate-history', level: 'general', text: t(year ? 'q.vacateHistoryYear' : 'q.vacateHistory', { year, reason: lifted.reason.toLowerCase() }) })
  }
  const deed = record?.lastSale?.lastDeed
  if (deed?.date) {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - RECENT_SALE_YEARS)
    if (deed.date.slice(0, 10) >= cutoff.toISOString().slice(0, 10)) {
      qs.push({ id: 'recent-sale', level: 'general', text: t('q.recentSale', { year: deed.date.slice(0, 4) }) })
    }
  }
  return qs
}

const GENERAL = ['q.general1', 'q.general2']

export function questionsFor(flags, record, max = 5, insights, t = EN) {
  const qs = flags
    .filter((f) => f.level !== 'green' && TEMPLATES.has(f.id))
    .map((f) => ({ id: f.id, level: f.level, text: t(`q.${f.id}`) }))
    .slice(0, max)
  qs.push(...recordQuestions(record, insights, t))
  // Always offer a couple of general questions so the list is never empty.
  GENERAL.forEach((key, i) => qs.length < max + 1 && qs.push({ id: `general-${i}`, level: 'general', text: t(key) }))
  return qs
}
