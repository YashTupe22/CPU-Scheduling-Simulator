import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { CheckCircleIcon, PauseIcon, PlayIcon, ResetIcon, StepIcon } from '../ui/icons'
import { IDLE_BLOCK_CLASS } from '../results/ganttModel'
import {
  buildPlaybackState,
  collectStepBoundaries,
  formatTime,
  nextStepTime,
  timelineSpan,
} from './playbackModel'
import type { PlaybackState, ProcessPhase } from './playbackModel'
import type { SimulationResult } from '../../features/scheduling/types'

interface SimulatorPanelProps {
  result: SimulationResult
}

/** Real milliseconds between playback ticks. */
const FRAME_MS = 50
/** Real milliseconds per simulated millisecond at 1× speed. */
const BASE_MS_PER_SIM_MS = 40
const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4] as const

const PHASE_BADGE: Record<ProcessPhase, { label: string; className: string }> = {
  running: { label: 'Running', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  ready: { label: 'Ready', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  completed: { label: 'Done', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  pending: { label: 'Waiting', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
}

/** Playback cursor: simulation time in ms plus whether the timer is running. */
interface Playback {
  time: number
  playing: boolean
}

/**
 * Interactive step-through of the engine timeline: play, pause, reset, step,
 * speed control and the machine state (running process, ready queue,
 * completed processes, remaining bursts) — all derived from `SimulationResult`.
 */
export function SimulatorPanel({ result }: SimulatorPanelProps) {
  const span = useMemo(() => timelineSpan(result.timeline), [result])
  const boundaries = useMemo(() => collectStepBoundaries(result), [result])
  const [speed, setSpeed] = useState<number>(1)
  const [playback, setPlayback] = useState<Playback>({ time: 0, playing: false })
  const [trackedResult, setTrackedResult] = useState(result)

  // A fresh run restarts playback from zero (React's adjust-state-during-render
  // pattern — no effect, no cascading render).
  if (trackedResult !== result) {
    setTrackedResult(result)
    setPlayback({ time: 0, playing: false })
  }

  const { time, playing } = playback

  useEffect(() => {
    if (!playing) return
    const delta = (speed * FRAME_MS) / BASE_MS_PER_SIM_MS
    const timer = window.setInterval(() => {
      setPlayback((previous) => {
        const next = Math.min(span, previous.time + delta)
        return next >= span
          ? { time: span, playing: false }
          : { time: next, playing: previous.playing }
      })
    }, FRAME_MS)
    return () => window.clearInterval(timer)
  }, [playing, speed, span])

  const state = useMemo(() => buildPlaybackState(result, time), [result, time])

  const handlePlayPause = () => {
    setPlayback((previous) => {
      if (previous.playing) return { ...previous, playing: false }
      const restart = previous.time >= span
      return { time: restart ? 0 : previous.time, playing: true }
    })
  }

  const handleReset = () => {
    setPlayback({ time: 0, playing: false })
  }

  const handleStep = () => {
    setPlayback((previous) => ({
      time: nextStepTime(boundaries, previous.time),
      playing: false,
    }))
  }

  const progressPct = state.span > 0 ? Math.min(100, (state.time / state.span) * 100) : 100

  return (
    <Card>
      <CardHeader
        title="Step-through Simulator"
        description="Replay the engine's timeline event by event — play, pause, step and inspect the machine."
      />

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {/* Playback controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={playing ? <PauseIcon /> : <PlayIcon />}
            onClick={handlePlayPause}
            disabled={state.span === 0}
          >
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button
            size="sm"
            icon={<StepIcon />}
            onClick={handleStep}
            disabled={state.finished}
          >
            Next Step
          </Button>
          <Button
            size="sm"
            icon={<ResetIcon />}
            onClick={handleReset}
            disabled={state.time === 0 && !playing}
          >
            Reset
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="playback-speed" className="text-xs font-medium text-slate-600">
              Speed
            </label>
            <select
              id="playback-speed"
              className="input-base w-auto py-1.5 text-xs"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              {SPEED_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}×
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clock */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Simulation time
            </p>
            <p className="font-mono text-sm text-slate-700">
              {formatTime(state.time)} ms
              <span className="text-slate-500"> / {state.span} ms</span>
            </p>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={state.span}
            aria-valuenow={Math.floor(state.time)}
          >
            <div
              className="h-full rounded-full bg-brand-500 transition-[width] duration-75"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Machine state */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Section title="Now running">
            <RunningView state={state} />
          </Section>

          <Section title={`Ready queue · ${state.readyQueue.length}`}>
            {state.readyQueue.length === 0 ? (
              <p className="text-xs leading-relaxed text-slate-500">
                {state.finished
                  ? 'Nothing queued — the simulation is complete.'
                  : `No process is ready at ${formatTime(state.time)} ms.`}
              </p>
            ) : (
              <>
                <ol className="space-y-1.5">
                  {state.readyQueue.map((entry, index) => (
                    <li
                      key={entry.processId}
                      className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5"
                    >
                      <span className="w-3 text-[10px] font-semibold text-slate-500">
                        {index + 1}
                      </span>
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${entry.colorClass}`} />
                      <span className="text-xs font-semibold text-slate-800">{entry.pid}</span>
                      <span className="ml-auto font-mono text-[11px] text-slate-500">
                        {formatTime(entry.remaining)} ms left
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[11px] text-slate-500">
                  Queued in arrival order — the engine decides dispatch.
                </p>
              </>
            )}
          </Section>

          <Section title={`Completed · ${state.completed.length}`}>
            {state.completed.length === 0 ? (
              <p className="text-xs leading-relaxed text-slate-500">
                No process has finished yet at {formatTime(state.time)} ms.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {state.completed.map((entry) => (
                  <li
                    key={entry.processId}
                    className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5"
                  >
                    <CheckCircleIcon width={14} height={14} className="shrink-0 text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-800">{entry.pid}</span>
                    <span className="ml-auto font-mono text-[11px] text-slate-500">
                      t = {entry.completionTime} ms
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        {/* Remaining burst */}
        <Section title="Remaining burst time">
          <ul className="space-y-2.5">
            {state.progress.map((entry) => {
              const donePct =
                entry.burstTime > 0
                  ? ((entry.burstTime - entry.remaining) / entry.burstTime) * 100
                  : 100
              const badge = PHASE_BADGE[entry.phase]
              return (
                <li key={entry.processId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="flex w-14 shrink-0 items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-sm ${entry.colorClass}`} />
                    <span className="text-xs font-semibold text-slate-800">{entry.pid}</span>
                  </span>
                  <div
                    className="h-2.5 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={entry.burstTime}
                    aria-valuenow={Math.round(entry.executed)}
                    aria-label={`${entry.pid} burst progress`}
                  >
                    <div
                      className={`h-full rounded-full ${entry.colorClass} transition-[width] duration-75`}
                      style={{ width: `${donePct}%` }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right font-mono text-[11px] text-slate-500">
                    {formatTime(entry.remaining)} / {entry.burstTime} ms left
                  </span>
                  <span
                    className={`inline-flex w-16 shrink-0 justify-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </Section>
      </div>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-slate-50/70 p-4">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function RunningView({ state }: { state: PlaybackState }) {
  const running = state.running

  if (running.kind === 'process') {
    const runningProgress = state.progress.find((entry) => entry.phase === 'running')
    return (
      <div>
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 shrink-0 rounded-sm ${running.colorClass}`} />
          <span className="text-sm font-semibold text-slate-900">{running.pid}</span>
          <span className="ml-auto font-mono text-[11px] text-slate-500">
            {running.start} → {running.end} ms
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          {formatTime(running.elapsed)} ms into this slice ·{' '}
          {formatTime(running.sliceRemaining)} ms left on the CPU.
        </p>
        {runningProgress ? (
          <p className="mt-1 text-xs text-slate-600">
            Remaining burst:{' '}
            <span className="font-semibold text-slate-900">
              {formatTime(runningProgress.remaining)} ms
            </span>{' '}
            of {runningProgress.burstTime} ms
          </p>
        ) : null}
      </div>
    )
  }

  if (running.kind === 'idle') {
    return (
      <div>
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 shrink-0 rounded-sm ring-1 ring-line ${IDLE_BLOCK_CLASS}`} />
          <span className="text-sm font-semibold text-slate-900">CPU idle</span>
          <span className="ml-auto font-mono text-[11px] text-slate-500">
            {running.start} → {running.end} ms
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          No process has arrived yet — {formatTime(running.sliceRemaining)} ms until the next
          arrival.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <CheckCircleIcon width={16} height={16} className="text-emerald-600" />
        <span className="text-sm font-semibold text-slate-900">Simulation complete</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
        All {state.progress.length} process{state.progress.length === 1 ? '' : 'es'} finished
        after {state.span} ms. Press Play to watch it again or Reset to rewind.
      </p>
    </div>
  )
}
