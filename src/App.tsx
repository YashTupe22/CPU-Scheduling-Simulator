import { useMemo, useRef, useState } from 'react'
import { registerBuiltinAlgorithms } from './features/scheduling/algorithms'
import { AppShell } from './components/layout/AppShell'
import { AboutPage } from './components/about/AboutPage'
import { useHashRoute } from './hooks/useHashRoute'
import { StatsBar } from './components/dashboard/StatsBar'
import { ProcessTable } from './components/processes/ProcessTable'
import { SimulationSetup } from './components/simulation/SimulationSetup'
import { ResultsPanel } from './components/simulation/ResultsPanel'
import type { RunStatus } from './components/simulation/ResultsPanel'
import { ComparisonPanel } from './components/comparison/ComparisonPanel'
import { useProcessList } from './hooks/useProcessList'
import {
  DEFAULT_ALGORITHM_ID,
  DEFAULT_TIME_QUANTUM,
  getAlgorithmDefinition,
} from './features/scheduling/definitions'
import type { AlgorithmId } from './features/scheduling/definitions'
import { getAlgorithm } from './features/scheduling/registry'
import {
  countErrors,
  validateProcesses,
  validateTimeQuantum,
} from './features/scheduling/validation'
import { averageBurstOf, totalBurstOf } from './features/scheduling/workload'

// Installs the scheduling engines into the registry (idempotent, runs once).
registerBuiltinAlgorithms()

function App() {
  const { view, navigate } = useHashRoute()
  const { drafts, update, add, remove, clear, loadSample } = useProcessList()
  const [algorithmId, setAlgorithmId] = useState<AlgorithmId>(DEFAULT_ALGORITHM_ID)
  const [timeQuantum, setTimeQuantum] = useState(String(DEFAULT_TIME_QUANTUM))
  const [showErrors, setShowErrors] = useState(false)
  const [runStatus, setRunStatus] = useState<RunStatus>({ kind: 'idle' })

  const definition = getAlgorithmDefinition(algorithmId)
  const validation = useMemo(() => validateProcesses(drafts), [drafts])
  const timeQuantumError = definition?.usesTimeQuantum
    ? validateTimeQuantum(timeQuantum)
    : undefined
  const errorCount = countErrors(validation.errors) + (timeQuantumError ? 1 : 0)
  // The comparison always needs a usable quantum for Round Robin, even when
  // another algorithm is selected.
  const comparisonQuantum =
    validateTimeQuantum(timeQuantum) === undefined ? Number(timeQuantum) : DEFAULT_TIME_QUANTUM

  const stats = useMemo(() => {
    const total = totalBurstOf(drafts)
    return { total, average: averageBurstOf(drafts) }
  }, [drafts])

  /**
   * Monotonic token: every state change bumps it, so a deferred simulation
   * that has been superseded (by an edit or reset) never writes stale output.
   */
  const runTokenRef = useRef(0)

  /** Any workload or algorithm change invalidates the previous run output. */
  const invalidateRun = () => {
    runTokenRef.current += 1
    setRunStatus({ kind: 'idle' })
    setShowErrors(false)
  }

  const handleUpdate: typeof update = (id, field, value) => {
    invalidateRun()
    update(id, field, value)
  }

  const handleAdd = () => {
    invalidateRun()
    add()
  }

  const handleRemove = (id: string) => {
    invalidateRun()
    remove(id)
  }

  const handleClear = () => {
    invalidateRun()
    clear()
  }

  const handleLoadSample = () => {
    invalidateRun()
    loadSample()
  }

  const handleAlgorithmChange = (id: AlgorithmId) => {
    invalidateRun()
    setAlgorithmId(id)
  }

  const handleTimeQuantumChange = (value: string) => {
    invalidateRun()
    setTimeQuantum(value)
  }

  const handleSimulate = () => {
    setShowErrors(true)

    if (!validation.isValid || timeQuantumError) {
      setRunStatus({ kind: 'invalid', errorCount: Math.max(errorCount, 1) })
      document
        .getElementById('process-input')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const algorithm = getAlgorithm(algorithmId)
    const quantum = definition?.usesTimeQuantum ? Number(timeQuantum) : undefined

    if (!algorithm) {
      setRunStatus({
        kind: 'awaiting-implementation',
        algorithmId,
        processCount: validation.processes.length,
        timeQuantum: quantum,
      })
      return
    }

    const token = runTokenRef.current + 1
    runTokenRef.current = token
    setRunStatus({ kind: 'running' })

    // Compute on the next tick so the loading state paints first; the token
    // guard drops the result if the workload changed while we were computing.
    window.setTimeout(() => {
      if (runTokenRef.current !== token) return
      try {
        const result = algorithm.run({
          processes: validation.processes,
          ...(quantum !== undefined ? { timeQuantum: quantum } : {}),
        })
        setRunStatus({ kind: 'complete', result })
      } catch (error) {
        setRunStatus({
          kind: 'failed',
          message: error instanceof Error ? error.message : 'The scheduling engine failed to run.',
        })
      }
    }, 0)
  }

  /** Spoken status for screen readers whenever the run state changes. */
  const announcement =
    runStatus.kind === 'complete'
      ? `Simulation complete. ${runStatus.result.metrics.length} processes scheduled.`
      : runStatus.kind === 'failed'
        ? `Simulation failed. ${runStatus.message}`
        : runStatus.kind === 'invalid'
          ? `Simulation blocked. ${runStatus.errorCount} fields need fixing.`
          : runStatus.kind === 'running'
            ? 'Computing schedule.'
            : ''

  return (
    <AppShell view={view} onNavigate={navigate}>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {view === 'about' ? (
        <AboutPage />
      ) : (
        <div className="space-y-6">
          <StatsBar
            processCount={drafts.length}
            totalBurst={stats.total}
            avgBurst={stats.average}
            invalidCount={errorCount}
          />

          <div className="grid items-start gap-6 lg:grid-cols-3">
            <div id="process-input" className="lg:col-span-2 scroll-mt-24">
              <ProcessTable
                drafts={drafts}
                errors={validation.errors}
                showErrors={showErrors}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
                onAdd={handleAdd}
                onClear={handleClear}
                onLoadSample={handleLoadSample}
              />
            </div>

            <SimulationSetup
              algorithmId={algorithmId}
              onAlgorithmChange={handleAlgorithmChange}
              timeQuantum={timeQuantum}
              onTimeQuantumChange={handleTimeQuantumChange}
              timeQuantumError={timeQuantumError}
              processCount={drafts.length}
              errorCount={errorCount}
              showErrors={showErrors}
              running={runStatus.kind === 'running'}
              onSimulate={handleSimulate}
            />
          </div>

          <ResultsPanel status={runStatus} />

          {validation.isValid && validation.processes.length > 0 ? (
            <ComparisonPanel
              processes={validation.processes}
              timeQuantum={comparisonQuantum}
              selectedAlgorithmId={algorithmId}
            />
          ) : null}
        </div>
      )}
    </AppShell>
  )
}

export default App
