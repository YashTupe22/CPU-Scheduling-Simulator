import { useCallback, useEffect, useState } from 'react'

export type View = 'simulator' | 'about'

const ABOUT_HASH = '#/about'
const HOME_HASH = '#/'

function readView(): View {
  return window.location.hash === ABOUT_HASH ? 'about' : 'simulator'
}

/**
 * Minimal hash router: `#/about` opens the About page, everything else keeps
 * the simulator on screen. `pushState` is used instead of assigning
 * `location.hash` so in-page anchors (the skip link) never change the view;
 * the browser back/forward buttons still work through `popstate`.
 */
export function useHashRoute() {
  const [view, setView] = useState<View>(readView)

  useEffect(() => {
    const onPopState = () => setView(readView())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    document.title =
      view === 'about' ? 'About · CPU Scheduling Simulator' : 'CPU Scheduling Simulator'
  }, [view])

  const navigate = useCallback((next: View) => {
    const hash = next === 'about' ? ABOUT_HASH : HOME_HASH
    if (window.location.hash !== hash) window.history.pushState(null, '', hash)
    setView(next)
    window.scrollTo({ top: 0 })
  }, [])

  return { view, navigate }
}
