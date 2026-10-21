import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '../lib/motion.js'
import { useT } from '../i18n/index.jsx'

// "Vibe" — a calm line-art building. The face is strokes only (no filled eyes); every
// mood-dependent path shares the same command structure (M x y Q cx cy x y), so GSAP can
// tween `d` between moods without plugins.
const INK = '#1d1a3a'
const STROKE = 3.5

const MOODS = {
  happy: {
    body: '#f6bfcf', door: '#e79bb2',
    eyeL: 'M73 103 Q80 95 87 103', eyeR: 'M113 103 Q120 95 127 103',
    browL: 'M73 87 Q80 85 87 87', browR: 'M113 87 Q120 85 127 87', brow: 0,
    mouth: 'M90 124 Q100 132 110 124',
  },
  mixed: {
    body: '#f5dc9a', door: '#e3c172',
    eyeL: 'M74 101 Q80 104 86 101', eyeR: 'M114 101 Q120 104 126 101',
    browL: 'M73 87 Q80 85 87 87', browR: 'M113 87 Q120 85 127 87', brow: 0,
    mouth: 'M92 127 Q100 129 108 127',
  },
  worried: {
    body: '#b9c5ee', door: '#97a6db',
    eyeL: 'M74 104 Q80 101 86 100', eyeR: 'M114 100 Q120 101 126 104',
    browL: 'M73 90 Q80 88 86 85', browR: 'M114 85 Q120 88 127 90', brow: 0.65,
    mouth: 'M92 129 Q100 124 108 129',
  },
  searching: {
    body: '#b4e3cf', door: '#8fcfb4',
    eyeL: 'M74 102 Q80 97 86 102', eyeR: 'M114 102 Q120 97 126 102',
    browL: 'M73 87 Q80 85 87 87', browR: 'M113 87 Q120 85 127 87', brow: 0,
    mouth: 'M94 126 Q100 129 106 126',
  },
}

// Slow float per mood: [amplitude in viewBox units (≤4), seconds per half-cycle].
const FLOAT = { happy: [4, 4], mixed: [3, 4.6], worried: [2.5, 5], searching: [3.5, 3.6] }

const line = { stroke: INK, strokeWidth: STROKE, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }

// Static close up of Vibe's face (no motion), for small spots like the floating Ask button.
export function MascotFace({ mood = 'happy', className = '' }) {
  const cfg = MOODS[mood] || MOODS.happy
  return (
    <svg aria-hidden viewBox="58 70 84 84" className={`block shrink-0 ${className}`}>
      <rect x="48" y="44" width="104" height="162" fill={cfg.body} />
      <path d={cfg.eyeL} {...line} />
      <path d={cfg.eyeR} {...line} />
      <g opacity={cfg.brow}>
        <path d={cfg.browL} {...line} />
        <path d={cfg.browR} {...line} />
      </g>
      <path d={cfg.mouth} {...line} />
    </svg>
  )
}

export default function Mascot({ mood = 'happy', className = '', title }) {
  const t = useT()
  const root = useRef(null)
  const initial = useRef(MOODS[mood] || MOODS.happy).current

  // Mood transition: soft crossfade of colors and face strokes, plus a gentle 0.98 → 1 settle.
  useLayoutEffect(() => {
    const cfg = MOODS[mood] || MOODS.happy
    const q = gsap.utils.selector(root.current)
    const reduce = prefersReducedMotion()
    const d = reduce ? 0 : 0.9
    const ease = 'sine.inOut'

    gsap.to(q('.body'), { attr: { fill: cfg.body }, duration: d, ease })
    gsap.to(q('.door'), { attr: { fill: cfg.door }, duration: d, ease })
    gsap.to(q('.eye-l'), { attr: { d: cfg.eyeL }, duration: d, ease })
    gsap.to(q('.eye-r'), { attr: { d: cfg.eyeR }, duration: d, ease })
    gsap.to(q('.brow-l'), { attr: { d: cfg.browL }, duration: d, ease })
    gsap.to(q('.brow-r'), { attr: { d: cfg.browR }, duration: d, ease })
    gsap.to(q('.brow'), { opacity: cfg.brow, duration: d, ease })
    gsap.to(q('.mouth'), { attr: { d: cfg.mouth }, duration: d, ease })
    if (!reduce) {
      gsap.fromTo(q('.settle'), { scale: 0.98, opacity: 0.85 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'power1.out', transformOrigin: '50% 100%' })
    }
  }, [mood])

  // Idle float per mood. Reverted (transforms reset) before the next mood's loop starts.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const [amp, dur] = FLOAT[mood] || FLOAT.happy
    const ctx = gsap.context(() => {
      gsap.to('.figure', { y: -amp, duration: dur, yoyo: true, repeat: -1, ease: 'sine.inOut' })
      gsap.to('.shadow', { scaleX: 0.92, opacity: 0.08, duration: dur, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 50%' })
      if (mood === 'searching') {
        // An unhurried glance left and right while the records load.
        gsap.fromTo('.face', { x: -3 }, { x: 3, duration: 1.8, yoyo: true, repeat: -1, ease: 'power1.inOut' })
      }
    }, root)
    return () => ctx.revert()
  }, [mood])

  useLayoutEffect(() => () => gsap.killTweensOf(root.current?.querySelectorAll('*') || []), [])

  // The padded frame plus the viewBox headroom (antenna top ≈ y18, float ≤ 4) keep the whole
  // character and its shadow inside the box at every point of the animation.
  return (
    <div className={`mascot-frame shrink-0 overflow-visible p-1.5 ${className}`}>
      <svg
        ref={root}
        viewBox="0 0 200 240"
        className="block h-full w-full overflow-visible"
        role="img"
        aria-label={title || t('mascot.vibe')}
      >
        <ellipse className="shadow" cx="100" cy="224" rx="56" ry="6" fill={INK} opacity="0.12" />

        <g className="settle">
          <g className="figure">
            {/* antenna */}
            <path d="M100 44 L100 29" {...line} />
            <circle cx="100" cy="24" r="4" fill="#fffaf0" stroke={INK} strokeWidth={STROKE} />

            {/* body */}
            <rect className="body" x="48" y="44" width="104" height="162" rx="24" fill={initial.body} stroke={INK} strokeWidth={STROKE} />
            {/* soft highlight */}
            <path d="M62 70 Q62 58 74 58" stroke="#fff" strokeOpacity="0.5" strokeWidth={STROKE} strokeLinecap="round" fill="none" />

            {/* windows + door */}
            {[64, 116].map((x) => (
              <rect key={x} x={x} y="150" width="20" height="18" rx="5" fill="#fffaf0" stroke={INK} strokeWidth={STROKE} />
            ))}
            <path className="door" d="M88 206 L88 180 Q88 170 100 170 Q112 170 112 180 L112 206" fill={initial.door} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />

            {/* face: stroke eyes, a faint brow line (worried only), one small mouth curve */}
            <g className="face">
              <path className="eye-l" d={initial.eyeL} {...line} />
              <path className="eye-r" d={initial.eyeR} {...line} />
              <g className="brow" opacity={initial.brow}>
                <path className="brow-l" d={initial.browL} {...line} />
                <path className="brow-r" d={initial.browR} {...line} />
              </g>
              <path className="mouth" d={initial.mouth} {...line} />
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}
