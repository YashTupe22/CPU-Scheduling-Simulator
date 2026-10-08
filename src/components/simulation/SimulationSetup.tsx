import { AlgorithmSelector } from './AlgorithmSelector'
import { ValidationSummary } from './ValidationSummary'
import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { PlayIcon, SpinnerIcon } from '../ui/icons'
import {
  DEFAULT_ALGORITHM_ID,
  getAlgorithmDefinition,
} from '../../features/scheduling/definitions'
import type { AlgorithmId } from '../../features/scheduling/definitions'

interface SimulationSetupProps {
  algorithmId: AlgorithmId
  onAlgorithmChange: (id: AlgorithmId) => void
  timeQuantum: string
  onTimeQuantumChange: (value: string) => void
  timeQuantumError?: string
  processCount: number
  errorCount: number
  showErrors: boolean
  running: boolean
  onSimulate: () => void
}

export function SimulationSetup({
  algorithmId,
  onAlgorithmChange,
  timeQuantum,
  onTimeQuantumChange,
  timeQuantumError,
  processCount,
  errorCount,
  showErrors,
  running,
  onSimulate,
}: SimulationSetupProps) {
  const definition = getAlgorithmDefinition(algorithmId) ?? {
    id: DEFAULT_ALGORITHM_ID,
    name: '',
    shortName: '',
    summary: '',
    explanation: '',
    preemption: 'non-preemptive',
    usesPriority: false,
    usesTimeQuantum: false,
  }

  const quantumError = definition.usesTimeQuantum
    ? showErrors
      ? timeQuantumError
      : undefined
    : undefined

  return (
    <Card>
      <CardHeader
        title="Simulation Setup"
        description="Pick the scheduling policy for this run."
      />

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <AlgorithmSelector value={algorithmId} onChange={onAlgorithmChange} />

        <div className="rounded-lg border border-line bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            How {definition.shortName} works
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{definition.explanation}</p>
        </div>

        {definition.usesTimeQuantum ? (
          <div>
            <label
              htmlFor="time-quantum"
              className="block text-xs font-medium text-slate-700"
            >
              Time quantum
              <span className="ml-1 font-normal text-slate-500">(ms per slice)</span>
            </label>
            <input
              id="time-quantum"
              className={`input-base mt-1.5 ${quantumError ? 'input-invalid' : ''}`}
              value={timeQuantum}
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={quantumError ? true : undefined}
              onChange={(event) => onTimeQuantumChange(event.target.value)}
            />
            {quantumError ? (
              <p className="mt-1 text-[11px] text-rose-600">{quantumError}</p>
            ) : null}
          </div>
        ) : null}

        {definition.usesPriority ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
            This algorithm reads the <span className="font-medium text-slate-700">Priority</span>{' '}
            column — a lower number means a higher priority.
          </p>
        ) : null}

        <ValidationSummary
          processCount={processCount}
          errorCount={errorCount}
          showErrors={showErrors}
        />

        <Button
          variant="primary"
          fullWidth
          icon={running ? <SpinnerIcon /> : <PlayIcon />}
          onClick={onSimulate}
          disabled={processCount === 0 || running}
        >
          {running ? 'Simulating…' : 'Simulate'}
        </Button>
      </div>
    </Card>
  )
}
