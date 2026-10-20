import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import Mascot from './Mascot.jsx'
import { prefersReducedMotion } from '../lib/motion.js'

const MESSAGES = [
  'Finding the building on the map…',
  'Knocking on HPD’s door…',
  'Reading through 311 calls…',
  'Checking in with the Department of Buildings…',
  'Looking up marshal records…',
  'Tallying up the flags…',
]

export default function LoadingView({ query }) {
  const [i, setI] = useState(0)
  const dots = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 1400)
    return () => clearInterval(t)
  }, [])

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.to('.dot', { y: -18, duration: 0.4, yoyo: true, repeat: -1, ease: 'power2.out', stagger: { each: 0.12 } })
    }, dots)
    return () => ctx.revert()
  }, [])

  return (
    <section className="flex flex-col items-center px-6 py-10 text-center" aria-live="polite" aria-busy="true">
      <Mascot mood="searching" className="h-56 w-56 sm:h-64 sm:w-64" title="Mascot searching the records" />
      <div ref={dots} className="mt-4 flex gap-3" aria-hidden>
        {['bg-bubblegum', 'bg-sunny', 'bg-sky', 'bg-mint'].map((c) => (
          <span key={c} className={`dot h-4 w-4 rounded-full border-2 border-ink ${c}`} />
        ))}
      </div>
      <p className="mt-6 font-display text-2xl font-bold sm:text-3xl">{MESSAGES[i]}</p>
      {typeof query === 'string' && <p className="mt-2 text-ink/60">“{query}”</p>}
    </section>
  )
}
