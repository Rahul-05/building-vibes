// Freeze My Rent assessment: rule based, deterministic, no AI call. Answers stay in
// the component's state and never leave the device.
//
// The program is the NYC Rent Freeze Program (SCRIE for seniors, DRIE for tenants
// with disabilities), run by the Dept. of Finance. The outcome is a pattern match
// only, never a verdict: the city decides every application. Language mirrors the
// rest of the site: flags and questions, never "you qualify" or "you are eligible".

// who: 'senior' | 'disability' | 'neither' | 'unsure'
// home: 'stabilized' | 'controlled' | 'mitchell' | 'unsure' | 'none'
// income: 'under' | 'over' | 'unsure'   (under = household income $75,000 or less)
// burden: 'over' | 'under' | 'unsure'   (over = rent is more than one third of income)
export function assessFreeze(a) {
  const reasons = []
  const pointsAway = []
  if (a.who === 'neither') pointsAway.push('who')
  if (a.home === 'none') pointsAway.push('home')
  if (a.income === 'over') pointsAway.push('income')
  if (a.burden === 'under') pointsAway.push('burden')
  if (a.who === 'senior') reasons.push('whoSenior')
  if (a.who === 'disability') reasons.push('whoDisability')
  if (a.home === 'stabilized' || a.home === 'controlled' || a.home === 'mitchell') reasons.push('home')
  if (a.income === 'under') reasons.push('income')
  if (a.burden === 'over') reasons.push('burden')
  const unsure =
    a.who === 'unsure' || a.home === 'unsure' || a.income === 'unsure' || a.burden === 'unsure'

  if (pointsAway.length > 0) return { level: 'red', reasons, pointsAway, unsure }
  if (
    !unsure &&
    (a.who === 'senior' || a.who === 'disability') &&
    a.home !== 'unsure' &&
    a.income === 'under' &&
    a.burden === 'over'
  ) {
    return { level: 'green', reasons, pointsAway, unsure }
  }
  return { level: 'yellow', reasons, pointsAway, unsure }
}

export function parseAmount(raw) {
  if (raw == null) return null
  const n = Number(String(raw).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}
