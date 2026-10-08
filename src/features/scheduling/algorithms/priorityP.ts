import {
  compareByPriority,
  createSchedule,
  defineAlgorithm,
  finalizeSimulation,
  pickBest,
  sortProcessesByArrival,
  toWorkItems,
} from '../engine'
import type { WorkItem } from '../engine'

/**
 * Priority scheduling, preemptive.
 *
 * Runs until the running process completes or the next process arrives,
 * whichever comes first, then re-decides by priority — so a better-priority
 * arrival takes the CPU immediately. Because a new arrival always has a later
 * arrival time than the running process, equal priorities never cause a
 * needless context switch.
 */
export const priorityPreemptive = defineAlgorithm({
  id: 'priority-p',
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

      const current = pickBest(ready, compareByPriority)
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
      algorithmId: 'priority-p',
      processes,
      segments: schedule.segments(),
    })
  },
})
