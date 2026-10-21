import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, Languages, Search } from 'lucide-react'
import { AVAILABLE, LANGUAGES, LANGUAGE_BY_CODE, NYC_POPULAR, useI18n } from '../i18n/index.jsx'

// Searchable language selector. NYC's most spoken languages are pinned on top, then every other
// language we have a dictionary for, each under its own name. Phones get a full width panel
// under the header; wider screens a dropdown.

const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

function nameIn(uiCode, code) {
  try {
    return new Intl.DisplayNames([uiCode, 'en'], { type: 'language', fallback: 'none' }).of(code) || ''
  } catch {
    return ''
  }
}

export default function LanguagePicker() {
  const { t, language, loading, setLanguage } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef(null)
  const input = useRef(null)
  const panelId = useId()
  const current = LANGUAGE_BY_CODE[language] || LANGUAGE_BY_CODE.en

  // Each language: its own name, plus its name in the current UI language (or English) to search by.
  const entries = useMemo(
    () =>
      LANGUAGES.filter((l) => AVAILABLE.has(l.code)).map((l) => {
        const local = nameIn(language, l.code) || l.name
        return { ...l, local, hint: fold(l.native) === fold(local) ? '' : local, haystack: fold([l.native, l.name, local, l.code].join(' ')) }
      }),
    [language],
  )
  const q = fold(query.trim())
  const matches = q ? entries.filter((e) => e.haystack.includes(q)) : entries
  const popular = NYC_POPULAR.map((c) => matches.find((e) => e.code === c)).filter(Boolean)
  const others = matches.filter((e) => !NYC_POPULAR.includes(e.code)).sort((a, b) => a.name.localeCompare(b.name))

  useEffect(() => {
    if (!open) return
    const onDown = (e) => root.current && !root.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    // Focus the search box with a mouse; on touch screens it would throw the keyboard over the list.
    if (window.matchMedia?.('(pointer: fine)').matches) input.current?.focus()
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function choose(code) {
    setLanguage(code)
    setOpen(false)
    setQuery('')
  }

  const Row = ({ e }) => (
    <li>
      <button
        type="button"
        onClick={() => choose(e.code)}
        aria-current={e.code === language ? 'true' : undefined}
        className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-start hover:bg-lilac ${e.code === language ? 'bg-sunny/40' : ''}`}
      >
        <span className="min-w-0 flex-1">
          <span lang={e.code} dir="auto" className="block font-bold leading-tight">{e.native}</span>
          {e.hint && <span className="block text-xs leading-tight text-ink/60">{e.hint}</span>}
        </span>
        {e.code === language && <Check aria-hidden size={18} strokeWidth={3} className="shrink-0" />}
        {loading === e.code && <span aria-hidden className="h-3 w-3 shrink-0 animate-pulse rounded-full border-2 border-ink bg-bubblegum" />}
      </button>
    </li>
  )

  return (
    // min-w-0 all the way down: on a phone the label truncates to whatever room the header leaves.
    <div ref={root} className="min-w-0 sm:relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${t('lang.button')}: ${current.native}`}
        className="pop-sm press flex min-h-10 max-w-full min-w-0 items-center gap-1.5 bg-paper px-2.5 py-1.5 text-sm font-bold"
      >
        <Languages aria-hidden size={18} strokeWidth={2.5} className="shrink-0" />
        <span lang={current.code} className="min-w-0 max-w-[10rem] truncate">{current.native}</span>
        {loading && <span aria-hidden className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full border-2 border-ink bg-bubblegum" />}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('lang.button')}
          className="pop absolute inset-x-3 top-[4.5rem] z-[80] flex flex-col bg-paper p-3 sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-80"
        >
          <label className="pop-sm flex items-center gap-2 bg-cream px-3">
            <Search aria-hidden size={16} strokeWidth={2.5} className="shrink-0" />
            <span className="sr-only">{t('lang.search')}</span>
            <input
              ref={input}
              type="search"
              dir="auto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('lang.search')}
              autoComplete="off"
              className="min-h-11 min-w-0 flex-1 bg-transparent font-medium placeholder:text-ink/40 focus:outline-none"
            />
          </label>
          <div className="mt-2 max-h-[min(60dvh,26rem)] overflow-y-auto overscroll-contain">
            {popular.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-ink/55">{t('lang.popular')}</p>
                <ul>{popular.map((e) => <Row key={e.code} e={e} />)}</ul>
              </>
            )}
            {others.length > 0 && (
              <>
                <p className="mt-1 border-t-2 border-dashed border-ink/15 px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-ink/55">{t('lang.all')}</p>
                <ul>{others.map((e) => <Row key={e.code} e={e} />)}</ul>
              </>
            )}
            {!matches.length && <p className="px-3 py-4 text-sm font-medium text-ink/70">{t('lang.none', { query: query.trim() })}</p>}
          </div>
          <p className="mt-2 border-t-2 border-dashed border-ink/15 px-1 pt-2 text-xs text-ink/60">{t('lang.more')}</p>
        </div>
      )}
    </div>
  )
}
