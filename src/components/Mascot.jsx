import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '../lib/motion.js'

// "Vibe" — a squishy building blob. All mood-dependent shapes share the same SVG
// command structure (M x y Q cx cy x y), so GSAP can tween `d` between moods without plugins.
const MOODS = {
  happy: {
    body: '#ff5ca8', shade: '#e8448f', cheek: '#ffc2dc', window: '#ffe68a',
    mouth: 'M78 132 Q100 160 122 132',
    browL: 'M64 72 Q78 64 92 72', browR: 'M108 72 Q122 64 136 72',
    pupil: { x: 0, y: 1 }, lid: 0, sweat: 0, sparkle: 1,
  },
  mixed: {
    body: '#ffc93c', shade: '#f0b31f', cheek: '#ffe9a8', window: '#fff6d6',
    mouth: 'M84 140 Q102 140 118 133',
    browL: 'M64 76 Q78 74 92 76', browR: 'M108 64 Q122 54 136 64',
    pupil: { x: 4, y: -4 }, lid: 0, sweat: 0, sparkle: 0,
  },
  worried: {
    body: '#8fa8ff', shade: '#6f8cf0', cheek: '#c3d0ff', window: '#dfe6ff',
    mouth: 'M84 145 Q100 130 116 145',
    browL: 'M64 79 Q80 75 92 68', browR: 'M108 68 Q120 75 136 79',
    pupil: { x: 7, y: 3 }, lid: 1, sweat: 1, sparkle: 0,
  },
  searching: {
    body: '#6ee7b7', shade: '#43cf98', cheek: '#c4f5df', window: '#eafff5',
    mouth: 'M90 138 Q100 148 110 138',
    browL: 'M64 70 Q78 64 92 70', browR: 'M108 70 Q122 64 136 70',
    pupil: { x: 0, y: 0 }, lid: 0, sweat: 0, sparkle: 0,
  },
}

// Position lives on the wrapper so GSAP can own the inner path's scale/rotation.
function Sparkle({ x, y, s = 1, color = '#ffd23f', visible }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        className="sparkle"
        d="M0 -10 C2 -2 2 -2 10 0 C2 2 2 2 0 10 C-2 2 -2 2 -10 0 C-2 -2 -2 -2 0 -10 Z"
        fill={color}
        stroke="#1d1a3a"
        strokeWidth="2"
        opacity={visible}
      />
    </g>
  )
}

export default function Mascot({ mood = 'happy', className = '', title }) {
  const root = useRef(null)
  const initial = useRef(MOODS[mood] || MOODS.happy).current

  // Mood transition: tween every mood-driven attribute to the new state.
  useLayoutEffect(() => {
    const cfg = MOODS[mood] || MOODS.happy
    const el = root.current
    const q = gsap.utils.selector(el)
    const d = prefersReducedMotion() ? 0 : 0.7
    const ease = 'back.out(1.6)'

    gsap.to(q('.body'), { attr: { fill: cfg.body }, duration: d })
    gsap.to(q('.shade'), { attr: { fill: cfg.shade }, duration: d })
    gsap.to(q('.lid'), { attr: { fill: cfg.body }, opacity: cfg.lid, duration: d })
    gsap.to(q('.cheek'), { attr: { fill: cfg.cheek }, duration: d })
    gsap.to(q('.win'), { attr: { fill: cfg.window }, duration: d })
    gsap.to(q('.mouth'), { attr: { d: cfg.mouth }, duration: d, ease })
    gsap.to(q('.brow-l'), { attr: { d: cfg.browL }, duration: d, ease })
    gsap.to(q('.brow-r'), { attr: { d: cfg.browR }, duration: d, ease })
    gsap.to(q('.pupil'), { x: cfg.pupil.x, y: cfg.pupil.y, duration: d, ease })
    gsap.to(q('.sweat'), { opacity: cfg.sweat, scale: cfg.sweat ? 1 : 0.4, transformOrigin: '50% 0%', duration: d })
    gsap.to(q('.sparkle'), { opacity: cfg.sparkle, scale: cfg.sparkle, transformOrigin: '50% 50%', duration: d, stagger: 0.08, ease })
    // A little "boing" so the change itself reads as a moment.
    if (d) gsap.fromTo(q('.boing'), { scaleX: 1.12, scaleY: 0.88 }, { scaleX: 1, scaleY: 1, duration: 0.9, ease: 'elastic.out(1, 0.4)', transformOrigin: '50% 100%' })
  }, [mood])

  // Idle loop per mood. Reverted (transforms reset) before the next mood's loop starts.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const blink = gsap.timeline({ repeat: -1, repeatDelay: 2.8 })
      blink.to('.eye', { scaleY: 0.1, transformOrigin: '50% 50%', duration: 0.08 }).to('.eye', { scaleY: 1, duration: 0.12 })

      if (mood === 'happy') {
        gsap.timeline({ repeat: -1 })
          .to('.figure', { y: -16, scaleY: 1.03, scaleX: 0.98, duration: 0.42, ease: 'power2.out', transformOrigin: '50% 100%' })
          .to('.figure', { y: 0, scaleY: 1, scaleX: 1, duration: 0.38, ease: 'power2.in' })
          .to('.figure', { scaleY: 0.93, scaleX: 1.06, duration: 0.1, yoyo: true, repeat: 1 })
        gsap.timeline({ repeat: -1 })
          .to('.shadow', { scaleX: 0.75, opacity: 0.12, duration: 0.42, ease: 'power2.out', transformOrigin: '50% 50%' })
          .to('.shadow', { scaleX: 1, opacity: 0.2, duration: 0.38, ease: 'power2.in' })
          .to({}, { duration: 0.2 })
        gsap.to('.sparkle', { rotation: 30, scale: 0.7, duration: 0.9, yoyo: true, repeat: -1, stagger: 0.3, ease: 'sine.inOut', transformOrigin: '50% 50%' })
      } else if (mood === 'mixed') {
        gsap.timeline({ repeat: -1, yoyo: true })
          .to('.figure', { rotation: -7, duration: 1.4, ease: 'sine.inOut', transformOrigin: '50% 100%' })
          .to('.figure', { rotation: -3, duration: 1.2, ease: 'sine.inOut' })
        gsap.to('.brow-r', { y: -3, duration: 0.6, yoyo: true, repeat: -1, repeatDelay: 1.5, ease: 'sine.inOut' })
      } else if (mood === 'worried') {
        gsap.to('.figure', { scaleY: 0.96, y: 4, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 100%' })
        gsap.to('.figure', { x: 2, duration: 0.12, yoyo: true, repeat: -1, repeatDelay: 2.5, ease: 'none' })
        gsap.fromTo('.sweat-drop', { y: 0 }, { y: 14, duration: 1.4, repeat: -1, ease: 'power1.in', repeatDelay: 0.6 })
      } else if (mood === 'searching') {
        gsap.timeline({ repeat: -1 })
          .to('.pupil', { x: -7, duration: 0.35, ease: 'power2.inOut' })
          .to('.pupil', { x: 7, duration: 0.5, ease: 'power2.inOut', delay: 0.25 })
          .to('.pupil', { x: 0, duration: 0.3, delay: 0.25 })
        gsap.to('.figure', { y: -8, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' })
      }
    }, root)
    return () => ctx.revert()
  }, [mood])

  useLayoutEffect(() => () => gsap.killTweensOf(root.current?.querySelectorAll('*') || []), [])

  return (
    <svg
      ref={root}
      viewBox="0 0 200 230"
      className={className}
      role="img"
      aria-label={title || `Building mascot looking ${mood}`}
    >
      <ellipse className="shadow" cx="100" cy="216" rx="62" ry="8" fill="#1d1a3a" opacity="0.2" />

      <g className="boing">
        <g className="figure">
          {/* antenna + chimney */}
          <path d="M100 38 L100 18" stroke="#1d1a3a" strokeWidth="4" strokeLinecap="round" />
          <circle cx="100" cy="14" r="7" fill="#ffd23f" stroke="#1d1a3a" strokeWidth="3" />
          <rect className="shade" x="132" y="24" width="16" height="26" rx="5" fill={initial.shade} stroke="#1d1a3a" strokeWidth="3" />

          {/* body */}
          <path
            className="body"
            d="M42 74 Q40 40 76 38 L124 38 Q160 40 158 74 L163 178 Q165 206 136 206 L64 206 Q35 206 37 178 Z"
            fill={initial.body}
            stroke="#1d1a3a"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          {/* soft highlight */}
          <path d="M56 70 Q56 52 74 50" stroke="#fff" strokeOpacity="0.55" strokeWidth="6" fill="none" strokeLinecap="round" />

          {/* windows + door */}
          {[[58, 160], [120, 160]].map(([x, y]) => (
            <rect key={x} className="win" x={x} y={y} width="22" height="20" rx="6" fill={initial.window} stroke="#1d1a3a" strokeWidth="3" />
          ))}
          <path d="M88 206 L88 178 Q88 166 100 166 Q112 166 112 178 L112 206" fill="#1d1a3a" />
          <circle cx="106" cy="188" r="2" fill="#ffd23f" />

          {/* cheeks */}
          <ellipse className="cheek" cx="62" cy="122" rx="10" ry="6" fill={initial.cheek} />
          <ellipse className="cheek" cx="138" cy="122" rx="10" ry="6" fill={initial.cheek} />

          {/* eyes */}
          {[78, 122].map((cx) => (
            <g key={cx}>
              <g className="eye">
                <circle cx={cx} cy="98" r="15" fill="#fff" stroke="#1d1a3a" strokeWidth="3.5" />
                <g className="pupil" transform={`translate(${initial.pupil.x} ${initial.pupil.y})`}>
                  <circle cx={cx} cy="99" r="7" fill="#1d1a3a" />
                  <circle cx={cx + 2.5} cy="96" r="2.2" fill="#fff" />
                </g>
              </g>
              {/* droopy eyelid (worried) */}
              <path className="lid" d={`M${cx - 16.5} 98 A16.5 16.5 0 0 1 ${cx + 16.5} 98 Z`} fill={initial.body} stroke="#1d1a3a" strokeWidth="3.5" opacity={initial.lid} />
            </g>
          ))}

          {/* brows + mouth */}
          <path className="brow-l" d={initial.browL} stroke="#1d1a3a" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path className="brow-r" d={initial.browR} stroke="#1d1a3a" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path className="mouth" d={initial.mouth} stroke="#1d1a3a" strokeWidth="5" fill="none" strokeLinecap="round" />

          {/* sweat drop (worried) */}
          <g className="sweat" opacity={initial.sweat}>
            <path className="sweat-drop" d="M160 64 Q150 80 156 86 Q164 90 166 80 Q166 72 160 64 Z" fill="#bfe3ff" stroke="#1d1a3a" strokeWidth="2.5" />
          </g>
        </g>
      </g>

      {/* sparkles (happy) */}
      <Sparkle x={24} y={60} s={1.2} visible={initial.sparkle} />
      <Sparkle x={180} y={44} s={0.9} color="#6ee7b7" visible={initial.sparkle} />
      <Sparkle x={182} y={140} s={0.7} color="#ffffff" visible={initial.sparkle} />
    </svg>
  )
}
