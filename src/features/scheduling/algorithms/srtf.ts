import {
  compareByRemainingTime,
  createSchedule,
  defineAlgorithm,
  finalizeSimulation,
  pickBest,
  sortProcessesByArrival,
  toWorkItems,
} from '../engine'
import type { WorkItem } from '../engine'

/**
 * Shortest Remaining Time First — preemptive SJF.
 *
 * Runs until the running process completes or the next process arrives,
 * whichever comes first, then re-decides. That single rule yields preemption
 * automatically: a newly arrived job with a shorter remaining time wins the
 * next selection.
 */
export const shortestRemainingTimeFirst = defineAlgorithm({
  id: 'srtf',
  run({ processes }) {
    const schedule = createSchedule()
    const arrivalOrder = sortProcessesByArrival(processes)
    const all: WorkItem[] = toWorkItems(arrivalOrder)
    const ready: WorkItem[] = []
    let arrived = 0
    let completed = 0

    while (completed < processes.length) {
      while (arrived < all.length && all[arrived].process.arrivalTime <= schedule.clock) {
        ready.push(all[arrived])
        arrived += 1
      }

      if (ready.length === 0) {
        schedule.idleUntil(all[arrived].process.arrivalTime)
        continue
      }

      const current = pickBest(ready, compareByRemainingTime)
      const nextArrival =
        arrived < all.length ? all[arrived].process.arrivalTime : Number.POSITIVE_INFINITY
      const stopAt = Math.min(schedule.clock + current.remaining, nextArrival)
      const ran = schedule.run(current.process.id, stopAt - schedule.clock)
      current.remaining -= ran.end - ran.start

      if (current.remaining === 0) {
        ready.splice(ready.indexOf(current), 1)
        completed += 1
      }
    }

    return finalizeSimulation({
      algorithmId: 'srtf',
      processes,
      segments: schedule.segments(),
    })
  },
})
