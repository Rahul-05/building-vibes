import { AlertTriangle, Bug, KeyRound, Layers, Scale, Siren } from 'lucide-react'
import { aepRound, bedbugFilingIsRecent } from '../lib/scoring.js'
import { useT } from '../i18n/index.jsx'

// "Deeper record": AEP + vacate orders, HPD court cases, bedbug filings, owner and last sale.
// Each block handles its own failure; blocks whose absence says nothing are left out entirely.
// Case types, vacate reasons and names are the city's own text and stay as published.

const money = (n, t) => `$${t.num(Math.round(n))}`

function Block({ icon: Icon, title, accent, children }) {
  return (
    <div className="pop-sm bg-paper p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold leading-tight">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border-2 border-ink ${accent}`}>
          <Icon aria-hidden size={17} strokeWidth={2.5} />
        </span>
        <span className="min-w-0">{title}</span>
      </h3>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  )
}

function Unavailable({ what }) {
  const t = useT()
  return (
    <p className="flex items-center gap-2 rounded-xl bg-ink/5 p-3 text-sm text-ink/70">
      <AlertTriangle aria-hidden size={16} className="shrink-0" /> {t('deeper.unavailable', { what: t(`deeper.what.${what}`) })}
    </p>
  )
}
function SameLot() {
  const t = useT()
  return <Note>{t('deeper.sameLot')}</Note>
}
const Quiet = ({ children }) => <p className="rounded-xl bg-ink/5 p-3 text-sm font-medium text-ink/75">{children}</p>
const Note = ({ children }) => <p className="text-xs text-ink/55">{children}</p>
const Badge = ({ cls, children }) => <span className={`pill border-2 border-ink px-2.5 py-0.5 text-xs font-bold ${cls}`}>{children}</span>

function StatusBlock({ aep, vacate }) {
  const t = useT()
  const hasAep = aep && !aep.error && aep.listings.length > 0
  const hasVacate = vacate && !vacate.error && vacate.orders.length > 0
  // Not being on the vacate list says little, but AEP absence is worth stating, so the block shows whenever the AEP list loaded.
  if (!aep && !hasVacate && !vacate?.error) return null

  const listing = hasAep ? aep.listings.find((l) => l.active) || aep.listings[0] : null
  return (
    <Block icon={Siren} title={t('deeper.status.title')} accent="bg-tomato">
      {aep?.error && <Unavailable what="aep" />}
      {aep && !aep.error && !hasAep && <Quiet>{t('deeper.status.notOnAep')}</Quiet>}
      {listing && (
        <div className={`rounded-xl p-3 ${listing.active ? 'bg-tomato/15' : 'bg-ink/5'}`}>
          <p className="font-bold">
            {listing.active ? t('deeper.status.aepNow') : t('deeper.status.aepWas')}
          </p>
          <p className="text-sm text-ink/75">
            {[
              aepRound(listing.round, t),
              listing.active
                ? t('deeper.status.since', { date: t.monthYear(listing.startDate) })
                : t('deeper.status.range', { start: t.monthYear(listing.startDate), end: t.monthYear(listing.dischargeDate) }),
            ].filter(Boolean).join(' · ')}
            {listing.violationsAtStart ? ` · ${t('deeper.status.atStart', { count: t.count('openBC', listing.violationsAtStart) })}` : ''}
          </p>
          {aep.listings.length > 1 && <Note>{t('deeper.status.total', { count: t.count('aepListing', aep.listings.length) })}</Note>}
          {aep.scope === 'lot' && <SameLot />}
        </div>
      )}

      {vacate?.error && <Unavailable what="vacate" />}
      {hasVacate && (
        <div>
          <p className="text-sm font-bold">{t.count('hpdVacateOrder', vacate.orders.length)}</p>
          <ul className="mt-1 divide-y-2 divide-dashed divide-ink/15">
            {vacate.orders.slice(0, 4).map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium">{[o.type && t('deeper.vacate.type', { type: o.type }), o.reason.toLowerCase()].filter(Boolean).join(' · ')}</p>
                  <p className="text-sm text-ink/55">
                    {t.date(o.effectiveDate)}
                    {o.units ? ` · ${t.count('apartment', o.units)}` : ''}
                    {o.lifted && ` · ${t('deeper.vacate.lifted', { date: t.date(o.rescindedDate) })}`}
                  </p>
                </div>
                <Badge cls={o.lifted ? 'bg-ink/5' : 'bg-tomato'}>{o.lifted ? t('deeper.vacate.badgeLifted') : t('deeper.vacate.badgeNotLifted')}</Badge>
              </li>
            ))}
          </ul>
          {vacate.scope === 'lot' && <SameLot />}
        </div>
      )}
    </Block>
  )
}

function CourtBlock({ data }) {
  const t = useT()
  return (
    <Block icon={Scale} title={t('deeper.court.title')} accent="bg-grape">
      {data?.error ? (
        <Unavailable what="court" />
      ) : !data || data.total === 0 ? (
        <Quiet>{t('deeper.court.none')}</Quiet>
      ) : (
        <>
          <p className="badge-row font-medium">
            <span>{t('deeper.court.opened', { count: t.count('case', data.recentTotal) })}</span>
            {data.open > 0 && <Badge cls="bg-sunny">{t('deeper.court.pending', { n: data.open })}</Badge>}
          </p>
          {data.byType.length > 0 && (
            <ul className="space-y-1 text-sm">
              {data.byType.slice(0, 4).map((c) => (
                <li key={c.type} className="flex justify-between gap-3">
                  <span lang="en" className="min-w-0">{c.type}</span>
                  <span className="shrink-0 font-display font-extrabold">{t.num(c.count)}</span>
                </li>
              ))}
            </ul>
          )}
          {data.latest && (
            <p className="text-sm text-ink/70">
              {t('deeper.court.latest', { type: data.latest.type.charAt(0).toLowerCase() + data.latest.type.slice(1), date: t.date(data.latest.openedOn), status: data.latest.status.toLowerCase() })}
            </p>
          )}
          {data.recentHarassmentFindings > 0 && (
            <p className="rounded-xl bg-tomato/15 p-2 text-sm font-bold">{t('deeper.court.harassment', { count: t.count('case', data.recentHarassmentFindings) })}</p>
          )}
          {data.scope === 'lot' && <SameLot />}
          <Note>{t('deeper.court.note', { count: t.count('case', data.total) })}</Note>
        </>
      )}
    </Block>
  )
}

function BedbugBlock({ data }) {
  const t = useT()
  const f = data?.latest
  return (
    <Block icon={Bug} title={t('deeper.bedbugs.title')} accent="bg-sunny">
      {data?.error ? (
        <Unavailable what="bedbugs" />
      ) : !f ? (
        <Quiet>{t('deeper.bedbugs.none')}</Quiet>
      ) : (
        <>
          <p className={`rounded-xl p-3 font-bold ${f.infested ? 'bg-sunny/30' : 'bg-ink/5'}`}>
            {t('deeper.bedbugs.infested', { infested: f.infested, count: t.count('apartment', f.units) })}
          </p>
          <p className="text-sm text-ink/70">
            {t('deeper.bedbugs.filing', { start: t.monthYear(f.periodStart), end: t.monthYear(f.periodEnd), date: t.date(f.filedOn) })}
            {(f.eradicated > 0 || f.reinfested > 0) && ` ${t('deeper.bedbugs.treated', { eradicated: f.eradicated, reinfested: f.reinfested })}`}
          </p>
          {!bedbugFilingIsRecent(data) && <Note>{t('deeper.bedbugs.older')}</Note>}
          {data.scope === 'lot' && <SameLot />}
          <Note>{t('deeper.bedbugs.yearly')}</Note>
        </>
      )}
    </Block>
  )
}

function DeedLine({ label, deed }) {
  const t = useT()
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink/55">{label}</p>
      <p className="badge-row font-medium">
        <span className="whitespace-nowrap">{t.date(deed.date)}</span>
        <span aria-hidden className="text-ink/40">·</span>
        <span>{deed.amount > 0 ? money(deed.amount, t) : t('deeper.owner.noPrice')}</span>
      </p>
      {deed.lots > 1 && <Note>{t('deeper.owner.lots', { lots: deed.lots })}</Note>}
    </div>
  )
}

function OwnershipBlock({ owner, sale }) {
  const t = useT()
  if (!owner && !sale) return null
  return (
    <Block icon={KeyRound} title={t('deeper.owner.title')} accent="bg-mint">
      {owner?.error && <Unavailable what="registration" />}
      {owner && !owner.error && (
        <dl className="space-y-2">
          {owner.owners.length > 0 && (
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-ink/55">{t('deeper.owner.owner')}</dt>
              <dd className="font-medium wrap-anywhere">{owner.owners.join(', ')}</dd>
            </div>
          )}
          {owner.managingAgent && (
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-ink/55">{t('deeper.owner.agent')}</dt>
              <dd className="font-medium wrap-anywhere">{owner.managingAgent}</dd>
            </div>
          )}
          {owner.headOfficer && (
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-ink/55">{t('deeper.owner.headOfficer')}</dt>
              <dd className="font-medium wrap-anywhere">{owner.headOfficer}</dd>
            </div>
          )}
          <Note>{t('deeper.owner.registration', { date: t.date(owner.registeredOn) })}</Note>
        </dl>
      )}

      {sale?.error && <Unavailable what="acris" />}
      {sale && !sale.error && (
        <div className="space-y-2 border-t-2 border-dashed border-ink/15 pt-3">
          <DeedLine label={t('deeper.owner.lastDeed')} deed={sale.lastDeed} />
          {sale.lastPricedSale && <DeedLine label={t('deeper.owner.lastPriced')} deed={sale.lastPricedSale} />}
          <Note>{t('deeper.owner.acris')}</Note>
        </div>
      )}
    </Block>
  )
}

export default function DeeperRecord({ record }) {
  const t = useT()
  return (
    <section aria-labelledby="deeper-heading" className="pop reveal bg-sky/20 p-5 sm:p-7">
      <h2 id="deeper-heading" className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
        <Layers aria-hidden strokeWidth={2.75} /> {t('deeper.heading')}
      </h2>
      <p className="mt-1 text-ink/70">{t('deeper.intro')}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <StatusBlock aep={record.aep} vacate={record.vacateOrders} />
        <CourtBlock data={record.litigations} />
        <BedbugBlock data={record.bedbugs} />
        <OwnershipBlock owner={record.ownership} sale={record.lastSale} />
      </div>
    </section>
  )
}
