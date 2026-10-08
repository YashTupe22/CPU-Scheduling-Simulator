import type { AlgorithmId } from './definitions'
import type { SchedulingAlgorithm } from './types'

/**
 * Implementation registry.
 *
 * Phase 1 ships with an empty registry so the UI can be built and reviewed
 * independently. Phase 2 adds one file per algorithm under
 * `src/features/scheduling/algorithms/` and calls `registerAlgorithm`.
 *
 *   // src/features/scheduling/algorithms/fcfs.ts
 *   export const fcfs: SchedulingAlgorithm = { id: 'fcfs', run({ processes }) { ... } }
 *
 *   // src/features/scheduling/algorithms/index.ts
 *   registerAlgorithm(fcfs)
 */
const implementations = new Map<string, SchedulingAlgorithm>()

export function registerAlgorithm(algorithm: SchedulingAlgorithm): void {
  implementations.set(algorithm.id, algorithm)
}

export function getAlgorithm(id: AlgorithmId | string): SchedulingAlgorithm | undefined {
  return implementations.get(id)
}

export function isAlgorithmImplemented(id: AlgorithmId | string): boolean {
  return implementations.has(id)
}

export function implementedAlgorithmIds(): string[] {
  return [...implementations.keys()]
}
