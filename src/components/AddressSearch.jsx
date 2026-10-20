import { useEffect, useId, useRef, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import { suggestAddresses } from '../data/index.js'

// One input, debounced GeoSearch suggestions, keyboard friendly.
// onSearch receives either a resolved place (picked suggestion) or the raw text.
// dropUp opens the suggestions above the input (for the compare tray at the screen's bottom edge);
// listMaxHeight caps that list to the room actually available.
export default function AddressSearch({
  onSearch,
  compact = false,
  autoFocus = false,
  initialValue = '',
  dropUp = false,
  listMaxHeight,
  placeholder = 'Type any NYC address…',
  submitLabel = 'Check vibes',
  disabled = false,
}) {
  const [text, setText] = useState(initialValue)
  const [suggestions, setSuggestions] = useState([])
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const listId = useId()
  const skipNext = useRef(false)

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false
      return
    }
    if (text.trim().length < 3) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    const t = setTimeout(() => {
      suggestAddresses(text, { signal: controller.signal })
        .then((s) => {
          setSuggestions(s)
          setActive(-1)
          setOpen(true)
        })
        .catch(() => {}) // suggestions are a nicety; ignore failures
    }, 250)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [text])

  function choose(place) {
    if (disabled) return
    skipNext.current = true
    setText(place.label)
    setOpen(false)
    onSearch(place)
  }

  function submit(e) {
    e.preventDefault()
    if (open && active >= 0 && suggestions[active]) return choose(suggestions[active])
    const q = text.trim()
    if (!q || disabled) return
    setOpen(false)
    onSearch(q)
  }

  function onKeyDown(e) {
    if (!open || !suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && suggestions.length > 0

  return (
    <form onSubmit={submit} role="search" className="relative z-50 w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">NYC address</label>
      <div className={`pop flex items-center gap-2 bg-paper ${compact ? 'p-1.5 pl-4' : 'p-2 pl-5 sm:p-2.5 sm:pl-6'}`}>
        <MapPin aria-hidden className="shrink-0 text-bubblegum" size={compact ? 20 : 26} strokeWidth={2.5} />
        <input
          id={`${listId}-input`}
          type="text"
          inputMode="search"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className={`min-w-0 flex-1 bg-transparent font-medium placeholder:text-ink/40 focus:outline-none ${compact ? 'text-base' : 'text-base sm:text-xl'}`}
        />
        <button
          type="submit"
          disabled={disabled}
          className={`pop-sm press flex shrink-0 items-center gap-2 bg-ink font-display font-bold text-cream hover:bg-bubblegum hover:text-ink disabled:opacity-50 ${compact ? 'min-h-10 px-3 py-2 text-sm' : 'whitespace-nowrap px-3.5 py-3 text-base sm:px-6 sm:text-lg'}`}
        >
          <Search aria-hidden size={compact ? 16 : 20} strokeWidth={3} />
          <span className={compact ? 'sr-only sm:not-sr-only' : ''}>{submitLabel}</span>
        </button>
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}
          className={`absolute inset-x-2 z-[60] max-h-80 overflow-y-auto overscroll-contain rounded-2xl ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'} border-[2.5px] border-ink bg-paper text-left shadow-pop-sm`}
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.bbl}-${s.label}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-3 ${i === active ? 'bg-sunny' : 'hover:bg-lilac'}`}
            >
              <MapPin aria-hidden size={16} className="shrink-0" />
              <span className="min-w-0 font-medium">{s.name}</span>
              <span className="ml-auto shrink-0 text-sm text-ink/60">{s.borough}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
