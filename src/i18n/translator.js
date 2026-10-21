// The translator: t(key, vars) over one language's dictionary, with English underneath for any
// key the dictionary doesn't have yet, plus the Intl formatters for that language.
// No React here, so src/lib can take a translator as a plain argument (English by default:
// the AI summary is always built in English).
import en from './en.json'
import { RTL } from './languages.js'

const PLACEHOLDER = /\{(\w+)\}/g

// Intl throws on tags it can't parse; anything unusual formats as English instead.
function intl(Ctor, code, options) {
  try {
    return new Ctor([code, 'en'], options)
  } catch {
    return new Ctor('en', options)
  }
}

const atNoon = (iso) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)

export function createTranslator(code = 'en', dict = en) {
  const plurals = intl(Intl.PluralRules, code)
  const enPlurals = new Intl.PluralRules('en')
  const number = intl(Intl.NumberFormat, code)
  const percent = intl(Intl.NumberFormat, code, { style: 'percent', maximumFractionDigits: 0 })
  const day = intl(Intl.DateTimeFormat, code, { month: 'short', day: 'numeric', year: 'numeric' })
  const months = {
    short: intl(Intl.DateTimeFormat, code, { month: 'short', year: 'numeric' }),
    long: intl(Intl.DateTimeFormat, code, { month: 'long', year: 'numeric' }),
  }

  const num = (n) => number.format(n)
  // Numbers are formatted for the language; strings (including years) go in exactly as given.
  const fill = (text, vars) => text.replace(PLACEHOLDER, (m, k) => (k in vars ? (typeof vars[k] === 'number' ? num(vars[k]) : String(vars[k])) : m))

  // A numeric `n` picks the plural form: key_one, key_few, key_other... in this language's rules,
  // falling back to the English forms when the dictionary doesn't have the key.
  function pick(key, vars) {
    if (typeof vars.n === 'number') {
      const own = dict[`${key}_${plurals.select(vars.n)}`] ?? dict[`${key}_other`]
      if (own != null) return own
      const base = en[`${key}_${enPlurals.select(vars.n)}`] ?? en[`${key}_other`]
      if (base != null) return base
    }
    return dict[key] ?? en[key]
  }

  const t = (key, vars = {}) => {
    const text = pick(key, vars)
    return text == null ? key : fill(text, vars)
  }
  t.code = code
  t.dir = RTL.has(code) ? 'rtl' : 'ltr'
  t.has = (key) => key in dict || key in en
  t.num = num
  t.pct = (share) => percent.format(share)
  t.count = (what, n) => t(`count.${what}`, { n })
  t.date = (iso) => (iso ? day.format(atNoon(iso)) : '')
  t.monthYear = (iso, style = 'short') => (iso ? months[style].format(atNoon(iso.slice(0, 10))) : '')
  return t
}

export const EN = createTranslator('en', en)
