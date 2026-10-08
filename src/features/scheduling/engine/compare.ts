import type { Process } from '../types'

/** A process together with the CPU time it still needs. */
export interface WorkItem {
  process: Process
  remaining: number
}

export type Compare<T> = (a: T, b: T) => number

/** Deterministic, locale-independent label ordering (e.g. "P10" > "P2"). */
export function comparePid(a: Process, b: Process): number {
  if (a.pid === b.pid) return 0
  return a.pid < b.pid ? -1 : 1
}

export const compareByArrival: Compare<WorkItem> = (a, b) =>
  a.process.arrivalTime - b.process.arrivalTime || comparePid(a.process, b.process)

/** Shortest remaining time first; ties fall back to arrival order. */
export const compareByRemainingTime: Compare<WorkItem> = (a, b) =>
  a.remaining - b.remaining || compareByArrival(a, b)

/** Lowest priority value wins (lower number = higher priority). */
export const compareByPriority: Compare<WorkItem> = (a, b) =>
  a.process.priority - b.process.priority || compareByArrival(a, b)

/** Returns the best item according to `compare` (first wins ties). */
export function pickBest<T>(items: readonly T[], compare: Compare<T>): T {
  const first = items[0]
  if (first === undefined) {
    throw new Error('pickBest requires at least one candidate')
  }
  return items.reduce((best, item) => (compare(item, best) < 0 ? item : best), first)
}

/** Arrival ordering used by FCFS and by every arrival-driven loop. */
export function sortProcessesByArrival(processes: readonly Process[]): Process[] {
  return [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime || comparePid(a, b))
}

export function toWorkItems(processes: readonly Process[]): WorkItem[] {
  return processes.map((process) => ({ process, remaining: process.burstTime }))
}
