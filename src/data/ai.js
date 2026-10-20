// Calls to the Building Vibes AI Worker. It only ever receives the compact summary
// built in src/lib/summary.js, never raw records or anything about the user.
import { AI_TIMEOUT_MS, WORKER_URL } from './config.js'

const configured = !WORKER_URL.includes('PLACEHOLDER')

// POST JSON with a timeout. Throws on any non-200 so the UI can fall back.
async function postWorker(path, body, { signal } = {}) {
  if (!configured) throw new Error('AI helper is not configured yet')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
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
  const { story } = await postWorker('/story', { address: summary.address, summary }, opts)
  if (!story) throw new Error('Empty story')
  return story
}

export async function askBuilding(summary, question, opts) {
  const { answer } = await postWorker('/ask', { address: summary.address, summary, question }, opts)
  if (!answer) throw new Error('Empty answer')
  return answer
}
