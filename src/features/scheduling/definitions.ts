/**
 * Static metadata describing every algorithm the simulator supports.
 *
 * The UI renders this catalogue only — implementations live in `./algorithms`
 * and are registered through `./registry`, independently of the UI.
 */

export const ALGORITHM_IDS = [
  'fcfs',
  'sjf',
  'srtf',
  'priority-np',
  'priority-p',
  'round-robin',
] as const

export type AlgorithmId = (typeof ALGORITHM_IDS)[number]

export type Preemption = 'non-preemptive' | 'preemptive'

export interface AlgorithmDefinition {
  id: AlgorithmId
  name: string
  shortName: string
  summary: string
  /** Longer educational text shown under the algorithm picker. */
  explanation: string
  preemption: Preemption
  /** Whether the algorithm orders the queue by the priority field. */
  usesPriority: boolean
  /** Whether the user must provide a time quantum. */
  usesTimeQuantum: boolean
}

export const ALGORITHMS: readonly AlgorithmDefinition[] = [
  {
    id: 'fcfs',
    name: 'First Come, First Served',
    shortName: 'FCFS',
    summary: 'Runs processes in the exact order they arrive. Simple, non-preemptive baseline.',
    explanation:
      'Processes are dispatched strictly in arrival order, like customers at a counter. The first process to arrive runs until it finishes, so implementation is trivial and ordering is transparent — but one long job at the front makes every shorter job behind it wait (the convoy effect), so average waiting time suffers when burst times vary.',
    preemption: 'non-preemptive',
    usesPriority: false,
    usesTimeQuantum: false,
  },
  {
    id: 'sjf',
    name: 'Shortest Job First',
    shortName: 'SJF',
    summary: 'Picks the ready process with the smallest burst time. Non-preemptive.',
    explanation:
      'Whenever the CPU becomes free, the ready process with the smallest burst time runs next. For a fixed set of jobs this minimises the average waiting time, but the scheduler needs burst-time estimates and — being non-preemptive — a running job still blocks everything that arrives until it completes.',
    preemption: 'non-preemptive',
    usesPriority: false,
    usesTimeQuantum: false,
  },
  {
    id: 'srtf',
    name: 'Shortest Remaining Time First',
    shortName: 'SRTF',
    summary: 'Preemptive SJF: interrupts the running process whenever a shorter job arrives.',
    explanation:
      'Preemptive SJF: every time a process arrives, its remaining burst is compared with the running process, and the CPU switches if the newcomer needs less time. This keeps average waiting time very low, at the cost of more context switches, and it still depends on accurate burst-time estimates.',
    preemption: 'preemptive',
    usesPriority: false,
    usesTimeQuantum: false,
  },
  {
    id: 'priority-np',
    name: 'Priority Scheduling',
    shortName: 'Priority (NP)',
    summary:
      'Dispatches the highest-priority ready process and lets it finish. Lower number = higher priority.',
    explanation:
      'When the CPU is free, the arrived process with the highest priority (the lowest number) runs to completion. The rule is simple and lets urgent work jump ahead, but low-priority processes can starve indefinitely and the scheduler must estimate priorities correctly.',
    preemption: 'non-preemptive',
    usesPriority: true,
    usesTimeQuantum: false,
  },
  {
    id: 'priority-p',
    name: 'Priority Scheduling (Preemptive)',
    shortName: 'Priority (P)',
    summary:
      'Interrupts the running process as soon as a higher-priority one arrives. Lower number = higher priority.',
    explanation:
      'Like non-preemptive priority, but the running process is interrupted as soon as a higher-priority process arrives. Urgent work is picked up immediately, at the price of extra context switches, and low-priority work can still starve under constant high-priority load.',
    usesPriority: true,
    usesTimeQuantum: false,
    preemption: 'preemptive',
  },
  {
    id: 'round-robin',
    name: 'Round Robin',
    shortName: 'RR',
    summary: 'Cycles through the ready queue with a fixed time quantum for fairness.',
    explanation:
      'Every ready process gets the CPU for at most one time quantum, then moves to the back of the queue, so no process can monopolise the CPU and response times stay predictable. The quantum trades fairness against overhead: too large behaves like FCFS, too small spends CPU time on context switches.',
    preemption: 'preemptive',
    usesPriority: false,
    usesTimeQuantum: true,
  },
]

export const DEFAULT_ALGORITHM_ID: AlgorithmId = 'fcfs'

export const DEFAULT_TIME_QUANTUM = 2

export function getAlgorithmDefinition(id: string): AlgorithmDefinition | undefined {
  return ALGORITHMS.find((algorithm) => algorithm.id === id)
}
