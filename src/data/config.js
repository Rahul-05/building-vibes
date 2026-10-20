// Central list of every external endpoint the app touches.
// All are public, keyless, and CORS-enabled, so they're called straight from the browser.
// Schemas last verified: 2026-10-20 (see README).

export const GEOSEARCH_BASE = 'https://geosearch.planninglabs.nyc/v2'

export const SOCRATA_BASE = 'https://data.cityofnewyork.us/resource'

export const DATASETS = {
  hpdViolations: 'wvxf-dwi5', // HPD Housing Maintenance Code Violations
  serviceRequests311: 'erm2-nwe9', // 311 Service Requests from 2010 to Present
  dobComplaints: 'eabe-havv', // DOB Complaints Received
  evictions: '6z8x-wfk4', // Evictions (executed by NYC Marshals)
}

// How far back we look for "recent" activity, in years.
export const LOOKBACK_YEARS = {
  violations: 5,
  complaints311: 2,
  dob: 3,
  evictions: 5,
}

export const REQUEST_TIMEOUT_MS = 20000

// Phase 2 AI helper (Cloudflare Worker in worker/). It holds the Gemini key; the browser never sees it.
// The deploy step replaces PLACEHOLDER with the account's workers.dev subdomain.
export const WORKER_URL = 'https://building-vibes-ai.rao-gannamaneni123.workers.dev'
export const AI_TIMEOUT_MS = 20000
