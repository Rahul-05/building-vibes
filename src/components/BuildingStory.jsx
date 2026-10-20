import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { BookOpen } from 'lucide-react'
import { fetchStory } from '../data/index.js'
import { templateStory } from '../lib/summary.js'
import { prefersReducedMotion } from '../lib/motion.js'

// "This building's story": AI-written from the compact summary, with a quiet
// template sentence as the fallback if the AI helper is slow, down, or not configured.
export default function BuildingStory({ summary }) {
  const [story, setStory] = useState({ status: 'loading' })
  const root = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchStory(summary, { signal: controller.signal })
      .then((text) => setStory({ status: 'ai', text }))
      .catch(() => {
        if (!controller.signal.aborted) setStory({ status: 'fallback', text: templateStory(summary) })
      })
    return () => controller.abort()
  }, [summary])

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

  const paragraphs = story.text ? story.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : []

  return (
    <section ref={root} aria-labelledby="story-heading" aria-busy={story.status === 'loading'} className="pop reveal relative overflow-hidden bg-paper p-5 sm:p-7">
      <div aria-hidden className="absolute -bottom-14 -right-10 h-36 w-36 rounded-full border-[3px] border-ink bg-sunny/60" />
      <div aria-hidden className="absolute -right-4 top-6 h-10 w-10 rounded-full border-[3px] border-ink bg-bubblegum/70" />

      <header className="relative flex items-start gap-3">
        <span className="pop-sm grid h-11 w-11 shrink-0 place-items-center bg-bubblegum">
          <BookOpen aria-hidden size={22} strokeWidth={2.5} />
        </span>
        <div>
          <h2 id="story-heading" className="text-xl font-extrabold sm:text-2xl">This building’s story</h2>
          <p className="text-sm text-ink/60">
            {story.status === 'fallback' ? 'A quick summary of the record below' : 'Written by AI from only the public records on this page'}
          </p>
        </div>
      </header>

      <div className="relative mt-5" aria-live="polite">
        {story.status === 'loading' ? (
          <div>
            <div className="flex items-center gap-2">
              {['bg-bubblegum', 'bg-sunny', 'bg-sky'].map((c) => (
                <span key={c} aria-hidden className={`story-dot h-3.5 w-3.5 rounded-full border-2 border-ink ${c}`} />
              ))}
              <span className="ml-2 font-display font-bold">Vibe is reading the records…</span>
            </div>
            <div aria-hidden className="mt-4 space-y-2.5">
              {['w-full', 'w-11/12', 'w-3/4'].map((w) => (
                <div key={w} className={`story-line h-3.5 rounded-full bg-ink/10 ${w}`} />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-lg leading-relaxed">
            {paragraphs.map((p, i) =>
              /not advice\.?$/i.test(p) && i === paragraphs.length - 1 && paragraphs.length > 1 ? (
                <p key={i} className="story-p inline-block rounded-full border-2 border-ink bg-lilac px-4 py-1 text-sm font-bold">{p}</p>
              ) : (
                <p key={i} className="story-p">{p}</p>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  )
}
