import { useState } from 'react'
import { AlertTriangle, Building2, Gavel, Phone, Wrench } from 'lucide-react'
import { groupViolations, isHousingComplaint, plainComplaintType } from '../lib/plainLanguage.js'
import { useT } from '../i18n/index.jsx'

// Section chrome is translated; violation and DOB complaint descriptions are the city's own text
// and stay in English as published.

// Shared shell for each data section, with built-in unavailable/empty states.
function Section({ icon: Icon, title, subtitle, accent, data, isEmpty, emptyText, children }) {
  const t = useT()
  let body = children
  if (data?.error) {
    body = (
      <p className="flex items-center gap-2 rounded-2xl bg-ink/5 p-4 text-ink/70">
        <AlertTriangle aria-hidden size={18} className="shrink-0" /> {t('section.error')}
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

// Notes are class.<C|B|A>.note in the dictionary.
const CLASS_INFO = {
  C: { cls: 'bg-tomato' },
  B: { cls: 'bg-tangerine' },
  A: { cls: 'bg-sunny' },
}

export function ViolationsSection({ data }) {
  const t = useT()
  const [showAll, setShowAll] = useState(false)
  const items = groupViolations(data?.openItems || [])
  const visible = showAll ? items.slice(0, 20) : items.slice(0, 5)

  return (
    <Section
      icon={Wrench}
      title={t('viol.title')}
      subtitle={t('viol.subtitle')}
      accent="bg-tangerine"
      data={data}
      isEmpty={data && !data.error && data.openTotal === 0}
      emptyText={`${t('viol.empty')}${data?.recentTotal ? ` ${t('viol.emptyClosed', { count: t.count('violation', data.recentTotal) })}` : ''}`}
    >
      {data && !data.error && (
        <>
          <div className="flex flex-wrap gap-2">
            {['C', 'B', 'A'].map((c) => (
              <span key={c} className={`pop-sm inline-flex flex-wrap gap-x-1 px-3 py-1.5 text-sm font-bold ${CLASS_INFO[c].cls}`}>
                <span className="whitespace-nowrap">{t('viol.openClass', { n: data.openByClass[c], cls: c })}</span>
                <span className="whitespace-nowrap font-medium opacity-75">· {t(`class.${c}.note`)}</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink/60">{t('viol.issued', { count: t.count('violation', data.recentTotal) })}</p>

          <h3 className="mt-5 font-display text-lg font-bold">{t('viol.telling')}</h3>
          <ul className="mt-2 divide-y-2 divide-dashed divide-ink/15">
            {visible.map((v) => (
              <li key={`${v.class}|${v.text}`} className="flex gap-3 py-3">
                <span className={`mt-0.5 h-fit shrink-0 rounded-lg border-2 border-ink px-1.5 text-xs font-extrabold ${CLASS_INFO[v.class]?.cls || 'bg-lilac'}`}>
                  {v.class}
                </span>
                <div className="min-w-0">
                  <p className="badge-row font-medium">
                    <span lang="en">{v.text}</span>
                    {v.count > 1 && <span className="pill bg-ink px-2 py-0.5 text-xs font-bold text-cream">×{t.num(v.count)}</span>}
                  </p>
                  <p className="text-sm text-ink/55">
                    {v.count > 1 ? t('viol.latest', { date: t.date(v.date) }) : t.date(v.date)}
                    {v.units.size === 1 && ` · ${t('viol.apt', { unit: [...v.units][0] })}`}
                    {v.units.size > 1 && ` · ${t.count('apartment', v.units.size)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {items.length > 5 && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-1 min-h-10 text-sm font-bold underline decoration-2 underline-offset-4">
              {showAll ? t('viol.showFewer') : t('viol.showMore', { more: Math.min(items.length, 20) - 5 })}
            </button>
          )}
        </>
      )}
    </Section>
  )
}

export function ComplaintsSection({ data }) {
  const t = useT()
  const housing = data?.byType?.filter((t) => isHousingComplaint(t.type)) || []
  const other = data?.byType?.filter((t) => !isHousingComplaint(t.type)) || []
  const otherTotal = other.reduce((n, t) => n + t.count, 0)
  const max = housing[0]?.count || 1

  return (
    <Section
      icon={Phone}
      title={t('complaints.title')}
      subtitle={t('complaints.subtitle')}
      accent="bg-sky"
      data={data}
      isEmpty={data && !data.error && data.total === 0}
      emptyText={t('complaints.empty')}
    >
      {data && !data.error && (
        <>
          {housing.length > 0 ? (
            <ul className="space-y-3">
              {housing.slice(0, 7).map((c) => (
                <li key={c.type}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-medium">{plainComplaintType(c.type, t)}</span>
                    <span className="shrink-0 font-display text-lg font-extrabold">{t.num(c.count)}</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-ink bg-ink/5">
                    <div className="bar h-full rounded-full bg-sky" style={{ width: `${Math.max(6, (c.count / max) * 100)}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink/50">{t('complaints.latest', { date: t.date(c.lastDate) })}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-mint/25 p-4 font-medium">{t('complaints.noInside')}</p>
          )}
          {otherTotal > 0 && (
            <p className="mt-4 text-sm text-ink/60">{t('complaints.street', { count: t.count('streetComplaint', otherTotal) })}</p>
          )}
        </>
      )}
    </Section>
  )
}

export function DobSection({ data }) {
  const t = useT()
  const items = data?.items || []
  return (
    <Section
      icon={Building2}
      title={t('dob.title')}
      subtitle={t('dob.subtitle')}
      accent="bg-grape"
      data={data}
      isEmpty={!data || (!data.error && data.total === 0)}
      emptyText={data ? t('dob.empty') : t('dob.noBin')}
    >
      {data && !data.error && (
        <>
          <p className="text-sm text-ink/60">{t('dob.summary', { count: t.count('complaint', data.total), active: data.active })}</p>
          <ul className="mt-2 divide-y-2 divide-dashed divide-ink/15">
            {items.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p lang="en" className="font-medium">{c.label}</p>
                  <p className="text-sm text-ink/55">{t.date(c.date)}</p>
                </div>
                <span className={`pill border-2 border-ink px-2.5 py-0.5 text-xs font-bold ${c.status === 'Active' ? 'bg-sunny' : 'bg-ink/5'}`}>
                  {t(`status.${c.status}`)}
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
  const t = useT()
  const years = data?.byYear ? Object.entries(data.byYear).sort(([a], [b]) => b.localeCompare(a)) : []
  return (
    <Section
      icon={Gavel}
      title={t('evictions.title')}
      subtitle={t('evictions.subtitle')}
      accent="bg-bubblegum"
      data={data}
      isEmpty={data && !data.error && data.total === 0}
      emptyText={t('evictions.empty')}
    >
      {data && !data.error && (
        <>
          <p className="font-medium">{t('evictions.summary', { count: t.count('eviction', data.total), date: t.date(data.lastDate) })}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {years.map(([y, n]) => (
              <span key={y} className="pop-sm whitespace-nowrap bg-lilac px-3 py-1 text-sm font-bold">{y}: {t.num(n)}</span>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink/50">{t('evictions.note')}</p>
        </>
      )}
    </Section>
  )
}
