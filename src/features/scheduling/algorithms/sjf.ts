import {
  compareByRemainingTime,
  createSchedule,
  defineAlgorithm,
  finalizeSimulation,
  pickBest,
  toWorkItems,
} from '../engine'
import type { WorkItem } from '../engine'

/**
 * Shortest Job First (non-preemptive).
 *
 * At every decision point the ready set is the set of processes that have
 * arrived by the current clock; the shortest burst wins and then runs to
 * completion, so arrivals during its run never interrupt it.
 */
export const shortestJobFirst = defineAlgorithm({
  id: 'sjf',
  run({ processes }) {
    const schedule = createSchedule()
    const pending: WorkItem[] = toWorkItems(processes)

    while (pending.length > 0) {
      const ready = pending.filter((item) => item.process.arrivalTime <= schedule.clock)

      if (ready.length === 0) {
        schedule.idleUntil(earliestArrival(pending))
        continue
      }

      const next = pickBest(ready, compareByRemainingTime)
      schedule.run(next.process.id, next.remaining)
      pending.splice(pending.indexOf(next), 1)
    }

    return finalizeSimulation({ algorithmId: 'sjf', processes, segments: schedule.segments() })
  },
})

function earliestArrival(pending: readonly WorkItem[]): number {
  return Math.min(...pending.map((item) => item.process.arrivalTime))
}
