import { ALGORITHMS } from '../../features/scheduling/definitions'
import { Card, CardHeader } from '../ui/Card'

const TEAM_MEMBERS = [
  'Yash Tupe',
  'Saheel Khadke',
  'Sanskar Arude',
] as const

const PROJECT_DETAILS = [
  { label: 'Subject', value: 'Operating Systems' },
  { label: 'Course', value: 'AIML(AN) — Final Year' },
  { label: 'Project guide', value: 'Mrs. S.S. Babar' },
  { label: 'Team', value: '3 members' },
  { label: 'Built with', value: 'React 19 · TypeScript · Vite · Tailwind CSS v4' },
  { label: 'Algorithms', value: '6 scheduling algorithms' },
] as const

const WORKING_STEPS = [
  {
    title: 'Build the workload',
    body: 'Each process is entered in the input table with an arrival time, a burst time and a priority — or loaded from the built-in sample workload in one click.',
  },
  {
    title: 'Validate the input',
    body: 'Every field is checked against the rules taught in the course (whole numbers, valid bounds, unique process IDs), and errors are highlighted before a simulation can run.',
  },
  {
    title: 'Run the scheduler',
    body: "The selected algorithm's engine expands the workload into an ordered, contiguous timeline of execution segments starting at time 0, inserting an idle gap whenever no process is ready to run.",
  },
  {
    title: 'Compute the metrics',
    body: 'Completion, turnaround, waiting and response times are derived from that timeline for every process, along with schedule-wide averages, CPU utilisation and throughput.',
  },
  {
    title: 'Visualise and replay',
    body: 'The timeline is drawn as a Gantt chart with hover details, and the step-through simulator replays it at 0.25×–4× speed with play, pause, step and reset controls.',
  },
  {
    title: 'Compare the algorithms',
    body: 'The same workload is re-run through all six engines and charted side by side, with per-metric winners and a win tally so the trade-offs between algorithms are visible at a glance.',
  },
] as const

export function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Operating Systems · AIML(AN) · Final Year
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          About the project
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
          The CPU Scheduling Simulator turns the scheduling algorithms taught in our Operating
          Systems course into an interactive lab: build a workload, run a scheduler, and watch the
          resulting timeline, metrics and comparisons — instead of computing them by hand.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Project details"
          description="Submission information for this coursework project."
        />
        <dl className="grid gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {PROJECT_DETAILS.map((detail) => (
            <div key={detail.label}>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {detail.label}
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="How it works"
          description="The working of the simulator, from raw process input to a finished comparison."
        />
        <ol className="divide-y divide-line">
          {WORKING_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4 px-5 py-4 sm:px-6">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader
          title="Supported algorithms"
          description="The six scheduling algorithms implemented behind a shared engine."
        />
        <div className="overflow-x-auto px-5 py-5 sm:px-6">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-slate-50">
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Algorithm
                </th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Preemption
                </th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Uses priority
                </th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Uses quantum
                </th>
              </tr>
            </thead>
            <tbody>
              {ALGORITHMS.map((algorithm) => (
                <tr key={algorithm.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-slate-900">{algorithm.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{algorithm.shortName}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{algorithm.preemption}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {algorithm.usesPriority ? 'Yes' : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {algorithm.usesTimeQuantum ? 'Yes' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Project team"
          description="Developed by a team of six as part of the final-year coursework."
        />
        <ol className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {TEAM_MEMBERS.map((name, index) => (
            <li
              key={name}
              className="flex items-center gap-3 rounded-xl border border-line bg-slate-50 px-3 py-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span className="min-w-0 truncate text-sm font-medium text-slate-900">{name}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader
          title="Project guide & acknowledgement"
          description="Guidance and support behind this project."
        />
        <div className="space-y-4 px-5 py-5 text-sm leading-relaxed text-slate-600 sm:px-6">
          <p>
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Project guide{' '}
            </span>
            <span className="block text-base font-semibold text-slate-900">Mrs. S Babar</span>
          </p>
          <p>
            This project has been developed for the <strong>Operating Systems</strong> subject as
            part of the final-year course of <strong>AIML(AN)</strong>. The concepts, algorithms
            and working demonstrated in this simulator are based on the theory and practicals
            taught by our faculty. We sincerely thank our project guide, Mrs. S Babar, and the
            faculty for their guidance and support throughout the development of this project.
          </p>
        </div>
      </Card>
    </div>
  )
}
