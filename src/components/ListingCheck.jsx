import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ClipboardList, ReceiptText, Search, X } from 'lucide-react'
import Mascot from './Mascot.jsx'
import Disclaimer from './Disclaimer.jsx'
import AiFooter from './AiFooter.jsx'
import { checkListing } from '../data/index.js'
import { MAX_LISTING_CHARS, looksLikeListing, mentionsFee } from '../lib/listing.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { LANGUAGE_BY_CODE, useT } from '../i18n/index.jsx'

// The Worker's canonical English "not in the record" line; it also flags those pairs with noMention.
const NO_MENTION = "The record doesn't mention this."

// "Check a listing": the visitor pastes listing text, the AI helper sets each claim beside what the
// record shows. The text lives only in this component's state and the one request; nothing is stored.
// onFeeCheck (optional): opens the broker fee checker when the pasted text mentions a fee.
export default function ListingCheck({ summary, mood, onFeeCheck }) {
  const t = useT()
  const [text, setText] = useState('')
  const [result, setResult] = useState({ status: 'idle' }) // idle | notListing | checking | done | text | failed
  const checking = result.status === 'checking'
  const root = useRef(null)
  const requestRef = useRef(null)

  useEffect(() => () => requestRef.current?.abort(), [])

  async function check() {
    if (checking) return
    const listing = text.trim().slice(0, MAX_LISTING_CHARS)
    if (!looksLikeListing(listing)) return setResult({ status: 'notListing' })
    const controller = new AbortController()
    requestRef.current = controller
    setResult({ status: 'checking' })
    try {
      const { name, code } = LANGUAGE_BY_CODE[t.code] || LANGUAGE_BY_CODE.en
      const r = await checkListing(summary, listing, { signal: controller.signal, language: { name, code } })
      setResult(r.pairs ? { status: 'done', pairs: r.pairs, note: r.note } : { status: 'text', text: r.text })
    } catch {
      if (!controller.signal.aborted) setResult({ status: 'failed' })
    }
  }

  function clear() {
    requestRef.current?.abort()
    setText('')
    setResult({ status: 'idle' })
  }

  useLayoutEffect(() => {
    if (prefersReducedMotion() || result.status === 'idle') return
    const ctx = gsap.context(() => {
      if (checking) gsap.to('.check-dot', { y: -8, duration: 0.35, yoyo: true, repeat: -1, ease: 'power2.out', stagger: 0.12 })
      else gsap.from('.check-in', { y: 18, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'back.out(1.6)' })
    }, root)
    return () => ctx.revert()
  }, [result.status, checking])

  return (
    <section ref={root} id="check-listing" aria-labelledby="check-heading" className="pop reveal scroll-mt-4 bg-lilac p-5 sm:p-7">
      <h2 id="check-heading" className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
        <ClipboardList aria-hidden strokeWidth={2.75} /> {t('check.heading')}
      </h2>
      <p className="mt-1 text-ink/75">{t('check.intro')}</p>

      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault()
          check()
        }}
      >
        <label htmlFor="check-input" className="sr-only">{t('check.label')}</label>
        <textarea
          id="check-input"
          dir="auto"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (result.status === 'notListing') setResult({ status: 'idle' })
          }}
          maxLength={MAX_LISTING_CHARS}
          disabled={checking}
          rows={6}
          placeholder={t('check.placeholder')}
          autoComplete="off"
          className="pop-sm block min-h-36 w-full resize-y bg-paper px-4 py-3 font-medium placeholder:text-ink/40 focus:outline-none disabled:opacity-60"
        />
        <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
          <span className="font-medium text-ink/75">{t('check.privacy')}</span>
          <span className="whitespace-nowrap text-xs text-ink/55">{t.num(text.length)} / {t.num(MAX_LISTING_CHARS)}</span>
        </p>
        {onFeeCheck && mentionsFee(text) && (
          <p className="pop-sm mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 bg-sunny p-3 text-sm font-medium">
            <ReceiptText aria-hidden size={18} strokeWidth={2.5} className="shrink-0" />
            <span className="min-w-0 flex-1">{t('fare.listingHint')}</span>
            <button type="button" onClick={onFeeCheck} className="min-h-10 font-bold underline decoration-2 underline-offset-4">
              {t('fare.listingHintButton')}
            </button>
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={checking || !text.trim()}
            className="pop-sm press flex min-h-12 items-center gap-2 bg-bubblegum px-4 py-3 font-display font-bold disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0"
          >
            <Search aria-hidden size={18} strokeWidth={2.5} /> {t('check.submit')}
          </button>
          {(text || result.status !== 'idle') && (
            <button type="button" onClick={clear} className="flex min-h-12 items-center gap-1 px-2 font-bold underline decoration-2 underline-offset-4">
              <X aria-hidden size={16} strokeWidth={2.5} /> {t('check.clear')}
            </button>
          )}
        </div>
      </form>

      <div className="mt-5" aria-live="polite" aria-busy={checking}>
        {result.status === 'checking' && (
          <div className="flex items-center gap-2">
            {['bg-bubblegum', 'bg-sunny', 'bg-sky'].map((c) => (
              <span key={c} aria-hidden className={`check-dot h-3.5 w-3.5 rounded-full border-2 border-ink ${c}`} />
            ))}
            <span className="ms-2 font-display font-bold">{t('check.checking')}</span>
          </div>
        )}

        {result.status === 'notListing' && (
          <div className="check-in pop-sm flex items-center gap-3 bg-paper p-4">
            <Mascot mood="mixed" className="h-20 w-20 shrink-0" title={t('mascot.puzzled')} />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-tight">{t('check.notListingTitle')}</p>
              <p className="mt-1 text-sm text-ink/75">{t('check.notListingBody')}</p>
            </div>
          </div>
        )}

        {result.status === 'failed' && <p className="check-in pop-sm bg-paper p-4 font-medium">{t('check.failed')}</p>}

        {result.status === 'text' && (
          <div className="space-y-3">
            <p className="check-in pop-sm whitespace-pre-line bg-paper p-4 font-medium">{result.text}</p>
            <AiFooter className="check-in" />
          </div>
        )}

        {result.status === 'done' && (
          <div className="space-y-3">
            {result.pairs.length === 0 && (
              <div className="check-in pop-sm flex items-center gap-3 bg-paper p-4">
                <Mascot mood={mood} className="h-16 w-16 shrink-0" title={t('mascot.vibe')} />
                <p className="min-w-0 font-medium">{t('check.noClaims')}</p>
              </div>
            )}
            {result.pairs.length > 0 && (
              <ul className="space-y-3">
                {result.pairs.map((p, i) => {
                  const none = p.noMention || p.record === NO_MENTION
                  return (
                  <li key={i} className="check-in pop-sm grid overflow-hidden bg-paper sm:grid-cols-2">
                    <div className="border-b-2 border-dashed border-ink/20 p-4 sm:border-b-0 sm:border-e-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-ink/55">{t('check.listingSays')}</p>
                      <p className="mt-1 font-display text-lg font-bold leading-snug wrap-anywhere">{p.claim}</p>
                    </div>
                    <div className={`p-4 ${none ? 'bg-ink/5' : 'bg-sky/10'}`}>
                      <p className="text-xs font-bold uppercase tracking-wide text-ink/55">{t('check.recordShows')}</p>
                      <p className={`mt-1 wrap-anywhere ${none ? 'text-ink/60' : 'font-medium'}`}>{none ? t('check.noMention') : p.record}</p>
                    </div>
                  </li>
                  )
                })}
              </ul>
            )}
            {result.note && <p className="check-in text-sm text-ink/70">{result.note}</p>}
            <AiFooter className="check-in" />
          </div>
        )}

      </div>
      <Disclaimer className="mt-5" />
    </section>
  )
}
