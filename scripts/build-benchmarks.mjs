// Build time snapshot of borough benchmarks: open HPD violations per apartment.
//
//   node scripts/build-benchmarks.mjs            (writes src/data/benchmarks.json)
//
// Method (full join, no sampling):
//   1. PLUTO (64uk-42ks): every tax lot with 1 or more residential units → bbl, borough, unitsres.
//   2. HPD violations (wvxf-dwi5): open Class A, B and C violations grouped by bbl, all classes
//      and Class C separately. Same definition the app uses for a building's "open violations".
//   3. Join on BBL. Lots with no open violations count as zero. Rate = open violations / unitsres.
//   4. Per borough and size group (1 to 2 apartments, 3 or more), store the 1st..99th percentile
//      and the deciles of each rate, plus the share of lots at zero.
// Run again whenever a fresh snapshot is wanted; the UI shows the snapshot month.

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const BASE = 'https://data.cityofnewyork.us'
const PLUTO = '64uk-42ks'
const HPD = 'wvxf-dwi5'
const PAGE = 50000
const OUT = fileURLToPath(new URL('../src/data/benchmarks.json', import.meta.url))

const BOROUGHS = { 1: 'Manhattan', 2: 'Bronx', 3: 'Brooklyn', 4: 'Queens', 5: 'Staten Island' }
// Keep in sync with sizeGroup() in src/lib/insights.js.
const sizeGroup = (units) => (units >= 3 ? 'apartments' : 'homes')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(300000) })
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
      return await res.json()
    } catch (err) {
      if (i >= tries) throw err
      console.warn(`  retry ${i} after: ${err.message}`)
      await sleep(3000 * i)
    }
  }
}

function soql(ds, params) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) qs.set(`$${k}`, String(v))
  return `${BASE}/resource/${ds}.json?${qs}`
}

// Page through a query in stable `order`, until a short page comes back.
async function fetchAll(ds, params, label) {
  const rows = []
  for (let offset = 0; ; offset += PAGE) {
    const t = Date.now()
    const page = await getJson(soql(ds, { ...params, limit: PAGE, offset }))
    rows.push(...page)
    console.log(`  ${label}: +${page.length} (total ${rows.length}) in ${((Date.now() - t) / 1000).toFixed(1)}s`)
    if (page.length < PAGE) return rows
  }
}

const bblKey = (v) => {
  const n = Math.round(Number(v))
  return n >= 1000000000 && n < 6000000000 ? String(n) : null
}

// Nearest rank percentile on a sorted array (p in 0..100).
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]
const round4 = (x) => Math.round(x * 10000) / 10000

function distribution(values) {
  const sorted = Float64Array.from(values).sort()
  const percentiles = Array.from({ length: 99 }, (_, i) => round4(pct(sorted, i + 1)))
  return {
    zeroShare: round4(sorted.filter((v) => v === 0).length / sorted.length),
    deciles: [10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => percentiles[p - 1]),
    percentiles,
    max: round4(sorted[sorted.length - 1]),
  }
}

async function datasetInfo(id) {
  const d = await getJson(`${BASE}/api/views/${id}.json`)
  return { id, name: d.name, updated: new Date(d.rowsUpdatedAt * 1000).toISOString().slice(0, 10) }
}

async function main() {
  const started = Date.now()
  const snapshotDate = new Date().toISOString().slice(0, 10)
  const [plutoInfo, hpdInfo] = await Promise.all([datasetInfo(PLUTO), datasetInfo(HPD)])

  console.log('PLUTO residential lots…')
  const lots = await fetchAll(PLUTO, { select: 'bbl, borocode, unitsres, version', where: 'unitsres > 0', order: 'bbl' }, 'PLUTO')
  plutoInfo.version = lots[0]?.version || null

  console.log('HPD open violations by lot…')
  const open = await fetchAll(HPD, {
    select: "bbl, count(*) AS n, sum(case(class='C', 1, true, 0)) AS c",
    where: "violationstatus='Open' AND class in('A','B','C')",
    group: 'bbl',
    order: 'bbl',
  }, 'HPD')

  const openByBbl = new Map()
  let openViolations = 0
  for (const r of open) {
    const key = bblKey(r.bbl)
    if (!key) continue
    openByBbl.set(key, { n: Number(r.n), c: Number(r.c) })
    openViolations += Number(r.n)
  }

  const groups = {}
  let joinedViolations = 0
  let joinedLots = 0
  const seen = new Set()
  for (const lot of lots) {
    const key = bblKey(lot.bbl)
    const units = Number(lot.unitsres)
    if (!key || !(units > 0) || seen.has(key)) continue
    seen.add(key)
    const boro = key[0]
    const g = (groups[boro] ??= {})[sizeGroup(units)] ??= { all: [], classC: [] }
    const v = openByBbl.get(key) || { n: 0, c: 0 }
    if (v.n) {
      joinedLots++
      joinedViolations += v.n
    }
    g.all.push(v.n / units)
    g.classC.push(v.c / units)
  }

  const boroughs = {}
  for (const [boro, sizes] of Object.entries(groups)) {
    boroughs[boro] = { name: BOROUGHS[boro], groups: {} }
    for (const [size, g] of Object.entries(sizes)) {
      boroughs[boro].groups[size] = { lots: g.all.length, all: distribution(g.all), classC: distribution(g.classC) }
    }
  }

  const out = {
    meta: {
      snapshotDate,
      method: 'per_unit',
      metric: 'Open HPD violations (Class A, B and C) per residential unit, per tax lot',
      population: 'Every tax lot in PLUTO with 1 or more residential units; lots with no open violations count as zero',
      sizeGroups: { homes: '1 to 2 residential units', apartments: '3 or more residential units' },
      sources: [plutoInfo, hpdInfo],
      coverage: {
        plutoResidentialLots: seen.size,
        hpdLotsWithOpenViolations: openByBbl.size,
        hpdOpenViolations: openViolations,
        joinedLotsWithOpenViolations: joinedLots,
        joinedOpenViolations: joinedViolations,
        joinedViolationShare: round4(joinedViolations / openViolations),
      },
    },
    boroughs,
  }

  await writeFile(OUT, JSON.stringify(out) + '\n')
  console.log(`\nWrote ${OUT} in ${((Date.now() - started) / 1000).toFixed(0)}s`)
  console.log(JSON.stringify(out.meta, null, 2))
  for (const [boro, b] of Object.entries(boroughs)) {
    for (const [size, g] of Object.entries(b.groups)) {
      console.log(`${b.name} ${size}: ${g.lots} lots, zero ${g.all.zeroShare}, deciles ${g.all.deciles.join(' ')}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
