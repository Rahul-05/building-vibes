// FARE Act fee checker: plain, deterministic rules over the renter's answers. No network, no AI,
// nothing stored. The output is a pattern (consistent / unclear / matches what the law bans),
// never a legal verdict; the copy for each line lives in the dictionary under fare.*.

export const FARE_EFFECTIVE = '2025-06-11'
export const APPLICATION_FEE_CAP = 20

// What the renter typed a charge as, sorted into the kinds the law treats differently. Checked in
// this order, so "application processing fee" is an application fee and "broker fee" a broker fee.
// Labels in other languages land in "other" (unclear), which is the honest answer for them.
const KINDS = [
  ['application', /applica|credit|background|screening/i],
  ['broker', /broker|commission|agent|agency|realtor|realty|finder|locator/i],
  ['deposit', /deposit|security/i],
  ['advance', /last month|advance|prepaid|pre paid|upfront|up front|month.{0,6}rent|rent/i],
  ['otherFee', /fee|processing|listing|access|admin|marketing|showing|service|onboard|move.?in|key|holding|reserv|convenience|paperwork|document|amenit|charge/i],
]

export function kindOf(label) {
  const text = String(label || '')
  return KINDS.find(([, re]) => re.test(text))?.[0] || 'other'
}

// A typed amount ("$1,250.50", "1250") as a number, or null.
export function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

// Does the FARE Act reach this lease? 'yes' | 'no' | 'unsure'.
export function lawApplies(signed) {
  if (signed === 'after' || signed === 'notYet') return 'yes'
  if (signed === 'before') return 'no'
  return 'unsure'
}

// One charge against the rules. status: 'banned' (matches the pattern the law bans),
// 'consistent', or 'unclear'. note: the fare.charge.* key explaining it.
function judgeCharge(kind, amount, { applies, hired, rent }) {
  switch (kind) {
    case 'broker':
      if (hired === 'me') return { status: 'consistent', note: 'brokerOwn' }
      if (applies === 'no') return { status: 'consistent', note: 'brokerBefore' }
      if (hired === 'landlord') return { status: applies === 'yes' ? 'banned' : 'unclear', note: applies === 'yes' ? 'brokerLandlord' : 'brokerDate' }
      return { status: 'unclear', note: 'brokerUnsure' }
    case 'otherFee':
      if (hired === 'landlord' && applies === 'yes') return { status: 'banned', note: 'otherFeeLandlord' }
      return { status: 'unclear', note: 'otherFeeUnsure' }
    case 'application':
      if (amount == null) return { status: 'unclear', note: 'applicationNoAmount' }
      return amount > APPLICATION_FEE_CAP ? { status: 'banned', note: 'applicationOver' } : { status: 'consistent', note: 'applicationUnder' }
    case 'deposit':
    case 'advance':
      if (!rent || amount == null) return { status: 'unclear', note: `${kind}NoRent` }
      return amount > rent ? { status: 'banned', note: `${kind}Over` } : { status: 'consistent', note: `${kind}Under` }
    default:
      return { status: 'unclear', note: 'other' }
  }
}

// answers: { signed: 'after'|'notYet'|'before'|'unsure', hired: 'me'|'landlord'|'unsure',
//   extra: 'yes'|'no', charges: [{ label, amount }], paper: 'yes'|'no'|'unsure', rent }
// Returns { level: 'green'|'yellow'|'red', mood, applies, charges, total, yearShare, reasons, asks }.
export function assessFee(answers) {
  const applies = lawApplies(answers.signed)
  const hired = answers.hired || 'unsure'
  const rent = parseAmount(answers.rent)
  const typed = answers.extra === 'yes' ? (answers.charges || []).filter((c) => String(c.label || '').trim() || parseAmount(c.amount)) : []

  const charges = typed.map((c) => {
    const kind = kindOf(c.label)
    const amount = parseAmount(c.amount)
    return { label: String(c.label || '').trim(), amount, kind, ...judgeCharge(kind, amount, { applies, hired, rent }) }
  })
  const total = charges.reduce((sum, c) => sum + (c.amount || 0), 0)
  const yearShare = rent && total ? total / (rent * 12) : null

  // Reasons are fare.reason.* keys, most telling first; each carries the level it points to.
  const reasons = []
  const banned = charges.filter((c) => c.status === 'banned')
  if (banned.some((c) => c.kind === 'broker' || c.kind === 'otherFee')) reasons.push({ key: 'landlordBrokerFee', level: 'red' })
  if (banned.some((c) => c.kind === 'application')) reasons.push({ key: 'applicationOver', level: 'red' })
  if (banned.some((c) => c.kind === 'deposit' || c.kind === 'advance')) reasons.push({ key: 'depositOver', level: 'red' })

  if (answers.paper === 'yes' && hired !== 'me') reasons.push({ key: 'paperSigned', level: hired === 'landlord' ? 'red' : 'yellow' })
  if (answers.paper === 'unsure' && hired !== 'me') reasons.push({ key: 'paperUnsure', level: 'yellow' })
  if (applies === 'unsure') reasons.push({ key: 'dateUnsure', level: 'yellow' })
  if (hired === 'unsure' && charges.some((c) => c.kind === 'broker' || c.kind === 'otherFee')) reasons.push({ key: 'hiredUnsure', level: 'yellow' })
  if (charges.some((c) => c.status === 'unclear')) reasons.push({ key: 'someUnclear', level: 'yellow' })
  if (applies === 'no' && charges.some((c) => c.kind === 'broker')) reasons.push({ key: 'beforeLaw', level: 'green' })
  if (!charges.length) reasons.push({ key: 'noExtras', level: 'green' })
  if (charges.length && charges.every((c) => c.status === 'consistent')) reasons.push({ key: 'allConsistent', level: 'green' })

  // A paper saying you hired the broker, when you didn't, is the reported workaround: on its own
  // it is a yellow (worth knowing), alongside a landlord broker fee it is part of the red pattern.
  const red = banned.length > 0
  const yellow = reasons.some((r) => r.level === 'yellow') || (answers.paper === 'yes' && hired === 'landlord')
  const level = red ? 'red' : yellow ? 'yellow' : 'green'
  const mood = { red: 'worried', yellow: 'mixed', green: 'happy' }[level]

  // What the written ask names: one line per kind of charge that matches a banned pattern.
  const asks = [...new Set(banned.map((c) => (c.kind === 'otherFee' ? 'broker' : c.kind === 'advance' ? 'deposit' : c.kind)))]

  return { level, mood, applies, hired, rent, charges, total, yearShare, reasons, asks, banned }
}
