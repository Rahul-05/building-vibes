// Building Vibes AI Worker: turns the compact public-record summary the frontend already
// fetched into a short "building story" or an answer to one question, via Gemini.
// Holds the Gemini key (env.GEMINI_API_KEY secret). Never calls NYC APIs, never logs payloads.

// Tried in order. 404 (model retired for this account), 429 (quota) and 503 (overloaded)
// fall through to the next model; any other failure is final.
const GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash']
const RETRYABLE_STATUS = new Set([404, 429, 503])
const geminiUrl = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

const ALLOWED_ORIGINS = new Set(['https://rahul-05.github.io', 'http://localhost:5173'])

const MAX_BODY_BYTES = 16 * 1024
const MAX_QUESTION_CHARS = 300
const STORY_FOOTER = 'This is public-record information, not advice.'

const BASE_RULES = `You are "Vibe", the friendly building mascot of Building Vibes, a free tool that explains NYC buildings' public records to renters.

Hard rules:
- Use ONLY facts in the provided public-record summary. Never invent, guess, or add outside knowledge about the building, the landlord, or the neighborhood.
- Describe the record with flag language (green, yellow, or red flags) and plain counts. The record speaks; you don't judge.
- NEVER give verdicts or advice. Never tell anyone to rent or not rent, and never call the building or anything in it safe or unsafe, good or bad. Do not use these words or phrases at all, even to say you can't use them: "avoid", "walk away", "don't rent", "safe", "unsafe", "good building", "bad building". The only exception: if an official record name in the summary contains one of those words (e.g. a DOB category like "Façade – Unsafe Notification"), you may quote that name exactly, inside double quotes.
- Large buildings naturally have more records; don't treat raw counts as a ranking.
- Plain, warm, everyday English. Short sentences. Plain text only: no markdown, no bullet points, no headings, no emoji.`

const STORY_INSTRUCTION = `${BASE_RULES}

Task: write "This building's story": 2 or 3 short paragraphs (2-3 sentences each), separated by a blank line. Cover what shows up most in the record, what is open or recent, and anything notably absent (green flags). Then end with exactly this final line on its own: "${STORY_FOOTER}"`

const ASK_INSTRUCTION = `${BASE_RULES}

Task: answer the renter's question in 1 to 4 short sentences, using only the summary. If the summary doesn't contain the answer, say plainly: "The public record I have doesn't mention that." and, if helpful, mention one related thing it does show. If asked what to ask the landlord, suggest 2 or 3 neutral, factual questions grounded in specific items from the record. If asked whether to rent, or whether the building is safe or good, explain that you can only describe what the public record shows, then briefly describe it.`

// Defense in depth: if a banned verdict slips through, fail so the frontend shows its fallback.
// Quoted spans are skipped so official record names ("... – Unsafe Notification") can be cited.
const BANNED = /\b(avoid\w*|walk away|don'?t rent|do not rent|unsafe|safe|(good|bad) building)\b/i
const hasVerdict = (text) => BANNED.test(text.replace(/"[^"\n]*"|“[^”\n]*”/g, ''))

function corsHeaders(origin) {
  return ALLOWED_ORIGINS.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : { Vary: 'Origin' }
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(origin) },
  })
}

const isText = (v) => typeof v === 'string' && v.trim().length > 0

function promptFor(route, { address, summary, question }) {
  const record = `Building address: ${address.trim()}\n\nPublic-record summary (JSON):\n${JSON.stringify(summary)}`
  return route === '/story'
    ? `${record}\n\nWrite this building's story.`
    : `${record}\n\nRenter's question: ${question.trim()}`
}

async function generate(env, systemText, userText, maxOutputTokens) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens,
      // Short grounded rewrites don't need thinking; this keeps latency and quota low.
      thinkingConfig: { thinkingBudget: 0 },
    },
  })

  let res
  const failures = []
  for (const model of GEMINI_MODELS) {
    res = await fetch(geminiUrl(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body,
    })
    if (res.ok) break
    failures.push(`${model} ${res.status}`)
    if (!RETRYABLE_STATUS.has(res.status)) break
  }
  if (!res.ok) throw new Error(`Gemini returned ${failures.join(', ')}`)

  const data = await res.json()
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim()
  if (!text) throw new Error('Gemini returned no text')
  // Strip stray markdown emphasis/headings; the frontend renders plain text.
  return text.replace(/\*\*|__|^#+\s*/gm, '').replace(/\n{3,}/g, '\n\n')
}

async function handle(request, env) {
  const origin = request.headers.get('Origin') || ''
  const { pathname } = new URL(request.url)

  if (request.method === 'OPTIONS') {
    if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403, headers: corsHeaders(origin) })
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(origin),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    })
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin)
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origin not allowed' }, 403, origin)
  if (pathname !== '/story' && pathname !== '/ask') return json({ error: 'Not found' }, 404, origin)

  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) {
    return json({ error: 'Request body too large' }, 413, origin)
  }
  const raw = await request.text()
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json({ error: 'Request body too large' }, 413, origin)

  let body
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'Body must be valid JSON' }, 400, origin)
  }

  const { address, summary, question } = body || {}
  const missing = []
  if (!isText(address)) missing.push('address')
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) missing.push('summary')
  if (pathname === '/ask' && !isText(question)) missing.push('question')
  if (missing.length) return json({ error: `Missing or invalid fields: ${missing.join(', ')}` }, 400, origin)
  if (pathname === '/ask' && question.length > MAX_QUESTION_CHARS) {
    return json({ error: `Question must be ${MAX_QUESTION_CHARS} characters or fewer` }, 400, origin)
  }

  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured')

  if (pathname === '/story') {
    let story = await generate(env, STORY_INSTRUCTION, promptFor(pathname, body), 700)
    if (hasVerdict(story)) throw new Error('Story failed the verdict check')
    if (!/not advice\.?\s*$/i.test(story)) story = `${story}\n\n${STORY_FOOTER}`
    return json({ story }, 200, origin)
  }

  const answer = await generate(env, ASK_INSTRUCTION, promptFor(pathname, body), 350)
  if (hasVerdict(answer)) throw new Error('Answer failed the verdict check')
  return json({ answer }, 200, origin)
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env)
    } catch (err) {
      // Error message only; never the request body or model output.
      console.error('building-vibes-ai:', err.message)
      return json({ error: 'The AI helper is unavailable right now.' }, 502, request.headers.get('Origin') || '')
    }
  },
}
