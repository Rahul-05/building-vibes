// Public surface of the data layer. UI code should only import from here.
import { geocodeAddress, suggestAddresses } from './geosearch.js'
import { fetchHpdViolations } from './hpd.js'
import { fetch311Complaints } from './complaints311.js'
import { fetchDobComplaints } from './dob.js'
import { fetchEvictions } from './evictions.js'

export { suggestAddresses, geocodeAddress }
export { fetchStory, askBuilding } from './ai.js'
export { DATASETS, LOOKBACK_YEARS } from './config.js'

export class AddressNotFoundError extends Error {
  constructor(query) {
    super(`No NYC building found for "${query}"`)
    this.name = 'AddressNotFoundError'
  }
}

/**
 * Address text (or an already-resolved place from suggestions) → full building record.
 * Each source is fetched independently; a failed source comes back as { error } instead
 * of sinking the whole lookup.
 */
export async function getBuildingRecord(input, opts = {}) {
  const place = typeof input === 'string' ? await geocodeAddress(input, opts) : input
  if (!place) throw new AddressNotFoundError(input)

  const sources = {
    violations: fetchHpdViolations,
    complaints311: fetch311Complaints,
    dob: fetchDobComplaints,
    evictions: fetchEvictions,
  }

  const keys = Object.keys(sources)
  const settled = await Promise.allSettled(keys.map((k) => sources[k](place, opts)))

  const record = { place, fetchedAt: new Date().toISOString() }
  keys.forEach((key, i) => {
    const s = settled[i]
    record[key] = s.status === 'fulfilled' ? s.value : { error: s.reason?.message || 'Unavailable' }
  })

  // If literally every source failed, surface it as a real error.
  if (keys.every((k) => record[k]?.error)) throw new Error('NYC Open Data is not responding right now.')
  return record
}
