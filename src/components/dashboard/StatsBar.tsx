import type { ReactNode } from 'react'
import { Card } from '../ui/Card'
import { AlertIcon, ClockIcon, GaugeIcon, LayersIcon } from '../ui/icons'

interface StatsBarProps {
  processCount: number
  totalBurst: number
  avgBurst: number
  invalidCount: number
}

interface Stat {
  label: string
  value: string
  hint: string
  icon: ReactNode
  tone: 'brand' | 'sky' | 'violet' | 'rose' | 'emerald'
}

const TONE_CLASS = {
  brand: 'bg-indigo-50 text-indigo-600',
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
  emerald: 'bg-emerald-50 text-emerald-600',
} as const

export function StatsBar({ processCount, totalBurst, avgBurst, invalidCount }: StatsBarProps) {
  const isEmpty = processCount === 0
  const hasErrors = invalidCount > 0

  const stats: Stat[] = [
    {
      label: 'Processes',
      value: String(processCount),
      hint: isEmpty ? 'workload is empty' : 'in the workload',
      icon: <LayersIcon width={18} height={18} />,
      tone: 'brand',
    },
    {
      label: 'Total CPU time',
      value: `${totalBurst} ms`,
      hint: 'sum of burst times',
      icon: <ClockIcon width={18} height={18} />,
      tone: 'sky',
    },
    {
      label: 'Average burst',
      value: `${avgBurst} ms`,
      hint: 'per process',
      icon: <GaugeIcon width={18} height={18} />,
      tone: 'violet',
    },
    {
      label: 'Validation',
      value: isEmpty ? 'Awaiting input' : hasErrors ? `${invalidCount} issue${invalidCount === 1 ? '' : 's'}` : 'Ready',
      hint: isEmpty ? 'add processes' : hasErrors ? 'fix to simulate' : 'all inputs valid',
      icon: <AlertIcon width={18} height={18} />,
      tone: hasErrors && !isEmpty ? 'rose' : 'emerald',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">{stat.label}</p>
              <p className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {stat.value}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{stat.hint}</p>
            </div>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONE_CLASS[stat.tone]}`}
            >
              {stat.icon}
            </span>
          </div>
        </Card>
      ))}
    </div>
  )
}
