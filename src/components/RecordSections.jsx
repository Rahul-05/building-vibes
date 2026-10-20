import { useState } from 'react'
import { AlertTriangle, Building2, Gavel, Phone, Wrench } from 'lucide-react'
import { formatDate, groupViolations, isHousingComplaint, plainComplaintType, plural } from '../lib/plainLanguage.js'

// Shared shell for each data section, with built-in unavailable/empty states.
function Section({ icon: Icon, title, subtitle, accent, data, isEmpty, emptyText, children }) {
  let body = children
  if (data?.error) {
    body = (
      <p className="flex items-center gap-2 rounded-2xl bg-ink/5 p-4 text-ink/70">
        <AlertTriangle aria-hidden size={18} /> This source didn’t load right now. Try again in a bit.
      </p>
    )
  } else if (isEmpty) {
    body = <p className="rounded-2xl bg-mint/25 p-4 font-medium">{emptyText}</p>
  }

  return (
    <section className="pop reveal bg-paper p-5 sm:p-7">
      <header className="flex items-start gap-3">
        <span className={`pop-sm grid h-11 w-11 shrink-0 place-items-center ${accent}`}>
          <Icon aria-hidden size={22} strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>
          <p className="text-sm text-ink/60">{subtitle}</p>
        </div>
      </header>
      <div className="mt-5">{body}</div>
    </section>
  )
}

const CLASS_INFO = {
  C: { label: 'Class C', note: 'immediately hazardous', cls: 'bg-tomato' },
  B: { label: 'Class B', note: 'hazardous', cls: 'bg-tangerine' },
  A: { label: 'Class A', note: 'not hazardous', cls: 'bg-sunny' },
}

export function ViolationsSection({ data }) {
  const [showAll, setShowAll] = useState(false)
  const items = groupViolations(data?.openItems || [])
  const visible = showAll ? items.slice(0, 20) : items.slice(0, 5)

  return (
    <Section
      icon={Wrench}
      title="Housing violations"
      subtitle="HPD Housing Maintenance Code violations"
      accent="bg-tangerine"
      data={data}
      isEmpty={data && !data.error && data.openTotal === 0}
      emptyText={`No open HPD violations right now.${data?.recentTotal ? ` (${plural(data.recentTotal, 'violation')} issued in the last 5 years, all closed.)` : ''}`}
    >
      {data && !data.error && (
        <>
          <div className="flex flex-wrap gap-2">
            {['C', 'B', 'A'].map((c) => (
              <span key={c} className={`pop-sm inline-flex flex-wrap gap-x-1 px-3 py-1.5 text-sm font-bold ${CLASS_INFO[c].cls}`}>
                <span className="whitespace-nowrap">{data.openByClass[c]} open {CLASS_INFO[c].label}</span>
                <span className="whitespace-nowrap font-medium opacity-75">· {CLASS_INFO[c].note}</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink/60">{plural(data.recentTotal, 'violation')} issued in the last 5 years (open or closed).</p>

          <h3 className="mt-5 font-display text-lg font-bold">Most telling open violations</h3>
          <ul className="mt-2 divide-y-2 divide-dashed divide-ink/15">
            {visible.map((v) => (
              <li key={`${v.class}|${v.text}`} className="flex gap-3 py-3">
                <span className={`mt-0.5 h-fit shrink-0 rounded-lg border-2 border-ink px-1.5 text-xs font-extrabold ${CLASS_INFO[v.class]?.cls || 'bg-lilac'}`}>
                  {v.class}
                </span>
                <div className="min-w-0">
                  <p className="badge-row font-medium">
                    <span>{v.text}</span>
                    {v.count > 1 && <span className="pill bg-ink px-2 py-0.5 text-xs font-bold text-cream">×{v.count}</span>}
                  </p>
                  <p className="text-sm text-ink/55">
                    {v.count > 1 ? `Latest ${formatDate(v.date)}` : formatDate(v.date)}
                    {v.units.size === 1 && ` · Apt ${[...v.units][0]}`}
                    {v.units.size > 1 && ` · ${v.units.size} apartments`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {items.length > 5 && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-1 min-h-10 text-sm font-bold underline decoration-2 underline-offset-4">
              {showAll ? 'Show fewer' : `Show more (${Math.min(items.length, 20) - 5} more)`}
            </button>
          )}
        </>
      )}
    </Section>
  )
}

export function ComplaintsSection({ data }) {
  const housing = data?.byType?.filter((t) => isHousingComplaint(t.type)) || []
  const other = data?.byType?.filter((t) => !isHousingComplaint(t.type)) || []
  const otherTotal = other.reduce((n, t) => n + t.count, 0)
  const max = housing[0]?.count || 1

  return (
    <Section
      icon={Phone}
      title="311 complaints"
      subtitle="Service requests at this address, last 2 years"
      accent="bg-sky"
      data={data}
      isEmpty={data && !data.error && data.total === 0}
      emptyText="No 311 complaints at this address in the last 2 years."
    >
      {data && !data.error && (
        <>
          {housing.length > 0 ? (
            <ul className="space-y-3">
              {housing.slice(0, 7).map((t) => (
                <li key={t.type}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-medium">{plainComplaintType(t.type)}</span>
                    <span className="shrink-0 font-display text-lg font-extrabold">{t.count}</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-ink bg-ink/5">
                    <div className="bar h-full rounded-full bg-sky" style={{ width: `${Math.max(6, (t.count / max) * 100)}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink/50">Latest: {formatDate(t.lastDate)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-mint/25 p-4 font-medium">No complaints about conditions inside the building.</p>
          )}
          {otherTotal > 0 && (
            <p className="mt-4 text-sm text-ink/60">
              Plus {plural(otherTotal, 'street or neighborhood complaint')} (noise, parking, etc.) that aren’t about the building itself.
            </p>
          )}
        </>
      )}
    </Section>
  )
}

export function DobSection({ data }) {
  const items = data?.items || []
  return (
    <Section
      icon={Building2}
      title="Building complaints"
      subtitle="Department of Buildings complaints, last 3 years"
      accent="bg-grape"
      data={data}
      isEmpty={!data || (!data.error && data.total === 0)}
      emptyText={data ? 'No Department of Buildings complaints in the last 3 years.' : 'We couldn’t match a DOB building ID for this address.'}
    >
      {data && !data.error && (
        <>
          <p className="text-sm text-ink/60">
            {plural(data.total, 'complaint')} · {data.active} still active
          </p>
          <ul className="mt-2 divide-y-2 divide-dashed divide-ink/15">
            {items.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{c.label}</p>
                  <p className="text-sm text-ink/55">{formatDate(c.date)}</p>
                </div>
                <span className={`pill border-2 border-ink px-2.5 py-0.5 text-xs font-bold ${c.status === 'Active' ? 'bg-sunny' : 'bg-ink/5'}`}>
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  )
}

export function EvictionsSection({ data }) {
  const years = data?.byYear ? Object.entries(data.byYear).sort(([a], [b]) => b.localeCompare(a)) : []
  return (
    <Section
      icon={Gavel}
      title="Evictions"
      subtitle="Residential evictions carried out by NYC Marshals, last 5 years"
      accent="bg-bubblegum"
      data={data}
      isEmpty={data && !data.error && data.total === 0}
      emptyText="No residential evictions carried out here in the last 5 years."
    >
      {data && !data.error && (
        <>
          <p className="font-medium">
            {plural(data.total, 'eviction')} carried out, most recently {formatDate(data.lastDate)}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {years.map(([y, n]) => (
              <span key={y} className="pop-sm whitespace-nowrap bg-lilac px-3 py-1 text-sm font-bold">{y}: {n}</span>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink/50">Counts cover the whole building; a large building will naturally have more.</p>
        </>
      )}
    </Section>
  )
}
