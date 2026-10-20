import { DATASETS } from './config.js'
import { preferBin, querySocrata } from './http.js'

const OWNER_TYPES = ['CorporateOwner', 'IndividualOwner', 'JointOwner']
const personName = (c) => [c.firstname, c.middleinitial, c.lastname].filter(Boolean).join(' ').trim()
const tidy = (s) => (s || '').replace(/\s+/g, ' ').trim()

/**
 * Owner and managing agent from the building's HPD multiple-dwelling registration.
 * Registrations are joined on boroid/block/lot and matched to the building by BIN; contacts on
 * registrationid. Names only: we deliberately never select contact addresses, and never look
 * up other buildings for the same names (product rule: no portfolio mapping).
 * Returns null when no registration matched this building (e.g. 1–2 family homes, which
 * don't register, or a multi-building lot where none of the registrations is this BIN).
 */
export async function fetchOwnership(place, opts) {
  const regs = await querySocrata(DATASETS.registrations, {
    select: 'registrationid, bin, lastregistrationdate, registrationenddate',
    where: `boroid=${Number(place.boroId)} AND block=${Number(place.block)} AND lot=${Number(place.lot)}`,
    order: 'lastregistrationdate DESC',
    limit: 50,
  }, opts)

  // Only trust a registration that is clearly this building: a BIN match, or the lot's only building.
  const { rows, scope } = preferBin(regs, place.bin)
  if (!rows.length || scope === 'lot') return null
  const reg = rows[0]

  const contacts = await querySocrata(DATASETS.registrationContacts, {
    select: 'type, corporationname, firstname, middleinitial, lastname, title',
    where: `registrationid=${Number(reg.registrationid)}`,
    limit: 50,
  }, opts)

  const named = (c) => tidy(c.corporationname) || tidy(personName(c))
  const owners = [...new Set(contacts.filter((c) => OWNER_TYPES.includes(c.type)).map(named).filter(Boolean))]
  const agent = contacts.find((c) => c.type === 'Agent')
  const head = contacts.find((c) => c.type === 'HeadOfficer')

  return {
    registeredOn: reg.lastregistrationdate || null,
    registrationEnds: reg.registrationenddate || null,
    owners,
    managingAgent: agent ? named(agent) : null,
    headOfficer: head ? tidy(personName(head)) || null : null,
  }
}
