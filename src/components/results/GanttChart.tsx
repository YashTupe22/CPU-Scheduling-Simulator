import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { clamp } from '../../lib/math'
import { IDLE_BLOCK_CLASS, buildGanttModel } from './ganttModel'
import type { GanttBlock } from './ganttModel'
import type { SimulationResult } from '../../features/scheduling/types'

interface GanttChartProps {
  result: SimulationResult
}

const MIN_CHART_WIDTH = 520
const PX_PER_MS = 26

/**
 * Gantt chart rendered straight from the engine timeline: one block per
 * execution/idle segment, positioned by percentage of the total span, with a
 * details card that follows the hovered (mouse) or tapped (touch) block.
 */
export function GanttChart({ result }: GanttChartProps) {
  const model = useMemo(() => buildGanttModel(result.timeline, result.metrics), [result])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null)
  const [chartWidth, setChartWidth] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = contentRef.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setChartWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const activeIndex = hoveredIndex ?? pinnedIndex
  const activeBlock = activeIndex === null ? undefined : model.blocks[activeIndex]
  const pxPerMs = model.span > 0 && chartWidth > 0 ? chartWidth / model.span : 0
  const minWidthPx = Math.max(MIN_CHART_WIDTH, Math.round(model.span * PX_PER_MS))

  if (model.blocks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-slate-500">
        The schedule is empty, so there is nothing to plot yet.
      </p>
    )
  }

  const hideDetails = () => setHoveredIndex(null)
  const enterBlock = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    if (event.pointerType !== 'touch') setHoveredIndex(index)
  }
  const leaveBlock = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch') hideDetails()
  }
  const toggleBlock = (index: number) => {
    setPinnedIndex((current) => (current === index ? null : index))
  }

  return (
    <div className="space-y-4">
      <div
        role="region"
        aria-label="Execution timeline (scrollable)"
        tabIndex={0}
        className="overflow-x-auto rounded-xl border border-line bg-slate-50/70 px-3 pt-3 pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:px-4"
      >
        <div
          ref={contentRef}
          className="relative"
          style={{ minWidth: `max(100%, ${minWidthPx}px)` }}
        >
          {/* Execution segments */}
          <div className="relative h-16 overflow-hidden rounded-lg bg-white ring-1 ring-line sm:h-[72px]">
            {model.blocks.map((block, index) => {
              const isActive = index === activeIndex
              const showLabel = block.duration * pxPerMs >= 30
              const showTimes = block.duration * pxPerMs >= 58

              return (
                <button
                  key={block.key}
                  type="button"
                  className={[
                    'absolute inset-y-0 flex flex-col items-center justify-center overflow-hidden border-r text-center',
                    'transition-[filter,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
                    block.kind === 'idle'
                      ? `${IDLE_BLOCK_CLASS} border-slate-300 text-slate-600`
                      : `${block.colorClass} border-white/70 text-white`,
                    isActive ? 'z-10 brightness-110 ring-2 ring-slate-900' : 'z-0 brightness-100',
                  ].join(' ')}
                  style={{ left: `${block.leftPct}%`, width: `${block.widthPct}%` }}
                  onPointerEnter={(event) => enterBlock(event, index)}
                  onPointerLeave={leaveBlock}
                  onFocus={() => setHoveredIndex(index)}
                  onBlur={hideDetails}
                  onClick={() => toggleBlock(index)}
                  aria-label={describeBlock(block)}
                >
                  {showLabel ? (
                    <>
                      <span className="truncate px-1 text-[11px] font-semibold leading-tight sm:text-xs">
                        {block.kind === 'idle' ? 'Idle' : block.pid}
                      </span>
                      {showTimes ? (
                        <span className="truncate px-1 text-[10px] leading-tight opacity-85">
                          {block.start}–{block.end}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </button>
              )
            })}
          </div>

          {/* Time axis */}
          <div className="relative mt-1.5 h-6 border-t border-slate-200">
            {model.ticks.map((tick) => (
              <div
                key={tick}
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${model.span > 0 ? (tick / model.span) * 100 : 0}%` }}
              >
                <span className="h-1.5 w-px bg-slate-300" />
                <span className="mt-0.5 text-[10px] leading-none text-slate-500">{tick}</span>
              </div>
            ))}
            <span className="absolute right-0 top-1 text-[10px] leading-none text-slate-500">
              ms
            </span>
          </div>

          {/* Details band */}
          <div className="relative mt-2 h-32">
            {activeBlock ? (
              <DetailsCard block={activeBlock} />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-xs text-slate-500">
                Hover or tap a block to inspect its execution details
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {model.legend.map((entry) => (
          <span
            key={entry.processId}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600"
          >
            <span className={`h-3 w-3 rounded-sm ${entry.colorClass}`} />
            <span className="font-medium text-slate-800">{entry.pid}</span>
            <span className="text-slate-500">
              {entry.burstTime} ms{entry.sliceCount > 1 ? ` · ${entry.sliceCount} slices` : ''}
            </span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className={`h-3 w-3 rounded-sm ${IDLE_BLOCK_CLASS} ring-1 ring-line`} />
          <span className="font-medium text-slate-800">Idle</span>
        </span>
      </div>

      <p className="text-xs text-slate-500">
        {model.span} ms timeline · {model.processCount} process
        {model.processCount === 1 ? '' : 'es'} · {model.idleTime} ms idle
        {model.span > 0 ? ` · ${Math.round((model.idleTime / model.span) * 100)}% idle` : ''}
      </p>
    </div>
  )
}

function DetailsCard({ block }: { block: GanttBlock }) {
  const left = clamp(block.centerPct, 18, 82)

  return (
    <div
      className="absolute top-0 w-60 max-w-[80vw] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2.5 text-left shadow-lg ring-1 ring-slate-700"
      style={{ left: `${left}%` }}
      role="status"
    >
      {block.kind === 'process' ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <span className={`h-2.5 w-2.5 rounded-sm ${block.colorClass}`} />
              {block.pid}
            </span>
            <span className="text-[11px] text-slate-300">{block.duration} ms</span>
          </div>
          {block.sliceCount > 1 ? (
            <p className="mt-0.5 text-[10px] text-slate-500">
              Slice {block.sliceIndex} of {block.sliceCount}
            </p>
          ) : null}
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
            <DetailRow label="Start" value={`${block.start} ms`} />
            <DetailRow label="End" value={`${block.end} ms`} />
            <DetailRow label="Arrival" value={formatOptional(block.arrivalTime)} />
            <DetailRow label="Completed" value={formatOptional(block.completionTime)} />
          </dl>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-white">CPU idle</span>
            <span className="text-[11px] text-slate-300">{block.duration} ms</span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500">No process ready to run</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
            <DetailRow label="Start" value={`${block.start} ms`} />
            <DetailRow label="End" value={`${block.end} ms`} />
          </dl>
        </>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-xs font-medium text-white">{value}</dd>
    </div>
  )
}

function formatOptional(value: number | undefined): string {
  return value === undefined ? '—' : `${value} ms`
}

function describeBlock(block: GanttBlock): string {
  return block.kind === 'idle'
    ? `CPU idle from ${block.start} to ${block.end} milliseconds`
    : `Process ${block.pid}, slice ${block.sliceIndex} of ${block.sliceCount}, from ${block.start} to ${block.end} milliseconds`
}
