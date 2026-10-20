// Template questions keyed by flag id. Neutral, factual, and phrased so a renter can
// ask them out loud — no advice, no accusations.

const TEMPLATES = {
  'class-c': 'HPD lists open Class C (immediately hazardous) violations here. Which ones affect this unit, and when will they be fixed?',
  'class-b': 'There are a number of open Class B violations on record. What is the plan and timeline for clearing them?',
  lead: 'Some open violations mention lead-based paint. Has this apartment been tested or treated for lead, and can I see the results?',
  pests: 'The record shows pest-related violations. How often is the building treated, and has this unit had any issues?',
  mold: 'Mold shows up in the open violations. Has this unit had mold or leaks, and how was it addressed?',
  heat: 'Tenants have called 311 about heat or hot water. How old is the boiler, and how are outages handled in winter?',
  plumbing: 'There are recurring plumbing or leak complaints. Have there been any leaks in or above this unit?',
  elevator: 'Elevator complaints come up in 311. How often is it out of service, and how quickly is it repaired?',
  'dob-active': 'The Department of Buildings has active complaints on file. What are they about, and are they resolved?',
  evictions: 'The public record shows evictions at this address. How are rent disputes or late payments usually handled?',
}

const GENERAL = [
  'Who do I contact for repairs, and what is the typical response time?',
  'Is this apartment rent stabilized? Can I see the rent history?',
]

export function questionsFor(flags, max = 5) {
  const qs = flags
    .filter((f) => f.level !== 'green' && TEMPLATES[f.id])
    .map((f) => ({ id: f.id, level: f.level, text: TEMPLATES[f.id] }))
    .slice(0, max)
  // Always offer a couple of general questions so the list is never empty.
  GENERAL.forEach((text, i) => qs.length < max + 1 && qs.push({ id: `general-${i}`, level: 'general', text }))
  return qs
}
