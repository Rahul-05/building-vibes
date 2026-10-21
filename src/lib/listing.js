// Cheap check before the listing checker spends an AI call: is the pasted text long enough and
// does it read like a rental listing at all? Gibberish or a stray sentence gets a friendly nudge.

export const MAX_LISTING_CHARS = 4000
const MIN_CHARS = 30
const MIN_WORDS = 5
const MIN_KEYWORDS = 2

// Words rental listings lean on. Matched as whole words (or word starts, for the stems).
const KEYWORDS = [
  'apartment', 'apt', 'unit', 'studio', 'bedroom', 'bed', 'beds', 'br', 'bath', 'bathroom', 'baths', 'rent', 'rental',
  'lease', 'month', 'monthly', 'deposit', 'broker', 'fee', 'available', 'move', 'tenant', 'landlord', 'management',
  'super', 'building', 'floor', 'elevator', 'walkup', 'doorman', 'laundry', 'washer', 'dryer', 'dishwasher', 'kitchen',
  'renovat', 'updated', 'new', 'quiet', 'sunny', 'sun', 'bright', 'spacious', 'closet', 'heat', 'hot water',
  'utilities', 'included', 'pets', 'pet', 'cats', 'dogs', 'amenities', 'gym', 'roof', 'storage', 'subway', 'train',
  'neighborhood', 'block', 'sq ft', 'square feet', 'maintained', 'clean', 'responsive', 'complaints', 'pest',
]
const KEYWORD_RE = new RegExp(`\\b(${KEYWORDS.map((k) => k.replace(/ /g, '\\s+')).join('|')})`, 'gi')

export function looksLikeListing(text) {
  const t = (text || '').trim()
  if (t.length < MIN_CHARS) return false
  const words = t.match(/\p{L}{2,}/gu) || []
  if (words.length < MIN_WORDS) return false
  // Mostly symbols, digits or one repeated word reads as noise, not a listing.
  const letters = (t.match(/\p{L}/gu) || []).length
  if (letters / t.replace(/\s/g, '').length < 0.6) return false
  if (new Set(words.map((w) => w.toLowerCase())).size < MIN_WORDS) return false
  const hits = new Set((t.match(KEYWORD_RE) || []).map((k) => k.toLowerCase().replace(/\s+/g, ' ')))
  return hits.size >= MIN_KEYWORDS
}

// Does pasted listing text mention a broker fee, or the same kind of charge under another label?
// Used only to offer the broker fee checker; deterministic, nothing leaves the page.
const FEE_RE = /\b(broker|brokers|brokerage|commission|fee|fees)\b|\b(processing|listing|access|admin|administrative|marketing|move\s?in|holding)\s+(fee|charge)/i
export const mentionsFee = (text) => FEE_RE.test(text || '')
