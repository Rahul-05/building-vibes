import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ArrowLeft, Sparkles } from 'lucide-react'
import Backdrop from './components/Backdrop.jsx'
import Mascot from './components/Mascot.jsx'
import AddressSearch from './components/AddressSearch.jsx'
import LoadingView from './components/LoadingView.jsx'
import Results from './components/Results.jsx'
import StateMessage from './components/StateMessage.jsx'
import { CompareTray, CompareView, MAX_PINNED } from './components/Compare.jsx'
import { AddressNotFoundError, getBuildingRecord } from './data/index.js'
import { prefersReducedMotion } from './lib/motion.js'

const EXAMPLES = ['1520 Sedgwick Ave, Bronx', '1 Union Sq S, Manhattan', '2 Gold St, Manhattan']

// View state machine: idle → loading → results | notFound | error
// The compare tray and the comparison sit beside it: pinning survives new searches, and the
// comparison overlays whatever view is open (kept mounted, so the AI story isn't refetched).
export default function App() {
  const [view, setView] = useState({ name: 'idle' })
  const [tray, setTray] = useState([]) // [{ bbl, record }], in app state only, never stored
  const [comparing, setComparing] = useState(false)
  const requestRef = useRef(null)

  const togglePinned = (record) =>
    setTray((t) => {
      const bbl = record.place.bbl
      if (t.some((x) => x.bbl === bbl)) return t.filter((x) => x.bbl !== bbl)
      return t.length >= MAX_PINNED ? t : [...t, { bbl, record }]
    })
  const unpin = (bbl) => setTray((t) => t.filter((x) => x.bbl !== bbl))
  const openCompare = () => {
    setComparing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function search(input) {
    setComparing(false)
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setView({ name: 'loading', query: typeof input === 'string' ? input : input.label })
    window.scrollTo({ top: 0, behavior: 'smooth' })

    try {
      const record = await getBuildingRecord(input, { signal: controller.signal })
      if (!controller.signal.aborted) setView({ name: 'results', record })
    } catch (err) {
      if (controller.signal.aborted) return
      if (err instanceof AddressNotFoundError) setView({ name: 'notFound', query: input })
      else setView({ name: 'error', message: err.message, input })
    }
  }

  const reset = () => {
    setComparing(false)
    requestRef.current?.abort()
    setView({ name: 'idle' })
  }

  return (
    <div className={`relative min-h-dvh ${tray.length && !comparing ? 'pb-56 sm:pb-28' : ''}`}>
      <Backdrop />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <button type="button" onClick={reset} className="pop-sm press flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap bg-paper px-3 py-1.5 font-display text-lg font-extrabold">
          <span aria-hidden className="h-4 w-4 rounded-full border-2 border-ink bg-bubblegum" />
          Building Vibes
        </button>
        {(view.name !== 'idle' || comparing) && (
          <button type="button" onClick={reset} className="flex min-h-10 items-center gap-1 whitespace-nowrap px-1 text-sm font-bold underline decoration-2 underline-offset-4">
            <ArrowLeft aria-hidden size={16} /> New search
          </button>
        )}
      </header>

      {comparing && (
        <main>
          <CompareView tray={tray} onRemove={unpin} onBack={() => setComparing(false)} />
        </main>
      )}
      <main hidden={comparing}>
        {view.name === 'idle' && <Landing onSearch={search} />}
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
              compare={{ pinned: tray.some((x) => x.bbl === view.record.place.bbl), full: tray.length >= MAX_PINNED, onToggle: togglePinned }}
            />
          </>
        )}
        {view.name === 'notFound' && (
          <StateMessage
            mood="mixed"
            title="Hmm, we couldn’t find that one"
            action={<div className="relative z-50 w-full max-w-xl"><AddressSearch onSearch={search} autoFocus /></div>}
          >
            We couldn’t match “{String(view.query)}” to a NYC building. Try a house number and street, like “350 5th Ave, Manhattan”.
          </StateMessage>
        )}
        {view.name === 'error' && (
          <StateMessage
            mood="worried"
            title="The city’s data is being shy"
            action={
              <button type="button" onClick={() => search(view.input)} className="pop press bg-sunny px-6 py-3 font-display text-lg font-bold">
                Try again
              </button>
            }
          >
            {view.message || 'Something went wrong reaching NYC Open Data.'} Nothing is wrong on your end.
          </StateMessage>
        )}
      </main>

      <footer className="px-4 pb-8 text-center text-sm text-ink/60">
        Free & open. No accounts, no tracking, nothing stored. Data from NYC Open Data.
      </footer>
      {!comparing && <CompareTray tray={tray} onRemove={unpin} onClear={() => setTray([])} onView={openCompare} />}
    </div>
  )
}

function Landing({ onSearch }) {
  const root = useRef(null)

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

  const words = [
    ['What’s', 'bg-sunny'],
    ['the', null],
    ['vibe', 'bg-bubblegum'],
    ['of', null],
    ['your', null],
    ['next', null],
    ['building?', 'bg-sky text-cream'],
  ]

  return (
    <section ref={root} className="mx-auto grid w-full max-w-5xl items-center gap-6 px-4 pb-12 pt-4 sm:px-6 md:grid-cols-[1.4fr_1fr] md:pt-10">
      <div className="order-2 md:order-1">
        <h1 className="text-[2.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          {words.map(([w, cls], i) => (
            <span key={i} className={`word mr-[0.25em] inline-block ${cls ? `rounded-[0.4em] border-[3px] border-ink px-[0.2em] shadow-pop-sm ${cls} ${i % 2 ? 'rotate-2' : '-rotate-2'}` : ''}`}>
              {w}
            </span>
          ))}
        </h1>
        <p className="fade-up mt-5 max-w-lg text-lg text-ink/80 sm:text-xl">
          Type any NYC address. We pull the building’s public record (violations, 311 calls, building complaints, evictions) and turn it into flags in plain language.
        </p>
        {/* fade-up leaves a transform (own stacking context), so lift this one above its siblings. */}
        <div className="fade-up relative z-50 mt-7">
          <AddressSearch onSearch={onSearch} autoFocus />
        </div>
        <div className="fade-up mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1 font-bold"><Sparkles aria-hidden size={16} /> Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => onSearch(ex)} className="min-h-10 whitespace-nowrap rounded-full border-2 border-ink bg-paper px-3 py-1 font-medium hover:bg-sunny">
              {ex}
            </button>
          ))}
        </div>
        <p className="fade-up mt-6 text-sm font-bold">Based on public records, not advice. No login, nothing saved.</p>
      </div>
      <div className="mascot-in order-1 flex justify-center overflow-visible py-4 md:order-2">
        <Mascot mood="happy" className="h-52 w-52 sm:h-72 sm:w-72 md:h-80 md:w-80" title="Happy building mascot" />
      </div>
    </section>
  )
}
