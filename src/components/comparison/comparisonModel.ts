import { ALGORITHMS, getAlgorithmDefinition } from '../../features/scheduling/definitions'
import { getAlgorithm, implementedAlgorithmIds } from '../../features/scheduling/registry'
import type { Process, SimulationSummary } from '../../features/scheduling/types'

/**
 * Algorithm comparison model.
 *
 * Runs one workload through every supported algorithm and compares the
 * summary metrics each engine already computed — no scheduling logic is
 * duplicated here, and the algorithms themselves are never touched.
 */

export type MetricKey = keyof Pick<
  SimulationSummary,
  'avgWaitingTime' | 'avgTurnaroundTime' | 'avgResponseTime' | 'cpuUtilization' | 'throughput'
>

export type MetricDirection = 'lower' | 'higher'

export interface MetricSpec {
  key: MetricKey
  /** Full label used in chart titles. */
  label: string
  /** Compact label used in the table header. */
  shortLabel: string
  unit: string
  decimals: number
  better: MetricDirection
}

export const METRIC_SPECS: readonly MetricSpec[] = [
  {
    key: 'avgWaitingTime',
    label: 'Average Waiting Time',
    shortLabel: 'Avg Wait',
    unit: 'ms',
    decimals: 2,
    better: 'lower',
  },
  {
    key: 'avgTurnaroundTime',
    label: 'Average Turnaround Time',
    shortLabel: 'Avg Turnaround',
    unit: 'ms',
    decimals: 2,
    better: 'lower',
  },
  {
    key: 'avgResponseTime',
    label: 'Average Response Time',
    shortLabel: 'Avg Response',
    unit: 'ms',
    decimals: 2,
    better: 'lower',
  },
  {
    key: 'cpuUtilization',
    label: 'CPU Utilization',
    shortLabel: 'CPU Util',
    unit: '%',
    decimals: 1,
    better: 'higher',
  },
  {
    key: 'throughput',
    label: 'Throughput',
    shortLabel: 'Throughput',
    unit: 'proc/ms',
    decimals: 4,
    better: 'higher',
  },
]

export interface ComparisonRow {
  algorithmId: string
  /** Human-readable name (falls back to the raw id for custom algorithms). */
  name: string
  shortName: string
  preemption: string | null
  /** Engine-computed summary metrics, or `null` when the run failed. */
  metrics: Record<MetricKey, number> | null
  /** Why the algorithm could not run on this workload. */
  error: string | null
}

export interface ComparisonResult {
  rows: ComparisonRow[]
  /** Winning algorithm ids per metric (all of them, on a tie). */
  best: Record<MetricKey, string[]>
  failureCount: number
}

export interface MetricBar {
  algorithmId: string
  shortName: string
  value: number
  valueLabel: string
  /** Bar length as a percentage of the largest value in this chart. */
  widthPct: number
  isBest: boolean
}

export interface MetricChart {
  spec: MetricSpec
  bars: MetricBar[]
}

export interface WinTally {
  algorithmId: string
  shortName: string
  wins: number
}

export function formatMetric(spec: MetricSpec, value: number): string {
  const base = value.toFixed(spec.decimals)
  if (!spec.unit) return base
  return spec.unit === '%' ? `${base}%` : `${base} ${spec.unit}`
}

/**
 * Runs `processes` through every supported algorithm in catalogue order
 * (custom registrations follow the built-in list). One failing algorithm
 * becomes an error row instead of breaking the whole comparison.
 */
export function runComparison(
  processes: readonly Process[],
  timeQuantum?: number,
): ComparisonResult {
  const rows = orderedAlgorithmIds().map((algorithmId) =>
    buildRow(algorithmId, processes, timeQuantum),
  )
  return {
    rows,
    best: computeBest(rows),
    failureCount: rows.filter((row) => row.metrics === null).length,
  }
}

/** Catalogue order first, then any extra registered implementations. */
export function orderedAlgorithmIds(): string[] {
  const known: string[] = ALGORITHMS.map((definition) => definition.id)
  const extras = implementedAlgorithmIds().filter((id) => !known.includes(id))
  return [...known, ...extras]
}

/** Best value per metric: minimum for waiting/turnaround/response, maximum otherwise. */
export function computeBest(rows: readonly ComparisonRow[]): Record<MetricKey, string[]> {
  const best = {} as Record<MetricKey, string[]>
  const eligible = rows.filter((row): row is ComparisonRow & { metrics: Record<MetricKey, number> } => row.metrics !== null)

  for (const spec of METRIC_SPECS) {
    if (eligible.length === 0) {
      best[spec.key] = []
      continue
    }

    let target = eligible[0].metrics[spec.key]
    for (const row of eligible) {
      const value = row.metrics[spec.key]
      if (spec.better === 'lower' ? value < target : value > target) target = value
    }

    const tolerance = 1e-6 * Math.max(1, Math.abs(target))
    best[spec.key] = eligible
      .filter((row) => Math.abs(row.metrics[spec.key] - target) <= tolerance)
      .map((row) => row.algorithmId)
  }

  return best
}

export function isBest(
  result: ComparisonResult,
  algorithmId: string,
  key: MetricKey,
): boolean {
  return result.best[key].includes(algorithmId)
}

/** Chart data for one metric, keeping catalogue order across all charts. */
export function buildMetricChart(
  result: ComparisonResult,
  spec: MetricSpec,
): MetricChart {
  const values = result.rows.filter((row) => row.metrics !== null)
  const max = values.reduce((peak, row) => Math.max(peak, row.metrics![spec.key]), 0)

  const bars: MetricBar[] = values.map((row) => {
    const value = row.metrics![spec.key]
    return {
      algorithmId: row.algorithmId,
      shortName: row.shortName,
      value,
      valueLabel: formatMetric(spec, value),
      widthPct: max > 0 ? (value / max) * 100 : 100,
      isBest: result.best[spec.key].includes(row.algorithmId),
    }
  })

  return { spec, bars }
}

/** How many of the five metrics each algorithm wins (ties count for each). */
export function winTally(result: ComparisonResult): WinTally[] {
  return result.rows
    .map((row) => ({
      algorithmId: row.algorithmId,
      shortName: row.shortName,
      wins: METRIC_SPECS.filter((spec) => result.best[spec.key].includes(row.algorithmId)).length,
    }))
    .sort((a, b) => b.wins - a.wins || a.shortName.localeCompare(b.shortName))
}

function buildRow(
  algorithmId: string,
  processes: readonly Process[],
  timeQuantum: number | undefined,
): ComparisonRow {
  const definition = getAlgorithmDefinition(algorithmId)
  const algorithm = getAlgorithm(algorithmId)
  const base = {
    algorithmId,
    name: definition?.name ?? algorithmId,
    shortName: definition?.shortName ?? algorithmId,
    preemption: definition?.preemption ?? null,
  }

  if (!algorithm) {
    return { ...base, metrics: null, error: 'No implementation is registered.' }
  }

  try {
    // Fresh copies per run so one engine can never poison another's inputs.
    const workload = processes.map((process) => ({ ...process }))
    const result = algorithm.run(
      timeQuantum !== undefined ? { processes: workload, timeQuantum } : { processes: workload },
    )
    return { ...base, metrics: metricsFromSummary(result.summary), error: null }
  } catch (error) {
    return {
      ...base,
      metrics: null,
      error: error instanceof Error ? error.message : 'The algorithm failed to run.',
    }
  }
}

function metricsFromSummary(summary: SimulationSummary): Record<MetricKey, number> {
  return {
    avgWaitingTime: summary.avgWaitingTime,
    avgTurnaroundTime: summary.avgTurnaroundTime,
    avgResponseTime: summary.avgResponseTime,
    cpuUtilization: summary.cpuUtilization,
    throughput: summary.throughput,
  }
}
