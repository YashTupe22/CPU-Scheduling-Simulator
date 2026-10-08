import type { Process, ProcessDraft, RowErrors } from './types'

export interface ValidationResult {
  /** Per-row, per-field messages keyed by `ProcessDraft.id`. */
  errors: Record<string, RowErrors>
  isValid: boolean
  /** Fully parsed processes — only populated when `isValid` is true. */
  processes: Process[]
}

const PID_MAX_LENGTH = 10

/** Upper bound for arrival, burst, priority and time-quantum fields. */
const MAX_VALUE = 9999

const INTEGER_PATTERN = /^\d+$/

function parseInteger(raw: string): number | null {
  const value = raw.trim()
  if (!INTEGER_PATTERN.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function validateNumericField(
  raw: string,
  label: string,
  min: number,
): string | undefined {
  const parsed = parseInteger(raw)
  if (parsed === null) {
    return `${label} must be a whole number`
  }
  if (parsed < min) {
    return `${label} must be ${min === 0 ? 'zero or greater' : `at least ${min}`}`
  }
  if (parsed > MAX_VALUE) {
    return `${label} must be ${MAX_VALUE} or less`
  }
  return undefined
}

/**
 * Validates every draft row and, when everything is valid, converts the
 * drafts into domain `Process` objects ready for a scheduling algorithm.
 */
export function validateProcesses(drafts: readonly ProcessDraft[]): ValidationResult {
  const errors: Record<string, RowErrors> = {}
  const seenPids = new Map<string, string>()
  const processes: Process[] = []

  for (const draft of drafts) {
    const row: RowErrors = {}
    const pid = draft.pid.trim()

    if (pid === '') {
      row.pid = 'Process ID is required'
    } else if (pid.length > PID_MAX_LENGTH) {
      row.pid = `Max ${PID_MAX_LENGTH} characters`
    } else {
      const normalized = pid.toLowerCase()
      const duplicateOf = seenPids.get(normalized)
      if (duplicateOf !== undefined) {
        row.pid = `Duplicates "${duplicateOf}"`
        seenPids.set(normalized, duplicateOf)
      } else {
        seenPids.set(normalized, pid)
      }
    }

    const arrivalError = validateNumericField(draft.arrivalTime, 'Arrival time', 0)
    if (arrivalError) row.arrivalTime = arrivalError

    const burstError = validateNumericField(draft.burstTime, 'Burst time', 1)
    if (burstError) row.burstTime = burstError

    const priorityError = validateNumericField(draft.priority, 'Priority', 0)
    if (priorityError) row.priority = priorityError

    if (Object.keys(row).length > 0) {
      errors[draft.id] = row
      continue
    }

    processes.push({
      id: draft.id,
      pid,
      arrivalTime: parseInteger(draft.arrivalTime) ?? 0,
      burstTime: parseInteger(draft.burstTime) ?? 0,
      priority: parseInteger(draft.priority) ?? 0,
    })
  }

  const isValid = drafts.length > 0 && Object.keys(errors).length === 0
  return {
    errors,
    isValid,
    processes: isValid ? processes : [],
  }
}

export function countErrors(errors: Record<string, RowErrors>): number {
  return Object.values(errors).reduce((total, row) => total + Object.keys(row).length, 0)
}

/** Validates the Round Robin time quantum. Returns undefined when acceptable. */
export function validateTimeQuantum(raw: string): string | undefined {
  return validateNumericField(raw, 'Time quantum', 1)
}
