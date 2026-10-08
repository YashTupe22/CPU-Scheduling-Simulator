import { describe, expect, it } from 'vitest'
import { countErrors, validateProcesses, validateTimeQuantum } from './validation'
import type { ProcessDraft } from './types'

const draft = (overrides: Partial<ProcessDraft> = {}): ProcessDraft => ({
  id: overrides.id ?? 'r1',
  pid: overrides.pid ?? 'P1',
  arrivalTime: overrides.arrivalTime ?? '0',
  burstTime: overrides.burstTime ?? '5',
  priority: overrides.priority ?? '1',
})

describe('validateProcesses', () => {
  it('accepts a valid workload and parses the values', () => {
    const result = validateProcesses([
      draft({ id: 'r1', pid: 'P1', arrivalTime: '0', burstTime: '6', priority: '2' }),
      draft({ id: 'r2', pid: 'P2', arrivalTime: '3', burstTime: '4', priority: '0' }),
    ])

    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual({})
    expect(result.processes).toEqual([
      { id: 'r1', pid: 'P1', arrivalTime: 0, burstTime: 6, priority: 2 },
      { id: 'r2', pid: 'P2', arrivalTime: 3, burstTime: 4, priority: 0 },
    ])
  })

  it('rejects an empty workload and returns no processes', () => {
    const result = validateProcesses([])

    expect(result.isValid).toBe(false)
    expect(result.errors).toEqual({})
    expect(result.processes).toEqual([])
  })

  it('trims the process id but keeps the visible label', () => {
    const result = validateProcesses([draft({ pid: '  P1  ' })])

    expect(result.isValid).toBe(true)
    expect(result.processes[0].pid).toBe('P1')
  })

  it('flags a missing process id', () => {
    const result = validateProcesses([draft({ pid: '' })])

    expect(result.isValid).toBe(false)
    expect(result.errors.r1.pid).toBe('Process ID is required')
    expect(result.processes).toEqual([])
  })

  it('flags an over-long process id', () => {
    const result = validateProcesses([draft({ pid: 'ABCDEFGHIJK' })])

    expect(result.errors.r1.pid).toBe('Max 10 characters')
  })

  it('treats ids that differ only by case as duplicates', () => {
    const result = validateProcesses([
      draft({ id: 'r1', pid: 'P1' }),
      draft({ id: 'r2', pid: 'p1' }),
      draft({ id: 'r3', pid: 'P1' }),
    ])

    expect(result.isValid).toBe(false)
    expect(result.errors.r1).toBeUndefined()
    expect(result.errors.r2.pid).toBe('Duplicates "P1"')
    expect(result.errors.r3.pid).toBe('Duplicates "P1"')
    expect(result.processes).toEqual([])
  })

  it('keeps ids that differ by more than case apart', () => {
    const result = validateProcesses([
      draft({ id: 'r1', pid: 'P1' }),
      draft({ id: 'r2', pid: 'P10' }),
    ])

    expect(result.isValid).toBe(true)
  })

  it('rejects non-numeric, fractional and signed field values', () => {
    const result = validateProcesses([
      draft({ arrivalTime: 'abc', burstTime: '2.5', priority: '-1' }),
    ])

    expect(result.errors.r1.arrivalTime).toBe('Arrival time must be a whole number')
    expect(result.errors.r1.burstTime).toBe('Burst time must be a whole number')
    expect(result.errors.r1.priority).toBe('Priority must be a whole number')
  })

  it('rejects an empty numeric field', () => {
    const result = validateProcesses([draft({ arrivalTime: '  ' })])

    expect(result.errors.r1.arrivalTime).toBe('Arrival time must be a whole number')
  })

  it('enforces minimums: arrival >= 0, burst >= 1, priority >= 0', () => {
    const result = validateProcesses([
      draft({ arrivalTime: '-3', burstTime: '0', priority: '-2' }),
    ])

    expect(result.errors.r1.arrivalTime).toBe('Arrival time must be a whole number')
    expect(result.errors.r1.burstTime).toBe('Burst time must be at least 1')
    expect(result.errors.r1.priority).toBe('Priority must be a whole number')
  })

  it('accepts the boundary values 0 and 9999', () => {
    const result = validateProcesses([
      draft({ id: 'r1', pid: 'P1', arrivalTime: '0', burstTime: '9999', priority: '0' }),
      draft({ id: 'r2', pid: 'P2', arrivalTime: '9999', burstTime: '1', priority: '9999' }),
    ])

    expect(result.isValid).toBe(true)
  })

  it('rejects values above 9999', () => {
    const result = validateProcesses([
      draft({ arrivalTime: '10000', burstTime: '10000', priority: '10000' }),
    ])

    expect(result.errors.r1.arrivalTime).toBe('Arrival time must be 9999 or less')
    expect(result.errors.r1.burstTime).toBe('Burst time must be 9999 or less')
    expect(result.errors.r1.priority).toBe('Priority must be 9999 or less')
  })

  it('collects every broken field of a broken row', () => {
    const result = validateProcesses([
      draft({ id: 'ok', pid: 'P1' }),
      draft({ id: 'bad', pid: '', arrivalTime: 'x', burstTime: '0', priority: 'y' }),
    ])

    expect(result.isValid).toBe(false)
    expect(result.errors.ok).toBeUndefined()
    expect(Object.keys(result.errors.bad).sort()).toEqual([
      'arrivalTime',
      'burstTime',
      'pid',
      'priority',
    ])
    expect(result.processes).toEqual([])
  })
})

describe('countErrors', () => {
  it('sums the errors across every row', () => {
    const result = validateProcesses([
      draft({ id: 'ok', pid: 'P1' }),
      draft({ id: 'r2', pid: '', burstTime: '0' }),
      draft({ id: 'r3', pid: 'P1', priority: 'x' }),
    ])

    expect(countErrors(result.errors)).toBe(4)
  })

  it('returns 0 for an error-free map', () => {
    expect(countErrors({})).toBe(0)
  })
})

describe('validateTimeQuantum', () => {
  it('accepts whole numbers from 1 to 9999', () => {
    expect(validateTimeQuantum('1')).toBeUndefined()
    expect(validateTimeQuantum(' 42 ')).toBeUndefined()
    expect(validateTimeQuantum('9999')).toBeUndefined()
  })

  it('rejects zero, fractions, junk, negatives and overflow', () => {
    expect(validateTimeQuantum('0')).toBe('Time quantum must be at least 1')
    expect(validateTimeQuantum('1.5')).toBe('Time quantum must be a whole number')
    expect(validateTimeQuantum('fast')).toBe('Time quantum must be a whole number')
    expect(validateTimeQuantum('-2')).toBe('Time quantum must be a whole number')
    expect(validateTimeQuantum('')).toBe('Time quantum must be a whole number')
    expect(validateTimeQuantum('10000')).toBe('Time quantum must be 9999 or less')
  })
})
