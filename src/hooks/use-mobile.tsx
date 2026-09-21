/* Use Mobile Hook - A hook that checks if the screen is mobile - from shadcn/ui (exposes useIsMobile) */
import * as React from 'react'

const DESKTOP_BREAKPOINT = 1024

export function useIsMobile(breakpoint: number = DESKTOP_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }
    mql.addEventListener('change', onChange)
    setIsMobile(window.innerWidth < breakpoint)
    return () => mql.removeEventListener('change', onChange)
  }, [breakpoint])

  return !!isMobile
}
