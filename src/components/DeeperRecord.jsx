import { AlertTriangle, Bug, KeyRound, Layers, Scale, Siren } from 'lucide-react'
import { bedbugFilingIsRecent } from '../lib/scoring.js'
import { formatDate, plural } from '../lib/plainLanguage.js'

// "Deeper record": AEP + vacate orders, HPD court cases, bedbug filings, owner and last sale.
// Each block handles its own failure; blocks whose absence says nothing are left out entirely.

const monthYear = (iso) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '')
const money = (n) => `$${Math.round(n).toLocaleString()}`
const SAME_LOT = 'This is for another building on the same tax lot; we couldn’t match it to this exact building.'

function Block({ icon: Icon, title, accent, children }) {
  return (
    <div className="pop-sm bg-paper p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border-2 border-ink ${accent}`}>
          <Icon aria-hidden size={17} strokeWidth={2.5} />
        </span>
        {title}
      </h3>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  )
}

const Unavailable = ({ what }) => (
  <p className="flex items-center gap-2 rounded-xl bg-ink/5 p-3 text-sm text-ink/70">
    <AlertTriangle aria-hidden size={16} /> {what} didn’t load right now.
  </p>
)
const Quiet = ({ children }) => <p className="rounded-xl bg-ink/5 p-3 text-sm font-medium text-ink/75">{children}</p>
const Note = ({ children }) => <p className="text-xs text-ink/55">{children}</p>
const Badge = ({ cls, children }) => (
  <span className={`shrink-0 rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold ${cls}`}>{children}</span>
)

function StatusBlock({ aep, vacate }) {
  const hasAep = aep && !aep.error && aep.listings.length > 0
  const hasVacate = vacate && !vacate.error && vacate.orders.length > 0
  // Not being on these lists isn't informative on its own, so the block only appears when there's something to show.
  if (!hasAep && !hasVacate && !aep?.error && !vacate?.error) return null

  const listing = hasAep ? aep.listings.find((l) => l.active) || aep.listings[0] : null
  return (
    <Block icon={Siren} title="Building status" accent="bg-tomato">
      {aep?.error && <Unavailable what="The AEP list" />}
      {listing && (
        <div className={`rounded-xl p-3 ${listing.active ? 'bg-tomato/15' : 'bg-ink/5'}`}>
          <p className="font-bold">
            {listing.active ? 'On the city’s worst conditions list (AEP) now' : 'Was on the city’s worst conditions list (AEP)'}
          </p>
          <p className="text-sm text-ink/75">
            {[listing.round, listing.active ? `since ${monthYear(listing.startDate)}` : `${monthYear(listing.startDate)} to ${monthYear(listing.dischargeDate)}, since discharged`].filter(Boolean).join(' · ')}
            {listing.violationsAtStart ? ` · ${plural(listing.violationsAtStart, 'open B/C violation')} when selected` : ''}
          </p>
          {aep.listings.length > 1 && <Note>{plural(aep.listings.length, 'AEP listing')} on record in total.</Note>}
          {aep.scope === 'lot' && <Note>{SAME_LOT}</Note>}
        </div>
      )}

      {vacate?.error && <Unavailable what="Vacate orders" />}
      {hasVacate && (
        <div>
          <p className="text-sm font-bold">{plural(vacate.orders.length, 'HPD vacate order')}</p>
          <ul className="mt-1 divide-y-2 divide-dashed divide-ink/15">
            {vacate.orders.slice(0, 4).map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <p className="font-medium">{[o.type && `${o.type} vacate`, o.reason.toLowerCase()].filter(Boolean).join(' · ')}</p>
                  <p className="text-sm text-ink/55">
                    {formatDate(o.effectiveDate)}
                    {o.units ? ` · ${plural(o.units, 'apartment')}` : ''}
                    {o.lifted && ` · lifted ${formatDate(o.rescindedDate)}`}
                  </p>
                </div>
                <Badge cls={o.lifted ? 'bg-ink/5' : 'bg-tomato'}>{o.lifted ? 'Lifted' : 'Not lifted'}</Badge>
              </li>
            ))}
          </ul>
          {vacate.scope === 'lot' && <Note>{SAME_LOT}</Note>}
        </div>
      )}
    </Block>
  )
}

function CourtBlock({ data }) {
  return (
    <Block icon={Scale} title="Court cases" accent="bg-grape">
      {data?.error ? (
        <Unavailable what="HPD court cases" />
      ) : !data || data.total === 0 ? (
        <Quiet>No HPD housing court cases found in the public record.</Quiet>
      ) : (
        <>
          <p className="font-medium">
            {plural(data.recentTotal, 'case')} opened in the last 5 years
            {data.open > 0 && <span className="ml-2 rounded-full bg-sunny px-2 py-0.5 text-xs font-bold">{data.open} pending</span>}
          </p>
          {data.byType.length > 0 && (
            <ul className="space-y-1 text-sm">
              {data.byType.slice(0, 4).map((t) => (
                <li key={t.type} className="flex justify-between gap-3">
                  <span>{t.type}</span>
                  <span className="font-display font-extrabold">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
          {data.latest && (
            <p className="text-sm text-ink/70">
              Most recent: {data.latest.type.charAt(0).toLowerCase() + data.latest.type.slice(1)}, opened {formatDate(data.latest.openedOn)} ({data.latest.status.toLowerCase()}).
            </p>
          )}
          {data.recentHarassmentFindings > 0 && (
            <p className="rounded-xl bg-tomato/15 p-2 text-sm font-bold">{plural(data.recentHarassmentFindings, 'case')} ended with a finding of tenant harassment.</p>
          )}
          {data.scope === 'lot' && <Note>{SAME_LOT}</Note>}
          <Note>{plural(data.total, 'case')} on record in all. Most are brought by tenants or HPD to get repairs made; a case on its own isn’t a finding of wrongdoing.</Note>
        </>
      )}
    </Block>
  )
}

function BedbugBlock({ data }) {
  const f = data?.latest
  return (
    <Block icon={Bug} title="Bedbugs" accent="bg-sunny">
      {data?.error ? (
        <Unavailable what="Bedbug filings" />
      ) : !f ? (
        <Quiet>
          No bedbug report found in the public record. That isn’t a clean bill of health: owners of apartment buildings
          are required to file one every year, so a missing filing just means there’s nothing to read.
        </Quiet>
      ) : (
        <>
          <p className={`rounded-xl p-3 font-bold ${f.infested ? 'bg-sunny/30' : 'bg-ink/5'}`}>
            {f.infested} of {plural(f.units, 'apartment')} reported infested
          </p>
          <p className="text-sm text-ink/70">
            Landlord’s filing for {monthYear(f.periodStart)} to {monthYear(f.periodEnd)}, filed {formatDate(f.filedOn)}.
            {(f.eradicated > 0 || f.reinfested > 0) && ` ${f.eradicated} treated successfully, ${f.reinfested} infested again.`}
          </p>
          {!bedbugFilingIsRecent(data) && <Note>This is an older filing, so it doesn’t count toward the flags.</Note>}
          {data.scope === 'lot' && <Note>{SAME_LOT}</Note>}
          <Note>The owner reports this once a year.</Note>
        </>
      )}
    </Block>
  )
}

function DeedLine({ label, deed }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink/55">{label}</p>
      <p className="font-medium">
        {formatDate(deed.date)} · {deed.amount > 0 ? money(deed.amount) : 'no sale price recorded'}
      </p>
      {deed.lots > 1 && <Note>This deed covered {deed.lots} tax lots, so the amount is for all of them.</Note>}
    </div>
  )
}

function OwnershipBlock({ owner, sale }) {
  if (!owner && !sale) return null
  return (
    <Block icon={KeyRound} title="Ownership & last sale" accent="bg-mint">
      {owner?.error && <Unavailable what="The HPD registration" />}
      {owner && !owner.error && (
        <dl className="space-y-2">
          {owner.owners.length > 0 && (
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-ink/55">Owner</dt>
              <dd className="font-medium">{owner.owners.join(', ')}</dd>
            </div>
          )}
          {owner.managingAgent && (
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-ink/55">Managing agent</dt>
              <dd className="font-medium">{owner.managingAgent}</dd>
            </div>
          )}
          {owner.headOfficer && (
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-ink/55">Head officer</dt>
              <dd className="font-medium">{owner.headOfficer}</dd>
            </div>
          )}
          <Note>From the building’s HPD registration, last filed {formatDate(owner.registeredOn)}.</Note>
        </dl>
      )}

      {sale?.error && <Unavailable what="ACRIS sale records" />}
      {sale && !sale.error && (
        <div className="space-y-2 border-t-2 border-dashed border-ink/15 pt-3">
          <DeedLine label="Most recent deed" deed={sale.lastDeed} />
          {sale.lastPricedSale && <DeedLine label="Last deed with a price" deed={sale.lastPricedSale} />}
          <Note>From ACRIS, the city’s property records. Deeds between related companies often show no price.</Note>
        </div>
      )}
    </Block>
  )
}

export default function DeeperRecord({ record }) {
  return (
    <section aria-labelledby="deeper-heading" className="pop reveal bg-sky/20 p-5 sm:p-7">
      <h2 id="deeper-heading" className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
        <Layers aria-hidden strokeWidth={2.75} /> Deeper record
      </h2>
      <p className="mt-1 text-ink/70">City lists, court cases, bedbug filings, and who owns the building.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <StatusBlock aep={record.aep} vacate={record.vacateOrders} />
        <CourtBlock data={record.litigations} />
        <BedbugBlock data={record.bedbugs} />
        <OwnershipBlock owner={record.ownership} sale={record.lastSale} />
      </div>
    </section>
  )
}
