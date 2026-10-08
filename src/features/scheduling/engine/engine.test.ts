import { describe, expect, it } from 'vitest'
import { createSchedule } from './schedule'
import { finalizeSimulation } from './finalize'
import type { Process, TimelineSegment } from '../types'

const proc = (pid: string, arrivalTime: number, burstTime: number, priority = 1): Process => ({
  id: pid.toLowerCase(),
  pid,
  arrivalTime,
  burstTime,
  priority,
})

describe('createSchedule', () => {
  it('records contiguous execution and idle segments', () => {
    const schedule = createSchedule()
    schedule.idleUntil(3)
    const first = schedule.run('p1', 2)
    schedule.idleUntil(8)
    schedule.run('p2', 1)

    expect(first).toEqual({ start: 3, end: 5 })
    expect(schedule.clock).toBe(9)
    expect(schedule.segments()).toEqual([
      { kind: 'idle', start: 0, end: 3 },
      { kind: 'process', processId: 'p1', start: 3, end: 5 },
      { kind: 'idle', start: 5, end: 8 },
      { kind: 'process', processId: 'p2', start: 8, end: 9 },
    ])
  })

  it('treats idleUntil in the past as a no-op', () => {
    const schedule = createSchedule()
    schedule.run('p1', 4)
    schedule.idleUntil(2)
    expect(schedule.clock).toBe(4)
    expect(schedule.segments()).toHaveLength(1)
  })

  it('merges adjacent slices of the same process', () => {
    const schedule = createSchedule()
    schedule.run('p1', 2)
    schedule.run('p2', 1)
    schedule.run('p2', 3)

    expect(schedule.segments()).toEqual([
      { kind: 'process', processId: 'p1', start: 0, end: 2 },
      { kind: 'process', processId: 'p2', start: 2, end: 6 },
    ])
  })

  it('rejects non-positive execution slices', () => {
    const schedule = createSchedule()
    expect(() => schedule.run('p1', 0)).toThrow(/Cannot run process/)
    expect(() => schedule.run('p1', Number.NaN)).toThrow(/Cannot run process/)
  })

  it('returns copies so callers cannot mutate the timeline', () => {
    const schedule = createSchedule()
    schedule.run('p1', 2)
    const segments = schedule.segments()
    segments.pop()
    expect(schedule.segments()).toHaveLength(1)
  })
})

describe('finalizeSimulation', () => {
  const processes = [proc('P1', 0, 3), proc('P2', 1, 2)]

  const valid: TimelineSegment[] = [
    { kind: 'process', processId: 'p1', start: 0, end: 3 },
    { kind: 'idle', start: 3, end: 4 },
    { kind: 'process', processId: 'p2', start: 4, end: 6 },
  ]

  it('computes metrics and summary from the timeline', () => {
    const result = finalizeSimulation({
      algorithmId: 'test',
      processes,
      segments: valid,
      timeQuantum: 2,
    })

    expect(result.algorithmId).toBe('test')
    expect(result.timeQuantum).toBe(2)
    expect(result.metrics).toEqual([
      {
        processId: 'p1',
        pid: 'P1',
        arrivalTime: 0,
        burstTime: 3,
        priority: 1,
        completionTime: 3,
        turnaroundTime: 3,
        waitingTime: 0,
        responseTime: 0,
      },
      {
        processId: 'p2',
        pid: 'P2',
        arrivalTime: 1,
        burstTime: 2,
        priority: 1,
        completionTime: 6,
        turnaroundTime: 5,
        waitingTime: 3,
        responseTime: 3,
      },
    ])
    expect(result.summary).toEqual({
      avgTurnaroundTime: 4,
      avgWaitingTime: 1.5,
      avgResponseTime: 1.5,
      cpuUtilization: 83.33,
      throughput: 0.3333,
    })
  })

  it('returns an empty result for an empty workload', () => {
    const result = finalizeSimulation({ algorithmId: 'test', processes: [], segments: [] })
    expect(result.metrics).toEqual([])
    expect(result.timeline).toEqual([])
    expect(result.summary).toEqual({
      avgTurnaroundTime: 0,
      avgWaitingTime: 0,
      avgResponseTime: 0,
      cpuUtilization: 0,
      throughput: 0,
    })
  })

  it('rejects gaps and overlaps in the timeline', () => {
    expect(() =>
      finalizeSimulation({
        algorithmId: 'test',
        processes,
        segments: [
          { kind: 'process', processId: 'p1', start: 0, end: 3 },
          { kind: 'process', processId: 'p2', start: 5, end: 7 },
        ],
      }),
    ).toThrow(/not contiguous/)

    expect(() =>
      finalizeSimulation({
        algorithmId: 'test',
        processes,
        segments: [
          { kind: 'process', processId: 'p1', start: 0, end: 4 },
          { kind: 'process', processId: 'p2', start: 3, end: 5 },
        ],
      }),
    ).toThrow(/not contiguous/)
  })

  it('rejects zero-length segments', () => {
    expect(() =>
      finalizeSimulation({
        algorithmId: 'test',
        processes,
        segments: [{ kind: 'process', processId: 'p1', start: 0, end: 0 }],
      }),
    ).toThrow(/non-positive duration/)
  })

  it('rejects processes that never get the CPU', () => {
    expect(() =>
      finalizeSimulation({
        algorithmId: 'test',
        processes,
        segments: [{ kind: 'process', processId: 'p1', start: 0, end: 3 }],
      }),
    ).toThrow(/never received CPU time/)
  })

  it('rejects wrong amounts of CPU time', () => {
    expect(() =>
      finalizeSimulation({
        algorithmId: 'test',
        processes,
        segments: [
          { kind: 'process', processId: 'p1', start: 0, end: 2 },
          { kind: 'process', processId: 'p2', start: 2, end: 4 },
        ],
      }),
    ).toThrow(/executed 2 ms but its burst time is 3 ms/)
  })

  it('rejects execution before arrival and unknown processes', () => {
    expect(() =>
      finalizeSimulation({
        algorithmId: 'test',
        processes: [proc('P1', 5, 2)],
        segments: [{ kind: 'process', processId: 'p1', start: 0, end: 2 }],
      }),
    ).toThrow(/before its arrival/)

    expect(() =>
      finalizeSimulation({
        algorithmId: 'test',
        processes,
        segments: [{ kind: 'process', processId: 'nope', start: 0, end: 3 }],
      }),
    ).toThrow(/unknown process id/)
  })
})
