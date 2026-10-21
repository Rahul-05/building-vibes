import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, GitCompareArrows, Minus, X } from 'lucide-react'
import Mascot from './Mascot.jsx'
import AddressSearch from './AddressSearch.jsx'
import Disclaimer from './Disclaimer.jsx'
import { FlagDot } from './FlagSummary.jsx'
import { TREND_ICONS } from './Context.jsx'
import { moodLabel, scoreRecord } from '../lib/scoring.js'
import { computeInsights, ratePhrase } from '../lib/insights.js'
import { useT } from '../i18n/index.jsx'

// Phase 4 compare mode. The tray lives in App state only (no storage). The comparison is a
// plain side by side table: no winner, no ranking, the visitor reads the numbers.

export const MAX_PINNED = 3

// Phones: when the keyboard opens, a bottom fixed bar would sit behind it, so the tray rides on
// the visual viewport instead. Pinch zoom also shrinks the visual viewport; ignore it then.
function useVisualViewport() {
  const [vp, setVp] = useState({ inset: 0, height: 0 })
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const zoomed = Math.abs(vv.scale - 1) > 0.01
      setVp({ inset: zoomed ? 0 : Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)), height: zoomed ? 0 : vv.height })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return vp
}

// Search to add a building without leaving the tray or the comparison. Remounted (key) after
// each add so the box clears; a failed add keeps the typed text.
function CompareAdd({ count, adding, onAdd, dropUp, listMaxHeight }) {
  const t = useT()
  if (count >= MAX_PINNED) return <p className="text-sm font-medium text-ink/70">{t('compare.trayFull', { max: MAX_PINNED })}</p>
  const loading = adding?.status === 'loading'
  return (
    <div className="min-w-0">
      <AddressSearch
        key={count}
        onSearch={onAdd}
        compact
        dropUp={dropUp}
        listMaxHeight={listMaxHeight}
        disabled={loading}
        placeholder={count === 1 ? t('compare.addSecond') : t('compare.addAnother')}
        submitLabel={t('compare.add')}
      />
      <p aria-live="polite" className={`px-2 text-sm font-medium empty:hidden ${adding?.status === 'error' ? 'mt-2 text-ink' : 'mt-2 text-ink/70'}`}>
        {loading && t('compare.lookingUp', { label: adding.label })}
        {adding?.status === 'error' && adding.message}
      </p>
    </div>
  )
}

export function CompareTray({ tray, adding, onAdd, onRemove, onClear, onView }) {
  const t = useT()
  const ref = useRef(null)
  const [height, setHeight] = useState(0)
  const vp = useVisualViewport()

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [tray.length > 0])

  // Publish the room the tray takes so the page padding and the floating Ask button clear it.
  useEffect(() => {
    if (!tray.length) return
    const root = document.documentElement
    root.style.setProperty('--tray-space', `${height + vp.inset}px`)
    return () => root.style.removeProperty('--tray-space')
  }, [tray.length, height, vp.inset])

  if (!tray.length) return null
  // Suggestions open upward from the top of the tray; cap them to the visible room above it.
  const listMaxHeight = vp.height ? `min(20rem, ${Math.max(120, vp.height - height - 12)}px)` : undefined

  return (
    <aside
      ref={ref}
      aria-label={t('compare.trayLabel')}
      style={vp.inset ? { bottom: vp.inset } : undefined}
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5"
    >
      <div className="pop mx-auto flex max-w-3xl flex-col gap-3 bg-paper p-3 sm:p-4">
        <CompareAdd count={tray.length} adding={adding} onAdd={onAdd} dropUp listMaxHeight={listMaxHeight} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ul className="flex min-w-0 flex-1 flex-wrap gap-2">
            {tray.map(({ bbl, record }) => (
              <li key={bbl} className="flex min-w-0 max-w-full items-center gap-1 rounded-full border-2 border-ink bg-lilac py-0.5 ps-3 pe-1 text-sm font-bold">
                <span className="truncate">{record.place.name}</span>
                {/* 40px tap target; the negative margin keeps the pill itself slim. */}
                <button type="button" onClick={() => onRemove(bbl)} aria-label={t('compare.remove', { name: record.place.name })} className="-my-2 grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-ink/10">
                  <X aria-hidden size={14} strokeWidth={3} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <button type="button" onClick={onClear} className="min-h-10 px-2 text-sm font-bold underline decoration-2 underline-offset-4">{t('compare.clear')}</button>
            <button
              type="button"
              onClick={onView}
              disabled={tray.length < 2}
              className="pop-sm press inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap bg-sunny px-4 py-2 font-display font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              <GitCompareArrows aria-hidden size={18} strokeWidth={2.5} /> {t('compare.view')}
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------- comparison rows

const money = (n, t) => `$${t.num(Math.round(n))}`
const year = (iso) => (iso ? iso.slice(0, 4) : '')

// Each row: compare.row.<key> label, cell(entry, t). Owner names and dates' city text stay as is.
const ROWS = [
  {
    key: 'flags',
    cell: ({ scored }, t) => (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {['red', 'yellow', 'green'].map((l) => (
          <span key={l} className="inline-flex items-center gap-1 whitespace-nowrap font-bold">
            <FlagDot level={l} /> {t.num(scored.counts[l])} {t(`level.${l}`)}
          </span>
        ))}
      </span>
    ),
  },
  { key: 'facts', cell: ({ insights }, t) => insights.factsLine || t('compare.notInPluto') },
  {
    key: 'open',
    cell: ({ record, insights }, t) => {
      const v = record.violations
      if (!v || v.error) return t('compare.na')
      const rate = insights.units && v.openTotal ? ratePhrase(v.openTotal, insights.units, t) : ''
      const text = t('compare.openCell', { open: v.openTotal, c: v.openByClass.C })
      return rate ? t('rate.with', { text, rate }) : text
    },
  },
  {
    key: 'perApt',
    cell: ({ record, insights }, t) => {
      const v = record.violations
      if (!v || v.error) return t('compare.na')
      return insights.units ? t.num(Math.round((v.openTotal / insights.units) * 100) / 100) : t('compare.noUnitCount')
    },
  },
  { key: 'compares', cell: ({ insights }) => insights.benchmark.unavailable || insights.benchmark.lines.all },
  {
    key: 'trend',
    cell: ({ insights }, t) => {
      const tr = insights.trend
      if (tr.unavailable) return t('compare.na')
      const Icon = TREND_ICONS[tr.direction] || Minus
      return (
        <span>
          <span className="flex items-start gap-1 font-bold">
            <Icon aria-hidden size={16} strokeWidth={2.75} className="mt-0.5 shrink-0" /> <span className="min-w-0">{tr.headline}</span>
          </span>
          <span className="block text-xs text-ink/60">{t('compare.trendCell', { count: t.count('report', tr.lastTotal), prior: tr.priorTotal })}</span>
        </span>
      )
    },
  },
  {
    key: 'fix',
    cell: ({ insights }, t) => {
      const f = insights.fixRate
      if (f.unavailable) return t('compare.na')
      if (!f.issued) return t('compare.fixNone')
      return [
        t('compare.fixClosed', { pct: t.pct(Math.round(f.closedShare * 100) / 100), total: f.issued }),
        f.medianDays !== null && t('compare.fixTypical', { count: t.count('day', f.medianDays) }),
        f.openOverYear > 0 && t('compare.fixOld', { n: f.openOverYear }),
      ].filter(Boolean).join(' · ')
    },
  },
  {
    key: 'lists',
    cell: ({ record }, t) => {
      const { aep, vacateOrders: vac } = record
      const parts = []
      if (aep?.error) parts.push(t('compare.aepFailed'))
      else if (aep?.active) parts.push(t('compare.aepNow'))
      else if (aep?.listings?.length) parts.push(t('compare.aepWas', { year: year(aep.listings[0].startDate) }))
      if (vac?.error) parts.push(t('compare.vacateFailed'))
      else if (vac?.inEffect) parts.push(t('compare.vacateNotLifted', { count: t.count('vacateOrder', vac.inEffect) }))
      else if (vac?.orders?.length) parts.push(t('compare.vacatePast', { count: t.count('pastVacateOrder', vac.orders.length) }))
      return parts.join(' · ') || t('compare.listsNone')
    },
  },
  {
    key: 'court',
    cell: ({ record }, t) => {
      const l = record.litigations
      if (!l || l.error) return t('compare.na')
      return [
        t('compare.courtCell', { count: t.count('case', l.recentTotal) }),
        l.open > 0 && t('compare.pending', { n: l.open }),
        l.recentHarassmentFindings > 0 && t.count('harassmentFinding', l.recentHarassmentFindings),
      ].filter(Boolean).join(' · ')
    },
  },
  {
    key: 'bedbugs',
    cell: ({ record }, t) => {
      const b = record.bedbugs
      if (!b || b.error) return t('compare.na')
      if (!b.latest) return t('compare.bedbugsNone')
      return t('compare.bedbugsCell', { infested: b.latest.infested, count: t.count('apartment', b.latest.units), year: year(b.latest.periodEnd) })
    },
  },
  {
    key: 'owner',
    cell: ({ record }, t) => {
      const o = record.ownership
      if (o?.error) return t('compare.na')
      return o?.owners?.length ? o.owners.join(', ') : t('compare.ownerNone')
    },
  },
  {
    key: 'sale',
    cell: ({ record }, t) => {
      const s = record.lastSale
      if (s?.error) return t('compare.na')
      if (!s?.lastDeed) return t('compare.saleNone')
      const d = s.lastPricedSale && !(s.lastDeed.amount > 0) ? s.lastPricedSale : s.lastDeed
      return `${t.date(d.date)} · ${d.amount > 0 ? money(d.amount, t) : t('compare.noPrice')}`
    },
  },
]

function Head({ entry, onRemove }) {
  const t = useT()
  const { record, scored } = entry
  return (
    <div className="flex items-center gap-3">
      <Mascot mood={scored.mood} className="h-16 w-16 shrink-0" title={t('mascot.mood', { label: moodLabel(scored.mood, t) })} />
      <div className="min-w-0 flex-1 text-start">
        <p className="font-display text-lg font-extrabold leading-tight wrap-anywhere">{record.place.name}</p>
        <p className="text-xs font-bold uppercase tracking-wide text-ink/60">{record.place.borough}</p>
        <p className="text-sm font-medium">{moodLabel(scored.mood, t)}</p>
      </div>
      <button type="button" onClick={() => onRemove(record.place.bbl)} aria-label={t('compare.remove', { name: record.place.name })} className="grid h-10 w-10 shrink-0 place-items-center self-start rounded-full border-2 border-ink bg-paper hover:bg-ink/10">
        <X aria-hidden size={16} strokeWidth={3} />
      </button>
    </div>
  )
}

export function CompareView({ tray, adding, onAdd, onRemove, onBack }) {
  const t = useT()
  const entries = useMemo(
    () => tray.map(({ record }) => ({ record, scored: scoreRecord(record, t), insights: computeInsights(record, t) })),
    [tray, t],
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-16 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold sm:text-4xl">
          <GitCompareArrows aria-hidden size={32} strokeWidth={2.75} /> {t('compare.heading')}
        </h1>
        <button type="button" onClick={onBack} className="pop-sm press inline-flex min-h-10 items-center gap-1 bg-paper px-3 py-1.5 text-sm font-bold">
          <ArrowLeft aria-hidden size={16} className="rtl:-scale-x-100" /> {t('compare.back')}
        </button>
      </div>
      <p className="text-ink/75">{t('compare.intro')}</p>
      {/* Positioned + z-50 so the suggestions list stacks over the table below. */}
      <div className="relative z-50 max-w-xl">
        <CompareAdd count={tray.length} adding={adding} onAdd={onAdd} />
      </div>

      {entries.length === 0 ? (
        <p className="pop bg-paper p-6 font-medium">{t('compare.empty')}</p>
      ) : (
        <>
          {/* Wide screens: one column per building. */}
          <div className="pop hidden overflow-x-auto bg-paper md:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <caption className="sr-only">{t('compare.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-40 p-4 text-start align-bottom text-xs uppercase tracking-wide text-ink/55">{t('compare.building')}</th>
                  {entries.map((e) => (
                    <th key={e.record.place.bbl} scope="col" className="p-4 align-top font-normal">
                      <Head entry={e} onRemove={onRemove} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.key} className="border-t-2 border-dashed border-ink/15">
                    <th scope="row" className="p-4 text-start align-top font-bold">{t(`compare.row.${row.key}`)}</th>
                    {entries.map((e) => (
                      <td key={e.record.place.bbl} className="p-4 align-top wrap-anywhere">{row.cell(e, t)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: stacked cards with the same rows in the same order. */}
          <div className="space-y-4 md:hidden">
            {entries.map((e) => (
              <article key={e.record.place.bbl} className="pop bg-paper p-4">
                <Head entry={e} onRemove={onRemove} />
                <dl className="mt-3 divide-y-2 divide-dashed divide-ink/15 text-sm">
                  {ROWS.map((row) => (
                    <div key={row.key} className="py-2">
                      <dt className="text-xs font-bold uppercase tracking-wide text-ink/55">{t(`compare.row.${row.key}`)}</dt>
                      <dd className="mt-0.5 wrap-anywhere">{row.cell(e, t)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
          {entries.length === 1 && <p className="text-sm text-ink/70">{t('compare.onlyOne')}</p>}
        </>
      )}

      <div className="text-center">
        <Disclaimer />
        <p className="mt-3 text-sm text-ink/60">{t('compare.footnote')}</p>
      </div>
    </div>
  )
}
