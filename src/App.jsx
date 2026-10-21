import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ArrowLeft, ArrowRight, ClipboardList, ReceiptText, Sparkles } from 'lucide-react'
import Backdrop from './components/Backdrop.jsx'
import Mascot from './components/Mascot.jsx'
import AddressSearch from './components/AddressSearch.jsx'
import LoadingView from './components/LoadingView.jsx'
import Results from './components/Results.jsx'
import StateMessage from './components/StateMessage.jsx'
import LanguagePicker from './components/LanguagePicker.jsx'
import FeeCheck from './components/FeeCheck.jsx'
import { CompareTray, CompareView, MAX_PINNED } from './components/Compare.jsx'
import { AddressNotFoundError, getBuildingRecord } from './data/index.js'
import { prefersReducedMotion } from './lib/motion.js'
import { useT } from './i18n/index.jsx'

const EXAMPLES = ['1520 Sedgwick Ave, Bronx', '1 Union Sq S, Manhattan', '2 Gold St, Manhattan']

// View state machine: idle → loading → results | notFound | error
// The compare tray and the comparison sit beside it: pinning survives new searches, and the
// comparison overlays whatever view is open (kept mounted, so the AI story isn't refetched).
export default function App() {
  const t = useT()
  const [view, setView] = useState({ name: 'idle' })
  const [tray, setTray] = useState([]) // [{ bbl, record }], in app state only, never stored
  const [comparing, setComparing] = useState(false)
  // The broker fee checker overlays whatever view is open, like the comparison, so closing it
  // returns to the landing page or the building it was opened from.
  const [checkingFee, setCheckingFee] = useState(false)
  const [adding, setAdding] = useState(null) // compare search: { status: 'loading', label } | { status: 'error', message }
  const requestRef = useRef(null)
  const addRef = useRef(null)

  const togglePinned = (record) =>
    setTray((t) => {
      const bbl = record.place.bbl
      if (t.some((x) => x.bbl === bbl)) return t.filter((x) => x.bbl !== bbl)
      return t.length >= MAX_PINNED ? t : [...t, { bbl, record }]
    })
  const unpin = (bbl) => {
    setTray((t) => t.filter((x) => x.bbl !== bbl))
    setAdding((a) => (a?.status === 'error' ? null : a))
  }
  const clearTray = () => {
    addRef.current?.abort()
    setAdding(null)
    setTray([])
  }

  // Search from inside the compare tray or comparison: fetch the record and pin it in place,
  // leaving whatever page is open untouched.
  async function addToCompare(input) {
    if (tray.length >= MAX_PINNED) return
    addRef.current?.abort()
    const controller = new AbortController()
    addRef.current = controller
    const label = typeof input === 'string' ? `“${input}”` : input.label
    setAdding({ status: 'loading', label })
    try {
      const record = await getBuildingRecord(input, { signal: controller.signal })
      if (controller.signal.aborted) return
      const bbl = record.place.bbl
      if (tray.some((x) => x.bbl === bbl)) return setAdding({ status: 'error', message: t('app.alreadyInTray', { name: record.place.name }) })
      setTray((t) => (t.length >= MAX_PINNED || t.some((x) => x.bbl === bbl) ? t : [...t, { bbl, record }]))
      setAdding(null)
    } catch (err) {
      if (controller.signal.aborted) return
      setAdding({
        status: 'error',
        message: err instanceof AddressNotFoundError ? t('app.compareNotFound', { label }) : t('app.dataError'),
      })
    }
  }
  const openFeeCheck = () => {
    setComparing(false)
    setCheckingFee(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const closeFeeCheck = () => {
    setCheckingFee(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openCompare = () => {
    setCheckingFee(false)
    setComparing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // opts.startWith: 'check' opens the results on the listing checker (chosen on the landing page).
  async function search(input, { startWith } = {}) {
    setComparing(false)
    setCheckingFee(false)
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setView({ name: 'loading', query: typeof input === 'string' ? input : input.label })
    window.scrollTo({ top: 0, behavior: 'smooth' })

    try {
      const record = await getBuildingRecord(input, { signal: controller.signal })
      if (!controller.signal.aborted) setView({ name: 'results', record, startWith })
    } catch (err) {
      if (controller.signal.aborted) return
      if (err instanceof AddressNotFoundError) setView({ name: 'notFound', query: input })
      else setView({ name: 'error', message: err.message, input })
    }
  }

  const reset = () => {
    setComparing(false)
    setCheckingFee(false)
    requestRef.current?.abort()
    setView({ name: 'idle' })
  }

  return (
    // Bottom padding clears the compare tray (it publishes its height) and the floating Ask button.
    // dir and lang follow the chosen language; RTL layouts lean on logical (start/end) classes.
    <div dir={t.dir} lang={t.code} className="relative min-h-dvh" style={{ paddingBottom: `calc(var(--tray-space, 0px) + ${view.name === 'results' && !comparing && !checkingFee ? '5.5rem' : '0px'})` }}>
      <Backdrop />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <button type="button" onClick={reset} className="pop-sm press flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap bg-paper px-3 py-1.5 font-display text-lg font-extrabold">
          <span aria-hidden className="h-4 w-4 rounded-full border-2 border-ink bg-bubblegum" />
          Building Vibes
        </button>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {(view.name !== 'idle' || comparing || checkingFee) && (
            // Icon only on phones (the address box sits right below on results), so the header fits.
            <button type="button" onClick={reset} aria-label={t('app.newSearch')} className="flex min-h-10 min-w-10 items-center justify-center gap-1 whitespace-nowrap px-1 text-sm font-bold underline decoration-2 underline-offset-4">
              <ArrowLeft aria-hidden size={16} className="shrink-0 rtl:-scale-x-100" /> <span className="hidden sm:inline">{t('app.newSearch')}</span>
            </button>
          )}
          <LanguagePicker />
        </div>
      </header>

      {comparing && (
        <main>
          <CompareView tray={tray} adding={adding} onAdd={addToCompare} onRemove={unpin} onBack={() => setComparing(false)} />
        </main>
      )}
      {checkingFee && (
        <main>
          <FeeCheck onClose={closeFeeCheck} />
        </main>
      )}
      <main hidden={comparing || checkingFee}>
        {view.name === 'idle' && <Landing onSearch={search} onFeeCheck={openFeeCheck} />}
        {view.name === 'loading' && <LoadingView query={view.query} />}
        {view.name === 'results' && (
          <>
            {/* Positioned + z-50 so the suggestions list stacks over the (GSAP-transformed) results below. */}
            <div className="relative z-50 mx-auto mb-6 w-full max-w-3xl px-4 sm:px-6">
              <AddressSearch onSearch={search} compact />
            </div>
            <Results
              key={view.record.place.bbl + view.record.fetchedAt}
              record={view.record}
              startWith={view.startWith}
              compare={{ pinned: tray.some((x) => x.bbl === view.record.place.bbl), full: tray.length >= MAX_PINNED, onToggle: togglePinned }}
              onFeeCheck={openFeeCheck}
            />
          </>
        )}
        {view.name === 'notFound' && (
          <StateMessage
            mood="mixed"
            title={t('app.notFoundTitle')}
            action={<div className="relative z-50 w-full max-w-xl"><AddressSearch onSearch={search} autoFocus /></div>}
          >
            {t('app.notFoundBody', { query: typeof view.query === 'string' ? view.query : view.query?.label || '' })}
          </StateMessage>
        )}
        {view.name === 'error' && (
          <StateMessage
            mood="worried"
            title={t('app.errorTitle')}
            action={
              <button type="button" onClick={() => search(view.input)} className="pop press bg-sunny px-6 py-3 font-display text-lg font-bold">
                {t('app.tryAgain')}
              </button>
            }
          >
            {t('app.errorBody')}
          </StateMessage>
        )}
      </main>

      <footer className="px-4 pb-8 text-center text-sm text-ink/60">
        {t('app.footer')}
      </footer>
      {!comparing && !checkingFee && <CompareTray tray={tray} adding={adding} onAdd={addToCompare} onRemove={unpin} onClear={clearTray} onView={openCompare} />}
    </div>
  )
}

// "[What’s] the [vibe] of your next [building?]": bracketed words get the sticker highlight, in
// order. Languages written without spaces keep their pieces touching.
const HIGHLIGHTS = ['bg-sunny', 'bg-bubblegum', 'bg-sky text-cream']
function headlineWords(text) {
  const words = []
  let marked = 0
  for (const m of text.matchAll(/\[([^\]]+)\]|[^\s[]+/g)) {
    const spaced = /\s/.test(text[m.index + m[0].length] || ' ')
    words.push({ text: m[1] ?? m[0], cls: m[1] ? HIGHLIGHTS[marked++ % HIGHLIGHTS.length] : null, spaced })
  }
  return words
}

function Landing({ onSearch, onFeeCheck }) {
  const t = useT()
  const root = useRef(null)
  // "I have a listing to check": the next address picked opens on the listing checker.
  const [withListing, setWithListing] = useState(false)
  const go = (input) => onSearch(input, withListing ? { startWith: 'check' } : undefined)

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'back.out(1.8)' } })
        .from('.word', { y: 60, rotation: () => gsap.utils.random(-12, 12), opacity: 0, duration: 0.7, stagger: 0.08 })
        .from('.mascot-in', { scale: 0.98, opacity: 0, duration: 1, ease: 'power1.out' }, '-=0.5')
        .from('.fade-up', { y: 24, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power3.out' }, '-=0.6')
    }, root)
    return () => ctx.revert()
  }, [])

  const words = headlineWords(t('landing.headline'))

  return (
    <section ref={root} className="mx-auto grid w-full max-w-5xl items-center gap-6 px-4 pb-12 pt-4 sm:px-6 md:grid-cols-[1.4fr_1fr] md:pt-10">
      <div className="order-2 md:order-1">
        <h1 className="text-[2.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          {words.map(({ text, cls, spaced }, i) => (
            <span key={i} className={`word inline-block ${spaced ? 'me-[0.25em]' : cls ? 'mx-[0.08em]' : ''} ${cls ? `rounded-[0.4em] border-[3px] border-ink px-[0.2em] shadow-pop-sm ${cls} ${i % 2 ? 'rotate-2' : '-rotate-2'}` : ''}`}>
              {text}
            </span>
          ))}
        </h1>
        <p className="fade-up mt-5 max-w-lg text-lg text-ink/80 sm:text-xl">
          {t('landing.intro')}
        </p>
        {/* fade-up leaves a transform (own stacking context), so lift this one above its siblings. */}
        <div className="fade-up relative z-50 mt-7">
          <AddressSearch onSearch={go} autoFocus />
        </div>
        <div className="fade-up mt-3">
          <button
            type="button"
            onClick={() => setWithListing((v) => !v)}
            aria-pressed={withListing}
            className={`pop-sm press inline-flex min-h-10 items-center gap-1.5 px-3 py-1.5 text-start text-sm font-bold ${withListing ? 'bg-lilac' : 'bg-paper'}`}
          >
            <ClipboardList aria-hidden size={16} strokeWidth={2.5} className="shrink-0" />
            {withListing ? t('landing.listingOn') : t('landing.listingOff')}
          </button>
          {withListing && (
            <p className="mt-2 max-w-lg text-sm text-ink/70">
              {t('landing.listingNote')}
            </p>
          )}
        </div>
        <div className="fade-up mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1 font-bold"><Sparkles aria-hidden size={16} /> {t('landing.try')}</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" dir="ltr" onClick={() => go(ex)} className="min-h-10 whitespace-nowrap rounded-full border-2 border-ink bg-paper px-3 py-1 font-medium hover:bg-sunny">
              {ex}
            </button>
          ))}
        </div>
        {/* The broker fee checker's entry card: its own flow, no address needed. */}
        <button
          type="button"
          onClick={onFeeCheck}
          className="fade-up pop press mt-7 flex w-full max-w-lg items-center gap-3 bg-sunny p-4 text-start sm:p-5"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-[2.5px] border-ink bg-paper">
            <ReceiptText aria-hidden size={24} strokeWidth={2.5} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl font-extrabold leading-tight">{t('fare.entry.title')}</span>
            <span className="mt-0.5 block text-sm text-ink/75">{t('fare.entry.body')}</span>
          </span>
          <ArrowRight aria-hidden size={22} strokeWidth={2.75} className="shrink-0 rtl:-scale-x-100" />
        </button>
        <p className="fade-up mt-6 text-sm font-bold">{t('landing.disclaimer')}</p>
      </div>
      <div className="mascot-in order-1 flex justify-center overflow-visible py-4 md:order-2">
        <Mascot mood="happy" className="h-52 w-52 sm:h-72 sm:w-72 md:h-80 md:w-80" title={t('mascot.happy')} />
      </div>
    </section>
  )
}
