import { REQUEST_TIMEOUT_MS, SOCRATA_BASE } from './config.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// One attempt: fetch() + JSON + timeout. Throws on non-2xx.
async function attempt(url, signal, timeout) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      const err = new Error(`Request failed (${res.status})`)
      err.retryable = res.status === 429 || res.status >= 500
      throw err
    }
    return await res.json()
  } catch (err) {
    // Our own timeout (not a caller abort) is worth one retry.
    if (err.name === 'AbortError' && !signal?.aborted) err.retryable = true
    // A dropped connection ("Failed to fetch" / "fetch failed") is a TypeError; also worth one retry.
    if (err.name === 'TypeError' && !signal?.aborted) err.retryable = true
    throw err
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

// GET JSON with a timeout and a single retry for transient failures (timeouts, 429, 5xx).
export async function getJson(url, { signal, timeout = REQUEST_TIMEOUT_MS, retries = 1 } = {}) {
  for (let i = 0; ; i++) {
    try {
      return await attempt(url, signal, timeout)
    } catch (err) {
      if (i >= retries || !err.retryable || signal?.aborted) throw err
      await sleep(700 * (i + 1))
    }
  }
}

// Build a SoQL query URL. `params` keys are SoQL clauses without the `$` (where, select, order, limit...).
export function soqlUrl(datasetId, params) {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) qs.set(`$${key}`, String(value))
  }
  return `${SOCRATA_BASE}/${datasetId}.json?${qs.toString()}`
}

export function querySocrata(datasetId, params, opts) {
  return getJson(soqlUrl(datasetId, params), opts)
}

// Socrata floating timestamp for "N years ago", e.g. 2021-10-20T00:00:00
export function yearsAgoIso(years) {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  return d.toISOString().slice(0, 10) + 'T00:00:00'
}

// Escape a value for a single-quoted SoQL string literal.
export function soqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

// Several datasets are one row per building, and a tax lot (BBL) can hold more than one building.
// When we know this building's BIN and some rows match it, keep just those ("building" scope);
// otherwise keep every row on the lot ("lot" scope) so the UI can say so honestly.
export function preferBin(rows, bin, binField = 'bin') {
  if (bin) {
    const mine = rows.filter((r) => String(r[binField] ?? '') === String(bin))
    if (mine.length) return { rows: mine, scope: 'building' }
  }
  const bins = new Set(rows.map((r) => String(r[binField] ?? '')).filter(Boolean))
  // A lot with a single known building is effectively building scope, unless that BIN isn't ours.
  const scope = bins.size <= 1 && !(bin && bins.size === 1) ? 'building' : 'lot'
  return { rows, scope }
}
