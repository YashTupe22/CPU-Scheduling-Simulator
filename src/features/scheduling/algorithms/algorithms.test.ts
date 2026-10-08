import { describe, expect, it } from 'vitest'
import { builtinAlgorithms, registerBuiltinAlgorithms } from './index'
import { fcfs } from './fcfs'
import { shortestJobFirst } from './sjf'
import { shortestRemainingTimeFirst } from './srtf'
import { priorityNonPreemptive } from './priorityNp'
import { priorityPreemptive } from './priorityP'
import { roundRobin } from './roundRobin'
import { ALGORITHM_IDS, getAlgorithmDefinition } from '../definitions'
import { getAlgorithm, isAlgorithmImplemented } from '../registry'
import type { Process, SimulationResult } from '../types'

const proc = (pid: string, arrivalTime: number, burstTime: number, priority = 1): Process => ({
  id: pid.toLowerCase(),
  pid,
  arrivalTime,
  burstTime,
  priority,
})

/** Canonical four-process workload with varied arrivals, bursts and priorities. */
const workload: Process[] = [
  proc('P1', 0, 6, 2),
  proc('P2', 1, 4, 1),
  proc('P3', 2, 2, 3),
  proc('P4', 4, 5, 2),
]

/** Renders the timeline as readable strings, e.g. "P1 0-6" or "idle 3-4". */
function render(result: SimulationResult): string[] {
  const labels = new Map(result.metrics.map((metric) => [metric.processId, metric.pid]))
  return result.timeline.map((segment) =>
    segment.kind === 'idle'
      ? `idle ${segment.start}-${segment.end}`
      : `${labels.get(segment.processId)} ${segment.start}-${segment.end}`,
  )
}

function completionTimes(result: SimulationResult): Record<string, number> {
  return Object.fromEntries(result.metrics.map((metric) => [metric.pid, metric.completionTime]))
}

function withoutQuantum(processes: Process[]) {
  return { processes }
}

describe('FCFS', () => {
  it('runs strictly in arrival order and computes metrics', () => {
    const result = fcfs.run(withoutQuantum(workload))

    expect(render(result)).toEqual(['P1 0-6', 'P2 6-10', 'P3 10-12', 'P4 12-17'])
    expect(completionTimes(result)).toEqual({ P1: 6, P2: 10, P3: 12, P4: 17 })
    expect(result.summary).toEqual({
      avgTurnaroundTime: 9.5,
      avgWaitingTime: 5.25,
      avgResponseTime: 5.25,
      cpuUtilization: 100,
      throughput: 0.2353,
    })
  })

  it('idles the CPU until the first process arrives', () => {
    const result = fcfs.run(withoutQuantum([proc('P1', 5, 2)]))

    expect(render(result)).toEqual(['idle 0-5', 'P1 5-7'])
    expect(result.summary).toEqual({
      avgTurnaroundTime: 2,
      avgWaitingTime: 0,
      avgResponseTime: 0,
      cpuUtilization: 28.57,
      throughput: 0.1429,
    })
  })

  it('breaks arrival-time ties by process label', () => {
    const result = fcfs.run(withoutQuantum([proc('P2', 0, 2), proc('P1', 0, 4)]))

    expect(render(result)).toEqual(['P1 0-4', 'P2 4-6'])
  })
})

describe('SJF (non-preemptive)', () => {
  it('picks the shortest ready burst and finishes it before re-deciding', () => {
    const result = shortestJobFirst.run(withoutQuantum(workload))

    expect(render(result)).toEqual(['P1 0-6', 'P3 6-8', 'P2 8-12', 'P4 12-17'])
    expect(completionTimes(result)).toEqual({ P1: 6, P3: 8, P2: 12, P4: 17 })
    expect(result.summary.avgTurnaroundTime).toBe(9)
    expect(result.summary.avgWaitingTime).toBe(4.75)
  })

  it('waits for the CPU to be free before a shorter job can jump the queue', () => {
    // P2 is shorter but arrives while P1 is already running: no preemption.
    const result = shortestJobFirst.run(withoutQuantum([proc('P1', 0, 5), proc('P2', 1, 1)]))

    expect(render(result)).toEqual(['P1 0-5', 'P2 5-6'])
    expect(completionTimes(result)).toEqual({ P1: 5, P2: 6 })
  })

  it('idles when nothing has arrived yet', () => {
    const result = shortestJobFirst.run(withoutQuantum([proc('P1', 4, 3)]))
    expect(render(result)).toEqual(['idle 0-4', 'P1 4-7'])
  })
})

describe('SRTF (preemptive)', () => {
  it('preempts on arrival whenever the remaining time is shorter', () => {
    const result = shortestRemainingTimeFirst.run(withoutQuantum(workload))

    expect(render(result)).toEqual([
      'P1 0-1',
      'P2 1-2',
      'P3 2-4',
      'P2 4-7',
      'P1 7-12',
      'P4 12-17',
    ])
    expect(completionTimes(result)).toEqual({ P1: 12, P2: 7, P3: 4, P4: 17 })
    expect(result.summary).toEqual({
      avgTurnaroundTime: 8.25,
      avgWaitingTime: 4,
      avgResponseTime: 2,
      cpuUtilization: 100,
      throughput: 0.2353,
    })
  })

  it('keeps the current process when the arrival is longer', () => {
    const result = shortestRemainingTimeFirst.run(
      withoutQuantum([proc('P1', 0, 4), proc('P2', 1, 10)]),
    )

    expect(render(result)).toEqual(['P1 0-4', 'P2 4-14'])
  })

  it('stays idle across a gap between arrivals', () => {
    const result = shortestRemainingTimeFirst.run(
      withoutQuantum([proc('P1', 0, 2), proc('P2', 6, 3)]),
    )

    expect(render(result)).toEqual(['P1 0-2', 'idle 2-6', 'P2 6-9'])
  })
})

describe('Priority (non-preemptive)', () => {
  it('dispatches the best priority among arrived processes', () => {
    const result = priorityNonPreemptive.run(withoutQuantum(workload))

    expect(render(result)).toEqual(['P1 0-6', 'P2 6-10', 'P4 10-15', 'P3 15-17'])
    expect(completionTimes(result)).toEqual({ P1: 6, P2: 10, P4: 15, P3: 17 })
    expect(result.summary.avgTurnaroundTime).toBe(10.25)
    expect(result.summary.avgWaitingTime).toBe(6)
  })

  it('ignores better priorities that arrive during the current run', () => {
    const result = priorityNonPreemptive.run(
      withoutQuantum([proc('P1', 0, 5, 5), proc('P2', 1, 2, 1)]),
    )

    expect(render(result)).toEqual(['P1 0-5', 'P2 5-7'])
  })
})

describe('Priority (preemptive)', () => {
  it('preempts as soon as a better priority arrives', () => {
    const result = priorityPreemptive.run(withoutQuantum(workload))

    expect(render(result)).toEqual(['P1 0-1', 'P2 1-5', 'P1 5-10', 'P4 10-15', 'P3 15-17'])
    expect(completionTimes(result)).toEqual({ P1: 10, P2: 5, P4: 15, P3: 17 })
    expect(result.summary).toEqual({
      avgTurnaroundTime: 10,
      avgWaitingTime: 5.75,
      avgResponseTime: 4.75,
      cpuUtilization: 100,
      throughput: 0.2353,
    })
  })

  it('does not switch away on an equal or worse priority', () => {
    const result = priorityPreemptive.run(
      withoutQuantum([proc('P1', 0, 4, 2), proc('P2', 1, 1, 2), proc('P3', 2, 1, 3)]),
    )

    expect(render(result)).toEqual(['P1 0-4', 'P2 4-5', 'P3 5-6'])
  })

  it('idles until the first arrival', () => {
    const result = priorityPreemptive.run(withoutQuantum([proc('P1', 3, 2, 1)]))
    expect(render(result)).toEqual(['idle 0-3', 'P1 3-5'])
  })
})

describe('Round Robin', () => {
  const quantum = (value: number) => ({ processes: workload, timeQuantum: value })

  it('cycles the ready queue with the given quantum', () => {
    const result = roundRobin.run(quantum(2))

    expect(render(result)).toEqual([
      'P1 0-2',
      'P2 2-4',
      'P3 4-6',
      'P1 6-8',
      'P4 8-10',
      'P2 10-12',
      'P1 12-14',
      'P4 14-17',
    ])
    expect(completionTimes(result)).toEqual({ P1: 14, P2: 12, P3: 6, P4: 17 })
    expect(result.timeQuantum).toBe(2)
    expect(result.summary).toEqual({
      avgTurnaroundTime: 10.5,
      avgWaitingTime: 6.25,
      avgResponseTime: 1.75,
      cpuUtilization: 100,
      throughput: 0.2353,
    })
  })

  it('queues arrivals made during a slice ahead of the interrupted process', () => {
    // P2 arrives inside P1's first slice, so it runs before P1 is re-queued.
    const result = roundRobin.run({
      processes: [proc('P1', 0, 4), proc('P2', 1, 1)],
      timeQuantum: 2,
    })

    expect(render(result)).toEqual(['P1 0-2', 'P2 2-3', 'P1 3-5'])
  })

  it('idles between two arrivals', () => {
    const result = roundRobin.run({
      processes: [proc('P1', 0, 4), proc('P2', 5, 3)],
      timeQuantum: 2,
    })

    expect(render(result)).toEqual(['P1 0-4', 'idle 4-5', 'P2 5-8'])
    expect(result.summary.cpuUtilization).toBe(87.5)
    expect(result.summary.avgWaitingTime).toBe(0)
  })

  it('handles a quantum larger than every burst time', () => {
    const result = roundRobin.run(quantum(100))
    expect(render(result)).toEqual(['P1 0-6', 'P2 6-10', 'P3 10-12', 'P4 12-17'])
  })

  it('rejects a missing, zero or fractional time quantum', () => {
    expect(() => roundRobin.run({ processes: workload })).toThrow(/time quantum/)
    expect(() => roundRobin.run(quantum(0))).toThrow(/time quantum/)
    expect(() => roundRobin.run(quantum(1.5))).toThrow(/time quantum/)
  })
})

describe('registry', () => {
  it('exposes every declared algorithm id', () => {
    registerBuiltinAlgorithms()

    const builtinIds = builtinAlgorithms.map((algorithm) => algorithm.id).sort()
    expect(builtinIds).toEqual([...ALGORITHM_IDS].sort())
    for (const id of ALGORITHM_IDS) {
      expect(isAlgorithmImplemented(id)).toBe(true)
      expect(getAlgorithm(id)).toBeDefined()
      expect(getAlgorithmDefinition(id)).toBeDefined()
    }
  })
})

describe.each(builtinAlgorithms)('$id', (algorithm) => {
  const options = (processes: Process[]) =>
    algorithm.id === 'round-robin' ? { processes, timeQuantum: 2 } : { processes }

  it('produces a consistent schedule for the shared workload', () => {
    const result = algorithm.run(options(workload))

    expect(result.algorithmId).toBe(algorithm.id)
    expect(result.timeline.length).toBeGreaterThan(0)
    expect(result.metrics).toHaveLength(workload.length)

    const executed = new Map<string, number>()
    let cursor = 0
    for (const segment of result.timeline) {
      expect(segment.start).toBe(cursor)
      cursor = segment.end
      if (segment.kind === 'process') {
        executed.set(segment.processId, (executed.get(segment.processId) ?? 0) + segment.end - segment.start)
      }
    }

    for (const process of workload) {
      expect(executed.get(process.id)).toBe(process.burstTime)
      const metric = result.metrics.find((entry) => entry.processId === process.id)
      expect(metric?.completionTime).toBeGreaterThanOrEqual(process.arrivalTime + process.burstTime)
    }

    expect(result.summary.cpuUtilization).toBeGreaterThan(0)
    expect(result.summary.cpuUtilization).toBeLessThanOrEqual(100)
  })

  it('handles an empty workload', () => {
    const result = algorithm.run(options([]))
    expect(result.timeline).toEqual([])
    expect(result.metrics).toEqual([])
    expect(result.summary.cpuUtilization).toBe(0)
  })

  it('handles a single late-arriving process with an idle lead-in', () => {
    const result = algorithm.run(options([proc('P1', 7, 3)]))
    expect(result.timeline).toEqual([
      { kind: 'idle', start: 0, end: 7 },
      { kind: 'process', processId: 'p1', start: 7, end: 10 },
    ])
    expect(result.metrics[0].completionTime).toBe(10)
    expect(result.summary.avgWaitingTime).toBe(0)
  })
})
