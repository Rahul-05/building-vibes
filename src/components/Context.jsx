import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Minus, TrendingUp } from 'lucide-react'

// Phase 4 context blocks: "How it compares" (sits inside the flags card) and the trend and
// fix rate card. Factual lines only; nothing here changes flags or the mascot.

export function HowItCompares({ benchmark }) {
  return (
    <div className="mt-6 rounded-2xl border-[2.5px] border-dashed border-ink/40 bg-lilac/50 p-4">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <BarChart3 aria-hidden size={18} strokeWidth={2.5} /> How it compares
      </h3>
      {benchmark.unavailable ? (
        <p className="mt-1 text-sm text-ink/70">{benchmark.unavailable}</p>
      ) : (
        <>
          <p className="mt-1 font-medium">{benchmark.lines.all}</p>
          <p className="mt-1 text-sm text-ink/75">{benchmark.lines.classC}</p>
          <p className="mt-2 text-xs text-ink/55">{benchmark.basis}</p>
        </>
      )}
    </div>
  )
}

export const TREND_ICONS = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight, quiet: Minus }

// One small single series line per measure (they differ in scale, so each gets its own).
// The last year is partial: dashed segment, hollow marker, "so far" label.
function Sparkline({ label, color, points }) {
  const W = 160
  const H = 44
  const pad = 6
  const max = Math.max(1, ...points.map((p) => p.value))
  const x = (i) => pad + (i * (W - pad * 2)) / (points.length - 1)
  const y = (v) => H - pad - (v / max) * (H - pad * 2)
  const solid = points.slice(0, -1).map((p, i) => `${x(i)},${y(p.value)}`).join(' ')
  const n = points.length
  const tail = `${x(n - 2)},${y(points[n - 2].value)} ${x(n - 1)},${y(points[n - 1].value)}`

  return (
    <figure className="min-w-0">
      <figcaption className="flex items-center gap-2 text-sm font-bold">
        <span aria-hidden className="h-1 w-4 rounded-full" style={{ background: color }} /> {label}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-12 w-full max-w-56 overflow-visible" role="img" aria-label={`${label} by year: ${points.map((p) => `${p.year}${p.partial ? ' so far' : ''} ${p.value}`).join(', ')}`}>
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="#1d1a3a" strokeOpacity="0.15" strokeWidth="1" />
        <polyline points={solid} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={tail} fill="none" stroke={color} strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.year}>
            <circle cx={x(i)} cy={y(p.value)} r="4" fill={p.partial ? '#fffdf8' : color} stroke={p.partial ? color : '#fffdf8'} strokeWidth="2" />
            {/* larger invisible hit target carries the hover tooltip */}
            <circle cx={x(i)} cy={y(p.value)} r="10" fill="transparent">
              <title>{`${p.year}${p.partial ? ' so far' : ''}: ${p.value.toLocaleString()}`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <ol className="mt-1 flex max-w-56 justify-between text-[11px] leading-tight text-ink/60">
        {points.map((p) => (
          <li key={p.year} className="text-center">
            <span className="block font-bold text-ink">{p.value.toLocaleString()}</span>
            {`’${String(p.year).slice(2)}`}
            {p.partial && <span className="block whitespace-nowrap">so far</span>}
          </li>
        ))}
      </ol>
    </figure>
  )
}

export function TrendAndFixes({ trend, fixRate }) {
  if (trend.unavailable && fixRate.unavailable) {
    return (
      <section className="pop reveal bg-paper p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <TrendingUp aria-hidden strokeWidth={2.75} /> Trend and fixes
        </h2>
        <p className="mt-3 rounded-2xl bg-ink/5 p-4 text-ink/70">The history behind the trend didn’t load right now. Try again in a bit.</p>
      </section>
    )
  }
  const Icon = TREND_ICONS[trend.direction] || Minus

  return (
    <section aria-labelledby="trend-heading" className="pop reveal bg-paper p-5 sm:p-7">
      <h2 id="trend-heading" className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
        <TrendingUp aria-hidden strokeWidth={2.75} /> Trend and fixes
      </h2>

      {!trend.unavailable && (
        <div className="mt-4">
          <p className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="pop-sm grid h-9 w-9 shrink-0 place-items-center bg-sunny">
              <Icon aria-hidden size={20} strokeWidth={2.75} />
            </span>
            <span className="min-w-0">{trend.headline}</span>
          </p>
          <p className="mt-2 text-ink/80">{trend.detail}</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {trend.sources.violations && <Sparkline label="HPD violations issued" color="#4d7cfe" points={trend.years.map((y) => ({ ...y, value: y.violations }))} />}
            {trend.sources.complaints && <Sparkline label="Building complaints to 311" color="#ff8a3d" points={trend.years.map((y) => ({ ...y, value: y.complaints }))} />}
          </div>
          {!(trend.sources.violations && trend.sources.complaints) && (
            <p className="mt-2 text-xs text-ink/55">{trend.sources.violations ? '311 history' : 'HPD history'} didn’t load, so the trend uses the other source only.</p>
          )}
        </div>
      )}

      {!fixRate.unavailable && (
        <div className="mt-6 border-t-2 border-dashed border-ink/15 pt-5">
          <h3 className="font-display text-lg font-bold">How violations get closed</h3>
          <p className="mt-1 text-ink/85">{fixRate.sentence}</p>
          {fixRate.issued > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="pop-sm whitespace-nowrap bg-mint px-3 py-1 font-bold">{Math.round(fixRate.closedShare * 100)}% marked closed</span>
              {fixRate.medianDays !== null && <span className="pop-sm whitespace-nowrap bg-sky/30 px-3 py-1 font-bold">Typical fix about {fixRate.medianDays.toLocaleString()} days</span>}
              {fixRate.openOverYear > 0 && <span className="pop-sm whitespace-nowrap bg-sunny px-3 py-1 font-bold">{fixRate.openOverYear.toLocaleString()} open more than a year</span>}
            </div>
          )}
          <p className="mt-3 text-xs text-ink/55">
            Closed includes violations HPD dismissed. Days run from the notice to the date the status changed to closed.
            {fixRate.medianSampled && ' The typical fix is based on the most recent 5,000 closed violations.'}
          </p>
        </div>
      )}
    </section>
  )
}
