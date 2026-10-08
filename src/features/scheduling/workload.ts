import type { ProcessDraft } from './types'

/**
 * Draft-parsing helpers shared by the dashboard stats and the process table
 * footer so both always report the same numbers.
 */

function draftBurst(draft: ProcessDraft): number {
  const value = Number.parseInt(draft.burstTime, 10)
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Sum of every valid burst time in the drafts (invalid rows count as 0). */
export function totalBurstOf(drafts: readonly ProcessDraft[]): number {
  return drafts.reduce((total, draft) => total + draftBurst(draft), 0)
}

/** Mean burst across all drafts, rounded to one decimal (0 for no drafts). */
export function averageBurstOf(drafts: readonly ProcessDraft[]): number {
  if (drafts.length === 0) return 0
  return Math.round((totalBurstOf(drafts) / drafts.length) * 10) / 10
}
