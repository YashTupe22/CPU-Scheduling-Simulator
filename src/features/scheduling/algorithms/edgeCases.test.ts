import { describe, expect, it } from 'vitest'
import { builtinAlgorithms } from './index'
import { fcfs } from './fcfs'
import { shortestJobFirst } from './sjf'
import { shortestRemainingTimeFirst } from './srtf'
import { priorityNonPreemptive } from './priorityNp'
import { priorityPreemptive } from './priorityP'
import { roundRobin } from './roundRobin'
import type { Process, SimulationInput, SimulationResult } from '../types'

const proc = (pid: string, arrivalTime: number, burstTime: number, priority = 1): Process => ({
  id: pid.toLowerCase(),
  pid,
  arrivalTime,
  burstTime,
  priority,
})

const round2 = (value: number): number => Math.round(value * 100) / 100
const round4 = (value: number): number => Math.round(value * 10_000) / 10_000

/** Runs an algorithm with the time quantum Round Robin requires. */
function runAlgorithm(
  algorithm: { id: string; run(input: SimulationInput): SimulationResult },
  processes: Process[],
  timeQuantum = 2,
): SimulationResult {
  return algorithm.run(
    algorithm.id === 'round-robin' ? { processes, timeQuantum } : { processes },
  )
}

/** Recomputes the summary from the result alone, without trusting the engine. */
function assertSummary(result: SimulationResult): void {
  const { summary, metrics, timeline } = result
  const average = (pick: (metric: (typeof metrics)[number]) => number): number =>
    metrics.length === 0
      ? 0
      : round2(metrics.reduce((sum, metric) => sum + pick(metric), 0) / metrics.length)

  expect(summary.avgTurnaroundTime).toBe(average((m) => m.turnaroundTime))
  expect(summary.avgWaitingTime).toBe(average((m) => m.waitingTime))
  expect(summary.avgResponseTime).toBe(average((m) => m.responseTime))

  const makespan = timeline.length > 0 ? timeline[timeline.length - 1].end : 0
  const busyTime = timeline.reduce(
    (sum, segment) => (segment.kind === 'process' ? sum + segment.end - segment.start : sum),
    0,
  )
  expect(summary.cpuUtilization).toBe(makespan > 0 ? round2((busyTime / makespan) * 100) : 0)
  expect(summary.throughput).toBe(makespan > 0 ? round4(metrics.length / makespan) : 0)
}

/**
 * The full scheduling contract, checked from scratch: a contiguous timeline
 * that starts at 0, no execution before a process arrives, exactly
 * `burstTime` CPU time per process, and metrics derived from the timeline.
 */
function assertSound(result: SimulationResult, processes: readonly Process[]): void {
  expect(result.metrics).toHaveLength(processes.length)

  const byId = new Map(processes.map((process) => [process.id, process]))
  const executed = new Map<string, number>()
  const firstStart = new Map<string, number>()
  const completion = new Map<string, number>()

  let cursor = 0
  for (const segment of result.timeline) {
    expect(segment.start).toBe(cursor)
    expect(segment.end).toBeGreaterThan(segment.start)
    cursor = segment.end
    if (segment.kind === 'idle') continue

    const process = byId.get(segment.processId)
    if (!process) throw new Error(`Timeline references unknown process "${segment.processId}"`)
    expect(segment.start).toBeGreaterThanOrEqual(process.arrivalTime)

    executed.set(process.id, (executed.get(process.id) ?? 0) + segment.end - segment.start)
    if (!firstStart.has(process.id)) firstStart.set(process.id, segment.start)
    completion.set(process.id, segment.end)
  }

  for (const process of processes) {
    expect(executed.get(process.id) ?? 0).toBe(process.burstTime)

    const metric = result.metrics.find((entry) => entry.processId === process.id)
    if (!metric) throw new Error(`Missing metrics for "${process.pid}"`)

    expect(metric.completionTime).toBe(completion.get(process.id))
    expect(metric.turnaroundTime).toBe(metric.completionTime - process.arrivalTime)
    expect(metric.waitingTime).toBe(metric.turnaroundTime - process.burstTime)
    expect(metric.responseTime).toBe((firstStart.get(process.id) ?? Infinity) - process.arrivalTime)
    expect(metric.waitingTime).toBeGreaterThanOrEqual(0)
    expect(metric.responseTime).toBeGreaterThanOrEqual(0)
    expect(metric.responseTime).toBeLessThanOrEqual(metric.turnaroundTime)
  }

  assertSummary(result)
}

const simultaneous: Process[] = [
  proc('P1', 0, 4, 2),
  proc('P2', 0, 1, 1),
  proc('P3', 0, 2, 3),
  proc('P4', 0, 3, 1),
]

const singleMillisecond: Process[] = [proc('P1', 0, 1)]

const hugeArrivalGap: Process[] = [proc('P1', 500, 5)]

const stress: Process[] = Array.from({ length: 20 }, (_, index) =>
  proc(`P${index + 1}`, index % 7, ((index * 3) % 9) + 1, index % 4),
)

const workloads: ReadonlyArray<readonly [string, Process[]]> = [
  ['simultaneous arrivals', simultaneous],
  ['a single 1 ms process', singleMillisecond],
  ['a 500 ms arrival gap', hugeArrivalGap],
  ['a 20-process stress workload', stress],
]

const executionOrder = (result: SimulationResult): string[] =>
  result.timeline.flatMap((segment) => (segment.kind === 'process' ? [segment.processId] : []))

describe.each(builtinAlgorithms)('$id edge cases', (algorithm) => {
  it.each(workloads)('holds every invariant for %s', (_name, processes) => {
    const result = runAlgorithm(algorithm, processes)

    expect(result.algorithmId).toBe(algorithm.id)
    expect(result.timeline.length).toBeGreaterThan(0)
    expect(result.metrics.map((metric) => metric.pid).sort()).toEqual(
      processes.map((process) => process.pid).sort(),
    )
    assertSound(result, processes)
  })

  it('never mutates a frozen input process list', () => {
    const processes: Process[] = [proc('P1', 2, 3), proc('P2', 0, 1)]
    for (const process of processes) Object.freeze(process)
    Object.freeze(processes)

    const result = runAlgorithm(algorithm, processes)

    expect(result.metrics).toHaveLength(2)
    expect(processes.map((process) => process.pid)).toEqual(['P1', 'P2'])
    assertSound(result, processes)
  })

  it('runs a single 1 ms process as a single 0-1 slice', () => {
    const result = runAlgorithm(algorithm, singleMillisecond)

    expect(result.timeline).toEqual([{ kind: 'process', processId: 'p1', start: 0, end: 1 }])
    expect(result.summary).toEqual({
      avgTurnaroundTime: 1,
      avgWaitingTime: 0,
      avgResponseTime: 0,
      cpuUtilization: 100,
      throughput: 1,
    })
  })

  it('idles across a huge arrival gap without distorting metrics', () => {
    const result = runAlgorithm(algorithm, hugeArrivalGap)

    expect(result.timeline).toEqual([
      { kind: 'idle', start: 0, end: 500 },
      { kind: 'process', processId: 'p1', start: 500, end: 505 },
    ])
    expect(result.summary).toEqual({
      avgTurnaroundTime: 5,
      avgWaitingTime: 0,
      avgResponseTime: 0,
      cpuUtilization: 0.99,
      throughput: 0.002,
    })
  })
})

describe('simultaneous arrivals', () => {
  it('FCFS breaks the tie by process label', () => {
    const result = fcfs.run({ processes: simultaneous })
    expect(executionOrder(result)).toEqual(['p1', 'p2', 'p3', 'p4'])
  })

  it('SJF and SRTF agree when everything is ready at t=0', () => {
    const sjf = shortestJobFirst.run({ processes: simultaneous })
    const srtf = shortestRemainingTimeFirst.run({ processes: simultaneous })

    expect(srtf.timeline).toEqual(sjf.timeline)
    expect(executionOrder(sjf)).toEqual(['p2', 'p3', 'p4', 'p1'])
  })

  it('priority algorithms agree when nothing can preempt', () => {
    const nonPreemptive = priorityNonPreemptive.run({ processes: simultaneous })
    const preemptive = priorityPreemptive.run({ processes: simultaneous })

    expect(preemptive.timeline).toEqual(nonPreemptive.timeline)
    expect(executionOrder(nonPreemptive)).toEqual(['p2', 'p4', 'p1', 'p3'])
  })

  it('round-robin with quantum 1 rotates through every process', () => {
    const result = roundRobin.run({ processes: simultaneous, timeQuantum: 1 })

    expect(
      executionOrder(result)
        .slice(0, 4)
        .map((id, index) => `${id} ${index}-${index + 1}`),
    ).toEqual(['p1 0-1', 'p2 1-2', 'p3 2-3', 'p4 3-4'])
    assertSound(result, simultaneous)
  })
})

describe('all processes share one priority', () => {
  const samePriority: Process[] = [
    proc('P3', 0, 2, 5),
    proc('P1', 0, 4, 5),
    proc('P2', 0, 1, 5),
  ]

  it('every algorithm still produces a deterministic, sound schedule', () => {
    for (const algorithm of builtinAlgorithms) {
      const result = runAlgorithm(algorithm, samePriority)
      assertSound(result, samePriority)
    }

    const firstCome = fcfs.run({ processes: samePriority })
    const shortest = shortestJobFirst.run({ processes: samePriority })
    const priorityNp = priorityNonPreemptive.run({ processes: samePriority })
    const priorityP = priorityPreemptive.run({ processes: samePriority })

    expect(executionOrder(firstCome)).toEqual(['p1', 'p2', 'p3'])
    expect(executionOrder(shortest)).toEqual(['p2', 'p3', 'p1'])
    expect(priorityP.timeline).toEqual(priorityNp.timeline)
  })
})
