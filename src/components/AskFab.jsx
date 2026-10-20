import { useEffect, useState } from 'react'
import { MascotFace } from './Mascot.jsx'
import { prefersReducedMotion } from '../lib/motion.js'

// Floating "Ask Vibe" button, bottom right of the results page. It jumps to the Ask section and
// focuses the question box, and steps aside while that section is on screen. It sits above the
// compare tray: the tray publishes the space it takes as --tray-space on <html>.
export default function AskFab({ mood, targetId = 'ask', inputId = 'ask-input' }) {
  const [askInView, setAskInView] = useState(false)

  useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setAskInView(entry.isIntersecting), { threshold: 0.2 })
    io.observe(target)
    return () => io.disconnect()
  }, [targetId])

  function go() {
    document.getElementById(targetId)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    // Focus inside the tap itself so phones open the keyboard; the smooth scroll does the moving.
    document.getElementById(inputId)?.focus({ preventScroll: true })
  }

  return (
    <button
      type="button"
      onClick={go}
      inert={askInView}
      aria-label="Ask Vibe about this building"
      style={{ bottom: 'calc(var(--tray-space, 0px) + max(1rem, env(safe-area-inset-bottom)))' }}
      className={`pop-sm press fixed right-4 z-[55] flex min-h-12 items-center gap-2 rounded-full bg-bubblegum py-1.5 pl-1.5 pr-4 font-display text-base font-bold transition-[opacity,translate] duration-300 sm:right-6 ${askInView ? 'pointer-events-none translate-y-4 opacity-0' : ''}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-ink">
        <MascotFace mood={mood} className="h-full w-full" />
      </span>
      <span className="whitespace-nowrap">Ask Vibe</span>
    </button>
  )
}
