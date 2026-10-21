// Language mode: React context over the translator. Only the chosen language's dictionary is
// loaded (each src/i18n/<code>.json is its own lazy chunk), and only languages whose file exists
// are offered. The choice is kept in localStorage as a display preference, nothing else.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { EN, createTranslator } from './translator.js'
import { LANGUAGE_BY_CODE } from './languages.js'

export { EN, createTranslator } from './translator.js'
export { LANGUAGES, LANGUAGE_BY_CODE, NYC_POPULAR, RTL } from './languages.js'

const loaders = import.meta.glob(['./*.json', '!./en.json'])
const loaderFor = Object.fromEntries(Object.entries(loaders).map(([path, load]) => [path.slice(2, -5), load]))

// Languages with a dictionary on disk (English always), in LANGUAGES order.
export const AVAILABLE = new Set(['en', ...Object.keys(loaderFor).filter((code) => LANGUAGE_BY_CODE[code])])

const STORAGE_KEY = 'building-vibes:language'

// Saved choice first; otherwise the browser's own language if we have it; otherwise English.
function preferredLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && AVAILABLE.has(saved)) return saved
  } catch {
    // Storage blocked: fine, it's only a preference.
  }
  for (const tag of navigator.languages || [navigator.language || '']) {
    const lower = tag.toLowerCase()
    if (lower.startsWith('zh')) return [/-(tw|hk|mo|hant)/.test(lower) ? 'zh-TW' : 'zh-CN'].find((c) => AVAILABLE.has(c)) || 'en'
    const exact = [...AVAILABLE].find((c) => c.toLowerCase() === lower)
    if (exact) return exact
    const base = lower.split('-')[0]
    if (base === 'en') return 'en'
    if (AVAILABLE.has(base)) return base
  }
  return 'en'
}

const I18nContext = createContext({ t: EN, language: 'en', loading: null, setLanguage: () => {} })

// `dict` + `language` render one language synchronously (SSR checks); the app itself starts in
// English and switches as soon as the preferred dictionary has loaded.
export function I18nProvider({ children, language: fixedLanguage, dict }) {
  const [t, setT] = useState(() => (fixedLanguage && dict ? createTranslator(fixedLanguage, dict) : EN))
  const [loading, setLoading] = useState(null)
  const latest = useRef(null)

  const setLanguage = useCallback(async (code, { remember = true } = {}) => {
    if (!AVAILABLE.has(code)) return
    latest.current = code
    if (remember) {
      try {
        localStorage.setItem(STORAGE_KEY, code)
      } catch {
        // ignore
      }
    }
    if (code === 'en') {
      setLoading(null)
      return setT(() => EN)
    }
    setLoading(code)
    try {
      const mod = await loaderFor[code]()
      if (latest.current === code) setT(() => createTranslator(code, mod.default))
    } finally {
      if (latest.current === code) setLoading(null)
    }
  }, [])

  useEffect(() => {
    if (fixedLanguage) return
    const code = preferredLanguage()
    if (code !== 'en') setLanguage(code, { remember: false }).catch(() => {})
  }, [fixedLanguage, setLanguage])

  // The whole document follows the language: lang for fonts and screen readers, dir for RTL.
  useEffect(() => {
    document.documentElement.lang = t.code
    document.documentElement.dir = t.dir
  }, [t])

  return <I18nContext.Provider value={{ t, language: t.code, loading, setLanguage }}>{children}</I18nContext.Provider>
}

export const useT = () => useContext(I18nContext).t
export const useI18n = () => useContext(I18nContext)
