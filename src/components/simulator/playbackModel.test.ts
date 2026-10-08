import { describe, expect, it } from 'vitest'
import {
  buildPlaybackState,
  collectStepBoundaries,
  formatTime,
  nextStepTime,
  timelineSpan,
} from './playbackModel'
import type { PlaybackSource } from './playbackModel'
import type { Process, ProcessMetrics, TimelineSegment } from '../../features/scheduling/types'

const proc = (pid: string, arrivalTime: number, burstTime: number): Process => ({
  id: pid.toLowerCase(),
  pid,
  arrivalTime,
  burstTime,
  priority: 1,
})

const exec = (processId: string, start: number, end: number): TimelineSegment => ({
  kind: 'process',
  processId,
  start,
  end,
})

const idle = (start: number, end: number): TimelineSegment => ({ kind: 'idle', start, end })

const metric = (
  processId: string,
  pid: string,
  arrivalTime: number,
  burstTime: number,
  completionTime: number,
): ProcessMetrics => ({
  processId,
  pid,
  arrivalTime,
  burstTime,
  priority: 1,
  completionTime,
  turnaroundTime: completionTime - arrivalTime,
  waitingTime: completionTime - arrivalTime - burstTime,
  responseTime: completionTime - arrivalTime - burstTime,
})

/**
 * FCFS-flavoured reference schedule (plausible engine output):
 *   idle 0–2 | P1 2–4 | P2 4–9 | P1 9–11
 */
const reference: PlaybackSource = {
  timeline: [idle(0, 2), exec('p1', 2, 4), exec('p2', 4, 9), exec('p1', 9, 11)],
  metrics: [metric('p1', 'P1', 2, 4, 11), metric('p2', 'P2', 4, 5, 9)],
}

/**
 * SRTF-flavoured reference schedule (preemption):
 *   P1 0–1 | P2 1–3 | P1 3–4
 */
const preemptive: PlaybackSource = {
  timeline: [exec('p1', 0, 1), exec('p2', 1, 3), exec('p1', 3, 4)],
  metrics: [metric('p1', 'P1', 0, 2, 4), metric('p2', 'P2', 1, 2, 3)],
}

describe('timelineSpan', () => {
  it('reads the span off the last segment', () => {
    expect(timelineSpan(reference.timeline)).toBe(11)
    expect(timelineSpan([])).toBe(0)
  })
})

describe('collectStepBoundaries / nextStepTime', () => {
  it('collects slice, arrival and completion times', () => {
    expect(collectStepBoundaries(reference)).toEqual([0, 2, 4, 9, 11])
  })

  it('walks to the next boundary and stops at the span', () => {
    const boundaries = collectStepBoundaries(reference)
    expect(nextStepTime(boundaries, 0)).toBe(2)
    expect(nextStepTime(boundaries, 2)).toBe(4)
    expect(nextStepTime(boundaries, 3.5)).toBe(4)
    expect(nextStepTime(boundaries, 11)).toBe(11)
  })

  it('returns zero for an empty schedule', () => {
    expect(nextStepTime([0], 0)).toBe(0)
  })
})

describe('buildPlaybackState', () => {
  it('starts with the CPU idle and nothing queued', () => {
    const state = buildPlaybackState(reference, 0)

    expect(state.finished).toBe(false)
    expect(state.running).toMatchObject({ kind: 'idle', start: 0, end: 2, elapsed: 0 })
    expect(state.readyQueue).toEqual([])
    expect(state.completed).toEqual([])
    expect(state.progress.map((entry) => entry.phase)).toEqual(['pending', 'pending'])
    expect(state.progress.map((entry) => entry.remaining)).toEqual([4, 5])
  })

  it('reports the running process mid-slice with remaining burst', () => {
    const state = buildPlaybackState(reference, 3)

    expect(state.running).toMatchObject({
      kind: 'process',
      pid: 'P1',
      start: 2,
      end: 4,
      elapsed: 1,
      sliceRemaining: 1,
    })
    expect(state.readyQueue).toEqual([])
    expect(state.progress.find((entry) => entry.pid === 'P1')).toMatchObject({
      phase: 'running',
      executed: 1,
      remaining: 3,
    })
    expect(state.progress.find((entry) => entry.pid === 'P2')?.phase).toBe('pending')
  })

  it('puts the preempted process at the head of the ready queue', () => {
    const state = buildPlaybackState(reference, 6)

    expect(state.running).toMatchObject({ kind: 'process', pid: 'P2', elapsed: 2 })
    expect(state.readyQueue).toHaveLength(1)
    expect(state.readyQueue[0]).toMatchObject({
      pid: 'P1',
      arrivalTime: 2,
      remaining: 2,
    })
    expect(state.readyQueue[0].colorClass).toContain('bg-')
    expect(state.completed).toEqual([])
  })

  it('lists completions as they happen', () => {
    const state = buildPlaybackState(reference, 9)

    expect(state.completed).toHaveLength(1)
    expect(state.completed[0]).toMatchObject({ pid: 'P2', completionTime: 9, turnaroundTime: 5 })
    expect(state.running).toMatchObject({ kind: 'process', pid: 'P1', elapsed: 0 })
    expect(state.readyQueue).toEqual([])
  })

  it('finishes at the span with every process completed and nothing owed', () => {
    const state = buildPlaybackState(reference, 11)

    expect(state.finished).toBe(true)
    expect(state.running).toEqual({ kind: 'finished' })
    expect(state.readyQueue).toEqual([])
    expect(state.completed.map((entry) => entry.pid)).toEqual(['P2', 'P1'])
    expect(state.progress.every((entry) => entry.remaining === 0)).toBe(true)
    expect(state.progress.every((entry) => entry.phase === 'completed')).toBe(true)
  })

  it('clamps out-of-range times instead of overflowing the timeline', () => {
    const past = buildPlaybackState(reference, 40)
    expect(past.time).toBe(11)
    expect(past.finished).toBe(true)

    const before = buildPlaybackState(reference, -5)
    expect(before.time).toBe(0)
    expect(before.running.kind).toBe('idle')
  })

  it('tracks remaining burst across a preemption', () => {
    const midSlice = buildPlaybackState(preemptive, 0.5)
    expect(midSlice.running).toMatchObject({ kind: 'process', pid: 'P1', elapsed: 0.5 })
    expect(midSlice.progress.find((entry) => entry.pid === 'P1')?.remaining).toBe(1.5)

    const waiting = buildPlaybackState(preemptive, 2)
    expect(waiting.running).toMatchObject({ kind: 'process', pid: 'P2' })
    expect(waiting.readyQueue.map((entry) => entry.pid)).toEqual(['P1'])
    expect(waiting.progress.find((entry) => entry.pid === 'P1')).toMatchObject({
      phase: 'ready',
      executed: 1,
      remaining: 1,
    })

    const done = buildPlaybackState(preemptive, 4)
    expect(done.finished).toBe(true)
    expect(done.progress.map((entry) => entry.remaining)).toEqual([0, 0])
  })

  it('handles an empty timeline without dividing by zero', () => {
    const state = buildPlaybackState({ timeline: [], metrics: [] }, 0)

    expect(state.span).toBe(0)
    expect(state.finished).toBe(true)
    expect(state.running).toEqual({ kind: 'finished' })
    expect(state.readyQueue).toEqual([])
    expect(state.completed).toEqual([])
    expect(state.progress).toEqual([])
  })
})

describe('formatTime', () => {
  it('keeps integers clean and trims fractional playback time', () => {
    expect(formatTime(0)).toBe('0')
    expect(formatTime(11)).toBe('11')
    expect(formatTime(2.5)).toBe('2.5')
    expect(formatTime(1.2499)).toBe('1.2')
  })
})

describe('engine round trip', () => {
  it('plays back a real Round Robin result end to end', async () => {
    const { roundRobin } = await import('../../features/scheduling/algorithms/roundRobin')
    const result = roundRobin.run({
      processes: [proc('P1', 0, 5), proc('P2', 1, 3), proc('P3', 2, 2)],
      timeQuantum: 2,
    })

    const boundaries = collectStepBoundaries(result)
    const final = buildPlaybackState(result, timelineSpan(result.timeline))

    expect(final.finished).toBe(true)
    expect(final.progress.every((entry) => entry.remaining === 0)).toBe(true)
    expect(final.completed).toHaveLength(3)

    // Stepping through boundaries must visit every state exactly once.
    let previous = 0
    const states = boundaries.map((boundary) => {
      expect(boundary).toBeGreaterThanOrEqual(previous)
      previous = boundary
      return buildPlaybackState(result, boundary)
    })
    expect(states[0].running.kind).not.toBe('finished')

    // Every "ready" entry must be an arrived, unfinished, non-running process.
    for (const state of states) {
      const runningId =
        state.running.kind === 'process' ? state.running.processId : undefined
      for (const entry of state.readyQueue) {
        const source = result.metrics.find((m) => m.processId === entry.processId)
        expect(source).toBeDefined()
        expect(source!.arrivalTime).toBeLessThanOrEqual(state.time)
        expect(source!.completionTime).toBeGreaterThan(state.time)
        expect(entry.processId).not.toBe(runningId)
      }
    }

    expect(nextStepTime(boundaries, 0)).toBeGreaterThan(0)
    expect(nextStepTime(boundaries, 10_000)).toBe(timelineSpan(result.timeline))
  })
})
