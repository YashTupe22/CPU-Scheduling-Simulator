import { registerAlgorithm } from '../registry'
import { fcfs } from './fcfs'
import { priorityNonPreemptive } from './priorityNp'
import { priorityPreemptive } from './priorityP'
import { roundRobin } from './roundRobin'
import { shortestJobFirst } from './sjf'
import { shortestRemainingTimeFirst } from './srtf'

/**
 * Every algorithm shipped with the simulator.
 *
 * Phase 3+ adds a new file here and one line below — no UI changes.
 */
export const builtinAlgorithms = [
  fcfs,
  shortestJobFirst,
  shortestRemainingTimeFirst,
  priorityNonPreemptive,
  priorityPreemptive,
  roundRobin,
] as const

/** Idempotent: installs the built-in algorithms into the registry. */
export function registerBuiltinAlgorithms(): void {
  for (const algorithm of builtinAlgorithms) {
    registerAlgorithm(algorithm)
  }
}

export {
  fcfs,
  shortestJobFirst,
  shortestRemainingTimeFirst,
  priorityNonPreemptive,
  priorityPreemptive,
  roundRobin,
}
