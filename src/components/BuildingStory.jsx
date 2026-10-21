import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { BookOpen } from 'lucide-react'
import AiFooter from './AiFooter.jsx'
import { fetchStory } from '../data/index.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { LANGUAGE_BY_CODE, useT } from '../i18n/index.jsx'

// "This building's story": AI-written from the compact summary in the visitor's language, with a
// quiet template paragraph (`fallback`, already in that language) if the AI helper is slow, down,
// or not configured. Switching language asks for the story again.
export default function BuildingStory({ summary, fallback }) {
  const t = useT()
  const [story, setStory] = useState({ status: 'loading' })
  const root = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    setStory({ status: 'loading' })
    const { name, code } = LANGUAGE_BY_CODE[t.code] || LANGUAGE_BY_CODE.en
    fetchStory(summary, { signal: controller.signal, language: { name, code } })
      .then((text) => setStory({ status: 'ai', text }))
      .catch(() => {
        if (!controller.signal.aborted) setStory({ status: 'fallback' })
      })
    return () => controller.abort()
  }, [summary, t.code])

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      if (story.status === 'loading') {
        gsap.to('.story-dot', { y: -12, duration: 0.4, yoyo: true, repeat: -1, ease: 'power2.out', stagger: 0.12 })
        gsap.to('.story-line', { opacity: 0.35, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.15 })
      } else {
        gsap.from('.story-p', { y: 18, opacity: 0, duration: 0.55, stagger: 0.12, ease: 'back.out(1.6)' })
      }
    }, root)
    return () => ctx.revert()
  }, [story.status])

  const text = story.status === 'fallback' ? fallback : story.text

  return (
    <section ref={root} aria-labelledby="story-heading" aria-busy={story.status === 'loading'} className="pop reveal relative overflow-hidden bg-paper p-5 sm:p-7">
      <div aria-hidden className="absolute -bottom-14 -right-10 h-36 w-36 rounded-full border-[3px] border-ink bg-sunny/60" />
      <div aria-hidden className="absolute -right-4 top-6 h-10 w-10 rounded-full border-[3px] border-ink bg-bubblegum/70" />

      <header className="relative flex items-start gap-3">
        <span className="pop-sm grid h-11 w-11 shrink-0 place-items-center bg-bubblegum">
          <BookOpen aria-hidden size={22} strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <h2 id="story-heading" className="text-xl font-extrabold sm:text-2xl">{t('story.heading')}</h2>
          <p className="text-sm text-ink/60">{story.status === 'fallback' ? t('story.subFallback') : t('story.subAi')}</p>
        </div>
      </header>

      <div className="relative mt-5" aria-live="polite">
        {story.status === 'loading' ? (
          <div>
            <div className="flex items-center gap-2">
              {['bg-bubblegum', 'bg-sunny', 'bg-sky'].map((c) => (
                <span key={c} aria-hidden className={`story-dot h-3.5 w-3.5 rounded-full border-2 border-ink ${c}`} />
              ))}
              <span className="ms-2 font-display font-bold">{t('story.loading')}</span>
            </div>
            <div aria-hidden className="mt-4 space-y-2.5">
              {['w-full', 'w-11/12', 'w-3/4'].map((w) => (
                <div key={w} className={`story-line h-3.5 rounded-full bg-ink/10 ${w}`} />
              ))}
            </div>
          </div>
        ) : (
          <StoryBody text={text} />
        )}
      </div>
    </section>
  )
}

// The story's paragraphs with the translated "not advice" line under them.
export function StoryBody({ text }) {
  const paragraphs = text ? text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : []
  return (
    <div className="space-y-3 text-lg leading-relaxed">
      {paragraphs.map((p, i) => (
        <p key={i} className="story-p">{p}</p>
      ))}
      <AiFooter className="story-p" />
    </div>
  )
}
