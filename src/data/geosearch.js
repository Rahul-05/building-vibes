import { GEOSEARCH_BASE } from './config.js'
import { getJson } from './http.js'

const BOROUGHS = { 1: 'Manhattan', 2: 'Bronx', 3: 'Brooklyn', 4: 'Queens', 5: 'Staten Island' }

// BBL = 1 digit borough + 5 digit block + 4 digit lot.
export function parseBbl(bbl) {
  const s = String(bbl || '')
  if (!/^\d{10}$/.test(s)) return null
  return {
    bbl: s,
    boroId: s.slice(0, 1),
    block: String(Number(s.slice(1, 6))),
    lot: String(Number(s.slice(6, 10))),
  }
}

// DOB uses placeholder "million BINs" (1000000, 2000000, ...) for lots without a real building.
// Querying with one would match unrelated records, so treat them as missing.
function cleanBin(bin) {
  const s = String(bin || '')
  if (!/^\d{7}$/.test(s) || /^\d000000$/.test(s)) return null
  return s
}

function featureToPlace(feature) {
  const props = feature?.properties || {}
  const pad = props.addendum?.pad || {}
  const parsed = parseBbl(pad.bbl)
  if (!parsed) return null
  return {
    label: props.label?.replace(/, USA$/, '') || props.name,
    name: props.name,
    borough: props.borough || BOROUGHS[parsed.boroId],
    ...parsed,
    bin: cleanBin(pad.bin),
  }
}

// Resolve free text to a single building. Returns null if nothing with a BBL matched.
export async function geocodeAddress(text, opts) {
  const url = `${GEOSEARCH_BASE}/search?text=${encodeURIComponent(text)}&size=1`
  const data = await getJson(url, opts)
  return featureToPlace(data.features?.[0])
}

// Lightweight suggestions for the search box.
export async function suggestAddresses(text, opts) {
  if (!text || text.trim().length < 3) return []
  const url = `${GEOSEARCH_BASE}/autocomplete?text=${encodeURIComponent(text)}`
  const data = await getJson(url, { ...opts, timeout: 8000 })
  return (data.features || []).map(featureToPlace).filter(Boolean).slice(0, 5)
}
