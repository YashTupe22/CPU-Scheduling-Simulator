import { buildMetrics } from '../metrics'
import type { Process, SimulationResult, TimelineSegment } from '../types'

export interface FinalizeInput {
  algorithmId: string
  processes: readonly Process[]
  segments: readonly TimelineSegment[]
  timeQuantum?: number
}

/**
 * Validates an algorithm's raw timeline and turns it into a `SimulationResult`.
 *
 * Timeline contract, per-process metrics and schedule-wide summary all live in
 * the metrics engine (`../metrics`) — this function only assembles the result,
 * so every algorithm and every test goes through exactly the same math.
 *
 * Throws when the schedule breaks a contract invariant (gaps, overlaps, a
 * process running before it arrives, missing or surplus CPU time).
 */
export function finalizeSimulation({
  algorithmId,
  processes,
  segments,
  timeQuantum,
}: FinalizeInput): SimulationResult {
  const { metrics, summary } = buildMetrics(processes, segments)

  return {
    algorithmId,
    ...(timeQuantum !== undefined ? { timeQuantum } : {}),
    timeline: segments.map((segment) => ({ ...segment })),
    metrics,
    summary,
  }
}
