import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '../lib/motion.js'

const COLORS = ['#ff5ca8', '#ffd23f', '#4d7cfe', '#6ee7b7', '#ff8a3d', '#9b6bff']
const PIECES = 70

// One-shot celebratory burst. Re-mount (change `key`) to fire again.
export default function Confetti() {
  const root = useRef(null)

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray('.confetti').forEach((el) => {
        const angle = gsap.utils.random(-Math.PI * 0.9, -Math.PI * 0.1)
        const power = gsap.utils.random(260, 620)
        gsap.set(el, { x: 0, y: 0, rotation: gsap.utils.random(0, 360), opacity: 1 })
        gsap.timeline()
          .to(el, { x: Math.cos(angle) * power, y: Math.sin(angle) * power, rotation: '+=' + gsap.utils.random(180, 720), duration: 0.9, ease: 'power3.out' })
          .to(el, { y: '+=' + gsap.utils.random(500, 800), x: '+=' + gsap.utils.random(-80, 80), rotation: '+=360', opacity: 0, duration: gsap.utils.random(1.4, 2.2), ease: 'power1.in' })
      })
    }, root)
    return () => ctx.revert()
  }, [])

  if (prefersReducedMotion()) return null

  return (
    <div ref={root} aria-hidden className="pointer-events-none fixed left-1/2 top-[38%] z-50 h-0 w-0">
      {Array.from({ length: PIECES }, (_, i) => {
        const round = i % 3 === 0
        return (
          <span
            key={i}
            className="confetti absolute block border-2 border-ink opacity-0"
            style={{
              background: COLORS[i % COLORS.length],
              width: round ? 12 : 10,
              height: round ? 12 : 18,
              borderRadius: round ? '999px' : '3px',
            }}
          />
        )
      })}
    </div>
  )
}
