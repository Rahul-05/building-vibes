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
  // Phase 3 "Deeper record"
  aep: 'hcir-3275', // Buildings Selected for the Alternative Enforcement Program
  bedbugs: 'wz6d-d3jb', // Bedbug Reporting (landlord-filed annual reports)
  litigations: '59kj-x8nc', // HPD Housing Litigations
  vacateOrders: 'tb8q-a3ar', // HPD Order to Repair/Vacate Orders
  registrations: 'tesw-yqqr', // HPD Multiple Dwelling Registrations
  registrationContacts: 'feu5-w2e2', // HPD Registration Contacts
  acrisLegals: '8h5j-fqxa', // ACRIS Real Property Legals (document → borough/block/lot)
  acrisMaster: 'bnx9-e6tj', // ACRIS Real Property Master (document type, date, amount)
}

// How far back we look for "recent" activity, in years.
export const LOOKBACK_YEARS = {
  violations: 5,
  complaints311: 2,
  dob: 3,
  evictions: 5,
  litigations: 5,
  bedbugs: 2, // a filing whose period ended longer ago than this is shown but not scored
}

export const REQUEST_TIMEOUT_MS = 20000

// Phase 2 AI helper (Cloudflare Worker in worker/). It holds the Gemini key; the browser never sees it.
// The deploy step replaces PLACEHOLDER with the account's workers.dev subdomain.
export const WORKER_URL = 'https://building-vibes-ai.rao-gannamaneni123.workers.dev'
// Generous on purpose: the Worker races and falls back across overloaded Gemini models.
// The loading states cover the wait; the UI only falls back after this or a non-200.
export const AI_STORY_TIMEOUT_MS = 75000
export const AI_ASK_TIMEOUT_MS = 60000
