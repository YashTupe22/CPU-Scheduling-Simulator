import { beforeAll, describe, expect, it } from 'vitest'
import {
  METRIC_SPECS,
  buildMetricChart,
  computeBest,
  formatMetric,
  isBest,
  orderedAlgorithmIds,
  runComparison,
  winTally,
} from './comparisonModel'
import type { ComparisonRow, MetricKey } from './comparisonModel'
import { registerBuiltinAlgorithms } from '../../features/scheduling/algorithms'
import { registerAlgorithm } from '../../features/scheduling/registry'
import type { Process } from '../../features/scheduling/types'

const workload: Process[] = [
  { id: 'p1', pid: 'P1', arrivalTime: 0, burstTime: 7, priority: 2 },
  { id: 'p2', pid: 'P2', arrivalTime: 2, burstTime: 4, priority: 1 },
  { id: 'p3', pid: 'P3', arrivalTime: 4, burstTime: 1, priority: 3 },
  { id: 'p4', pid: 'P4', arrivalTime: 6, burstTime: 5, priority: 2 },
]

const row = (overrides: Partial<ComparisonRow> & { algorithmId: string }): ComparisonRow => ({
  name: overrides.algorithmId,
  shortName: overrides.algorithmId,
  preemption: null,
  metrics: null,
  error: null,
  ...overrides,
})

const metrics = (
  avgWaitingTime: number,
  avgTurnaroundTime: number,
  avgResponseTime: number,
  cpuUtilization: number,
  throughput: number,
): Record<MetricKey, number> => ({
  avgWaitingTime,
  avgTurnaroundTime,
  avgResponseTime,
  cpuUtilization,
  throughput,
})

beforeAll(() => {
  registerBuiltinAlgorithms()
})

describe('orderedAlgorithmIds', () => {
  it('lists the catalogue first, then extra registrations', () => {
    const ids = orderedAlgorithmIds()

    expect(ids.slice(0, 6)).toEqual(['fcfs', 'sjf', 'srtf', 'priority-np', 'priority-p', 'round-robin'])
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('runComparison', () => {
  it('runs every supported algorithm on the same dataset', () => {
    const result = runComparison(workload, 2)

    expect(result.rows).toHaveLength(6)
    expect(result.failureCount).toBe(0)
    for (const spec of METRIC_SPECS) expect(result.best[spec.key].length).toBeGreaterThan(0)

    for (const rowEntry of result.rows) {
      expect(rowEntry.metrics).not.toBeNull()
      expect(rowEntry.error).toBeNull()
      expect(rowEntry.metrics!.avgWaitingTime).toBeGreaterThanOrEqual(0)
      expect(rowEntry.metrics!.cpuUtilization).toBeGreaterThan(0)
      expect(rowEntry.metrics!.throughput).toBeGreaterThan(0)
    }
  })

  it('reads metrics straight from the engine summary', async () => {
    const result = runComparison(workload, 2)
    const { getAlgorithm } = await import('../../features/scheduling/registry')
    const fcfsRow = result.rows.find((entry) => entry.algorithmId === 'fcfs')!

    const direct = getAlgorithm('fcfs')!.run({ processes: workload.map((p) => ({ ...p })) })

    expect(fcfsRow.metrics).toEqual({
      avgWaitingTime: direct.summary.avgWaitingTime,
      avgTurnaroundTime: direct.summary.avgTurnaroundTime,
      avgResponseTime: direct.summary.avgResponseTime,
      cpuUtilization: direct.summary.cpuUtilization,
      throughput: direct.summary.throughput,
    })
  })

  it('records a failing algorithm as an error row without breaking the run', () => {
    registerAlgorithm({
      id: 'boom-always-throws',
      run() {
        throw new Error('kaboom')
      },
    })

    const result = runComparison(workload, 2)
    const failed = result.rows.find((entry) => entry.algorithmId === 'boom-always-throws')!

    expect(result.rows).toHaveLength(7)
    expect(failed.metrics).toBeNull()
    expect(failed.error).toBe('kaboom')
    expect(result.failureCount).toBe(1)
    for (const spec of METRIC_SPECS) {
      expect(result.best[spec.key]).not.toContain('boom-always-throws')
    }
  })

  it('marks unregistered catalogue algorithms instead of throwing', () => {
    const result = runComparison([], undefined)
    const rr = result.rows.find((entry) => entry.algorithmId === 'round-robin')!

    // No quantum supplied → Round Robin refuses the input, others still run.
    expect(rr.metrics).toBeNull()
    expect(rr.error).toMatch(/quantum/i)
  })
})

describe('computeBest', () => {
  it('picks the minimum for time metrics and the maximum for util/throughput', () => {
    const rows = [
      row({
        algorithmId: 'a',
        metrics: metrics(4, 10, 3, 80, 0.1),
      }),
      row({
        algorithmId: 'b',
        metrics: metrics(6, 9, 5, 90, 0.2),
      }),
    ]
    const best = computeBest(rows)

    expect(best.avgWaitingTime).toEqual(['a'])
    expect(best.avgTurnaroundTime).toEqual(['b'])
    expect(best.avgResponseTime).toEqual(['a'])
    expect(best.cpuUtilization).toEqual(['b'])
    expect(best.throughput).toEqual(['b'])
  })

  it('highlights every algorithm tied for the best value', () => {
    const rows = [
      row({ algorithmId: 'a', metrics: metrics(5, 10, 3, 80, 0.1) }),
      row({ algorithmId: 'b', metrics: metrics(5, 11, 3, 70, 0.1) }),
      row({ algorithmId: 'c', metrics: metrics(7, 12, 4, 60, 0.05) }),
    ]
    const best = computeBest(rows)

    expect(best.avgWaitingTime).toEqual(['a', 'b'])
    expect(best.avgResponseTime).toEqual(['a', 'b'])
    expect(best.throughput).toEqual(['a', 'b'])
    expect(best.cpuUtilization).toEqual(['a'])
    expect(best.avgTurnaroundTime).toEqual(['a'])
  })

  it('ignores error rows', () => {
    const best = computeBest([
      row({ algorithmId: 'ok', metrics: metrics(1, 2, 3, 4, 5) }),
      row({ algorithmId: 'broken', metrics: null, error: 'nope' }),
    ])

    expect(best.avgWaitingTime).toEqual(['ok'])
    expect(best.cpuUtilization).toEqual(['ok'])
  })

  it('returns empty winners when nothing ran', () => {
    const best = computeBest([])
    for (const spec of METRIC_SPECS) expect(best[spec.key]).toEqual([])
  })
})

describe('buildMetricChart', () => {
  it('scales bars against the largest value and marks the winner', () => {
    const result = runComparison(workload, 2)
    const spec = METRIC_SPECS.find((entry) => entry.key === 'avgWaitingTime')!
    const chart = buildMetricChart(result, spec)

    expect(chart.bars).toHaveLength(6)
    // Error rows are excluded from charts but stay in the table.
    expect(chart.bars.map((bar) => bar.algorithmId)).toEqual(
      result.rows.filter((entry) => entry.metrics !== null).map((entry) => entry.algorithmId),
    )

    const values = chart.bars.map((bar) => bar.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    expect(max).toBeGreaterThan(min)

    const bestBar = chart.bars.find((bar) => bar.isBest)!
    expect(bestBar.value).toBeCloseTo(min)
    expect(bestBar.widthPct).toBeCloseTo((min / max) * 100)
    expect(chart.bars.filter((bar) => bar.isBest).length).toBe(result.best.avgWaitingTime.length)
    expect(chart.bars.every((bar) => bar.valueLabel.includes('ms'))).toBe(true)
  })

  it('falls back to full-width bars when every value is zero', () => {
    const result = {
      rows: [
        row({ algorithmId: 'a', metrics: metrics(0, 0, 0, 0, 0) }),
        row({ algorithmId: 'b', metrics: metrics(0, 0, 0, 0, 0) }),
      ],
      best: computeBest([
        row({ algorithmId: 'a', metrics: metrics(0, 0, 0, 0, 0) }),
        row({ algorithmId: 'b', metrics: metrics(0, 0, 0, 0, 0) }),
      ]),
      failureCount: 0,
    }
    const chart = buildMetricChart(result, METRIC_SPECS[0])

    expect(chart.bars.every((bar) => bar.widthPct === 100)).toBe(true)
    expect(chart.bars.every((bar) => bar.isBest)).toBe(true)
  })
})

describe('winTally', () => {
  it('counts metric wins and sorts most first', () => {
    const rows = [
      row({ algorithmId: 'a', shortName: 'A', metrics: metrics(4, 10, 3, 80, 0.1) }),
      row({ algorithmId: 'b', shortName: 'B', metrics: metrics(6, 9, 5, 95, 0.2) }),
    ]
    const tally = winTally({ rows, best: computeBest(rows), failureCount: 0 })

    expect(tally[0]).toMatchObject({ shortName: 'B', wins: 3 })
    expect(tally[1]).toMatchObject({ shortName: 'A', wins: 2 })
    expect(tally.reduce((sum, entry) => sum + entry.wins, 0)).toBe(5)
  })
})

describe('helpers', () => {
  it('formats metrics to their precision and unit', () => {
    expect(formatMetric(METRIC_SPECS[0], 4.333)).toBe('4.33 ms')
    expect(formatMetric(METRIC_SPECS[3], 83.333)).toBe('83.3%')
    expect(formatMetric(METRIC_SPECS[4], 0.0833)).toBe('0.0833 proc/ms')
  })

  it('exposes best membership per row', () => {
    const rows = [row({ algorithmId: 'a', metrics: metrics(1, 1, 1, 99, 1) })]
    const result = { rows, best: computeBest(rows), failureCount: 0 }

    expect(isBest(result, 'a', 'avgWaitingTime')).toBe(true)
    expect(isBest(result, 'a', 'throughput')).toBe(true)
    expect(isBest(result, 'nope', 'avgWaitingTime')).toBe(false)
  })
})
