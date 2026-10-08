# CPU Scheduling Simulator

An interactive web simulator for the classic CPU scheduling algorithms taught in
Operating Systems courses. Build a workload, pick an algorithm, and watch the
scheduler dispatch processes in real time — with a Gantt chart, per-process
metrics, a step-through playback mode, and a side-by-side comparison of every
implemented algorithm.

Built with **React 19 + TypeScript + Vite + Tailwind CSS v4**. Runtime
dependencies: `react` and `react-dom` only.

## Objective

Make CPU scheduling *visible*. The app computes every schedule with a
framework-agnostic scheduling engine and renders:

- a **Gantt chart** of the execution timeline (including CPU idle periods),
- **per-process metrics** (completion, turnaround, waiting, response),
- a **step-through simulator** that replays the timeline at adjustable speed,
- an **algorithm comparison** that runs the same workload through every
  registered engine and charts the results.

## Features

| Phase | Feature | Where |
| --- | --- | --- |
| 1 | Dashboard shell, process input table, validation feedback, stats bar | `src/components/processes`, `src/components/layout` |
| 2 | Scheduling engine + 6 algorithms behind a registry, metrics engine | `src/features/scheduling` |
| 3 | Result cards, algorithm catalogue with explanations | `src/components/simulation` |
| 4 | Gantt chart with hover/tap details, axis ticks, legend, idle hatch | `src/components/results/GanttChart.tsx` |
| 5 | Step-through playback: play/pause, step, reset, speed 0.25×–4× | `src/components/simulator` |
| 6 | Comparison panel: 5 metric charts + win tally + starred best values | `src/components/comparison` |
| 7 | Tests, strict validation, error/loading states, dark mode, a11y, README | throughout |

Quality of life: dark/light theme (system-aware, persisted, no flash), reduced
motion support, keyboard-accessible timeline, screen-reader announcements for
run status, responsive layout from 320 px up.

## Supported algorithms

| Id | Name | Preemption | Uses priority | Uses quantum |
| --- | --- | --- | --- | --- |
| `fcfs` | First Come First Served | non-preemptive | – | – |
| `sjf` | Shortest Job First | non-preemptive | – | – |
| `srtf` | Shortest Remaining Time First | preemptive | – | – |
| `priority-np` | Priority Scheduling | non-preemptive | yes | – |
| `priority-p` | Priority Scheduling | preemptive | yes | – |
| `round-robin` | Round Robin | preemptive | – | yes |

Conventions:

- All times are **milliseconds**.
- **Lower priority number = higher priority.**
- The timeline is ordered, contiguous and non-overlapping:
  `segments[i + 1].start === segments[i].end`, starting at 0.

## Metrics

For each process, from arrival `a`, burst `b`, completion `c` and first
dispatch `f`:

```
turnaround = c - a
waiting    = turnaround - b
response   = f - a
```

Schedule-wide (rounded to 2 decimals, throughput to 4):

```
avgWaiting / avgTurnaround / avgResponse = arithmetic mean over processes
cpuUtilization = busyTime / makespan * 100      (%)
throughput     = completedProcesses / makespan  (processes per ms)
```

Idle time counts against both utilization and throughput — it is real elapsed
time.

## Getting started

```bash
npm install       # install dependencies
npm run dev       # start the dev server (http://localhost:5173)
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build
npm test          # run the test suite (Vitest)
npm run lint      # oxlint
```

## Usage

1. **Load sample data** (or add rows manually): each process needs a unique ID,
   an arrival time (`>= 0`), a burst time (`>= 1`) and a priority
   (`>= 0`, lower = more important). Values must be whole numbers `<= 9999`.
2. **Pick an algorithm** from the catalogue; Round Robin additionally asks for
   a time quantum (`>= 1` ms).
3. **Press Simulate.** The results section shows the Gantt chart, the metrics
   table and the playback simulator; the comparison panel below charts the
   workload across all six algorithms.
4. **Interact:** hover/focus a Gantt block for details, use the simulator's
   play/step/reset controls to walk through time, and switch algorithms to see
   the schedule change.

### Example test case

Workload: `P1(0, 6) P2(1, 4) P3(2, 2) P4(4, 5)` — `(arrival, burst)`, all
priority 2.

FCFS result:

```
Timeline:  P1 0-6 · P2 6-10 · P3 10-12 · P4 12-17
avg turnaround 9.5 · avg waiting 5.25 · avg response 5.25
utilization 100% · throughput 0.2353
```

## Architecture

```
src/
├── App.tsx                     # orchestration: validation, run state, layout
├── index.css                   # design tokens, dark theme layer, animations
├── hooks/                      # useProcessList, useTheme
├── lib/                        # shared helpers (clamp, …)
├── features/scheduling/
│   ├── types.ts                # Process, TimelineSegment, metrics contracts
│   ├── validation.ts           # draft → Process parsing + field errors
│   ├── definitions.ts          # algorithm metadata (name, badges, explanation)
│   ├── registry.ts             # registerAlgorithm / getAlgorithm
│   ├── workload.ts             # shared workload helpers
│   ├── engine/                 # createSchedule + finalizeSimulation
│   ├── algorithms/             # fcfs, sjf, srtf, priorityNp, priorityP, roundRobin
│   └── metrics/                # analyzeTimeline → per-process metrics + summary
└── components/
    ├── layout/AppShell.tsx     # header, skip link, theme toggle, footer
    ├── processes/ProcessTable.tsx
    ├── simulation/             # SimulationSetup, ResultsPanel, AlgorithmSelector
    ├── results/GanttChart.tsx  # + ganttModel.ts
    ├── simulator/              # SimulatorPanel + playbackModel.ts
    ├── comparison/             # ComparisonPanel + comparisonModel.ts
    └── ui/                     # Button, Card, Badge, icons, …
```

Design rules the code follows:

- **The engine is the single source of truth.** UI panels never re-derive
  schedules or metrics; they render `SimulationResult`.
- **Algorithms are pluggable.** Adding one = new file in `algorithms/` +
  one line in `algorithms/index.ts`. The registry, catalogue, comparison panel
  and tests pick it up automatically.
- **Pure models next to their components** (`ganttModel`, `playbackModel`,
  `comparisonModel`) keep the rendering dumb and the logic unit-testable.

### Adding a new algorithm

```ts
// src/features/scheduling/algorithms/myAlgo.ts
import type { SchedulingAlgorithm } from '../types'

export const myAlgo: SchedulingAlgorithm = {
  id: 'my-algo',
  run({ processes }) {
    // build segments with createSchedule(), then finalizeSimulation()
  },
}
```

Register it in `algorithms/index.ts` (`builtinAlgorithms`) — no UI changes
required. Use `finalizeSimulation` so the shared timeline/metrics invariants
are guaranteed.

## Testing

`npm test` runs 171 Vitest tests across 8 files:

| Suite | Covers |
| --- | --- |
| `algorithms/algorithms.test.ts` | Correct schedules/metrics for all 6 algorithms, registry, shared-workload invariants |
| `algorithms/edgeCases.test.ts` | Simultaneous arrivals, 1 ms process, 500 ms arrival gap, 20-process stress, frozen-input immutability, tie-breaking, summary recomputed from scratch |
| `engine/engine.test.ts` | Segment contiguity/merging, finalize validation |
| `metrics/metrics.test.ts` | Per-process metric formulas, rounding, edge inputs |
| `validation.test.ts` | Field bounds, duplicates (case-insensitive), error aggregation, quantum rules |
| `ganttModel.test.ts` | Ticks, label gating, colors, block geometry |
| `playbackModel.test.ts` | Step boundaries, next-step time, round-robin round-trip |
| `comparisonModel.test.ts` | Best-per-metric with tie handling, win tally, chart series |

## Accessibility & theming

- Semantic landmarks, skip-to-content link, labelled controls,
  `aria-describedby` error messages, live status announcements.
- Gantt timeline is a labelled scroll region; every block is a focusable
  button with a full sentence label.
- WCAG AA text contrast in both themes (muted text uses slate-500+).
- Dark mode: `index.html` applies the stored/system theme before first paint;
  a central `.dark` CSS layer remaps surfaces, text and tints. Toggle lives in
  the header and persists to `localStorage`.
- `prefers-reduced-motion` disables entrance animations and transitions.

## Future work

- Gantt chart zoom + export (PNG/CSV of the timeline).
- Prebuilt scenario presets (adversarial FCFS vs SRTF cases).
- Multi-level feedback queue and priority-aging demos.
- Shareable state via URL parameters.

## License

Academic / coursework use.
#   C P U - S c h e d u l i n g - S i m u l a t o r  
 