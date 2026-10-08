import type { AlgorithmId } from '../definitions'
import type { SimulationInput, SimulationResult } from '../types'

/**
 * Identity helper that pins an algorithm's `id` to the `AlgorithmId` union, so
 * a typo ("fcfs2") fails to compile instead of silently never matching a
 * definition in the UI catalogue.
 */
export function defineAlgorithm<A extends AlgorithmId>(
  algorithm: { id: A; run(input: SimulationInput): SimulationResult },
): { id: A; run(input: SimulationInput): SimulationResult } {
  return algorithm
}
