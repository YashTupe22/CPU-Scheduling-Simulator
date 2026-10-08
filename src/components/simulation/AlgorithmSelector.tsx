import { Badge } from '../ui/Badge'
import { ALGORITHMS } from '../../features/scheduling/definitions'
import type { AlgorithmId } from '../../features/scheduling/definitions'
import { isAlgorithmImplemented } from '../../features/scheduling/registry'

interface AlgorithmSelectorProps {
  value: AlgorithmId
  onChange: (id: AlgorithmId) => void
}

const PREEMPTION_LABEL = {
  'non-preemptive': 'Non-preemptive',
  preemptive: 'Preemptive',
} as const

const PREEMPTION_TONE = {
  'non-preemptive': 'neutral',
  preemptive: 'info',
} as const

export function AlgorithmSelector({ value, onChange }: AlgorithmSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Scheduling algorithm" className="flex flex-col gap-2">
      {ALGORITHMS.map((algorithm) => {
        const selected = algorithm.id === value
        const implemented = isAlgorithmImplemented(algorithm.id)
        return (
          <label
            key={algorithm.id}
            className={[
              'peer flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
              selected
                ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                : 'border-line bg-white hover:border-slate-300 hover:bg-slate-50',
            ].join(' ')}
          >
            <input
              type="radio"
              name="algorithm"
              className="sr-only"
              value={algorithm.id}
              checked={selected}
              onChange={() => onChange(algorithm.id)}
            />
            <span
              aria-hidden="true"
              className={[
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                selected ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white',
              ].join(' ')}
            >
              {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-slate-900">
                  {algorithm.shortName}
                  <span className="ml-1.5 font-normal text-slate-500">{algorithm.name}</span>
                </span>
                <Badge tone={PREEMPTION_TONE[algorithm.preemption]}>
                  {PREEMPTION_LABEL[algorithm.preemption]}
                </Badge>
                {!implemented ? (
                  <Badge tone="warning">No engine</Badge>
                ) : (
                  <Badge tone="success">Ready</Badge>
                )}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                {algorithm.summary}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
