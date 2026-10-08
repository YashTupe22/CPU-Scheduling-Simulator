import {
  compareByPriority,
  createSchedule,
  defineAlgorithm,
  finalizeSimulation,
  pickBest,
  toWorkItems,
} from '../engine'
import type { WorkItem } from '../engine'

/**
 * Priority scheduling, non-preemptive.
 *
 * The lowest priority value (lower number = higher priority) among arrived
 * processes is dispatched and runs to completion; ties break by arrival time
 * and then by label.
 */
export const priorityNonPreemptive = defineAlgorithm({
  id: 'priority-np',
  run({ processes }) {
    const schedule = createSchedule()
    const pending: WorkItem[] = toWorkItems(processes)

    while (pending.length > 0) {
      const ready = pending.filter((item) => item.process.arrivalTime <= schedule.clock)

      if (ready.length === 0) {
        schedule.idleUntil(earliestArrival(pending))
        continue
      }

      const next = pickBest(ready, compareByPriority)
      schedule.run(next.process.id, next.remaining)
      pending.splice(pending.indexOf(next), 1)
    }

    return finalizeSimulation({
      algorithmId: 'priority-np',
      processes,
      segments: schedule.segments(),
    })
  },
})

function earliestArrival(pending: readonly WorkItem[]): number {
  return Math.min(...pending.map((item) => item.process.arrivalTime))
}
