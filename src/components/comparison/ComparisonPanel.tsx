import { useMemo } from 'react'
import { AlertIcon } from '../ui/icons'
import { Badge } from '../ui/Badge'
import { Card, CardHeader } from '../ui/Card'
import {
  METRIC_SPECS,
  buildMetricChart,
  formatMetric,
  isBest,
  runComparison,
  winTally,
} from './comparisonModel'
import type { ComparisonRow, MetricChart } from './comparisonModel'
import type { Process } from '../../features/scheduling/types'

interface ComparisonPanelProps {
  processes: readonly Process[]
  /** Time quantum handed to Round Robin during the comparison runs. */
  timeQuantum?: number
  /** Highlighted in the table when it matches the user's current selection. */
  selectedAlgorithmId?: string
}

/**
 * Side-by-side comparison of every supported algorithm on one workload.
 * Metrics come from each engine's own `SimulationResult.summary`.
 */
export function ComparisonPanel({
  processes,
  timeQuantum,
  selectedAlgorithmId,
}: ComparisonPanelProps) {
  const result = useMemo(
    () => runComparison(processes, timeQuantum),
    [processes, timeQuantum],
  )
  const charts = useMemo(
    () => METRIC_SPECS.map((spec) => buildMetricChart(result, spec)),
    [result],
  )
  const tally = useMemo(() => winTally(result), [result])

  return (
    <Card>
      <CardHeader
        title="Algorithm Comparison"
        description="One workload through every supported engine — waiting, turnaround and response are best when lower; utilization and throughput when higher."
      />

      <div className="animate-rise space-y-6 px-5 py-5 sm:px-6">
        {/* Metric charts */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {charts.map((chart) => (
            <MetricChartCard key={chart.spec.key} chart={chart} />
          ))}

          <section className="rounded-xl border border-line bg-slate-50/70 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-xs font-semibold text-slate-800">Metric Wins</h4>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                out of {METRIC_SPECS.length}
              </span>
            </div>
            <ol className="mt-3 space-y-2">
              {tally.map((entry) => (
                <li key={entry.algorithmId} className="flex items-center gap-2">
                  <span
                    className="w-20 shrink-0 truncate text-right text-[11px] font-medium text-slate-500"
                    title={entry.shortName}
                  >
                    {entry.shortName}
                  </span>
                  <span
                    className="flex flex-1 gap-1"
                    aria-label={`${entry.wins} of ${METRIC_SPECS.length} metric wins`}
                  >
                    {METRIC_SPECS.map((spec, index) => (
                      <span
                        key={spec.key}
                        className={`h-2.5 w-2.5 rounded-full ${
                          index < entry.wins ? 'bg-brand-600' : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </span>
                  <span className="w-6 shrink-0 text-right font-mono text-[11px] text-slate-500">
                    {entry.wins}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Comparison table */}
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Comparison table
            </h4>
            <p className="text-[11px] text-slate-500">
              ★ marks the best value per column — ties are all highlighted.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-slate-50">
                  <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Algorithm
                  </th>
                  {METRIC_SPECS.map((spec) => (
                    <th
                      key={spec.key}
                      className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      <span className="block text-slate-600">{spec.shortLabel}</span>
                      <span className="block font-normal normal-case text-slate-500">
                        {spec.unit} · {spec.better} better
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <ComparisonTableRow
                    key={row.algorithmId}
                    row={row}
                    selected={row.algorithmId === selectedAlgorithmId}
                    isCellBest={(key) =>
                      row.metrics !== null && isBest(result, row.algorithmId, key)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          {result.failureCount > 0 ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
              <span>
                {result.failureCount} algorithm{result.failureCount === 1 ? '' : 's'} could not
                run on this workload — the reason is shown in the table and those rows are excluded
                from the charts.
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

function MetricChartCard({ chart }: { chart: MetricChart }) {
  const { spec } = chart
  return (
    <section className="rounded-xl border border-line bg-slate-50/70 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold text-slate-800">{spec.label}</h4>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {spec.better === 'lower' ? 'shorter is better' : 'longer is better'}
        </span>
      </div>

      {chart.bars.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No algorithm produced metrics.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {chart.bars.map((bar) => (
            <li key={bar.algorithmId} className="flex items-center gap-2">
              <span
                className={`w-20 shrink-0 truncate text-right text-[11px] ${
                  bar.isBest ? 'font-semibold text-brand-700' : 'font-medium text-slate-500'
                }`}
                title={bar.shortName}
              >
                {bar.shortName}
              </span>
              <div
                className="h-4 min-w-8 flex-1 overflow-hidden rounded bg-white ring-1 ring-line"
                role="img"
                aria-label={`${bar.shortName}: ${bar.valueLabel}`}
              >
                <div
                  className={`h-full rounded transition-[width] ${
                    bar.isBest ? 'bg-brand-600' : 'bg-slate-300'
                  }`}
                  style={{ width: `${bar.widthPct}%` }}
                />
              </div>
              <span
                className={`w-28 shrink-0 font-mono text-[11px] ${
                  bar.isBest ? 'font-semibold text-brand-700' : 'text-slate-500'
                }`}
              >
                {bar.isBest ? '★ ' : ''}
                {bar.valueLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ComparisonTableRow({
  row,
  selected,
  isCellBest,
}: {
  row: ComparisonRow
  selected: boolean
  isCellBest: (key: (typeof METRIC_SPECS)[number]['key']) => boolean
}) {
  return (
    <tr
      className={`border-b border-line last:border-b-0 ${selected ? 'bg-sky-50/60' : 'bg-white'}`}
    >
      <td className="px-4 py-2.5 align-top">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-slate-800">{row.shortName}</span>
          {selected ? <Badge tone="info">Selected</Badge> : null}
        </div>
        {row.error ? (
          <span className="block text-[11px] text-rose-500">{row.error}</span>
        ) : (
          <span className="block text-[11px] text-slate-500">
            {row.name}
            {row.preemption ? ` · ${row.preemption}` : ''}
          </span>
        )}
      </td>
      {METRIC_SPECS.map((spec) => {
        const best = row.metrics !== null && isCellBest(spec.key)
        return (
          <td
            key={spec.key}
            className={`px-4 py-2.5 font-mono text-xs ${
              best
                ? 'rounded bg-brand-50 font-semibold text-brand-700'
                : row.metrics !== null
                  ? 'text-slate-600'
                  : 'text-slate-500'
            }`}
          >
            {row.metrics !== null
              ? `${best ? '★ ' : ''}${formatMetric(spec, row.metrics[spec.key])}`
              : '—'}
          </td>
        )
      })}
    </tr>
  )
}
