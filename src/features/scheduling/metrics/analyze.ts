import type { Process, ProcessId, TimelineSegment } from '../types'

/**
 * What actually happened to one process on the CPU, derived from the raw
 * timeline. Multiple slices of the same process are merged into a single
 * trace: `firstStart` is the earliest dispatch, `completion` the last exit,
 * `executed` the sum of every slice and `slices` how many there were.
 */
export interface ProcessTrace {
  processId: ProcessId
  firstStart: number
  completion: number
  /** Total time actually spent on the CPU (equals burst time once validated). */
  executed: number
  /** Number of CPU slices — greater than 1 means preemption or re-slicing. */
  slices: number
}

export interface TimelineAnalysis {
  /** Per-process traces, keyed by `Process.id`. Only processes that ran appear. */
  traces: ReadonlyMap<ProcessId, ProcessTrace>
  /** End of the timeline: 0 for an empty schedule, otherwise the last `end`. */
  makespan: number
  /** Total time spent executing processes. */
  busyTime: number
  /** Total time the CPU was idle. `busyTime + idleTime === makespan`. */
  idleTime: number
  /** Number of distinct processes that received CPU time. */
  completed: number
}

/**
 * Walks the timeline once, validating its structural contract and collecting
 * per-process execution traces plus idle/busy/makespan totals.
 *
 * Throws when the timeline violates the contract: non-positive segments,
 * gaps or overlaps, unknown process ids, or execution before arrival.
 */
export function analyzeTimeline(
  processes: readonly Process[],
  segments: readonly TimelineSegment[],
): TimelineAnalysis {
  const byId = new Map<ProcessId, Process>(processes.map((process) => [process.id, process]))
  const traces = new Map<ProcessId, ProcessTrace>()
  let cursor = 0
  let busyTime = 0
  let idleTime = 0

  segments.forEach((segment, index) => {
    if (segment.end <= segment.start) {
      throw new Error(`Timeline segment ${index} has a non-positive duration`)
    }
    if (segment.start !== cursor) {
      throw new Error(
        `Timeline is not contiguous at segment ${index}: expected start ${cursor}, got ${segment.start}`,
      )
    }
    cursor = segment.end

    if (segment.kind === 'idle') {
      idleTime += segment.end - segment.start
      return
    }

    const process = byId.get(segment.processId)
    if (!process) {
      throw new Error(`Timeline references unknown process id "${segment.processId}"`)
    }
    if (segment.start < process.arrivalTime) {
      throw new Error(
        `Process "${process.pid}" runs at ${segment.start}, before its arrival at ${process.arrivalTime}`,
      )
    }

    const duration = segment.end - segment.start
    busyTime += duration

    const existing = traces.get(process.id)
    if (existing) {
      existing.firstStart = Math.min(existing.firstStart, segment.start)
      existing.completion = Math.max(existing.completion, segment.end)
      existing.executed += duration
      existing.slices += 1
      return
    }

    traces.set(process.id, {
      processId: process.id,
      firstStart: segment.start,
      completion: segment.end,
      executed: duration,
      slices: 1,
    })
  })

  return {
    traces,
    makespan: cursor,
    busyTime,
    idleTime,
    completed: traces.size,
  }
}
