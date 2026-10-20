import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '../lib/motion.js'

// Big soft color blobs drifting behind everything — the "campaign poster" layer.
const BLOBS = [
  { cls: 'bg-sunny -top-24 -left-20 h-72 w-72', r: '58% 42% 63% 37% / 45% 55% 45% 55%' },
  { cls: 'bg-bubblegum/80 top-1/3 -right-28 h-80 w-80', r: '40% 60% 35% 65% / 60% 35% 65% 40%' },
  { cls: 'bg-sky/70 -bottom-28 left-1/4 h-72 w-96', r: '63% 37% 54% 46% / 55% 48% 52% 45%' },
  { cls: 'bg-mint top-2/3 -left-24 h-56 w-56', r: '50% 50% 30% 70% / 50% 70% 30% 50%' },
]

export default function Backdrop() {
  const root = useRef(null)

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray('.blob').forEach((el, i) => {
        gsap.to(el, {
          x: gsap.utils.random(-40, 40),
          y: gsap.utils.random(-30, 30),
          rotation: gsap.utils.random(-25, 25),
          scale: gsap.utils.random(0.9, 1.12),
          duration: gsap.utils.random(7, 11),
          delay: i * 0.4,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        })
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={root} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {BLOBS.map((b, i) => (
        <div key={i} className={`blob absolute opacity-60 ${b.cls}`} style={{ borderRadius: b.r }} />
      ))}
      {/* faint dot grid for texture */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(#1d1a3a 1.5px, transparent 1.5px)', backgroundSize: '22px 22px' }}
      />
    </div>
  )
}
