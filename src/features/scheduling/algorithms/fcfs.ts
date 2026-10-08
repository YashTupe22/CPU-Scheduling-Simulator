import { createSchedule, defineAlgorithm, finalizeSimulation, sortProcessesByArrival } from '../engine'

/**
 * First Come, First Served — non-preemptive, strict arrival order.
 * Idle gaps are recorded whenever the next process has not arrived yet.
 */
export const fcfs = defineAlgorithm({
  id: 'fcfs',
  run({ processes }) {
    const schedule = createSchedule()

    for (const process of sortProcessesByArrival(processes)) {
      if (schedule.clock < process.arrivalTime) {
        schedule.idleUntil(process.arrivalTime)
      }
      schedule.run(process.id, process.burstTime)
    }

    return finalizeSimulation({ algorithmId: 'fcfs', processes, segments: schedule.segments() })
  },
})
