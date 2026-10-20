// Borough benchmarks: a committed snapshot built by scripts/build-benchmarks.mjs (not fetched
// at runtime). `benchmarksMeta` says which datasets and which day the snapshot came from.
import data from './benchmarks.json'

export const BENCHMARKS = data.boroughs
export const benchmarksMeta = data.meta
