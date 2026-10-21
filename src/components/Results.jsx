import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import Mascot from './Mascot.jsx'
import Confetti from './Confetti.jsx'
import Disclaimer from './Disclaimer.jsx'
import FlagSummary from './FlagSummary.jsx'
import Questions from './Questions.jsx'
import VibeCard from './VibeCard.jsx'
import BuildingStory from './BuildingStory.jsx'
import AskBuilding from './AskBuilding.jsx'
import AskFab from './AskFab.jsx'
import ListingCheck from './ListingCheck.jsx'
import DeeperRecord from './DeeperRecord.jsx'
import { TrendAndFixes } from './Context.jsx'
import { ComplaintsSection, DobSection, EvictionsSection, ViolationsSection } from './RecordSections.jsx'
import { Check, ClipboardList, GitCompareArrows } from 'lucide-react'
import { MOOD_COPY, scoreRecord, scoringBasis } from '../lib/scoring.js'
import { computeInsights } from '../lib/insights.js'
import { questionsFor } from '../lib/questions.js'
import { buildSummary } from '../lib/summary.js'
import { formatDate } from '../lib/plainLanguage.js'
import { prefersReducedMotion } from '../lib/motion.js'

const HERO_BG = { happy: 'bg-mint', mixed: 'bg-sunny', worried: 'bg-tangerine' }
const SOURCE_NAMES = {
  violations: 'HPD violations',
  complaints311: '311 complaints',
  dob: 'DOB complaints',
  evictions: 'evictions',
  aep: 'the AEP list',
  vacateOrders: 'vacate orders',
  litigations: 'HPD court cases',
  bedbugs: 'bedbug filings',
  building: 'the apartment count (PLUTO)',
  violationHistory: 'HPD violation history',
  complaintHistory: '311 history',
}

// Jump to the listing checker and focus its text box (inside a tap, so phones open the keyboard).
function openListingCheck() {
  document.getElementById('check-listing')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  document.getElementById('check-input')?.focus({ preventScroll: true })
}

// compare: { pinned, full, onToggle } from App's compare tray (optional).
// startWith: 'check' when the visitor asked for the listing checker on the landing page.
export default function Results({ record, compare, startWith }) {
  const scored = useMemo(() => scoreRecord(record), [record])
  const { flags, counts, mood } = scored
  const insights = useMemo(() => computeInsights(record), [record])
  const questions = useMemo(() => questionsFor(flags, record, undefined, insights), [flags, record, insights])
  const summary = useMemo(() => buildSummary(record, scored, insights), [record, scored, insights])
  const root = useRef(null)
  // Mascot arrives "searching", then settles into its computed mood.
  const [shownMood, setShownMood] = useState('searching')
  const celebrate = mood === 'happy' && counts.red === 0 && counts.yellow === 0 && shownMood === 'happy'

  const failed = Object.keys(SOURCE_NAMES).filter((k) => record[k]?.error)
  const { place } = record

  useLayoutEffect(() => {
    const reduce = prefersReducedMotion()
    const t = setTimeout(() => setShownMood(mood), reduce ? 0 : 650)
    if (reduce) return () => clearTimeout(t)
    const ctx = gsap.context(() => {
      gsap.from('.hero', { y: 30, scale: 0.96, opacity: 0, duration: 0.6, ease: 'back.out(1.7)' })
      gsap.from('.reveal', { y: 50, opacity: 0, duration: 0.7, stagger: 0.12, delay: 0.25, ease: 'power3.out' })
      gsap.from('.bar', { width: 0, duration: 1, delay: 0.6, stagger: 0.06, ease: 'power3.out' })
    }, root)
    return () => {
      clearTimeout(t)
      ctx.revert()
    }
  }, [mood])

  // Arriving from the landing page's "check a listing" choice: open on the checker once the
  // entrance animation has settled.
  useEffect(() => {
    if (startWith !== 'check') return
    const t = setTimeout(openListingCheck, prefersReducedMotion() ? 0 : 900)
    return () => clearTimeout(t)
  }, [startWith])

  return (
    <div ref={root} className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 sm:px-6">
      {celebrate && <Confetti />}

      <section className={`hero pop relative p-5 sm:p-8 ${HERO_BG[mood]}`}>
        {/* Only the decoration is clipped to the card, so the floating mascot never is. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[25px]">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-[3px] border-ink bg-paper/30" />
        </div>
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="shrink-0 overflow-visible py-2">
            <Mascot mood={shownMood} className="h-44 w-44 sm:h-52 sm:w-52" title={`Mascot mood: ${MOOD_COPY[mood].label}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-widest opacity-70">{place.borough}</p>
            <h1 className="mt-1 break-words text-3xl font-extrabold leading-tight sm:text-4xl">{place.name}</h1>
            {insights.factsLine && <p className="mt-1 font-bold text-ink/75">{insights.factsLine}</p>}
            <p className="mt-3 font-display text-2xl font-bold leading-tight">{MOOD_COPY[mood].label}</p>
            <p className="mt-1 text-ink/80">{MOOD_COPY[mood].blurb}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Disclaimer />
              {compare && (
                <button
                  type="button"
                  onClick={() => compare.onToggle(record)}
                  disabled={!compare.pinned && compare.full}
                  aria-pressed={compare.pinned}
                  className="pop-sm press inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap bg-paper px-3 py-1.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {compare.pinned ? <Check aria-hidden size={16} strokeWidth={3} /> : <GitCompareArrows aria-hidden size={16} strokeWidth={2.5} />}
                  {compare.pinned ? 'Pinned to compare' : compare.full ? 'Compare tray is full (3)' : 'Compare this building'}
                </button>
              )}
              <button
                type="button"
                onClick={openListingCheck}
                className="pop-sm press inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap bg-paper px-3 py-1.5 text-sm font-bold"
              >
                <ClipboardList aria-hidden size={16} strokeWidth={2.5} /> Check a listing
              </button>
            </div>
          </div>
        </div>
        <p className="relative mt-4 flex flex-wrap justify-center gap-x-2 text-xs text-ink/60 sm:justify-end">
          <span className="whitespace-nowrap">BBL {place.bbl}</span>
          {place.bin && <span className="whitespace-nowrap">· BIN {place.bin}</span>}
          <span className="whitespace-nowrap">· checked {formatDate(record.fetchedAt)}</span>
        </p>
      </section>

      {failed.length > 0 && (
        <p className="pop-sm reveal bg-paper p-4 text-sm font-medium">
          Heads up: we couldn’t load {failed.map((k) => SOURCE_NAMES[k]).join(', ')} just now, so those aren’t counted in the flags.
        </p>
      )}

      <BuildingStory summary={summary} />
      <FlagSummary flags={flags} counts={counts} benchmark={insights.benchmark} basis={scoringBasis(record)} />
      <ViolationsSection data={record.violations} />
      <ComplaintsSection data={record.complaints311} />
      <DobSection data={record.dob} />
      <EvictionsSection data={record.evictions} />
      <DeeperRecord record={record} />
      <Questions questions={questions} />
      <AskBuilding summary={summary} mood={mood} />
      <ListingCheck summary={summary} mood={mood} />
      <VibeCard place={place} mood={mood} counts={counts} />
      {/* Trend and fix rate close the page: the last substantive thing a reader reaches. */}
      <TrendAndFixes trend={insights.trend} fixRate={insights.fixRate} />

      <div className="reveal text-center">
        <Disclaimer />
        <p className="mt-3 text-sm text-ink/60">
          Sources: NYC Open Data (HPD violations, registrations, court cases, vacate orders and AEP; bedbug filings; 311; DOB; NYC Marshals; ACRIS property records; PLUTO tax lot data) and NYC GeoSearch. Records can lag or contain errors.
        </p>
      </div>

      <AskFab mood={mood} />
    </div>
  )
}
