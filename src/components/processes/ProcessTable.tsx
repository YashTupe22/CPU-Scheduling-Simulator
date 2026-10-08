import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { AlertIcon, LayersIcon, PlusIcon, TableIcon, TrashIcon } from '../ui/icons'
import { totalBurstOf } from '../../features/scheduling/workload'
import type { ProcessDraft, ProcessField, RowErrors } from '../../features/scheduling/types'

interface ProcessTableProps {
  drafts: readonly ProcessDraft[]
  errors: Record<string, RowErrors>
  showErrors: boolean
  onUpdate: (id: string, field: ProcessField, value: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
  onClear: () => void
  onLoadSample: () => void
}

const COLUMNS: ReadonlyArray<{ field: ProcessField; label: string; hint: string }> = [
  { field: 'pid', label: 'Process ID', hint: 'unique label' },
  { field: 'arrivalTime', label: 'Arrival Time', hint: 'ms' },
  { field: 'burstTime', label: 'Burst Time', hint: 'ms' },
  { field: 'priority', label: 'Priority', hint: 'lower = higher' },
]

export function ProcessTable({
  drafts,
  errors,
  showErrors,
  onUpdate,
  onRemove,
  onAdd,
  onClear,
  onLoadSample,
}: ProcessTableProps) {
  const totalBurst = totalBurstOf(drafts)

  return (
    <Card>
      <CardHeader
        title="Process Input"
        description="Define the workload: when each process arrives, how long it needs the CPU, and its priority."
        actions={
          <>
            <Button size="sm" onClick={onLoadSample} disabled={drafts.length > 0}>
              Load sample
            </Button>
            <Button size="sm" variant="primary" icon={<PlusIcon />} onClick={onAdd}>
              Add process
            </Button>
          </>
        }
      />

      {drafts.length === 0 ? (
        <EmptyState
          icon={<TableIcon width={24} height={24} />}
          title="No processes yet"
          description="Add your first process to build a workload, or load a ready-made sample set to explore the simulator."
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="primary" icon={<PlusIcon />} onClick={onAdd}>
              Add process
            </Button>
            <Button onClick={onLoadSample}>Load sample data</Button>
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-slate-50/70 text-left">
                  <th scope="col" className="w-12 px-4 py-3 text-xs font-medium text-slate-500">
                    #
                  </th>
                  {COLUMNS.map((column) => (
                    <th
                      key={column.field}
                      scope="col"
                      className="px-3 py-3 font-medium text-slate-500"
                    >
                      <span className="block text-xs font-medium">{column.label}</span>
                      <span className="block text-[11px] font-normal text-slate-500">
                        {column.hint}
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="w-16 px-3 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft, index) => {
                  const rowErrors = showErrors ? errors[draft.id] : undefined
                  return (
                    <tr
                      key={draft.id}
                      className="border-b border-line last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3 align-top">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                          {index + 1}
                        </span>
                      </td>
                      {COLUMNS.map((column) => {
                        const error = rowErrors?.[column.field]
                        const errorId = `${draft.id}-${column.field}-error`
                        return (
                          <td key={column.field} className="px-3 py-3 align-top">
                            <input
                              className={`input-base ${
                                error ? 'input-invalid' : ''
                              } ${column.field === 'pid' ? 'font-medium' : ''}`}
                              value={draft[column.field]}
                              inputMode={column.field === 'pid' ? 'text' : 'numeric'}
                              autoComplete="off"
                              aria-label={`${column.label} for row ${index + 1}`}
                              aria-invalid={error ? true : undefined}
                              aria-describedby={error ? errorId : undefined}
                              onChange={(event) => onUpdate(draft.id, column.field, event.target.value)}
                            />
                            {error ? (
                              <p
                                id={errorId}
                                className="mt-1 flex items-center gap-1 text-[11px] leading-tight text-rose-600"
                              >
                                <AlertIcon width={12} height={12} />
                                {error}
                              </p>
                            ) : null}
                          </td>
                        )
                      })}
                      <td className="px-3 py-3 text-right align-top">
                        <button
                          type="button"
                          onClick={() => onRemove(draft.id)}
                          aria-label={`Remove process ${draft.pid || index + 1}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 sm:px-6">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <LayersIcon width={14} height={14} />
              {drafts.length} process{drafts.length === 1 ? '' : 'es'} · {totalBurst} ms total CPU
              time
            </p>
            <Button size="sm" variant="ghost" onClick={onClear}>
              Clear all
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
