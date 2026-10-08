import type { ProcessId, ProcessMetrics, TimelineSegment } from '../../features/scheduling/types'

/**
 * Presentation model for the Gantt chart.
 *
 * Everything here is derived from the engine's `SimulationResult` — block
 * positions are computed as percentages of the timeline span, so no process
 * position is ever hardcoded.
 */

/** One class per process colour. Longer lists wrap around. */
export const PROCESS_COLORS = [
  'bg-indigo-600',
  'bg-rose-600',
  'bg-emerald-700',
  'bg-amber-700',
  'bg-sky-700',
  'bg-violet-700',
  'bg-teal-700',
  'bg-orange-700',
] as const

/** Hatched styling for CPU idle periods (see `index.css`). */
export const IDLE_BLOCK_CLASS = 'gantt-idle'

export interface BaseBlock {
  /** Stable React key, unique within one timeline. */
  key: string
  index: number
  start: number
  end: number
  duration: number
  /** Horizontal offset as a percentage of the timeline span. */
  leftPct: number
  /** Width as a percentage of the timeline span. */
  widthPct: number
  /** Horizontal centre, used to anchor the details card. */
  centerPct: number
}

export interface ProcessBlock extends BaseBlock {
  kind: 'process'
  processId: ProcessId
  pid: string
  colorClass: string
  arrivalTime?: number
  completionTime?: number
  /** 1-based position of this slice within the process's slices. */
  sliceIndex: number
  /** Total number of slices the process has in the timeline. */
  sliceCount: number
}

export interface IdleBlock extends BaseBlock {
  kind: 'idle'
}

export type GanttBlock = ProcessBlock | IdleBlock

export interface GanttLegendEntry {
  processId: ProcessId
  pid: string
  colorClass: string
  arrivalTime: number
  burstTime: number
  /** How many separate CPU slices this process got (1 unless preempted). */
  sliceCount: number
}

export interface GanttModel {
  /** End of the timeline in ms (0 when empty). */
  span: number
  /** Axis tick step in ms. */
  step: number
  ticks: number[]
  blocks: GanttBlock[]
  legend: GanttLegendEntry[]
  idleTime: number
  processCount: number
}

const TICK_TARGET = 10
const NICE_STEPS = [1, 2, 5, 10, 15, 20, 25, 50, 100, 200, 250, 500, 1000, 2000]

export function niceStep(span: number): number {
  if (span <= 0) return 1
  const raw = span / TICK_TARGET
  return NICE_STEPS.find((candidate) => candidate >= raw) ?? Math.ceil(raw)
}

export function buildTicks(span: number, step: number): number[] {
  if (span <= 0 || step <= 0) return []
  const ticks: number[] = []
  for (let time = 0; time <= span; time += step) ticks.push(time)
  const last = ticks[ticks.length - 1] ?? 0
  // Skip a final tick that would sit on top of its neighbour.
  if (span - last > step * 0.5) ticks.push(span)
  return ticks
}

export function colorForIndex(index: number): string {
  return PROCESS_COLORS[((index % PROCESS_COLORS.length) + PROCESS_COLORS.length) % PROCESS_COLORS.length]
}

/**
 * Turns a raw engine timeline into positioned blocks, axis ticks and a legend.
 *
 * Guarantees:
 * - one block per timeline segment, in order
 * - `leftPct + widthPct` of the last block equals 100 (the whole span is covered)
 * - process slices are numbered `n / total` for preemptive algorithms
 */
export function buildGanttModel(
  timeline: readonly TimelineSegment[],
  metrics: readonly ProcessMetrics[],
): GanttModel {
  const span = timeline.length > 0 ? timeline[timeline.length - 1].end : 0

  const metricByProcess = new Map<ProcessId, ProcessMetrics>()
  const colorIndexByProcess = new Map<ProcessId, number>()
  metrics.forEach((metric, index) => {
    metricByProcess.set(metric.processId, metric)
    colorIndexByProcess.set(metric.processId, index)
  })

  const sliceTotals = new Map<ProcessId, number>()
  for (const segment of timeline) {
    if (segment.kind !== 'process') continue
    sliceTotals.set(segment.processId, (sliceTotals.get(segment.processId) ?? 0) + 1)
  }
  const sliceSeen = new Map<ProcessId, number>()
  let idleTime = 0

  const blocks: GanttBlock[] = timeline.map((segment, index) => {
    const duration = segment.end - segment.start
    const leftPct = span > 0 ? (segment.start / span) * 100 : 0
    const widthPct = span > 0 ? (duration / span) * 100 : 0
    const base: BaseBlock = {
      key: `segment-${index}`,
      index,
      start: segment.start,
      end: segment.end,
      duration,
      leftPct,
      widthPct,
      centerPct: leftPct + widthPct / 2,
    }

    if (segment.kind === 'idle') {
      idleTime += duration
      return { ...base, kind: 'idle' }
    }

    const sliceIndex = (sliceSeen.get(segment.processId) ?? 0) + 1
    sliceSeen.set(segment.processId, sliceIndex)

    const metric = metricByProcess.get(segment.processId)
    const colorIndex = colorIndexByProcess.get(segment.processId)

    return {
      ...base,
      kind: 'process',
      processId: segment.processId,
      pid: metric?.pid ?? segment.processId,
      colorClass: colorIndex !== undefined ? colorForIndex(colorIndex) : colorForIndex(index),
      arrivalTime: metric?.arrivalTime,
      completionTime: metric?.completionTime,
      sliceIndex,
      sliceCount: sliceTotals.get(segment.processId) ?? sliceIndex,
    }
  })

  const legend: GanttLegendEntry[] = metrics.map((metric, index) => ({
    processId: metric.processId,
    pid: metric.pid,
    colorClass: colorForIndex(index),
    arrivalTime: metric.arrivalTime,
    burstTime: metric.burstTime,
    sliceCount: sliceTotals.get(metric.processId) ?? 0,
  }))

  const step = niceStep(span)

  return {
    span,
    step,
    ticks: buildTicks(span, step),
    blocks,
    legend,
    idleTime,
    processCount: metrics.length,
  }
}
