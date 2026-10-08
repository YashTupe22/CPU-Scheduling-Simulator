import { describe, expect, it } from 'vitest'
import { analyzeTimeline, buildMetrics, computeProcessMetrics, computeSummary } from './index'
import { fcfs } from '../algorithms/fcfs'
import { roundRobin } from '../algorithms/roundRobin'
import { shortestRemainingTimeFirst } from '../algorithms/srtf'
import type { Process, TimelineSegment } from '../types'

const proc = (pid: string, arrivalTime: number, burstTime: number, priority = 1): Process => ({
  id: pid.toLowerCase(),
  pid,
  arrivalTime,
  burstTime,
  priority,
})

const exec = (processId: string, start: number, end: number): TimelineSegment => ({
  kind: 'process',
  processId,
  start,
  end,
})

const idle = (start: number, end: number): TimelineSegment => ({ kind: 'idle', start, end })

describe('analyzeTimeline', () => {
  const processes = [proc('P1', 2, 3), proc('P2', 7, 2)]

  it('separates busy time, idle time and makespan', () => {
    const analysis = analyzeTimeline(processes, [idle(0, 2), exec('p1', 2, 5), idle(5, 7), exec('p2', 7, 9)])

    expect(analysis.makespan).toBe(9)
    expect(analysis.busyTime).toBe(5)
    expect(analysis.idleTime).toBe(4)
    expect(analysis.completed).toBe(2)
    expect(analysis.busyTime + analysis.idleTime).toBe(analysis.makespan)
  })

  it('reports zero totals for an empty schedule', () => {
    const analysis = analyzeTimeline([], [])

    expect(analysis.makespan).toBe(0)
    expect(analysis.busyTime).toBe(0)
    expect(analysis.idleTime).toBe(0)
    expect(analysis.completed).toBe(0)
    expect(analysis.traces.size).toBe(0)
  })

  it('merges multiple executions of the same process into one trace', () => {
    const analysis = analyzeTimeline(
      [proc('P1', 2, 3), proc('P2', 3, 2)],
      [idle(0, 2), exec('p1', 2, 3), exec('p2', 3, 5), exec('p1', 5, 7)],
    )

    expect(analysis.traces.get('p1')).toEqual({
      processId: 'p1',
      firstStart: 2,
      completion: 7,
      executed: 3,
      slices: 2,
    })
    expect(analysis.traces.get('p2')?.slices).toBe(1)
  })

  it('rejects gaps and overlaps', () => {
    const ready = [proc('P1', 0, 6), proc('P2', 0, 4)]

    expect(() => analyzeTimeline(ready, [exec('p1', 0, 2), exec('p2', 4, 6)])).toThrow(
      /not contiguous/,
    )
    expect(() => analyzeTimeline(ready, [exec('p1', 0, 5), exec('p2', 3, 6)])).toThrow(
      /not contiguous/,
    )
  })

  it('rejects zero-length segments, unknown ids and early execution', () => {
    expect(() => analyzeTimeline(processes, [idle(0, 2), exec('p1', 2, 2)])).toThrow(
      /non-positive duration/,
    )
    expect(() => analyzeTimeline(processes, [idle(0, 2), exec('zz', 2, 4)])).toThrow(
      /unknown process id/,
    )
    expect(() => analyzeTimeline(processes, [exec('p1', 0, 2)])).toThrow(/before its arrival/)
  })
})

describe('computeProcessMetrics', () => {
  it('computes completion, turnaround, waiting and response', () => {
    const process = proc('P1', 2, 3)
    const analysis = analyzeTimeline([process], [idle(0, 5), exec('p1', 5, 8)])

    expect(computeProcessMetrics([process], analysis)).toEqual([
      {
        processId: 'p1',
        pid: 'P1',
        arrivalTime: 2,
        burstTime: 3,
        priority: 1,
        completionTime: 8,
        turnaroundTime: 6,
        waitingTime: 3,
        responseTime: 3,
      },
    ])
  })

  it('measures response time from the first dispatch across preempted slices', () => {
    const preempted = proc('P1', 1, 5)
    const filler = proc('P2', 3, 4)
    // P1 runs 1-3, is preempted, resumes 7-10: waiting time must ignore the gap.
    const analysis = analyzeTimeline(
      [preempted, filler],
      [idle(0, 1), exec('p1', 1, 3), exec('p2', 3, 7), exec('p1', 7, 10)],
    )

    const [metric] = computeProcessMetrics([preempted, filler], analysis)

    expect(metric).toMatchObject({
      completionTime: 10,
      turnaroundTime: 9,
      waitingTime: 4,
      responseTime: 0,
    })
    // turnaround decomposes into CPU time + time spent waiting
    expect(metric.turnaroundTime).toBe(metric.burstTime + metric.waitingTime)
    expect(analysis.traces.get('p1')?.slices).toBe(2)
  })

  it('rejects processes that never ran or got the wrong CPU time', () => {
    const ran = proc('P1', 0, 3)
    const missing = proc('P2', 0, 2)

    expect(() =>
      computeProcessMetrics([ran, missing], analyzeTimeline([ran, missing], [exec('p1', 0, 3)])),
    ).toThrow(/never received CPU time/)

    expect(() => computeProcessMetrics([ran], analyzeTimeline([ran], [exec('p1', 0, 2)]))).toThrow(
      /executed 2 ms but its burst time is 3 ms/,
    )
  })
})

describe('computeSummary', () => {
  it('averages the per-process metrics and reports utilization and throughput', () => {
    // P1 waits 0 ms, P2 waits 1 ms, P3 waits 1 ms -> 0.666... rounds to 0.67
    const processes = [proc('P1', 0, 2), proc('P2', 1, 1), proc('P3', 2, 1)]
    const { analysis, metrics, summary } = buildMetrics(
      processes,
      [exec('p1', 0, 2), exec('p2', 2, 3), exec('p3', 3, 4)],
    )

    expect(summary).toEqual({
      avgTurnaroundTime: 2,
      avgWaitingTime: 0.67,
      avgResponseTime: 0.67,
      cpuUtilization: 100,
      throughput: 0.75,
    })
    expect(analysis.makespan).toBe(4)
    expect(metrics).toHaveLength(3)
  })

  it('counts CPU idle time against utilization and throughput', () => {
    const processes = [proc('P1', 5, 2)]
    const { analysis, summary } = buildMetrics(processes, [idle(0, 5), exec('p1', 5, 7)])

    expect(analysis.idleTime).toBe(5)
    expect(summary.cpuUtilization).toBe(28.57)
    // 1 process over the full 7 ms window (not over the 2 ms of busy time)
    expect(summary.throughput).toBe(0.1429)
  })

  it('returns zeros for an empty workload', () => {
    const analysis = analyzeTimeline([], [])
    expect(computeSummary(analysis, [])).toEqual({
      avgTurnaroundTime: 0,
      avgWaitingTime: 0,
      avgResponseTime: 0,
      cpuUtilization: 0,
      throughput: 0,
    })
  })

  it('rounds throughput to four decimals', () => {
    const processes = [proc('P1', 0, 17)]
    const { summary } = buildMetrics(processes, [exec('p1', 0, 17), idle(17, 21)])

    expect(summary.throughput).toBe(0.0476) // 1 / 21
    expect(summary.cpuUtilization).toBe(80.95) // 17 / 21
  })
})

describe('metrics from real schedules', () => {
  const workload: Process[] = [
    proc('P1', 0, 6, 2),
    proc('P2', 1, 4, 1),
    proc('P3', 2, 2, 3),
    proc('P4', 4, 5, 2),
  ]

  it('handles a preemptive SRTF schedule where processes run in several slices', () => {
    const result = shortestRemainingTimeFirst.run({ processes: workload })
    const { analysis, summary } = buildMetrics(workload, result.timeline)

    expect(analysis.traces.get('p1')?.slices).toBe(2)
    expect(analysis.traces.get('p2')?.slices).toBe(2)
    expect(analysis.idleTime).toBe(0)

    const byPid = Object.fromEntries(result.metrics.map((metric) => [metric.pid, metric]))
    expect(byPid.P1).toMatchObject({
      completionTime: 12,
      turnaroundTime: 12,
      waitingTime: 6,
      responseTime: 0,
    })
    expect(byPid.P2).toMatchObject({
      completionTime: 7,
      turnaroundTime: 6,
      waitingTime: 2,
      responseTime: 0,
    })
    expect(byPid.P4).toMatchObject({ completionTime: 17, waitingTime: 8, responseTime: 8 })
    expect(summary).toEqual({
      avgTurnaroundTime: 8.25,
      avgWaitingTime: 4,
      avgResponseTime: 2,
      cpuUtilization: 100,
      throughput: 0.2353,
    })
  })

  it('keeps Round Robin metrics correct across re-slices', () => {
    const processes = [proc('P1', 0, 4), proc('P2', 1, 2)]
    const result = roundRobin.run({ processes, timeQuantum: 2 })
    const { analysis, summary } = buildMetrics(processes, result.timeline)

    expect(result.timeline).toEqual([exec('p1', 0, 2), exec('p2', 2, 4), exec('p1', 4, 6)])
    expect(analysis.traces.get('p1')).toMatchObject({ slices: 2, completion: 6, executed: 4 })

    expect(result.metrics).toEqual([
      expect.objectContaining({
        pid: 'P1',
        completionTime: 6,
        turnaroundTime: 6,
        waitingTime: 2,
        responseTime: 0,
      }),
      expect.objectContaining({
        pid: 'P2',
        completionTime: 4,
        turnaroundTime: 3,
        waitingTime: 1,
        responseTime: 1,
      }),
    ])
    expect(summary).toEqual({
      avgTurnaroundTime: 4.5,
      avgWaitingTime: 1.5,
      avgResponseTime: 0.5,
      cpuUtilization: 100,
      throughput: 0.3333,
    })
  })

  it('keeps Round Robin metrics correct when the CPU idles between arrivals', () => {
    const processes = [proc('P1', 0, 4), proc('P2', 5, 3)]
    const result = roundRobin.run({ processes, timeQuantum: 2 })
    const { analysis, summary } = buildMetrics(processes, result.timeline)

    expect(result.timeline).toEqual([exec('p1', 0, 4), idle(4, 5), exec('p2', 5, 8)])
    expect(analysis.busyTime + analysis.idleTime).toBe(analysis.makespan)
    expect(summary.cpuUtilization).toBe(87.5)
    expect(summary.throughput).toBe(0.25)
    expect(summary.avgWaitingTime).toBe(0)
  })

  it('derives the same metrics for FCFS and for a hand-built identical timeline', () => {
    const processes = [proc('P1', 3, 2), proc('P2', 8, 4)]
    const fromAlgorithm = fcfs.run({ processes })
    const fromHandBuilt = buildMetrics(processes, [idle(0, 3), exec('p1', 3, 5), idle(5, 8), exec('p2', 8, 12)])

    expect(fromAlgorithm.metrics).toEqual(fromHandBuilt.metrics)
    expect(fromAlgorithm.summary).toEqual(fromHandBuilt.summary)
    // Both processes start the moment they arrive, so nothing is ever queued.
    expect(fromAlgorithm.summary).toEqual({
      avgTurnaroundTime: 3,
      avgWaitingTime: 0,
      avgResponseTime: 0,
      cpuUtilization: 50,
      throughput: 0.1667,
    })
  })

  it('keeps every metric internally consistent for all six algorithms', () => {
    const algorithms = [
      { id: 'fcfs', run: () => fcfs.run({ processes: workload }) },
      { id: 'srtf', run: () => shortestRemainingTimeFirst.run({ processes: workload }) },
      {
        id: 'round-robin',
        run: () => roundRobin.run({ processes: workload, timeQuantum: 3 }),
      },
    ]

    for (const algorithm of algorithms) {
      const result = algorithm.run()
      const { analysis } = buildMetrics(workload, result.timeline)

      expect(analysis.busyTime + analysis.idleTime).toBe(analysis.makespan)
      for (const metric of result.metrics) {
        // turnaround = CPU time + waiting, and the process cannot finish early
        expect(metric.turnaroundTime).toBe(metric.burstTime + metric.waitingTime)
        expect(metric.completionTime).toBeGreaterThanOrEqual(
          metric.arrivalTime + metric.burstTime,
        )
        expect(metric.responseTime).toBeGreaterThanOrEqual(0)
        expect(metric.responseTime).toBeLessThanOrEqual(metric.turnaroundTime)
        expect(metric.waitingTime).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
