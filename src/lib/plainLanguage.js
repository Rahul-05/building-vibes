import { EN } from '../i18n/translator.js'

// Minimal translation of city-speak into readable text. Deliberately conservative:
// strip legal citations, soften a few stock phrases, sentence-case. No reinterpretation.

// HPD descriptions open with a legal preamble ("§ 27-2005, 2007 ADM CODE & 309 M/D LAW ...",
// "567 (C) § 27-2017 HMC:", "§ 27-2045(B)(1)(B) HMC, § 12-06 RCNY ..."). We peel tokens off the
// front until we hit the actual instruction.
const PREAMBLE_TOKENS = [
  /^\d{3}\s*\(\s*[A-Z]\s*\)/i, // order codes like 567 (C)
  /^\(\s*[A-Z]\s*\)/i, // (A)
  /^§+/,
  /^\d+(-\d+)?(\.\d+)?(\s*\(\s*[A-Z0-9]+\s*\))*/i, // 27-2045(B)(1)(B), 2007, 309
  /^(HMC|MDL|RCNY|[MD]\/[MD]\s*LAW|ADM(IN)?\.?\s*CODE|AND|&|DEPT\.?\s*RULES\s*(AND|&)\s*REG(S|ULATIONS)\.?)(?![A-Z])/i,
  /^[,;:.\-–]/,
]

function stripPreamble(text) {
  let s = text.trim()
  for (let changed = true; changed; ) {
    changed = false
    for (const re of PREAMBLE_TOKENS) {
      const m = re.exec(s)
      if (m && m[0].length) {
        s = s.slice(m[0].length).trimStart()
        changed = true
      }
    }
  }
  return s
}

// Citations that occasionally appear mid-sentence.
const INLINE_CITATIONS = [/\s*§\s*[\d-]+(\.\d+)?/g, /\b(ADM(IN)?\.?\s*CODE|HMC)\b:?/gi]

// Order matters: longer phrases first.
const PHRASES = [
  [/TRACE AND REPAIR THE SOURCE AND ABATE THE NUISANCE CONSISTING OF/gi, 'find and fix the source of'],
  [/ABATE THE INFESTATION CONSISTING OF/gi, 'get rid of'],
  [/ABATE THE NUISANCE CONSISTING OF/gi, 'fix'],
  [/PROPERLY REPAIR WITH SIMILAR MATERIAL THE/gi, 'repair the'],
  [/PROPERLY REPAIR THE/gi, 'repair the'],
  [/TO THE SATISFACTION OF THIS DEPARTMENT/gi, ''],
  [/\.{2,}/g, ' '],
  [/\s*,?\s*USING WORK PRACTICES SET FORTH IN .*$/i, ''],
  [/IN THE ENTIRE APARTMENT/gi, 'in the apartment'],
]

export function sentenceCase(text) {
  const lower = text.toLowerCase().trim()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function plainViolation(raw, maxLength = 150) {
  let text = stripPreamble(raw || '')
  for (const re of INLINE_CITATIONS) text = text.replace(re, ' ')
  for (const [re, sub] of PHRASES) text = text.replace(re, sub)

  // The location tail ("LOCATED AT APT 2D, 2nd STORY, 3rd APARTMENT FROM SOUTH...") is noise for a summary.
  text = text.replace(/\s+LOCATED AT\s+.*$/i, '')
  text = text.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim()
  if (!text) return 'Housing code violation'

  text = sentenceCase(text)
    .replace(/\bapt\.? ?([a-z0-9-]+)/g, (_, unit) => `apt ${unit.toUpperCase()}`)
    .replace(/\bhpd\b/g, 'HPD')
    .replace(/([.!?]\s+)([a-z])/g, (_, gap, c) => gap + c.toUpperCase())

  if (text.length > maxLength) text = text.slice(0, maxLength).replace(/\s+\S*$/, '') + '…'
  return text
}

// Same violation written up in several apartments → one row with a count.
// Input is already ordered most-severe/newest first, so first occurrence wins.
export function groupViolations(items) {
  const groups = new Map()
  for (const v of items) {
    const text = plainViolation(v.description)
    const key = `${v.class}|${text}`
    if (!groups.has(key)) groups.set(key, { ...v, text, count: 0, units: new Set() })
    const g = groups.get(key)
    g.count++
    if (v.apartment) g.units.add(v.apartment)
  }
  return [...groups.values()]
}

// 311 complaint types → friendlier labels (complaintType.* in the dictionary). Unknown types are
// city text, so they just get sentence-cased and stay as published.
export function plainComplaintType(type, t = EN) {
  const key = `complaintType.${type}`
  return t.has(key) ? t(key) : sentenceCase(type.replace(/\//g, ' / '))
}

// HPD-routed housing complaints are uppercase in the 311 data; these are the
// mixed-case types that are also about conditions inside the building.
const HOUSING_MIXED_CASE = new Set([
  'Elevator', 'Rodent', 'Asbestos', 'Lead', 'Indoor Air Quality', 'Construction Lead Dust',
  'Indoor Sewage', 'Boilers', 'Water System', 'Mold', 'Unsanitary Animal Pvt Property',
  'Non-Residential Heat', 'Building/Use',
])

export function isHousingComplaint(type) {
  return type === type.toUpperCase() || HOUSING_MIXED_CASE.has(type)
}

export function formatDate(iso, t = EN) {
  return t.date(iso)
}

// English only (the AI summary); the UI uses t.count() so each language gets its own plurals.
export function plural(n, one, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}
