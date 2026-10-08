import { describe, expect, it } from 'vitest'
import { buildGanttModel, buildTicks, colorForIndex, niceStep } from './ganttModel'
import type { ProcessMetrics, TimelineSegment } from '../../features/scheduling/types'

const exec = (processId: string, start: number, end: number): TimelineSegment => ({
  kind: 'process',
  processId,
  start,
  end,
})

const idle = (start: number, end: number): TimelineSegment => ({ kind: 'idle', start, end })

const metric = (
  processId: string,
  pid: string,
  arrivalTime: number,
  burstTime: number,
  completionTime: number,
): ProcessMetrics => ({
  processId,
  pid,
  arrivalTime,
  burstTime,
  priority: 1,
  completionTime,
  turnaroundTime: completionTime - arrivalTime,
  waitingTime: completionTime - arrivalTime - burstTime,
  responseTime: 0,
})

describe('niceStep', () => {
  it('returns 1 for tiny spans', () => {
    expect(niceStep(0)).toBe(1)
    expect(niceStep(7)).toBe(1)
  })

  it('picks round tick steps for larger spans', () => {
    expect(niceStep(50)).toBe(5)
    expect(niceStep(240)).toBe(25)
    expect(niceStep(900)).toBe(100)
  })
})

describe('buildTicks', () => {
  it('starts at zero and ends at or beyond the span', () => {
    expect(buildTicks(10, 2)).toEqual([0, 2, 4, 6, 8, 10])
  })

  it('appends the span when it lands well past the last tick', () => {
    expect(buildTicks(19, 5)).toEqual([0, 5, 10, 15, 19])
    expect(buildTicks(11, 5)).toEqual([0, 5, 10])
  })

  it('is empty for an empty span', () => {
    expect(buildTicks(0, 1)).toEqual([])
  })
})

describe('colorForIndex', () => {
  it('assigns stable colours that wrap around the palette', () => {
    expect(colorForIndex(0)).toBe('bg-indigo-600')
    expect(colorForIndex(2)).toBe(colorForIndex(2))
    expect(colorForIndex(8)).toBe(colorForIndex(0))
  })
})

describe('buildGanttModel', () => {
  const timeline: TimelineSegment[] = [
    idle(0, 2),
    exec('p1', 2, 4),
    exec('p2', 4, 9),
    exec('p1', 9, 11),
  ]
  const metrics = [metric('p1', 'P1', 2, 4, 11), metric('p2', 'P2', 0, 5, 9)]

  it('creates one positioned block per timeline segment', () => {
    const model = buildGanttModel(timeline, metrics)

    expect(model.span).toBe(11)
    expect(model.blocks).toHaveLength(4)
    expect(model.blocks.map((block) => block.kind)).toEqual(['idle', 'process', 'process', 'process'])

    const [first, second, third, fourth] = model.blocks
    expect(first).toMatchObject({ start: 0, end: 2, leftPct: 0, widthPct: (2 / 11) * 100 })
    expect(second).toMatchObject({ kind: 'process', pid: 'P1', start: 2, end: 4 })
    expect(third).toMatchObject({ pid: 'P2' })
    expect(fourth).toMatchObject({ pid: 'P1', sliceIndex: 2, sliceCount: 2 })

    expect(first.leftPct + first.widthPct).toBeCloseTo(second.leftPct)
    expect(fourth.leftPct + fourth.widthPct).toBeCloseTo(100)
  })

  it('accumulates idle time separately from process slices', () => {
    const model = buildGanttModel(timeline, metrics)

    expect(model.idleTime).toBe(2)
    expect(model.processCount).toBe(2)
  })

  it('numbers slices of a preempted process and flags them in the legend', () => {
    const model = buildGanttModel(timeline, metrics)

    const p1Legend = model.legend.find((entry) => entry.processId === 'p1')
    expect(p1Legend).toMatchObject({ pid: 'P1', sliceCount: 2, burstTime: 4, arrivalTime: 2 })
    const p2Legend = model.legend.find((entry) => entry.processId === 'p2')
    expect(p2Legend).toMatchObject({ sliceCount: 1 })
  })

  it('gives each process a distinct legend colour matching its blocks', () => {
    const model = buildGanttModel(timeline, metrics)
    const p1Color = model.legend.find((entry) => entry.processId === 'p1')?.colorClass
    const p2Color = model.legend.find((entry) => entry.processId === 'p2')?.colorClass

    expect(p1Color).not.toBe(p2Color)
    for (const block of model.blocks) {
      if (block.kind !== 'process') continue
      expect(block.colorClass).toBe(
        block.processId === 'p1' ? p1Color : p2Color,
      )
    }
  })

  it('handles an empty timeline without dividing by zero', () => {
    const model = buildGanttModel([], [])

    expect(model.span).toBe(0)
    expect(model.blocks).toEqual([])
    expect(model.ticks).toEqual([])
    expect(model.idleTime).toBe(0)
    expect(model.processCount).toBe(0)
  })

  it('falls back to the process id when metrics are missing', () => {
    const model = buildGanttModel([exec('p9', 0, 3)], [])

    expect(model.blocks[0]).toMatchObject({ kind: 'process', pid: 'p9' })
  })
})
