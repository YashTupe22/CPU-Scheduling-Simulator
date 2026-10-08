import { useCallback, useMemo, useState } from 'react'
import type { ProcessDraft, ProcessField } from '../features/scheduling/types'

export interface ProcessListApi {
  drafts: readonly ProcessDraft[]
  update: (id: string, field: ProcessField, value: string) => void
  add: () => void
  remove: (id: string) => void
  clear: () => void
  loadSample: () => void
}

let counter = 0

function createDraft(overrides: Partial<ProcessDraft> = {}): ProcessDraft {
  counter += 1
  return {
    id: `proc_${counter}`,
    pid: '',
    arrivalTime: '0',
    burstTime: '1',
    priority: '1',
    ...overrides,
  }
}

function nextPid(drafts: readonly ProcessDraft[]): string {
  const used = new Set(drafts.map((draft) => draft.pid.trim().toLowerCase()))
  for (let index = 1; index <= drafts.length + 1; index += 1) {
    const candidate = `P${index}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return `P${drafts.length + 1}`
}

const SAMPLE_PROCESSES: ReadonlyArray<Omit<ProcessDraft, 'id'>> = [
  { pid: 'P1', arrivalTime: '0', burstTime: '6', priority: '2' },
  { pid: 'P2', arrivalTime: '1', burstTime: '4', priority: '1' },
  { pid: 'P3', arrivalTime: '2', burstTime: '2', priority: '3' },
  { pid: 'P4', arrivalTime: '4', burstTime: '5', priority: '2' },
]

function buildDrafts(rows: ReadonlyArray<Omit<ProcessDraft, 'id'>>): ProcessDraft[] {
  return rows.map((row) => createDraft(row))
}

/** Owns the process input list: add, remove, edit and sample data. */
export function useProcessList(initial: readonly ProcessDraft[] = []): ProcessListApi {
  const [drafts, setDrafts] = useState<ProcessDraft[]>(() => [...initial])

  const update = useCallback((id: string, field: ProcessField, value: string) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, [field]: value } : draft)),
    )
  }, [])

  const add = useCallback(() => {
    setDrafts((current) => [...current, createDraft({ pid: nextPid(current) })])
  }, [])

  const remove = useCallback((id: string) => {
    setDrafts((current) => current.filter((draft) => draft.id !== id))
  }, [])

  const clear = useCallback(() => setDrafts([]), [])

  const loadSample = useCallback(() => {
    setDrafts(buildDrafts(SAMPLE_PROCESSES))
  }, [])

  return useMemo(
    () => ({ drafts, update, add, remove, clear, loadSample }),
    [drafts, update, add, remove, clear, loadSample],
  )
}
