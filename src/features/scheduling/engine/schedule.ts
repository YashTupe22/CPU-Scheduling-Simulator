import type { ProcessId, TimelineSegment } from '../types'

/**
 * Records a schedule as the simulation clock advances.
 *
 * The builder guarantees the timeline invariants that `finalizeSimulation`
 * validates: segments are ordered, contiguous, non-overlapping and never
 * predate a process's arrival. Adjacent slices of the same process are merged
 * so the timeline describes *what ran when*, not dispatch bookkeeping.
 */
export interface Schedule {
  /** Current simulation time (end of the last recorded segment). */
  readonly clock: number
  /** Runs `processId` for `duration` ms starting at the current clock. */
  run(processId: ProcessId, duration: number): { start: number; end: number }
  /** Leaves the CPU idle until `time`. No-op if the clock is already there. */
  idleUntil(time: number): void
  /** Snapshot of the segments recorded so far. */
  segments(): TimelineSegment[]
}

export function createSchedule(): Schedule {
  const segments: TimelineSegment[] = []
  let clock = 0

  return {
    get clock(): number {
      return clock
    },

    run(processId, duration) {
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error(`Cannot run process "${processId}" for ${duration} ms`)
      }

      const start = clock
      const end = start + duration
      const last = segments[segments.length - 1]

      if (last && last.kind === 'process' && last.processId === processId) {
        last.end = end
      } else {
        segments.push({ kind: 'process', processId, start, end })
      }

      clock = end
      return { start, end }
    },

    idleUntil(time) {
      if (time <= clock) return
      segments.push({ kind: 'idle', start: clock, end: time })
      clock = time
    },

    segments() {
      return segments.map((segment) => ({ ...segment }))
    },
  }
}
