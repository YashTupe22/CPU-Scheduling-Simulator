import { Card, CardHeader } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { AlertIcon, CheckCircleIcon, ClockIcon, SparkIcon, SpinnerIcon } from '../ui/icons'
import { GanttChart } from '../results/GanttChart'
import { SimulatorPanel } from '../simulator/SimulatorPanel'
import { getAlgorithmDefinition } from '../../features/scheduling/definitions'
import type { AlgorithmId } from '../../features/scheduling/definitions'
import type { SimulationResult } from '../../features/scheduling/types'

export type RunStatus =
  | { kind: 'idle' }
  | { kind: 'invalid'; errorCount: number }
  | { kind: 'running' }
  | { kind: 'failed'; message: string }
  | {
      kind: 'awaiting-implementation'
      algorithmId: AlgorithmId
      processCount: number
      timeQuantum?: number
    }
  | { kind: 'complete'; result: SimulationResult }

interface ResultsPanelProps {
  status: RunStatus
}

export function ResultsPanel({ status }: ResultsPanelProps) {
  if (status.kind === 'complete') {
    return (
      <div className="animate-rise space-y-6">
        <Card>
          <CardHeader
            title="Simulation Output"
            description="Execution timeline rendered from the engine's schedule."
          />
          <div className="px-5 py-6 sm:px-6">
            <GanttChart result={status.result} />
          </div>
        </Card>

        <SimulatorPanel result={status.result} />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Simulation Output"
        description="The timeline and step-through simulator appear here after a run."
      />
      <ResultsBody status={status} />
    </Card>
  )
}

type PendingRunStatus = Exclude<RunStatus, { kind: 'complete' }>

function ResultsBody({ status }: { status: PendingRunStatus }) {
  if (status.kind === 'idle') {
    return (
      <EmptyState
        icon={<SparkIcon width={24} height={24} />}
        title="Nothing simulated yet"
        description="Enter a set of processes, choose an algorithm and press Simulate to see the schedule."
      />
    )
  }

  if (status.kind === 'invalid') {
    return (
      <div className="px-5 py-6 sm:px-6">
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3"
        >
          <AlertIcon className="mt-0.5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-800">Simulation blocked</p>
            <p className="mt-0.5 text-sm text-rose-700">
              {status.errorCount} field{status.errorCount === 1 ? '' : 's'} failed validation.
              Fix the highlighted inputs and try again.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status.kind === 'running') {
    return (
      <div role="status" className="flex flex-col items-center gap-3 px-6 py-14">
        <SpinnerIcon width={28} height={28} className="text-brand-600" />
        <p className="text-sm font-medium text-slate-700">Computing schedule…</p>
        <p className="text-xs text-slate-500">Running the selected scheduling algorithm.</p>
      </div>
    )
  }

  if (status.kind === 'failed') {
    return (
      <div className="px-5 py-6 sm:px-6">
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3"
        >
          <AlertIcon className="mt-0.5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-800">Simulation failed</p>
            <p className="mt-0.5 text-sm text-rose-700">{status.message}</p>
            <p className="mt-1 text-xs text-rose-600">
              Adjust the workload or time quantum and run it again.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status.kind === 'awaiting-implementation') {
    const definition = getAlgorithmDefinition(status.algorithmId)
    return (
      <div className="px-5 py-6 sm:px-6">
        <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <ClockIcon className="mt-0.5 shrink-0 text-indigo-600" />
          <div>
            <p className="text-sm font-semibold text-indigo-900">
              Inputs accepted — no engine registered
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-indigo-800">
              Your workload passed validation, but no implementation is registered for{' '}
              <span className="font-semibold">{definition?.name ?? status.algorithmId}</span>.
              Built-in algorithms are installed by the scheduling registry; new ones register
              through <code className="rounded bg-indigo-100 px-1 py-0.5 text-xs">registerAlgorithm</code>.
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SummaryTile label="Algorithm" value={definition?.shortName ?? status.algorithmId} />
          <SummaryTile label="Processes" value={String(status.processCount)} />
          <SummaryTile
            label="Time quantum"
            value={status.timeQuantum !== undefined ? `${status.timeQuantum} ms` : '—'}
          />
        </dl>

        <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
          <CheckCircleIcon width={14} height={14} className="text-emerald-600" />
          Workload validated and ready to dispatch.
        </p>
      </div>
    )
  }

  return null
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-slate-50 px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
