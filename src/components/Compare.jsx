import { useMemo } from 'react'
import { ArrowLeft, GitCompareArrows, Minus, X } from 'lucide-react'
import Mascot from './Mascot.jsx'
import Disclaimer from './Disclaimer.jsx'
import { FlagDot } from './FlagSummary.jsx'
import { TREND_ICONS } from './Context.jsx'
import { MOOD_COPY, scoreRecord } from '../lib/scoring.js'
import { computeInsights, ratePhrase } from '../lib/insights.js'
import { formatDate, plural } from '../lib/plainLanguage.js'

// Phase 4 compare mode. The tray lives in App state only (no storage). The comparison is a
// plain side by side table: no winner, no ranking, the visitor reads the numbers.

export const MAX_PINNED = 3

export function CompareTray({ tray, onRemove, onClear, onView }) {
  if (!tray.length) return null
  return (
    <aside aria-label="Compare tray" className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
      <div className="pop mx-auto flex max-w-3xl flex-col gap-3 bg-paper p-3 sm:flex-row sm:items-center sm:p-4">
        <ul className="flex min-w-0 flex-1 flex-wrap gap-2">
          {tray.map(({ bbl, record }) => (
            <li key={bbl} className="flex min-w-0 max-w-full items-center gap-1 rounded-full border-2 border-ink bg-lilac py-0.5 pl-3 pr-1 text-sm font-bold">
              <span className="truncate">{record.place.name}</span>
              {/* 40px tap target; the negative margin keeps the pill itself slim. */}
              <button type="button" onClick={() => onRemove(bbl)} aria-label={`Remove ${record.place.name} from compare`} className="-my-2 grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-ink/10">
                <X aria-hidden size={14} strokeWidth={3} />
              </button>
            </li>
          ))}
          {tray.length < MAX_PINNED && (
            <li className="self-center text-xs text-ink/60">
              {tray.length === 1 ? 'Search another address and pin it to compare.' : `Room for ${MAX_PINNED - tray.length} more.`}
            </li>
          )}
        </ul>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <button type="button" onClick={onClear} className="min-h-10 px-2 text-sm font-bold underline decoration-2 underline-offset-4">Clear</button>
          <button
            type="button"
            onClick={onView}
            disabled={tray.length < 2}
            className="pop-sm press inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap bg-sunny px-4 py-2 font-display font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <GitCompareArrows aria-hidden size={18} strokeWidth={2.5} /> View comparison
          </button>
        </div>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------- comparison rows

const NA = 'Didn’t load'
const money = (n) => `$${Math.round(n).toLocaleString()}`
const year = (iso) => (iso ? iso.slice(0, 4) : '')

const ROWS = [
  {
    label: 'Flags',
    cell: ({ scored }) => (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {['red', 'yellow', 'green'].map((l) => (
          <span key={l} className="inline-flex items-center gap-1 whitespace-nowrap font-bold">
            <FlagDot level={l} /> {scored.counts[l]} {l}
          </span>
        ))}
      </span>
    ),
  },
  { label: 'Built and apartments', cell: ({ insights }) => insights.factsLine || 'Not in PLUTO' },
  {
    label: 'Open violations',
    cell: ({ record, insights }) => {
      const v = record.violations
      if (!v || v.error) return NA
      const rate = insights.units && v.openTotal ? ratePhrase(v.openTotal, insights.units) : ''
      return `${v.openTotal.toLocaleString()} open (${v.openByClass.C.toLocaleString()} Class C)${rate ? `, ${rate}` : ''}`
    },
  },
  {
    label: 'Open violations per apartment',
    cell: ({ record, insights }) => {
      const v = record.violations
      if (!v || v.error) return NA
      return insights.units ? (Math.round((v.openTotal / insights.units) * 100) / 100).toLocaleString() : 'No apartment count'
    },
  },
  { label: 'How it compares', cell: ({ insights }) => insights.benchmark.unavailable || insights.benchmark.lines.all },
  {
    label: 'Trend',
    cell: ({ insights }) => {
      const t = insights.trend
      if (t.unavailable) return NA
      const Icon = TREND_ICONS[t.direction] || Minus
      return (
        <span>
          <span className="flex items-start gap-1 font-bold">
            <Icon aria-hidden size={16} strokeWidth={2.75} className="mt-0.5 shrink-0" /> <span className="min-w-0">{t.headline}</span>
          </span>
          <span className="block text-xs text-ink/60">{plural(t.lastTotal, 'report')} in the last 12 full months, {t.priorTotal.toLocaleString()} the 12 before</span>
        </span>
      )
    },
  },
  {
    label: 'Fix rate',
    cell: ({ insights }) => {
      const f = insights.fixRate
      if (f.unavailable) return NA
      if (!f.issued) return 'No violations issued in 5 years'
      return [
        `${Math.round(f.closedShare * 100)}% of ${f.issued.toLocaleString()} closed`,
        f.medianDays !== null && `typical fix about ${plural(f.medianDays, 'day')}`,
        f.openOverYear > 0 && `${f.openOverYear.toLocaleString()} open more than a year`,
      ].filter(Boolean).join(' · ')
    },
  },
  {
    label: 'City lists',
    cell: ({ record }) => {
      const { aep, vacateOrders: vac } = record
      const parts = []
      if (aep?.error) parts.push('AEP list didn’t load')
      else if (aep?.active) parts.push('On the AEP list now')
      else if (aep?.listings?.length) parts.push(`Was on the AEP list (${year(aep.listings[0].startDate)})`)
      if (vac?.error) parts.push('Vacate orders didn’t load')
      else if (vac?.inEffect) parts.push(`${plural(vac.inEffect, 'vacate order')} not lifted`)
      else if (vac?.orders?.length) parts.push(`${plural(vac.orders.length, 'past vacate order')}, lifted`)
      return parts.join(' · ') || 'Not on the AEP list, no vacate orders'
    },
  },
  {
    label: 'Court cases',
    cell: ({ record }) => {
      const l = record.litigations
      if (!l || l.error) return NA
      return [
        `${plural(l.recentTotal, 'case')} in 5 years`,
        l.open > 0 && `${l.open} pending`,
        l.recentHarassmentFindings > 0 && `${plural(l.recentHarassmentFindings, 'harassment finding')}`,
      ].filter(Boolean).join(' · ')
    },
  },
  {
    label: 'Bedbugs',
    cell: ({ record }) => {
      const b = record.bedbugs
      if (!b || b.error) return NA
      if (!b.latest) return 'No filing found'
      return `${b.latest.infested} of ${plural(b.latest.units, 'apartment')} infested (filing for ${year(b.latest.periodEnd)})`
    },
  },
  {
    label: 'Owner',
    cell: ({ record }) => {
      const o = record.ownership
      if (o?.error) return NA
      return o?.owners?.length ? o.owners.join(', ') : 'No HPD registration matched'
    },
  },
  {
    label: 'Last sale',
    cell: ({ record }) => {
      const s = record.lastSale
      if (s?.error) return NA
      if (!s?.lastDeed) return 'No deed found for this tax lot'
      const d = s.lastPricedSale && !(s.lastDeed.amount > 0) ? s.lastPricedSale : s.lastDeed
      return `${formatDate(d.date)} · ${d.amount > 0 ? money(d.amount) : 'no price recorded'}`
    },
  },
]

function Head({ entry, onRemove }) {
  const { record, scored } = entry
  return (
    <div className="flex items-center gap-3">
      <Mascot mood={scored.mood} className="h-16 w-16 shrink-0" title={`Mascot mood: ${MOOD_COPY[scored.mood].label}`} />
      <div className="min-w-0 flex-1 text-left">
        <p className="font-display text-lg font-extrabold leading-tight wrap-anywhere">{record.place.name}</p>
        <p className="text-xs font-bold uppercase tracking-wide text-ink/60">{record.place.borough}</p>
        <p className="text-sm font-medium">{MOOD_COPY[scored.mood].label}</p>
      </div>
      <button type="button" onClick={() => onRemove(record.place.bbl)} aria-label={`Remove ${record.place.name} from compare`} className="grid h-10 w-10 shrink-0 place-items-center self-start rounded-full border-2 border-ink bg-paper hover:bg-ink/10">
        <X aria-hidden size={16} strokeWidth={3} />
      </button>
    </div>
  )
}

export function CompareView({ tray, onRemove, onBack }) {
  const entries = useMemo(
    () => tray.map(({ record }) => ({ record, scored: scoreRecord(record), insights: computeInsights(record) })),
    [tray],
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-16 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold sm:text-4xl">
          <GitCompareArrows aria-hidden size={32} strokeWidth={2.75} /> Side by side
        </h1>
        <button type="button" onClick={onBack} className="pop-sm press inline-flex min-h-10 items-center gap-1 bg-paper px-3 py-1.5 text-sm font-bold">
          <ArrowLeft aria-hidden size={16} /> Back
        </button>
      </div>
      <p className="text-ink/75">The same public record facts for each building, in the order you pinned them. No winner here: read the numbers and decide for yourself.</p>

      {entries.length === 0 ? (
        <p className="pop bg-paper p-6 font-medium">Nothing pinned yet. Look up a building and press “Compare this building”.</p>
      ) : (
        <>
          {/* Wide screens: one column per building. */}
          <div className="pop hidden overflow-x-auto bg-paper md:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <caption className="sr-only">Public record facts for the pinned buildings, side by side</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-40 p-4 text-left align-bottom text-xs uppercase tracking-wide text-ink/55">Building</th>
                  {entries.map((e) => (
                    <th key={e.record.place.bbl} scope="col" className="p-4 align-top font-normal">
                      <Head entry={e} onRemove={onRemove} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label} className="border-t-2 border-dashed border-ink/15">
                    <th scope="row" className="p-4 text-left align-top font-bold">{row.label}</th>
                    {entries.map((e) => (
                      <td key={e.record.place.bbl} className="p-4 align-top wrap-anywhere">{row.cell(e)}</td>
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
                    <div key={row.label} className="py-2">
                      <dt className="text-xs font-bold uppercase tracking-wide text-ink/55">{row.label}</dt>
                      <dd className="mt-0.5 wrap-anywhere">{row.cell(e)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
          {entries.length === 1 && <p className="text-sm text-ink/70">Only one building is pinned. Search another address and pin it to see them side by side.</p>}
        </>
      )}

      <div className="text-center">
        <Disclaimer />
        <p className="mt-3 text-sm text-ink/60">Each building’s record was fetched when you looked it up. Counts cover the whole tax lot.</p>
      </div>
    </div>
  )
}
