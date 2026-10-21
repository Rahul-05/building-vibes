#!/usr/bin/env node
// Translates the UI dictionary (src/i18n/en.json) into other languages with the Gemini API free
// tier, writing src/i18n/<code>.json. Resumable and incremental: only keys that are missing, or
// whose English changed since they were translated, are sent, and each batch is saved as soon as
// it comes back. When the quota runs out the run stops cleanly; run it again later to continue.
//
//   export GEMINI_API_KEY=...            (never commit it; the script only reads the env var)
//   node scripts/translate-ui.mjs es bn ar fr     specific languages
//   node scripts/translate-ui.mjs --nyc           NYC's 10 most spoken languages besides English
//   node scripts/translate-ui.mjs --all           every language in src/i18n/languages.js
//   node scripts/translate-ui.mjs --check [codes] validate dictionaries on disk, no API calls
//   options: --batch 40 (keys per call), --delay 4500 (ms between calls)
//
// Checks on every translated string: same {placeholders}, same [brackets], no hyphens or dashes
// (the site's style rule). A string failing a check is retried once; a hyphen still left after
// that is rewritten as a space or a comma; a string that keeps breaking placeholders is skipped
// (the app shows English for it) and logged.

import { createHash } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { LANGUAGES, LANGUAGE_BY_CODE, NYC_POPULAR } from '../src/i18n/languages.js'

const root = new URL('../', import.meta.url)
const I18N = new URL('src/i18n/', root)
const STATE_FILE = new URL('scripts/translate-state.json', root)
const WORKER = new URL('worker/src/index.js', root)

// ---------------------------------------------------------------- options

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const BATCH = option('--batch', 40)
const DELAY_MS = option('--delay', 4500)
const CHECK_ONLY = flag('--check')
const codes = args.filter((a, i) => !a.startsWith('--') && !['--batch', '--delay'].includes(args[i - 1]))

let targets
if (flag('--all')) targets = LANGUAGES.map((l) => l.code)
else if (flag('--nyc')) targets = NYC_POPULAR
else targets = codes
targets = targets.filter((c) => c !== 'en')
const unknown = targets.filter((c) => !LANGUAGE_BY_CODE[c])
if (unknown.length) fail(`Unknown language code(s): ${unknown.join(', ')}. See src/i18n/languages.js.`)
if (!targets.length && !CHECK_ONLY) fail('Name languages (e.g. es fr), or use --nyc, --all, or --check.')

function fail(message) {
  console.error(message)
  process.exit(1)
}

// ---------------------------------------------------------------- checks

const DASHES = /[\u002D\u058A\u05BE\u1806\u2010-\u2015\u2212\u2E3A\u2E3B\u301C\u30A0\uFE58\uFE63\uFF0D]/
const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join(' ')
const brackets = (s) => `${(s.match(/\[/g) || []).length}/${(s.match(/\]/g) || []).length}`

// Writing systems, to catch a batch answered in the wrong language (Hindi in a Bengali file).
// A language may use its own script(s) plus Latin (for kept names like HPD or NYC).
const SCRIPTS = ['Arabic', 'Armenian', 'Bengali', 'Canadian_Aboriginal', 'Cyrillic', 'Devanagari', 'Ethiopic', 'Georgian', 'Greek', 'Gujarati', 'Gurmukhi', 'Hangul', 'Han', 'Hebrew', 'Hiragana', 'Kannada', 'Katakana', 'Khmer', 'Lao', 'Malayalam', 'Meetei_Mayek', 'Myanmar', 'Nko', 'Ol_Chiki', 'Oriya', 'Sinhala', 'Tamil', 'Telugu', 'Thaana', 'Thai', 'Tibetan', 'Tifinagh']
const SCRIPT_RE = Object.fromEntries(SCRIPTS.map((name) => [name, new RegExp(`\\p{Script=${name}}`, 'u')]))
const EXTRA_SCRIPTS = { ja: ['Han', 'Hiragana', 'Katakana'], ko: ['Hangul', 'Han'] }
function allowedScripts(lang) {
  const own = SCRIPTS.filter((name) => SCRIPT_RE[name].test(lang.native))
  return new Set([...own, ...(EXTRA_SCRIPTS[lang.code] || [])])
}
function wrongScript(lang, text) {
  const allowed = allowedScripts(lang)
  return SCRIPTS.some((name) => !allowed.has(name) && SCRIPT_RE[name].test(text))
}

// French, Italian and Catalan elide with an apostrophe (l'annonce); "l annonce" means it was dropped.
// Case sensitive, so "Classe C ouverte" or "B ou C ouverte" don't count.
const ELISION = { fr: /(^|[\s(«“"])(?<!Classe? )(l|d|n|s|qu|j|c|m|t|L|D|N|S|Qu|J) (?=\[?[aeiouyhàâéèêëîïôûœ])/, it: /(^|[\s(«“"])(l|dell|all|nell|sull|dall|quest|po|L) (?=\[?[aeiouàèéìòù])/, ca: /(^|[\s(«“"])(l|d|s|L|D) (?=\[?[aeiouàèéíòóú])/ }

// Problems with one translated string, or [] when it's fine.
function problems(source, text, lang) {
  if (typeof text !== 'string' || !text.trim()) return ['empty']
  const out = []
  if (placeholders(text) !== placeholders(source)) out.push('placeholders')
  if (brackets(text) !== brackets(source)) out.push('brackets')
  if (DASHES.test(text)) out.push('dash')
  if (lang && wrongScript(lang, text)) out.push('script')
  if (lang && ELISION[lang.code]?.test(text)) out.push('apostrophe')
  return out
}

// Last resort for a dash that survived a retry: the same rewrite the Worker applies to AI text.
const dehyphen = (t) => t.replace(/(\p{L})[\u002D\u2010\u2011\u05BE\u058A](?=\p{L})/gu, '$1 ').replace(/\s*[\u002D\u058A\u05BE\u1806\u2010-\u2015\u2212\u2E3A\u2E3B\u301C\u30A0\uFE58\uFE63\uFF0D]+\s*/g, ', ').replace(/\s{2,}/g, ' ').trim()

// Models sometimes answer a whole batch with the accents stripped ("informacion" for
// "información"). For languages whose writing needs letters beyond ASCII (any language whose own
// name has one, plus these), a long answer with none is sent to another model.
const NEEDS_NON_ASCII = new Set(['af', 'da', 'de', 'et', 'fi', 'ga', 'gl', 'hr', 'bs', 'hu', 'it', 'mt', 'no', 'pl', 'sq', 'sv'])
const needsNonAscii = (lang) => /[^\x00-\x7F]/.test(lang.native) || NEEDS_NON_ASCII.has(lang.code)
function strippedAccents(lang, out) {
  if (!needsNonAscii(lang)) return false
  const text = Object.values(out).filter((v) => typeof v === 'string').join(' ').replace(/\{\w+\}/g, '')
  return (text.match(/\p{L}/gu) || []).length > 300 && !/[^\x00-\x7F]/.test(text)
}

// Retry note for one rejected answer, so the model knows what to change.
function explain(previous, issues, lang) {
  const why = {
    empty: 'it was missing',
    placeholders: 'its {placeholders} did not match the English exactly',
    brackets: 'its square brackets did not match the English',
    dash: 'it joined words with a hyphen or used a dash',
    script: `it was not written in ${lang.name} script`,
    apostrophe: 'it lost an apostrophe or still reads like words that were joined (write l\'annonce, not l annonce; ask questions in plain word order, not with inversion)',
  }
  const shown = typeof previous === 'string' ? ` Your previous answer was "${previous}".` : ''
  return `RETRY:${shown} Rejected because ${issues.map((i) => why[i]).join(' and ')}. Rephrase it so that doesn't happen.`
}

const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 10)

// ---------------------------------------------------------------- plural forms

// en.json has key_one / key_other pairs; each language needs one key per plural category it uses.
function pluralCategories(code) {
  try {
    return new Intl.PluralRules(code).resolvedOptions().pluralCategories
  } catch {
    return ['one', 'other']
  }
}
function exampleCount(code, category) {
  try {
    const rules = new Intl.PluralRules(code)
    for (const n of [...Array(201).keys(), 1000, 1000000]) if (rules.select(n) === category) return n
  } catch {
    // fall through
  }
  return null
}

// Every key a language needs → { source, note } (note explains plural forms to the model).
function wantedKeys(en, code) {
  const wanted = {}
  const cats = pluralCategories(code)
  const bases = new Set()
  for (const [key, source] of Object.entries(en)) {
    const m = /^(.*)_(one|other)$/.exec(key)
    if (!m) {
      wanted[key] = { source }
      continue
    }
    if (bases.has(m[1])) continue
    bases.add(m[1])
    for (const cat of cats) {
      const n = exampleCount(code, cat)
      const english = en[`${m[1]}_${cat}`] ?? en[`${m[1]}_other`]
      wanted[`${m[1]}_${cat}`] = {
        source: english,
        note: `Plural form "${cat}"${n === null ? '' : `, used for counts like ${n}`}. {n} is always replaced by the number in digits, so keep {n} and write the phrase exactly as it reads right next to that number${n === null ? '' : ` (as with ${n})`}; never spell the number out in words. English forms: one = "${en[`${m[1]}_one`]}", other = "${en[`${m[1]}_other`]}".`,
      }
    }
  }
  return wanted
}

// ---------------------------------------------------------------- Gemini

async function workerModels() {
  const src = await readFile(WORKER, 'utf8')
  const list = (name) => [...(src.match(new RegExp(`const ${name} = (?:new Set\\()?\\[([^\\]]+)\\]`))?.[1] || '').matchAll(/'([^']+)'/g)].map((m) => m[1])
  const models = list('GEMINI_MODELS')
  if (!models.length) fail('Could not read GEMINI_MODELS from worker/src/index.js')
  return { models, thinking: new Set(list('THINKING_MODELS')) }
}

function instructionFor(lang) {
  return `You translate the user interface text of "Building Vibes", a free website that explains New York City buildings' public records to renters, from English into ${lang.name} (language code ${lang.code}).

Rules:
- Return ONLY a JSON object (no code fences) with exactly the keys of "strings", each value the ${lang.name} translation of that string. No other keys, no comments.
- Keep every placeholder in curly braces exactly as written and untranslated, for example {count}, {date}, {n}. Each one must appear exactly as many times as in the English. Move it wherever the grammar needs it.
- If the English wraps words in square brackets, wrap the matching translated words in square brackets, the same number of times.
- Keep these exactly as they are, untranslated: Building Vibes, Vibe (the mascot's name), NYC, New York City place names (Manhattan, Brooklyn, Queens, Staten Island, Bronx), street addresses, and agency or dataset names and abbreviations: HPD, DOB, 311, AEP, PLUTO, ACRIS, BBL, BIN, NYC Open Data, NYC GeoSearch, NYC Marshals, Class A, Class B, Class C.
- Use neutral, widely understood vocabulary, the way New York City's ${lang.name} speaking communities would understand it (no regional slang).
- Be concise: about as long as the English. Plain, warm, everyday words. These are buttons, labels, headings and short sentences on a phone screen.
- Site style: write compound words as separate words, and use a comma or a new sentence wherever English might use a dash, even where ${lang.name} spelling normally joins words. Spell everything else normally, with every accent, letter and punctuation mark the language uses, including apostrophes (for example French l'annonce, n'est). Rephrase so nothing needs joining: a French question uses plain word order (Cet appartement a été testé ?) rather than inversion.
- Write every accented or special letter as the real character (for example á, é, ñ, ü, ç, and every letter of non Latin scripts). Use the language's normal punctuation too (for example ¿ and ¡ in Spanish).
- Stay neutral and factual. Never add advice or judgments that the English does not have.
- "notes" explains plural forms: a key ending in _zero, _one, _two, _few, _many or _other must be the form of the phrase that fits that count in ${lang.name}.`
}

// The no hyphen rule. Stated in the system instruction as "write compounds as separate words":
// worded as a ban on hyphens and dashes there, it made the lite models strip every accent too.
// Here, after the strings, the plain ban reads fine.
const STYLE_NOTE = 'Site style rule: the site never uses hyphens or dashes. Write compounds as separate words and use commas or new sentences instead of dashes. Keep every accent, special letter and apostrophe.'

class QuotaError extends Error {}

// One batch → parsed JSON object, trying models round robin from `start`. Models that hit their
// quota (429) or don't exist for this key (404) are skipped for the rest of the run.
async function callGemini(key, lang, batch, notes, ctx) {
  const body = (model) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: instructionFor(lang) }] },
      contents: [{ role: 'user', parts: [{ text: `${JSON.stringify({ strings: batch, ...(Object.keys(notes).length && { notes }) }, null, 1)}\n\n${STYLE_NOTE}` }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 16384,
        // No JSON mode on purpose: in JSON mode these models often drop every accent.
        ...(ctx.thinking.has(model) && { thinkingConfig: { thinkingBudget: 0 } }),
      },
    })

  const n = ctx.models.length
  for (let i = 0; i < n; i++) {
    const model = ctx.models[(ctx.next + i) % n]
    if (ctx.dead.has(model)) continue
    let res
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: body(model),
        signal: AbortSignal.timeout(120000),
      })
    } catch (err) {
      console.log(`    ${model}: ${err.name === 'TimeoutError' ? 'timed out' : err.message}`)
      continue
    }
    if (res.status === 401 || res.status === 403) fail(`Gemini rejected the key (${res.status}). Check GEMINI_API_KEY.`)
    if (!res.ok) {
      console.log(`    ${model}: HTTP ${res.status}`)
      if (res.status === 429 || res.status === 404) ctx.dead.add(model)
      continue
    }
    const data = await res.json()
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim()
    try {
      const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
      let parsed
      try {
        parsed = JSON.parse(json)
      } catch {
        parsed = JSON.parse(json.replace(/,\s*([}\]])/g, '$1')) // trailing commas, the usual slip
      }
      // Models often mirror the input's { strings: {...} } wrapper; accept either shape.
      if (parsed?.strings && typeof parsed.strings === 'object') parsed = parsed.strings
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
      if (!Object.keys(batch).some((k) => typeof parsed[k] === 'string')) throw new Error('none of the keys came back')
      // Two models in a row without accents probably means this batch really has none.
      if (strippedAccents(lang, parsed) && ctx.accentRejects++ < 2) throw new Error('accents were stripped')
      ctx.accentRejects = 0
      ctx.next = (ctx.next + i + 1) % n // spread the next call to the next model
      ctx.calls++
      return parsed
    } catch (err) {
      if (process.env.DEBUG_TRANSLATE) await writeFile(`/tmp/translate-${model}.txt`, text)
      console.log(`    ${model}: answer not usable, ${err.message} (finish: ${data.candidates?.[0]?.finishReason || 'unknown'})`)
    }
  }
  if (ctx.models.every((m) => ctx.dead.has(m))) throw new QuotaError('every model is out of quota for now')
  throw new Error('no model returned a usable batch')
}

// ---------------------------------------------------------------- files

const readJson = async (url, fallback) => {
  try {
    return JSON.parse(await readFile(url, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
}

// Atomic write, then read back and parse, so a dictionary on disk is always valid JSON.
async function writeJson(url, data) {
  const tmp = new URL(`${url.href}.tmp`)
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`)
  await rename(tmp, url)
  JSON.parse(await readFile(url, 'utf8'))
}

// Dictionary in en.json order (plural forms where their English pair sits), only wanted keys.
const ordered = (dict, wanted) => Object.fromEntries(Object.keys(wanted).filter((k) => k in dict).map((k) => [k, dict[k]]))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------- main

async function translateLanguage(code, en, state, ctx, key) {
  const lang = LANGUAGE_BY_CODE[code]
  const file = new URL(`${code}.json`, I18N)
  const wanted = wantedKeys(en, code)
  const dict = await readJson(file, {})
  const seen = (state[code] ||= {})
  const sourceHash = (k) => hash(`${wanted[k].source}|${wanted[k].note || ''}`)

  // Missing, changed in English, or failing a check: translate (again).
  const todo = Object.keys(wanted).filter((k) => !(k in dict) || seen[k] !== sourceHash(k) || problems(wanted[k].source, dict[k], lang).length)
  const result = { code, total: Object.keys(wanted).length, translated: 0, skipped: [], fixed: 0 }
  if (!todo.length) {
    await writeJson(file, ordered(dict, wanted))
    return result
  }
  console.log(`${code} (${lang.name}): ${todo.length} of ${result.total} keys to translate`)

  // Keys failing a check on disk start with feedback on what was wrong, like a retry.
  const feedback = Object.fromEntries(todo.filter((k) => k in dict && problems(wanted[k].source, dict[k], lang).length).map((k) => [k, explain(dict[k], problems(wanted[k].source, dict[k], lang), lang)]))

  for (let i = 0; i < todo.length; i += BATCH) {
    let keys = todo.slice(i, i + BATCH)
    for (let attempt = 0; attempt < 2 && keys.length; attempt++) {
      const batch = Object.fromEntries(keys.map((k) => [k, wanted[k].source]))
      const notes = Object.fromEntries(keys.filter((k) => wanted[k].note || feedback[k]).map((k) => [k, [wanted[k].note, feedback[k]].filter(Boolean).join(' ')]))
      if (ctx.calls) await sleep(DELAY_MS)
      const out = await callGemini(key, lang, batch, notes, ctx)
      const retry = []
      for (const k of keys) {
        const issues = problems(wanted[k].source, out[k], lang)
        if (!issues.length) {
          dict[k] = out[k].trim()
          seen[k] = sourceHash(k)
          result.translated++
        } else if (attempt === 1 && issues.length === 1 && issues[0] === 'dash' && !problems(wanted[k].source, dehyphen(out[k]), lang).length) {
          dict[k] = dehyphen(out[k])
          seen[k] = sourceHash(k)
          result.translated++
          result.fixed++
        } else if (attempt === 0) {
          retry.push(k)
          feedback[k] = explain(out[k], issues, lang)
        } else {
          // Drop a failing translation so the app falls back to English; a later run tries again.
          if (k in dict && problems(wanted[k].source, dict[k], lang).length) delete dict[k]
          result.skipped.push(`${k} (${issues.join(', ')})`)
        }
      }
      keys = retry
      await writeJson(file, ordered(dict, wanted))
      await writeJson(STATE_FILE, state)
    }
    console.log(`  ${Math.min(i + BATCH, todo.length)} / ${todo.length}`)
  }
  return result
}

async function checkLanguage(code, en) {
  const lang = LANGUAGE_BY_CODE[code]
  const dict = await readJson(new URL(`${code}.json`, I18N), null)
  if (!dict) return { code, missing: 'no file' }
  const wanted = wantedKeys(en, code)
  const missing = Object.keys(wanted).filter((k) => !(k in dict))
  const bad = Object.keys(wanted).filter((k) => k in dict && problems(wanted[k].source, dict[k], lang).length).map((k) => `${k} (${problems(wanted[k].source, dict[k], lang).join(', ')})`)
  return { code, total: Object.keys(wanted).length, missing: missing.length, bad }
}

const en = JSON.parse(await readFile(new URL('en.json', I18N), 'utf8'))
const englishDashes = Object.entries(en).filter(([, v]) => DASHES.test(v)).map(([k]) => k)
if (englishDashes.length) fail(`en.json breaks the no hyphen rule: ${englishDashes.join(', ')}`)

if (CHECK_ONLY) {
  const { readdir } = await import('node:fs/promises')
  const onDisk = (await readdir(I18N)).filter((f) => /^[\w-]+\.json$/.test(f) && f !== 'en.json').map((f) => f.slice(0, -5))
  let ok = true
  for (const code of codes.length ? codes : onDisk) {
    const r = await checkLanguage(code, en)
    const good = r.total && !r.missing && !r.bad.length
    ok &&= Boolean(good)
    console.log(`${good ? 'ok  ' : 'FAIL'} ${code}: ${r.total ? `${r.total - r.missing} of ${r.total} keys, ${r.bad.length} failing checks` : r.missing}${r.bad?.length ? `\n       ${r.bad.join('\n       ')}` : ''}`)
  }
  process.exit(ok ? 0 : 1)
}

const key = process.env.GEMINI_API_KEY
if (!key) fail('Set GEMINI_API_KEY in the environment first (never in a file in this repo).')

const ctx = { ...(await workerModels()), next: 0, dead: new Set(), calls: 0, accentRejects: 0 }
const state = await readJson(STATE_FILE, {})
const results = []
let stopped = null
for (const code of targets) {
  if (stopped) {
    results.push({ code, pending: true })
    continue
  }
  try {
    results.push(await translateLanguage(code, en, state, ctx, key))
  } catch (err) {
    results.push({ code, error: err.message })
    if (err instanceof QuotaError) stopped = err.message
  }
}

console.log('\nSummary')
for (const r of results) {
  if (r.pending) console.log(`  ${r.code}: not started (${stopped}); run again later`)
  else if (r.error) console.log(`  ${r.code}: FAILED, ${r.error}; finished batches are saved, run again to continue`)
  else console.log(`  ${r.code}: ok, ${r.total - r.skipped.length} of ${r.total} keys (${r.translated} translated this run${r.fixed ? `, ${r.fixed} dashes rewritten` : ''})${r.skipped.length ? `\n    skipped (English shows instead): ${r.skipped.join('; ')}` : ''}`)
}
console.log(`  Gemini calls: ${ctx.calls}${ctx.dead.size ? `; out of quota or unavailable: ${[...ctx.dead].join(', ')}` : ''}`)
process.exit(results.some((r) => r.error || r.pending || r.skipped?.length) ? 1 : 0)
