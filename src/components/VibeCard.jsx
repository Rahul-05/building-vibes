import Mascot from './Mascot.jsx'
import { DISCLAIMER } from './Disclaimer.jsx'
import { MOOD_COPY } from '../lib/scoring.js'

// Contrasting backgrounds so the mascot (whose body color tracks mood) always pops.
const MOOD_BG = { happy: 'bg-sunny', mixed: 'bg-sky', worried: 'bg-lilac' }

// Static share card (Phase 1). Phase 2: export to image / share link.
export default function VibeCard({ place, mood, counts }) {
  return (
    <section aria-labelledby="vibecard-heading" className="reveal">
      <h2 id="vibecard-heading" className="mb-3 text-2xl font-extrabold sm:text-3xl">Your vibe card</h2>
      <div className={`pop relative mx-auto max-w-sm p-6 ${MOOD_BG[mood]}`}>
        {/* decorative shapes, clipped to the card on their own layer so the mascot never is */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[25px]">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border-[3px] border-ink bg-paper/40" />
          <div className="absolute -bottom-8 -left-6 h-24 w-24 rotate-12 rounded-[30%] border-[3px] border-ink bg-mint/70" />
        </div>

        <p className="relative font-display text-sm font-extrabold uppercase tracking-[0.2em]">Building Vibes</p>
        <div className="relative mt-2 flex items-center gap-3">
          <div className="shrink-0 overflow-visible py-1">
            <Mascot mood={mood} className="h-28 w-28" />
          </div>
          <div>
            <p className="font-display text-2xl font-extrabold leading-tight">{MOOD_COPY[mood].label}</p>
            <p className="mt-1 text-sm font-medium">{place.name}</p>
            <p className="text-sm opacity-75">{place.borough}</p>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
          {[['red', 'bg-tomato'], ['yellow', 'bg-sunny'], ['green', 'bg-mint']].map(([level, bg]) => (
            <div key={level} className={`rounded-2xl border-[2.5px] border-ink py-2 ${bg}`}>
              <p className="font-display text-2xl font-extrabold">{counts[level]}</p>
              <p className="text-[11px] font-bold uppercase">{level}</p>
            </div>
          ))}
        </div>
        <p className="relative mt-4 text-center text-xs font-bold">{DISCLAIMER}</p>
      </div>
    </section>
  )
}
