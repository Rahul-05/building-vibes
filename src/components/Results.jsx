import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import Mascot from './Mascot.jsx'
import Confetti from './Confetti.jsx'
import Disclaimer from './Disclaimer.jsx'
import FlagSummary from './FlagSummary.jsx'
import Questions from './Questions.jsx'
import VibeCard from './VibeCard.jsx'
import BuildingStory from './BuildingStory.jsx'
import AskBuilding from './AskBuilding.jsx'
import { ComplaintsSection, DobSection, EvictionsSection, ViolationsSection } from './RecordSections.jsx'
import { MOOD_COPY, scoreRecord } from '../lib/scoring.js'
import { questionsFor } from '../lib/questions.js'
import { buildSummary } from '../lib/summary.js'
import { formatDate } from '../lib/plainLanguage.js'
import { prefersReducedMotion } from '../lib/motion.js'

const HERO_BG = { happy: 'bg-mint', mixed: 'bg-sunny', worried: 'bg-tangerine' }
const SOURCE_NAMES = { violations: 'HPD violations', complaints311: '311 complaints', dob: 'DOB complaints', evictions: 'evictions' }

export default function Results({ record }) {
  const scored = useMemo(() => scoreRecord(record), [record])
  const { flags, counts, mood } = scored
  const questions = useMemo(() => questionsFor(flags), [flags])
  const summary = useMemo(() => buildSummary(record, scored), [record, scored])
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
            <p className="mt-3 font-display text-2xl font-bold">{MOOD_COPY[mood].label}</p>
            <p className="mt-1 text-ink/80">{MOOD_COPY[mood].blurb}</p>
            <Disclaimer className="mt-4" />
          </div>
        </div>
        <p className="relative mt-4 text-center text-xs text-ink/60 sm:text-right">
          BBL {place.bbl}{place.bin && ` · BIN ${place.bin}`} · checked {formatDate(record.fetchedAt)}
        </p>
      </section>

      {failed.length > 0 && (
        <p className="pop-sm reveal bg-paper p-4 text-sm font-medium">
          Heads up: we couldn’t load {failed.map((k) => SOURCE_NAMES[k]).join(', ')} just now, so those aren’t counted in the flags.
        </p>
      )}

      <BuildingStory summary={summary} />
      <FlagSummary flags={flags} counts={counts} />
      <ViolationsSection data={record.violations} />
      <ComplaintsSection data={record.complaints311} />
      <DobSection data={record.dob} />
      <EvictionsSection data={record.evictions} />
      <Questions questions={questions} />
      <AskBuilding summary={summary} mood={mood} />
      <VibeCard place={place} mood={mood} counts={counts} />

      <div className="reveal text-center">
        <Disclaimer />
        <p className="mt-3 text-sm text-ink/60">
          Sources: NYC Open Data (HPD, 311, DOB, NYC Marshals) and NYC GeoSearch. Records can lag or contain errors.
        </p>
      </div>
    </div>
  )
}
