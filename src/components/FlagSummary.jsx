import { useState } from 'react'
import { ChevronDown, Flag } from 'lucide-react'
import { RULES } from '../lib/scoring.js'

export const FLAG_STYLES = {
  red: { bg: 'bg-tomato', soft: 'bg-tomato/15', text: 'text-ink', label: 'Red flags' },
  yellow: { bg: 'bg-sunny', soft: 'bg-sunny/25', text: 'text-ink', label: 'Yellow flags' },
  green: { bg: 'bg-mint', soft: 'bg-mint/30', text: 'text-ink', label: 'Green flags' },
}

export function FlagDot({ level, size = 'h-3.5 w-3.5' }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full border-2 border-ink ${size} ${FLAG_STYLES[level].bg}`} />
}

export default function FlagSummary({ flags, counts }) {
  const [showRules, setShowRules] = useState(false)

  return (
    <section aria-labelledby="flags-heading" className="pop reveal bg-paper p-5 sm:p-7">
      <h2 id="flags-heading" className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
        <Flag aria-hidden strokeWidth={2.75} /> The flags
      </h2>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {['red', 'yellow', 'green'].map((level) => (
          <div key={level} className={`pop-sm flex flex-col items-center py-4 ${FLAG_STYLES[level].bg}`}>
            <span className="font-display text-4xl font-extrabold sm:text-5xl">{counts[level]}</span>
            <span className="text-xs font-bold uppercase tracking-wide sm:text-sm">{FLAG_STYLES[level].label}</span>
          </div>
        ))}
      </div>

      {flags.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {flags.map((f) => (
            <li key={f.id} className={`flex items-start gap-3 rounded-2xl p-3 ${FLAG_STYLES[f.level].soft}`}>
              <FlagDot level={f.level} size="mt-1 h-4 w-4" />
              <div>
                <p className="font-bold">
                  {f.title} <span className="ml-1 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-bold">{f.source}</span>
                </p>
                <p className="text-ink/80">{f.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-ink/70">Not enough data came back to raise any flags.</p>
      )}

      <button
        type="button"
        onClick={() => setShowRules((s) => !s)}
        aria-expanded={showRules}
        className="mt-5 inline-flex items-center gap-1 text-sm font-bold underline decoration-2 underline-offset-4"
      >
        How we pick flags
        <ChevronDown aria-hidden size={16} className={`transition-transform ${showRules ? 'rotate-180' : ''}`} />
      </button>
      {showRules && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink/75">
          {RULES.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
    </section>
  )
}
