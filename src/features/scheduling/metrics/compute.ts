import { analyzeTimeline } from './analyze'
import type { TimelineAnalysis } from './analyze'
import type { Process, ProcessMetrics, SimulationSummary, TimelineSegment } from '../types'

export interface MetricsBundle {
  analysis: TimelineAnalysis
  metrics: ProcessMetrics[]
  summary: SimulationSummary
}

const round2 = (value: number): number => Math.round(value * 100) / 100
const round4 = (value: number): number => Math.round(value * 10_000) / 10_000

/**
 * Per-process metrics derived from the execution traces.
 *
 * - completion: the moment the process left the CPU for the last time
 * - turnaround: wall-clock time in the system (`completion - arrival`)
 * - waiting: turnaround minus actual CPU time (`= turnaround - burst`), which
 *   is correct even when the process ran in several preempted slices
 * - response: wait until the *first* dispatch, so preemption does not reset it
 *
 * Throws if a process never ran or received the wrong amount of CPU time.
 */
export function computeProcessMetrics(
  processes: readonly Process[],
  analysis: TimelineAnalysis,
): ProcessMetrics[] {
  return processes.map((process) => {
    const trace = analysis.traces.get(process.id)

    if (!trace) {
      throw new Error(`Process "${process.pid}" never received CPU time`)
    }
    if (trace.executed !== process.burstTime) {
      throw new Error(
        `Process "${process.pid}" executed ${trace.executed} ms but its burst time is ${process.burstTime} ms`,
      )
    }

    const turnaroundTime = trace.completion - process.arrivalTime
    return {
      processId: process.id,
      pid: process.pid,
      arrivalTime: process.arrivalTime,
      burstTime: process.burstTime,
      priority: process.priority,
      completionTime: trace.completion,
      turnaroundTime,
      waitingTime: turnaroundTime - process.burstTime,
      responseTime: trace.firstStart - process.arrivalTime,
    }
  })
}

/**
 * Schedule-wide averages, CPU utilization and throughput.
 *
 * The measurement window is the whole makespan (0 → end of timeline), so CPU
 * idle periods lower utilization and throughput — they are real elapsed time.
 */
export function computeSummary(
  analysis: TimelineAnalysis,
  metrics: readonly ProcessMetrics[],
): SimulationSummary {
  const { makespan, busyTime, completed } = analysis

  return {
    avgTurnaroundTime: average(metrics, (metric) => metric.turnaroundTime),
    avgWaitingTime: average(metrics, (metric) => metric.waitingTime),
    avgResponseTime: average(metrics, (metric) => metric.responseTime),
    cpuUtilization: makespan > 0 ? round2((busyTime / makespan) * 100) : 0,
    throughput: makespan > 0 ? round4(completed / makespan) : 0,
  }
}

/** Full metric calculation for a raw timeline. Throws on contract violations. */
export function buildMetrics(
  processes: readonly Process[],
  segments: readonly TimelineSegment[],
): MetricsBundle {
  const analysis = analyzeTimeline(processes, segments)
  const metrics = computeProcessMetrics(processes, analysis)
  return { analysis, metrics, summary: computeSummary(analysis, metrics) }
}

function average<T>(items: readonly T[], select: (item: T) => number): number {
  if (items.length === 0) return 0
  const total = items.reduce((sum, item) => sum + select(item), 0)
  return round2(total / items.length)
}
