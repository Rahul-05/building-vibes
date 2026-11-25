import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  ExternalLink,
  FileText,
  Phone,
  RefreshCw,
  Snowflake,
} from 'lucide-react'
import Mascot from './Mascot.jsx'
import { FLAG_STYLES, FlagDot } from './FlagSummary.jsx'
import { assessFreeze, parseAmount } from '../lib/freeze.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { useT } from '../i18n/index.jsx'

// Official pages only (checked Nov 25, 2026).
export const FREEZE_ROUTES = [
  { id: 'official', href: 'https://www.nyc.gov/site/rentfreeze/index.page' },
  {
    id: 'report',
    href: 'https://www.nyc.gov/assets/rentfreeze/downloads/pdf/2025-scrie_drie_report.pdf',
  },
]

const STEPS = ['who', 'home', 'income', 'burden']
const CHOICES = {
  who: ['senior', 'disability', 'neither', 'unsure'],
  home: ['stabilized', 'controlled', 'mitchell', 'unsure', 'none'],
  income: ['under', 'over', 'unsure'],
  burden: ['over', 'under', 'unsure'],
}
const EMPTY = { who: null, home: null, income: null, burden: null }

// Figures verified Nov 25, 2026 against the NYC Dept. of Finance 2025 Report on the
// New York City Rent Freeze Program (published June 2025): 2023 is the most recent
// year with complete data. Missing out is the arithmetic gap, 158214 minus 67132.
const STATS = [
  { value: 158214, label: 'freeze.stats.eligible', kind: 'num' },
  { value: 67132, label: 'freeze.stats.receiving', kind: 'num' },
  { value: '42.4%', label: 'freeze.stats.rate', kind: 'text' },
  { value: 91082, label: 'freeze.stats.missing', kind: 'num' },
]

const money = (t, n) => `$${t.num(Math.round(n * 100) / 100)}`

// "Freeze My Rent": the NYC Rent Freeze Program (SCRIE/DRIE) in plain language.
// Four plain questions, then a pattern match (never a verdict), a savings estimate,
// a document checklist, and a renewal explainer. Rule based (src/lib/freeze.js);
// the answers stay in this component's state and never leave the device.
// initial: { answers } opens straight on the result (used by the SSR check).
export default function FreezeCheck({ onClose, initial }) {
  const t = useT()
  const [answers, setAnswers] = useState(initial?.answers || EMPTY)
  const [step, setStep] = useState(initial?.answers ? STEPS.length : 0)
  const [skipped, setSkipped] = useState(false)
  const done = step >= STEPS.length && !skipped
  const result = useMemo(() => (done ? assessFreeze(answers) : null), [done, answers])
  const root = useRef(null)

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.from('.freeze-in', { y: 24, opacity: 0, duration: 0.45, stagger: 0.07, ease: 'back.out(1.6)', clearProps: 'transform' })
    }, root)
    return () => ctx.revert()
  }, [step])

  const set = (key, value) => setAnswers((a) => ({ ...a, [key]: value }))
  const go = (to) => {
    setStep(to)
    root.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }
  const restart = () => {
    setAnswers(EMPTY)
    setSkipped(false)
    go(0)
  }
  const skipQuiz = () => {
    setSkipped(true)
    go(STEPS.length)
  }

  return (
    <div ref={root} className="mx-auto w-full max-w-3xl scroll-mt-4 space-y-6 px-4 pb-16 sm:px-6">
      <button type="button" onClick={onClose} className="flex min-h-10 items-center gap-1 px-1 text-sm font-bold underline decoration-2 underline-offset-4">
        <ArrowLeft aria-hidden size={16} className="shrink-0 rtl:-scale-x-100" /> {t('freeze.back')}
      </button>

      {step === 0 && (
        <section className="freeze-in pop relative bg-sky p-5 text-cream sm:p-7">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-start">
            <Mascot mood="happy" className="h-28 w-28 sm:h-36 sm:w-36" title={t('mascot.vibe')} />
            <div className="min-w-0">
              <h1 className="flex items-center justify-center gap-2 text-3xl font-extrabold leading-tight sm:justify-start sm:text-4xl">
                <Snowflake aria-hidden size={30} strokeWidth={2.5} className="shrink-0" /> {t('freeze.heading')}
              </h1>
              <p className="mt-2 text-cream/90">{t('freeze.intro')}</p>
              <p className="mt-2 text-sm font-bold">{t('freeze.privacy')}</p>
            </div>
          </div>
        </section>
      )}

      {done ? (
        <Outcome result={result} onRestart={restart} onEdit={() => go(0)} />
      ) : step < STEPS.length ? (
        <Question step={step} answers={answers} set={set} go={go} onSkip={skipQuiz} />
      ) : null}

      {/* The tools below the quiz stand on their own: a visitor can read them without
          answering anything, and the skip link jumps straight here. */}
      <StatsStrip />
      <Calculator />
      <Checklist />
      <Renewal />
      <p className="freeze-in text-center text-sm text-ink/60">{t('freeze.sources')}</p>
      <p className="freeze-in text-center text-sm font-bold">{t('freeze.disclaimer')}</p>
    </div>
  )
}

function Question({ step, answers, set, go, onSkip }) {
  const t = useT()
  const id = STEPS[step]
  const value = answers[id]
  const ready = value != null
  const next = () => ready && go(step + 1)

  return (
    <form
      className="freeze-in pop bg-paper p-5 sm:p-7"
      onSubmit={(e) => {
        e.preventDefault()
        next()
      }}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-ink/60">{t('freeze.progress', { n: step + 1, total: STEPS.length })}</p>
      <div aria-hidden className="mt-2 flex gap-1.5">
        {STEPS.map((s, i) => (
          <span key={s} className={`h-2.5 flex-1 rounded-full border-2 border-ink ${i <= step ? 'bg-sky' : 'bg-paper'}`} />
        ))}
      </div>
      <fieldset className="mt-5">
        <legend className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{t(`freeze.q.${id}`)}</legend>
        <p className="mt-2 text-ink/75">{t(`freeze.q.${id}.help`)}</p>
        <div className="mt-5 grid gap-3">
          {CHOICES[id].map((c) => (
            <label key={c} className={`pop-sm press flex min-h-12 cursor-pointer items-center gap-3 px-4 py-3 font-bold ${value === c ? 'bg-lilac' : 'bg-paper'}`}>
              <input type="radio" name={id} value={c} checked={value === c} onChange={() => set(id, c)} className="h-5 w-5 shrink-0 accent-bubblegum" />
              <span className="min-w-0">{t(`freeze.a.${id}.${c}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!ready}
          className="pop-sm press flex min-h-12 items-center gap-2 bg-bubblegum px-5 py-3 font-display font-bold disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0"
        >
          {id === 'burden' ? t('freeze.see') : t('freeze.next')} <ArrowRight aria-hidden size={18} strokeWidth={2.5} className="rtl:-scale-x-100" />
        </button>
        {step > 0 && (
          <button type="button" onClick={() => go(step - 1)} className="flex min-h-12 items-center gap-1 px-2 font-bold underline decoration-2 underline-offset-4">
            {t('freeze.prev')}
          </button>
        )}
        {step === 0 && (
          <button type="button" onClick={onSkip} className="flex min-h-12 items-center gap-1 px-2 font-bold underline decoration-2 underline-offset-4">
            {t('freeze.skip')}
          </button>
        )}
      </div>
    </form>
  )
}

function Outcome({ result, onRestart, onEdit }) {
  const t = useT()
  const level = result.level
  const heroBg = level === 'green' ? 'bg-mint' : level === 'yellow' ? 'bg-sunny' : 'bg-tangerine'
  return (
    <div className="space-y-6">
      <section className={`freeze-in pop ${heroBg} p-5 sm:p-7`}>
        <div className="flex items-start gap-3">
          <FlagDot level={level} size="mt-1.5 h-5 w-5" />
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{t(`freeze.level.${level}`)}</h2>
            <p className="mt-2 text-ink/80">{t(`freeze.blurb.${level}`)}</p>
          </div>
        </div>
      </section>

      <section className="freeze-in pop bg-paper p-5 sm:p-7">
        <h2 className="font-display text-2xl font-extrabold">{t('freeze.decides.heading')}</h2>
        <ul className="mt-4 space-y-3">
          {result.reasons.map((r) => (
            <li key={r} className="flex items-start gap-3">
              <Check aria-hidden size={20} strokeWidth={3} className="mt-0.5 shrink-0 text-leaf" />
              <span>{t(`freeze.reason.${r}`)}</span>
            </li>
          ))}
          {result.pointsAway.map((r) => (
            <li key={`away-${r}`} className="flex items-start gap-3">
              <FlagDot level="red" size="mt-1 h-4 w-4" />
              <span>{t(`freeze.away.${r}`)}</span>
            </li>
          ))}
          {result.unsure && (
            <li className="flex items-start gap-3">
              <FlagDot level="yellow" size="mt-1 h-4 w-4" />
              <span>{t('freeze.unsure.note')}</span>
            </li>
          )}
          {result.reasons.length === 0 && result.pointsAway.length === 0 && !result.unsure && (
            <li className="text-ink/70">{t('freeze.blurb.yellow')}</li>
          )}
        </ul>
      </section>

      <section className="freeze-in pop bg-paper p-5 sm:p-7">
        <h2 className="font-display text-2xl font-extrabold">{t('freeze.next.heading')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a href={FREEZE_ROUTES[0].href} target="_blank" rel="noreferrer" className="pop-sm press flex min-h-12 items-center gap-3 bg-mint px-4 py-3 font-bold">
            <FileText aria-hidden size={20} strokeWidth={2.5} className="shrink-0" />
            <span className="min-w-0">
              <span className="block">{t('freeze.next.apply')}</span>
              <span className="block text-sm font-medium text-ink/70">{t('freeze.next.applyBody')}</span>
            </span>
            <ExternalLink aria-hidden size={18} strokeWidth={2.5} className="ms-auto shrink-0" />
          </a>
          <div className="pop-sm flex min-h-12 items-center gap-3 bg-sunny px-4 py-3 font-bold">
            <Phone aria-hidden size={20} strokeWidth={2.5} className="shrink-0" />
            <span className="min-w-0">
              <span className="block">{t('freeze.next.hotline')}</span>
              <span className="block text-sm font-medium text-ink/70">{t('freeze.next.hotlineBody')}</span>
            </span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={onEdit} className="pop-sm press min-h-12 bg-paper px-5 py-3 font-display font-bold">
            {t('freeze.edit')}
          </button>
          <button type="button" onClick={onRestart} className="flex min-h-12 items-center gap-1 px-2 font-bold underline decoration-2 underline-offset-4">
            {t('freeze.restart')}
          </button>
        </div>
      </section>
    </div>
  )
}

function StatsStrip() {
  const t = useT()
  return (
    <section className="freeze-in pop bg-paper p-5 sm:p-7">
      <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
        <Snowflake aria-hidden strokeWidth={2.75} /> {t('freeze.stats.heading')}
      </h2>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {STATS.map((s) => (
          <div key={s.label} className="pop-sm flex min-w-0 flex-col bg-cream px-3 py-4 text-center">
            <span className="font-display text-3xl font-extrabold sm:text-4xl">
              {s.kind === 'text' ? s.value : t.num(s.value)}
            </span>
            <span className="mt-1 text-xs font-bold leading-tight text-ink/70 sm:text-sm">{t(s.label)}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink/60">{t('freeze.stats.source')}</p>
      <a href={FREEZE_ROUTES[1].href} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-bold underline decoration-2 underline-offset-4">
        {t('freeze.official')} <ExternalLink aria-hidden size={15} strokeWidth={2.5} />
      </a>
    </section>
  )
}

function Calculator() {
  const t = useT()
  const [now, setNow] = useState('')
  const [frozen, setFrozen] = useState('')
  const nowN = parseAmount(now)
  const frozenN = parseAmount(frozen)
  const gap = nowN != null && frozenN != null ? nowN - frozenN : null
  return (
    <section className="freeze-in pop bg-paper p-5 sm:p-7">
      <h2 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{t('freeze.calc.heading')}</h2>
      <p className="mt-2 text-ink/75">{t('freeze.calc.intro')}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="text-xs font-bold uppercase tracking-wide text-ink/60">{t('freeze.calc.now')}</span>
          <span className="mt-1 flex min-h-12 items-center rounded-xl border-2 border-ink bg-cream px-3" dir="ltr">
            <span aria-hidden className="font-bold text-ink/60">$</span>
            <input
              inputMode="decimal"
              value={now}
              onChange={(e) => setNow(e.target.value)}
              placeholder="0"
              maxLength={12}
              className="ms-1 min-h-12 w-full min-w-0 bg-transparent text-lg font-medium placeholder:text-ink/40 focus:outline-none"
            />
          </span>
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-wide text-ink/60">{t('freeze.calc.frozen')}</span>
          <span className="mt-1 flex min-h-12 items-center rounded-xl border-2 border-ink bg-cream px-3" dir="ltr">
            <span aria-hidden className="font-bold text-ink/60">$</span>
            <input
              inputMode="decimal"
              value={frozen}
              onChange={(e) => setFrozen(e.target.value)}
              placeholder="0"
              maxLength={12}
              className="ms-1 min-h-12 w-full min-w-0 bg-transparent text-lg font-medium placeholder:text-ink/40 focus:outline-none"
            />
          </span>
        </label>
      </div>
      {gap != null && gap > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="pop-sm bg-mint px-3 py-4 text-center">
            <span className="block font-display text-2xl font-extrabold sm:text-3xl">{money(t, gap)}</span>
            <span className="mt-1 block text-xs font-bold leading-tight text-ink/70 sm:text-sm">{t('freeze.calc.monthly')}</span>
          </div>
          <div className="pop-sm bg-mint px-3 py-4 text-center">
            <span className="block font-display text-2xl font-extrabold sm:text-3xl">{money(t, gap * 12)}</span>
            <span className="mt-1 block text-xs font-bold leading-tight text-ink/70 sm:text-sm">{t('freeze.calc.yearly')}</span>
          </div>
        </div>
      )}
      {gap != null && gap <= 0 && <p className="mt-5 font-bold">{t('freeze.calc.noGap')}</p>}
      <p className="mt-4 text-sm text-ink/60">
        <span className="pill bg-sunny px-2 py-0.5 text-xs font-bold">{t('freeze.calc.estimate')}</span> {t('freeze.calc.context')}
      </p>
    </section>
  )
}

function Checklist() {
  const t = useT()
  return (
    <section className="freeze-in pop bg-paper p-5 sm:p-7">
      <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
        <ClipboardList aria-hidden strokeWidth={2.75} /> {t('freeze.check.heading')}
      </h2>
      <p className="mt-2 text-ink/75">{t('freeze.check.intro')}</p>
      <ul className="mt-4 space-y-3">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <li key={n} className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-sunny text-xs font-extrabold">{n}</span>
            <span>{t(`freeze.check.${n}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Renewal() {
  const t = useT()
  return (
    <section className="freeze-in pop bg-paper p-5 sm:p-7">
      <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
        <RefreshCw aria-hidden strokeWidth={2.75} /> {t('freeze.renew.heading')}
      </h2>
      <ul className="mt-4 space-y-3 text-ink/85">
        <li>{t('freeze.renew.1')}</li>
        <li>{t('freeze.renew.2')}</li>
        <li>{t('freeze.renew.3')}</li>
      </ul>
    </section>
  )
}
