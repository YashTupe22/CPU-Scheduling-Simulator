/**
 * Domain types for the CPU scheduling simulator.
 *
 * Scheduling algorithms implement `SchedulingAlgorithm` and are registered in
 * `./registry`, so adding a new algorithm never requires touching the UI.
 */

export type ProcessId = string

export interface Process {
  /** Stable internal id (React key). */
  id: ProcessId
  /** User-facing label, e.g. "P1". Must be unique. */
  pid: string
  arrivalTime: number
  burstTime: number
  priority: number
}

/** Raw table row before validation. Values are kept as strings while editing. */
export interface ProcessDraft {
  id: ProcessId
  pid: string
  arrivalTime: string
  burstTime: string
  priority: string
}

export type ProcessField = keyof Omit<ProcessDraft, 'id'>

export type RowErrors = Partial<Record<ProcessField, string>>

/** The CPU executed a process during `[start, end)`. */
export interface ExecutionSegment {
  kind: 'process'
  processId: ProcessId
  start: number
  end: number
}

/** The CPU had nothing to run during `[start, end)` (no process had arrived). */
export interface IdleSegment {
  kind: 'idle'
  start: number
  end: number
}

/**
 * One slice of the Gantt timeline. Segments are ordered, contiguous and
 * non-overlapping: `segments[i + 1].start === segments[i].end`.
 */
export type TimelineSegment = ExecutionSegment | IdleSegment

export interface ProcessMetrics {
  processId: ProcessId
  pid: string
  arrivalTime: number
  burstTime: number
  priority: number
  /** Time at which the process finished. */
  completionTime: number
  /** completionTime - arrivalTime */
  turnaroundTime: number
  /** turnaroundTime - burstTime */
  waitingTime: number
  /** Time of the first CPU dispatch - arrivalTime */
  responseTime: number
}

export interface SimulationSummary {
  /** Arithmetic mean of `ProcessMetrics.turnaroundTime`. */
  avgTurnaroundTime: number
  /** Arithmetic mean of `ProcessMetrics.waitingTime`. */
  avgWaitingTime: number
  /** Arithmetic mean of `ProcessMetrics.responseTime`. */
  avgResponseTime: number
  /** Share of the makespan spent executing processes, as a percentage (0-100). */
  cpuUtilization: number
  /**
   * Completed processes per unit time: `processCount / makespan`, where the
   * makespan runs from 0 to the end of the timeline (idle periods included).
   * Rounded to 4 decimals; 0 for an empty workload.
   */
  throughput: number
}

export interface SimulationResult {
  algorithmId: string
  timeQuantum?: number
  timeline: TimelineSegment[]
  metrics: ProcessMetrics[]
  summary: SimulationSummary
}

export interface SimulationInput {
  processes: Process[]
  /** Required by Round Robin; ignored by every other algorithm. */
  timeQuantum?: number
}

/**
 * Contract every scheduling algorithm must satisfy.
 *
 * Implementations live in `./algorithms/*` and are added to the app through
 * `registerAlgorithm(algorithm)`:
 *
 *   export const fcfs: SchedulingAlgorithm = {
 *     id: 'fcfs',
 *     run({ processes }) { ... }
 *   }
 *
 * `run` must return a validated `SimulationResult`; building it with
 * `finalizeSimulation` from `../engine` guarantees the shared invariants.
 */
export interface SchedulingAlgorithm {
  id: string
  run(input: SimulationInput): SimulationResult
}
