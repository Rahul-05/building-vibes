import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { MessageCircle, Send } from 'lucide-react'
import Mascot from './Mascot.jsx'
import { askBuilding } from '../data/index.js'
import { prefersReducedMotion } from '../lib/motion.js'

const SUGGESTIONS = ['What comes up most often?', 'Anything recent?', 'What should I ask the landlord?']
const INTRO = 'Ask me about this building’s record. I can only go by what’s on this page.'
const FAILED = 'I couldn’t reach my notes just now. Give it another try in a moment.'
const MAX_CHARS = 300

// "Ask about this building": one question at a time, answered in the mascot's speech bubble.
export default function AskBuilding({ summary, mood }) {
  const [question, setQuestion] = useState('')
  const [exchange, setExchange] = useState(null) // { q, a, asking }
  const asking = Boolean(exchange?.asking)
  const root = useRef(null)
  const requestRef = useRef(null)

  useEffect(() => () => requestRef.current?.abort(), [])

  async function ask(text) {
    const q = text.trim().slice(0, MAX_CHARS)
    if (!q || asking) return
    const controller = new AbortController()
    requestRef.current = controller
    setExchange({ q, asking: true })
    setQuestion('')
    try {
      const a = await askBuilding(summary, q, { signal: controller.signal })
      setExchange({ q, a })
    } catch {
      if (!controller.signal.aborted) setExchange({ q, a: FAILED })
    }
  }

  // Pop the bubble in whenever the mascot starts or finishes "talking".
  useLayoutEffect(() => {
    if (prefersReducedMotion() || !exchange) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.answer-bubble', { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)', transformOrigin: '0% 50%' })
      if (asking) {
        gsap.fromTo('.asked-bubble', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' })
        gsap.to('.typing-dot', { y: -6, duration: 0.35, yoyo: true, repeat: -1, ease: 'power2.out', stagger: 0.12 })
      }
    }, root)
    return () => ctx.revert()
  }, [exchange, asking])

  return (
    <section ref={root} aria-labelledby="ask-heading" className="pop reveal bg-mint p-5 sm:p-7">
      <h2 id="ask-heading" className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
        <MessageCircle aria-hidden strokeWidth={2.75} /> Ask about this building
      </h2>

      <div className="mt-5 flex items-end gap-3 sm:gap-4">
        <div className="shrink-0 overflow-visible pt-2">
          <Mascot mood={asking ? 'searching' : mood} className="h-24 w-24 sm:h-28 sm:w-28" title="Vibe, the building mascot" />
        </div>
        <div className="min-w-0 flex-1 space-y-3 pb-2" aria-live="polite">
          {exchange && (
            <p className="asked-bubble ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md border-[2.5px] border-ink bg-sunny px-4 py-2 font-medium wrap-anywhere">
              {exchange.q}
            </p>
          )}
          <div className="answer-bubble pop-sm relative bg-paper p-4">
            <span aria-hidden className="absolute -left-[9px] bottom-5 h-4 w-4 rotate-45 border-b-[2.5px] border-l-[2.5px] border-ink bg-paper" />
            {asking ? (
              <span className="flex items-center gap-1.5 py-1" aria-label="Vibe is thinking">
                {['bg-bubblegum', 'bg-sunny', 'bg-sky'].map((c) => (
                  <span key={c} aria-hidden className={`typing-dot h-3 w-3 rounded-full border-2 border-ink ${c}`} />
                ))}
              </span>
            ) : (
              <p className="relative whitespace-pre-line font-medium">{exchange?.a || INTRO}</p>
            )}
          </div>
        </div>
      </div>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          ask(question)
        }}
      >
        <label htmlFor="ask-input" className="sr-only">Your question about this building</label>
        <input
          id="ask-input"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={MAX_CHARS}
          disabled={asking}
          placeholder="Ask a question…"
          autoComplete="off"
          className="pop-sm min-w-0 flex-1 bg-paper px-4 py-3 font-medium placeholder:text-ink/40 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={asking || !question.trim()}
          className="pop-sm press flex shrink-0 items-center gap-2 bg-bubblegum px-4 py-3 font-display font-bold disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0"
        >
          <Send aria-hidden size={18} strokeWidth={2.5} /> Ask
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={asking}
            onClick={() => ask(s)}
            className="min-h-10 rounded-full border-2 border-ink bg-paper px-3 py-1 text-sm font-medium hover:bg-sunny disabled:opacity-50 disabled:hover:bg-paper"
          >
            {s}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-ink/70">
        Answers come only from the public record shown on this page. Based on public records, not advice.
      </p>
    </section>
  )
}
