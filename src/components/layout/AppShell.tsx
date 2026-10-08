import type { ReactNode } from 'react'
import { useTheme } from '../../hooks/useTheme'
import type { View } from '../../hooks/useHashRoute'
import { MoonIcon, SunIcon } from '../ui/icons'

interface AppShellProps {
  children: ReactNode
  view: View
  onNavigate: (view: View) => void
}

export function AppShell({ children, view, onNavigate }: AppShellProps) {
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-svh bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur dark:bg-slate-900/85">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-indigo-600/30">
              <CpuGlyph />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
                CPU Scheduling Simulator
              </p>
              <p className="truncate text-xs text-slate-500">
                Operating Systems · Interactive learning lab
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <nav aria-label="Primary" className="flex items-center gap-1">
              <a
                href="#/"
                aria-current={view === 'simulator' ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  if (view !== 'simulator') onNavigate('simulator')
                }}
                className={navLinkClass(view === 'simulator')}
              >
                Simulator
              </a>
              <a
                href="#/about"
                aria-current={view === 'about' ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  if (view !== 'about') onNavigate('about')
                }}
                className={navLinkClass(view === 'about')}
              >
                About
              </a>
            </nav>
            <button
              type="button"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="border-t border-line pt-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-slate-900">CPU Scheduling Simulator</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Operating Systems · AIML(AN) · Final-year academic project — six scheduling
                engines, one workload: watch a schedule, step through it, then compare every
                algorithm side by side.
              </p>
              <a
                href="#/about"
                onClick={(event) => {
                  event.preventDefault()
                  if (view !== 'about') onNavigate('about')
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                About this project
                <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Project guide
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Mrs. S Babar</p>
            </div>
          </div>
          <p className="mt-5 border-t border-line pt-4 text-center text-xs leading-relaxed text-slate-500">
            Team: Yash Tupe · Saheel Khadke · Atharv Bhosale · Bhagyashree Phalphale · Srushti
            Mane · Sanskar Arude
          </p>
        </div>
      </footer>
    </div>
  )
}

function navLinkClass(active: boolean) {
  return [
    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
    active
      ? 'bg-brand-50 text-brand-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')
}

function CpuGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4" />
    </svg>
  )
}
