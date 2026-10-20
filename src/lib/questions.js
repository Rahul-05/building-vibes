// Template questions keyed by flag id. Neutral, factual, and phrased so a renter can
// ask them out loud — no advice, no accusations.

const TEMPLATES = {
  'class-c': 'HPD lists open Class C (immediately hazardous) violations here. Which ones affect this unit, and when will they be fixed?',
  'class-b': 'There are a number of open Class B violations on record. What is the plan and timeline for clearing them?',
  lead: 'Some open violations mention lead paint. Has this apartment been tested or treated for lead, and can I see the results?',
  pests: 'The record shows violations about pests. How often is the building treated, and has this unit had any issues?',
  mold: 'Mold shows up in the open violations. Has this unit had mold or leaks, and how was it addressed?',
  heat: 'Tenants have called 311 about heat or hot water. How old is the boiler, and how are outages handled in winter?',
  plumbing: 'There are recurring plumbing or leak complaints. Have there been any leaks in or above this unit?',
  elevator: 'Elevator complaints come up in 311. How often is it out of service, and how quickly is it repaired?',
  'dob-active': 'The Department of Buildings has active complaints on file. What are they about, and are they resolved?',
  evictions: 'The public record shows evictions at this address. How are rent disputes or late payments usually handled?',
  aep: 'The building is in HPD’s Alternative Enforcement Program. What repairs are planned, and what is the timeline for finishing them?',
  vacate: 'HPD has a vacate order on record here that hasn’t been lifted. What is it for, and does it affect this apartment?',
  litigation: 'There are HPD housing court cases on record. What were they about, and have the issues been fixed?',
  harassment: 'An HPD court case here found tenant harassment. What has changed in how the building is managed since then?',
  bedbugs: 'The latest bedbug filing reports infested apartments. Has this unit or its neighbors been treated, and when?',
}

// Questions driven by facts that aren't flags on their own.
const RECENT_SALE_YEARS = 2

function recordQuestions(record) {
  const qs = []
  const lifted = record?.vacateOrders?.orders?.find((o) => o.lifted)
  if (lifted && !record.vacateOrders.inEffect) {
    const when = lifted.effectiveDate?.slice(0, 4)
    qs.push({ id: 'vacate-history', level: 'general', text: `HPD issued a vacate order here${when ? ` in ${when}` : ''} (${lifted.reason.toLowerCase()}) that was later lifted. What happened, and what was repaired?` })
  }
  const deed = record?.lastSale?.lastDeed
  if (deed?.date) {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - RECENT_SALE_YEARS)
    if (deed.date.slice(0, 10) >= cutoff.toISOString().slice(0, 10)) {
      qs.push({ id: 'recent-sale', level: 'general', text: `A new deed for this building was recorded in ${deed.date.slice(0, 4)}. Is there new ownership or management, and are any renovations or rent changes planned?` })
    }
  }
  return qs
}

const GENERAL = [
  'Who do I contact for repairs, and what is the typical response time?',
  'Is this apartment rent stabilized? Can I see the rent history?',
]

export function questionsFor(flags, record, max = 5) {
  const qs = flags
    .filter((f) => f.level !== 'green' && TEMPLATES[f.id])
    .map((f) => ({ id: f.id, level: f.level, text: TEMPLATES[f.id] }))
    .slice(0, max)
  qs.push(...recordQuestions(record))
  // Always offer a couple of general questions so the list is never empty.
  GENERAL.forEach((text, i) => qs.length < max + 1 && qs.push({ id: `general-${i}`, level: 'general', text }))
  return qs
}
