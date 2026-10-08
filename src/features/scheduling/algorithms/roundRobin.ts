import {
  createSchedule,
  defineAlgorithm,
  finalizeSimulation,
  sortProcessesByArrival,
  toWorkItems,
} from '../engine'
import type { WorkItem } from '../engine'

/**
 * Round Robin — fair, time-sliced scheduling.
 *
 * The ready queue is FIFO in arrival order. Each dispatch runs for at most one
 * time quantum; on expiry the process moves to the back of the queue *after*
 * everybody that arrived during its slice has been enqueued, which is what
 * gives Round Robin its fairness guarantee.
 */
export const roundRobin = defineAlgorithm({
  id: 'round-robin',
  run({ processes, timeQuantum }) {
    if (timeQuantum === undefined || !Number.isInteger(timeQuantum) || timeQuantum < 1) {
      throw new Error('Round Robin requires a whole-number time quantum of at least 1 ms')
    }

    const schedule = createSchedule()
    const arrivalOrder = sortProcessesByArrival(processes)
    const all: WorkItem[] = toWorkItems(arrivalOrder)
    const queue: WorkItem[] = []
    let arrived = 0
    let completed = 0

    const admitArrivals = () => {
      while (arrived < all.length && all[arrived].process.arrivalTime <= schedule.clock) {
        queue.push(all[arrived])
        arrived += 1
      }
    }

    while (completed < processes.length) {
      admitArrivals()

      if (queue.length === 0) {
        schedule.idleUntil(all[arrived].process.arrivalTime)
        continue
      }

      const current = queue[0]
      const ran = schedule.run(current.process.id, Math.min(timeQuantum, current.remaining))
      current.remaining -= ran.end - ran.start
      queue.shift()

      // Arrivals during the slice queue up before the interrupted process.
      admitArrivals()

      if (current.remaining === 0) {
        completed += 1
      } else {
        queue.push(current)
      }
    }

    return finalizeSimulation({
      algorithmId: 'round-robin',
      processes,
      segments: schedule.segments(),
      timeQuantum,
    })
  },
})
