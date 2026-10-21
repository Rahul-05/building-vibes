import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, FileText, Footprints, Landmark, Plus, ReceiptText, Scale, Trash2 } from 'lucide-react'
import Mascot from './Mascot.jsx'
import Confetti from './Confetti.jsx'
import { FLAG_STYLES, FlagDot } from './FlagSummary.jsx'
import { assessFee, parseAmount } from '../lib/fare.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { useT } from '../i18n/index.jsx'

const HERO_BG = { green: 'bg-mint', yellow: 'bg-sunny', red: 'bg-tangerine' }
const STATUS_LEVEL = { banned: 'red', unclear: 'yellow', consistent: 'green' }
const STEPS = ['signed', 'hired', 'extra', 'paper', 'rent']
const CHOICES = {
  signed: ['after', 'notYet', 'before', 'unsure'],
  hired: ['me', 'landlord', 'unsure'],
  extra: ['yes', 'no'],
  paper: ['yes', 'no', 'unsure'],
}
const EMPTY = { signed: null, hired: null, extra: null, charges: [{ label: '', amount: '' }], paper: null, rent: '' }

// Official pages only (checked Oct 21, 2026); the label and blurb for each are fare.route.<id>.*.
export const ROUTES = [
  { id: 'dcwp', href: 'https://www.nyc.gov/site/dca/consumers/file-complaint.page' },
  { id: 'dos', href: 'https://dos.ny.gov/file-complaint-against-licensee' },
  { id: 'court', href: 'https://www.nycourts.gov/courts/nyc/smallclaims/index.shtml' },
]

const money = (t, n) => `$${t.num(Math.round(n * 100) / 100)}`

// "Check a broker fee": a few plain questions, then the rule that applies, how the answers line up
// with it, the total, and what to do next. Rule based (src/lib/fare.js); the answers stay in this
// component's state and never leave the device.
// initial: { answers } opens straight on the result (used by the SSR check).
export default function FeeCheck({ onClose, initial }) {
  const t = useT()
  const [answers, setAnswers] = useState(initial?.answers || EMPTY)
  const [step, setStep] = useState(initial?.answers ? STEPS.length : 0)
  const done = step >= STEPS.length
  const result = useMemo(() => (done ? assessFee(answers) : null), [done, answers])
  const root = useRef(null)

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.from('.fee-in', { y: 24, opacity: 0, duration: 0.45, stagger: 0.07, ease: 'back.out(1.6)', clearProps: 'transform' })
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
    go(0)
  }

  return (
    <div ref={root} className="mx-auto w-full max-w-3xl scroll-mt-4 space-y-6 px-4 pb-16 sm:px-6">
      <button type="button" onClick={onClose} className="flex min-h-10 items-center gap-1 px-1 text-sm font-bold underline decoration-2 underline-offset-4">
        <ArrowLeft aria-hidden size={16} className="shrink-0 rtl:-scale-x-100" /> {t('fare.back')}
      </button>
      {done ? <Outcome result={result} onRestart={restart} onEdit={() => go(0)} /> : <Question step={step} answers={answers} set={set} go={go} />}
    </div>
  )
}

function Question({ step, answers, set, go }) {
  const t = useT()
  const id = STEPS[step]
  const value = answers[id]
  const charges = answers.charges
  const chargesReady = value === 'no' || (value === 'yes' && charges.some((c) => c.label.trim() && parseAmount(c.amount)))
  const ready = id === 'rent' ? true : id === 'extra' ? chargesReady : value != null
  const next = () => ready && go(step + 1)
  const setCharge = (i, key, v) => set('charges', charges.map((c, j) => (j === i ? { ...c, [key]: v } : c)))

  return (
    <>
      {step === 0 && (
        <section className="fee-in pop relative bg-sunny p-5 sm:p-7">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-start">
            <Mascot mood="happy" className="h-28 w-28 sm:h-36 sm:w-36" title={t('mascot.vibe')} />
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{t('fare.heading')}</h1>
              <p className="mt-2 text-ink/80">{t('fare.intro')}</p>
              <p className="mt-2 text-sm font-bold">{t('fare.privacy')}</p>
            </div>
          </div>
        </section>
      )}

      <form
        className="fee-in pop bg-paper p-5 sm:p-7"
        onSubmit={(e) => {
          e.preventDefault()
          next()
        }}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-ink/60">{t('fare.progress', { n: step + 1, total: STEPS.length })}</p>
        <div aria-hidden className="mt-2 flex gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-2.5 flex-1 rounded-full border-2 border-ink ${i <= step ? 'bg-bubblegum' : 'bg-paper'}`} />
          ))}
        </div>
        <fieldset className="mt-5">
          <legend className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{t(`fare.q.${id}`)}</legend>
          <p className="mt-2 text-ink/75">{t(`fare.q.${id}.help`)}</p>

          {CHOICES[id] && (
            <div className="mt-5 grid gap-3">
              {CHOICES[id].map((c) => (
                <label key={c} className={`pop-sm press flex min-h-12 cursor-pointer items-center gap-3 px-4 py-3 font-bold ${value === c ? 'bg-lilac' : 'bg-paper'}`}>
                  <input type="radio" name={id} value={c} checked={value === c} onChange={() => set(id, c)} className="h-5 w-5 shrink-0 accent-bubblegum" />
                  <span className="min-w-0">{t(`fare.a.${id}.${c}`)}</span>
                </label>
              ))}
            </div>
          )}

          {id === 'extra' && value === 'yes' && (
            <div className="mt-5 space-y-3">
              <p className="font-bold">{t('fare.charges.intro')}</p>
              {charges.map((c, i) => (
                <div key={i} className="pop-sm grid grid-cols-[1fr_auto] gap-2 bg-cream p-3 sm:grid-cols-[1fr_9rem_auto]">
                  <label className="col-span-2 sm:col-span-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-ink/60">{t('fare.charges.label')}</span>
                    <input
                      dir="auto"
                      value={c.label}
                      onChange={(e) => setCharge(i, 'label', e.target.value)}
                      placeholder={t('fare.charges.labelPlaceholder')}
                      maxLength={80}
                      className="mt-1 block min-h-12 w-full rounded-xl border-2 border-ink bg-paper px-3 font-medium placeholder:text-ink/40 focus:outline-none"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-bold uppercase tracking-wide text-ink/60">{t('fare.charges.amount')}</span>
                    <span className="mt-1 flex min-h-12 items-center rounded-xl border-2 border-ink bg-paper px-3" dir="ltr">
                      <span aria-hidden className="font-bold text-ink/60">$</span>
                      <input
                        inputMode="decimal"
                        value={c.amount}
                        onChange={(e) => setCharge(i, 'amount', e.target.value)}
                        placeholder="0"
                        maxLength={12}
                        className="ms-1 w-full min-w-0 bg-transparent font-medium placeholder:text-ink/40 focus:outline-none"
                      />
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => set('charges', charges.length > 1 ? charges.filter((_, j) => j !== i) : [{ label: '', amount: '' }])}
                    aria-label={t('fare.charges.remove')}
                    className="mt-5 flex min-h-12 min-w-12 items-center justify-center self-start rounded-xl hover:bg-ink/10"
                  >
                    <Trash2 aria-hidden size={18} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              {charges.length < 8 && (
                <button type="button" onClick={() => set('charges', [...charges, { label: '', amount: '' }])} className="flex min-h-10 items-center gap-1 font-bold underline decoration-2 underline-offset-4">
                  <Plus aria-hidden size={16} strokeWidth={2.75} /> {t('fare.charges.add')}
                </button>
              )}
            </div>
          )}

          {id === 'rent' && (
            <label className="mt-5 block">
              <span className="sr-only">{t('fare.q.rent')}</span>
              <span className="pop-sm flex min-h-12 max-w-xs items-center bg-paper px-4" dir="ltr">
                <span aria-hidden className="font-bold text-ink/60">$</span>
                <input
                  inputMode="decimal"
                  value={answers.rent}
                  onChange={(e) => set('rent', e.target.value)}
                  placeholder={t('fare.rentPlaceholder')}
                  maxLength={12}
                  className="ms-1 min-h-12 w-full min-w-0 bg-transparent text-lg font-medium placeholder:text-ink/40 focus:outline-none"
                />
              </span>
            </label>
          )}
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!ready}
            className="pop-sm press flex min-h-12 items-center gap-2 bg-bubblegum px-5 py-3 font-display font-bold disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0"
          >
            {id === 'rent' ? t('fare.see') : t('fare.next')} <ArrowRight aria-hidden size={18} strokeWidth={2.5} className="rtl:-scale-x-100" />
          </button>
          {step > 0 && (
            <button type="button" onClick={() => go(step - 1)} className="flex min-h-12 items-center gap-1 px-2 font-bold underline decoration-2 underline-offset-4">
              {t('fare.prev')}
            </button>
          )}
        </div>
      </form>
    </>
  )
}

function Outcome({ result, onRestart, onEdit }) {
  const t = useT()
  const { level, mood, charges, total, yearShare, reasons, applies, hired } = result
  const [shownMood, setShownMood] = useState('searching')

  useLayoutEffect(() => {
    const id = setTimeout(() => setShownMood(mood), prefersReducedMotion() ? 0 : 500)
    return () => clearTimeout(id)
  }, [mood])

  return (
    <>
      {level === 'green' && shownMood === 'happy' && <Confetti />}
      <section className={`fee-in pop relative p-5 sm:p-8 ${HERO_BG[level]}`}>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
          <Mascot mood={shownMood} className="h-40 w-40 shrink-0 sm:h-48 sm:w-48" title={t('mascot.mood', { label: t(`fare.level.${level}`) })} />
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-widest opacity-70">{t('fare.heading')}</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl" data-level={level}>{t(`fare.level.${level}`)}</h1>
            <p className="mt-2 text-ink/80">{t(`fare.blurb.${level}`)}</p>
            <FareDisclaimer className="mt-4" />
          </div>
        </div>
      </section>

      <section aria-labelledby="fare-rule" className="fee-in pop bg-paper p-5 sm:p-7">
        <h2 id="fare-rule" className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <Scale aria-hidden strokeWidth={2.75} /> {t('fare.rule.heading')}
        </h2>
        <p className="mt-3 font-medium">{t(`fare.rule.${applies}`)}</p>
        <p className="mt-2 text-ink/80">{t(`fare.rule.hired.${hired}`)}</p>
        <p className="mt-2 text-ink/80">{t('fare.rule.caps')}</p>
        <ul className="mt-5 space-y-3">
          {reasons.map((r) => (
            <li key={r.key} className={`flex items-start gap-3 rounded-2xl p-3 ${FLAG_STYLES[r.level].soft}`}>
              <FlagDot level={r.level} size="mt-1 h-4 w-4" />
              <p className="min-w-0 flex-1">{t(`fare.reason.${r.key}`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fare-charges" className="fee-in pop bg-lilac p-5 sm:p-7">
        <h2 id="fare-charges" className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <ReceiptText aria-hidden strokeWidth={2.75} /> {t('fare.charges.heading')}
        </h2>
        <div className="pop-sm mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-paper p-4">
          <span className="font-bold">{t('fare.total')}</span>
          <span className="font-display text-3xl font-extrabold" dir="ltr">{money(t, total)}</span>
          {yearShare != null && <span className="w-full text-sm text-ink/75">{t('fare.yearShare', { share: t.pct(yearShare) })}</span>}
        </div>
        {charges.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {charges.map((c, i) => (
              <li key={i} className="pop-sm grid overflow-hidden bg-paper sm:grid-cols-2">
                <div className="border-b-2 border-dashed border-ink/20 p-4 sm:border-b-0 sm:border-e-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/55">{t('fare.charges.youTyped')}</p>
                  <p className="badge-row mt-1 font-display text-lg font-bold leading-snug">
                    <span className="wrap-anywhere" dir="auto">{c.label || t('fare.charges.unnamed')}</span>
                    {c.amount != null && <span className="pill bg-ink/10 px-2 py-0.5 text-sm" dir="ltr">{money(t, c.amount)}</span>}
                  </p>
                  <p className="mt-1 text-sm text-ink/60">{t(`fare.kind.${c.kind}`)}</p>
                </div>
                <div className={`p-4 ${FLAG_STYLES[STATUS_LEVEL[c.status]].soft}`}>
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink/70">
                    <FlagDot level={STATUS_LEVEL[c.status]} /> {t(`fare.status.${c.status}`)}
                  </p>
                  <p className="mt-1 font-medium">{t(`fare.charge.${c.note}`, { cap: 20 })}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-ink/75">{t('fare.charges.none')}</p>
        )}
      </section>

      <NextSteps result={result} />

      <div className="fee-in flex flex-wrap items-center gap-2">
        <button type="button" onClick={onEdit} className="pop-sm press flex min-h-12 items-center gap-2 bg-paper px-4 py-3 font-display font-bold">
          {t('fare.edit')}
        </button>
        <button type="button" onClick={onRestart} className="flex min-h-12 items-center gap-1 px-2 font-bold underline decoration-2 underline-offset-4">
          {t('fare.restart')}
        </button>
      </div>
      <div className="text-center">
        <FareDisclaimer />
        <p className="mt-3 text-sm text-ink/60">{t('fare.sources')}</p>
      </div>
    </>
  )
}

export function FareDisclaimer({ className = '' }) {
  const t = useT()
  return (
    <p className={`inline-flex max-w-full items-center gap-2 rounded-[1.1rem] border-2 border-ink bg-paper px-3 py-1.5 text-start text-xs font-bold sm:px-4 sm:text-sm ${className}`}>
      <Scale aria-hidden size={16} strokeWidth={2.5} className="shrink-0" />
      {t('fare.disclaimer')}
    </p>
  )
}

// The written ask, built from fill in the blank lines: one line per kind of charge that matches a
// banned pattern, or a plain request for the basis of the charge when it is unclear.
export function scriptFor(result, t) {
  const { asks, banned, charges, total } = result
  const named = (asks.length ? banned : charges).map((c) => `${c.label || t('fare.charges.unnamed')}${c.amount != null ? ` (${money(t, c.amount)})` : ''}`)
  const sum = money(t, (asks.length ? banned : charges).reduce((s, c) => s + (c.amount || 0), 0) || total)
  const body = asks.length
    ? [t('fare.script.paidLine', { charges: named.join(', ') || t('fare.script.blank'), total: sum }), ...asks.map((k) => t(`fare.script.law.${k}`)), t('fare.script.askBack', { total: sum })]
    : [t('fare.script.askBasis', { charges: named.join(', ') || t('fare.script.blank') })]
  return [t('fare.script.hello'), '', ...body, '', t('fare.script.records'), '', t('fare.script.signoff')].join('\n')
}

function NextSteps({ result }) {
  const t = useT()
  const script = scriptFor(result, t)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the text is on screen to select by hand.
    }
  }
  const evidence = ['lease', 'receipts', 'listing', 'messages', 'paper', 'notes']

  return (
    <section aria-labelledby="fare-next" className="fee-in pop bg-paper p-5 sm:p-7">
      <h2 id="fare-next" className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
        <Footprints aria-hidden strokeWidth={2.75} /> {t('fare.next.heading')}
      </h2>
      <p className="mt-1 text-ink/70">{t('fare.next.intro')}</p>

      <ol className="mt-5 space-y-5">
        <li className="pop-sm bg-cream p-4">
          <h3 className="flex items-center gap-2 text-xl font-extrabold">
            <span className="font-display text-bubblegum">{t.num(1)}</span> <FileText aria-hidden size={20} strokeWidth={2.5} /> {t('fare.next.script')}
          </h3>
          <p className="mt-1 text-sm font-bold text-ink/70">{t('fare.next.scriptNote')}</p>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border-2 border-dashed border-ink/40 bg-paper p-3 font-sans text-sm leading-relaxed wrap-anywhere" data-testid="fare-script">{script}</pre>
          <button type="button" onClick={copy} className="pop-sm press mt-3 flex min-h-12 items-center gap-2 bg-sunny px-4 py-2 font-display font-bold">
            {copied ? <Check aria-hidden size={18} strokeWidth={3} /> : <Copy aria-hidden size={18} strokeWidth={2.5} />} {copied ? t('fare.next.copied') : t('fare.next.copy')}
          </button>
        </li>

        <li className="pop-sm bg-cream p-4">
          <h3 className="flex items-center gap-2 text-xl font-extrabold">
            <span className="font-display text-bubblegum">{t.num(2)}</span> <ReceiptText aria-hidden size={20} strokeWidth={2.5} /> {t('fare.next.evidence')}
          </h3>
          <ul className="mt-3 space-y-2">
            {evidence.map((e) => (
              <li key={e} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 h-4 w-4 shrink-0 rounded-md border-2 border-ink bg-paper" />
                <span className="min-w-0">{t(`fare.evidence.${e}`)}</span>
              </li>
            ))}
          </ul>
        </li>

        <li className="pop-sm bg-cream p-4">
          <h3 className="flex items-center gap-2 text-xl font-extrabold">
            <span className="font-display text-bubblegum">{t.num(3)}</span> <Landmark aria-hidden size={20} strokeWidth={2.5} /> {t('fare.next.routes')}
          </h3>
          <ul className="mt-3 space-y-3">
            {ROUTES.map((r) => (
              <li key={r.id}>
                <a href={r.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 font-bold underline decoration-2 underline-offset-4">
                  {t(`fare.route.${r.id}`)} <ExternalLink aria-hidden size={14} strokeWidth={2.5} className="shrink-0" />
                </a>
                <p className="text-sm text-ink/75">{t(`fare.route.${r.id}.note`)}</p>
              </li>
            ))}
          </ul>
        </li>
      </ol>
    </section>
  )
}
