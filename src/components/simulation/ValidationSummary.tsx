import { AlertIcon, InfoIcon } from '../ui/icons'

interface ValidationSummaryProps {
  processCount: number
  errorCount: number
  showErrors: boolean
}

export function ValidationSummary({ processCount, errorCount, showErrors }: ValidationSummaryProps) {
  if (processCount === 0) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <InfoIcon className="mt-0.5 shrink-0 text-slate-500" />
        Add at least one process to enable the simulation.
      </p>
    )
  }

  if (showErrors && errorCount > 0) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-200"
      >
        <AlertIcon className="mt-0.5 shrink-0" />
        {errorCount} field{errorCount === 1 ? '' : 's'} need{errorCount === 1 ? 's' : ''} fixing
        before the simulation can run.
      </p>
    )
  }

  if (errorCount > 0) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-inset ring-amber-200">
        <AlertIcon className="mt-0.5 shrink-0" />
        {errorCount} invalid field{errorCount === 1 ? '' : 's'} detected — press Simulate to review.
      </p>
    )
  }

  return (
    <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-inset ring-emerald-200">
      <InfoIcon className="mt-0.5 shrink-0" />
      {processCount} process{processCount === 1 ? '' : 'es'} validated and ready to simulate.
    </p>
  )
}
