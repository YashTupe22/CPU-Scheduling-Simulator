import { colorForIndex } from '../results/ganttModel'
import { clamp } from '../../lib/math'
import type {
  ProcessId,
  ProcessMetrics,
  SimulationResult,
  TimelineSegment,
} from '../../features/scheduling/types'

/**
 * Playback model for the step-through simulator.
 *
 * Every value here is *derived* from the engine's `SimulationResult`
 * (timeline + metrics). The UI never re-decides which process runs next —
 * the timeline is the single source of truth, and this module only reads it.
 */

/** `SimulationResult` fields the playback model needs. */
export type PlaybackSource = Pick<SimulationResult, 'timeline' | 'metrics'>

const EPSILON = 1e-9

export interface RunningProcessState {
  kind: 'process'
  processId: ProcessId
  pid: string
  colorClass: string
  start: number
  end: number
  /** ms already spent inside the current slice. */
  elapsed: number
  /** ms left before this slice ends. */
  sliceRemaining: number
}

export interface IdleState {
  kind: 'idle'
  start: number
  end: number
  elapsed: number
  sliceRemaining: number
}

export interface FinishedState {
  kind: 'finished'
}

export type RunningState = RunningProcessState | IdleState | FinishedState

export interface QueueEntry {
  processId: ProcessId
  pid: string
  colorClass: string
  arrivalTime: number
  burstTime: number
  /** Burst time still owed to this process. */
  remaining: number
}

export interface CompletedEntry {
  processId: ProcessId
  pid: string
  colorClass: string
  completionTime: number
  turnaroundTime: number
}

export type ProcessPhase = 'running' | 'ready' | 'completed' | 'pending'

export interface ProgressEntry {
  processId: ProcessId
  pid: string
  colorClass: string
  burstTime: number
  /** CPU time consumed so far (fractional mid-slice). */
  executed: number
  /** Burst time still owed (0 once completed). */
  remaining: number
  phase: ProcessPhase
}

export interface PlaybackState {
  /** Current simulation time, clamped to `[0, span]`. */
  time: number
  span: number
  finished: boolean
  running: RunningState
  /** Processes that have arrived, are not running and are not done. */
  readyQueue: QueueEntry[]
  /** Processes finished by `time`, ordered by completion time. */
  completed: CompletedEntry[]
  /** Per-process remaining burst, ordered by arrival then pid. */
  progress: ProgressEntry[]
}

export function timelineSpan(timeline: readonly TimelineSegment[]): number {
  return timeline.length > 0 ? timeline[timeline.length - 1].end : 0
}

/**
 * Every time at which displayed state can change: slice boundaries plus
 * arrivals and completions from the metrics.
 */
export function collectStepBoundaries(source: PlaybackSource): number[] {
  const span = timelineSpan(source.timeline)
  const times = new Set<number>([0, span])

  for (const segment of source.timeline) {
    times.add(segment.start)
    times.add(segment.end)
  }
  for (const metric of source.metrics) {
    if (metric.arrivalTime >= 0 && metric.arrivalTime <= span) times.add(metric.arrivalTime)
    if (metric.completionTime >= 0 && metric.completionTime <= span) times.add(metric.completionTime)
  }

  return [...times].sort((a, b) => a - b)
}

/** First boundary strictly after `time` (or the span when none remains). */
export function nextStepTime(boundaries: readonly number[], time: number): number {
  for (const boundary of boundaries) {
    if (boundary > time + EPSILON) return boundary
  }
  return boundaries.length > 0 ? boundaries[boundaries.length - 1] : 0
}

export function formatTime(ms: number): string {
  const floored = Math.floor(ms * 10) / 10
  return Number.isInteger(floored) ? String(floored) : floored.toFixed(1)
}

export function buildPlaybackState(source: PlaybackSource, rawTime: number): PlaybackState {
  const { timeline, metrics } = source
  const span = timelineSpan(timeline)
  const time = clamp(rawTime, 0, span)

  const colorByProcess = new Map<ProcessId, string>()
  metrics.forEach((metric, index) => colorByProcess.set(metric.processId, colorForIndex(index)))

  // CPU time consumed per process up to `time`, straight from the timeline.
  const executedByProcess = new Map<ProcessId, number>()
  for (const segment of timeline) {
    if (segment.kind !== 'process') continue
    const covered = Math.min(time, segment.end) - segment.start
    if (covered <= 0) continue
    executedByProcess.set(
      segment.processId,
      (executedByProcess.get(segment.processId) ?? 0) + covered,
    )
  }

  const isDone = (metric: ProcessMetrics) => time + EPSILON >= metric.completionTime
  const hasArrived = (metric: ProcessMetrics) => time + EPSILON >= metric.arrivalTime
  const remainingOf = (metric: ProcessMetrics) =>
    isDone(metric) ? 0 : Math.max(0, metric.burstTime - (executedByProcess.get(metric.processId) ?? 0))

  const running = findRunning()
  const runningId = running.kind === 'process' ? running.processId : undefined

  const completed: CompletedEntry[] = metrics
    .filter(isDone)
    .map((metric) => ({
      processId: metric.processId,
      pid: metric.pid,
      colorClass: colorByProcess.get(metric.processId) ?? colorForIndex(0),
      completionTime: metric.completionTime,
      turnaroundTime: metric.turnaroundTime,
    }))
    .sort((a, b) => a.completionTime - b.completionTime || a.pid.localeCompare(b.pid))

  const readyQueue: QueueEntry[] = metrics
    .filter(
      (metric) =>
        hasArrived(metric) && !isDone(metric) && metric.processId !== runningId,
    )
    .map((metric) => ({
      processId: metric.processId,
      pid: metric.pid,
      colorClass: colorByProcess.get(metric.processId) ?? colorForIndex(0),
      arrivalTime: metric.arrivalTime,
      burstTime: metric.burstTime,
      remaining: remainingOf(metric),
    }))
    .sort((a, b) => a.arrivalTime - b.arrivalTime || a.pid.localeCompare(b.pid))

  const progress: ProgressEntry[] = metrics
    .map((metric) => {
      const executed = executedByProcess.get(metric.processId) ?? 0
      const done = isDone(metric)
      const phase: ProcessPhase = done
        ? 'completed'
        : metric.processId === runningId
          ? 'running'
          : hasArrived(metric)
            ? 'ready'
            : 'pending'
      return {
        processId: metric.processId,
        pid: metric.pid,
        colorClass: colorByProcess.get(metric.processId) ?? colorForIndex(0),
        burstTime: metric.burstTime,
        executed,
        remaining: done ? 0 : Math.max(0, metric.burstTime - executed),
        phase,
      }
    })
    .sort((a, b) => a.pid.localeCompare(b.pid))

  return {
    time,
    span,
    finished: time >= span,
    running,
    readyQueue,
    completed,
    progress,
  }

  function findRunning(): RunningState {
    if (span === 0 || time >= span) return { kind: 'finished' }

    for (const [index, segment] of timeline.entries()) {
      if (!(segment.start <= time && time < segment.end)) continue
      const elapsed = time - segment.start
      const sliceRemaining = segment.end - time

      if (segment.kind === 'idle') {
        return { kind: 'idle', start: segment.start, end: segment.end, elapsed, sliceRemaining }
      }

      const metric = metrics.find((candidate) => candidate.processId === segment.processId)
      return {
        kind: 'process',
        processId: segment.processId,
        pid: metric?.pid ?? segment.processId,
        colorClass: colorByProcess.get(segment.processId) ?? colorForIndex(index),
        start: segment.start,
        end: segment.end,
        elapsed,
        sliceRemaining,
      }
    }

    // Timeline segments are contiguous, so this is unreachable in practice.
    return { kind: 'finished' }
  }
}
