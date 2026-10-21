// Calls to the Building Vibes AI Worker. It only ever receives the compact summary
// built in src/lib/summary.js, never raw records or anything about the user. The listing
// checker also sends the listing text the visitor pasted, which is never stored anywhere.
import { AI_ASK_TIMEOUT_MS, AI_CHECK_TIMEOUT_MS, AI_STORY_TIMEOUT_MS, WORKER_URL } from './config.js'

const configured = !WORKER_URL.includes('PLACEHOLDER')

// POST JSON with a timeout. Throws on any non-200 so the UI can fall back.
async function postWorker(path, body, timeoutMs, { signal } = {}) {
  if (!configured) throw new Error('AI helper is not configured yet')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const res = await fetch(`${WORKER_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (res.status !== 200) throw new Error(`AI helper failed (${res.status})`)
    return await res.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function fetchStory(summary, opts) {
  const { story } = await postWorker('/story', { address: summary.address, summary }, AI_STORY_TIMEOUT_MS, opts)
  if (!story) throw new Error('Empty story')
  return story
}

export async function askBuilding(summary, question, opts) {
  const { answer } = await postWorker('/ask', { address: summary.address, summary, question }, AI_ASK_TIMEOUT_MS, opts)
  if (!answer) throw new Error('Empty answer')
  return answer
}

// Language mode isn't built yet, so the checker always asks for English for now.
const ENGLISH = { name: 'English', code: 'en' }

// → { pairs: [{ claim, record }], note } or, when the model wrote prose, { text }.
export async function checkListing(summary, listingText, opts) {
  const result = await postWorker('/check', { address: summary.address, summary, listingText, language: ENGLISH }, AI_CHECK_TIMEOUT_MS, opts)
  if (Array.isArray(result?.pairs)) return { pairs: result.pairs, note: result.note || '' }
  if (result?.text) return { text: result.text }
  throw new Error('Empty check')
}
