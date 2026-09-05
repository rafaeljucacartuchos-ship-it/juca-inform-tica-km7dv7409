/* Main entry point for the application - renders the root React component */
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'

function Root() {
  useEffect(() => {
    const updateVisibleHeight = () => {
      const vv = window.visualViewport
      if (vv) {
        document.documentElement.style.setProperty('--app-visible-height', `${vv.height}px`)
      } else {
        document.documentElement.style.setProperty('--app-visible-height', '100dvh')
      }
    }

    updateVisibleHeight()

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', updateVisibleHeight)
      vv.addEventListener('scroll', updateVisibleHeight)
    }
    window.addEventListener('resize', updateVisibleHeight)

    return () => {
      if (vv) {
        vv.removeEventListener('resize', updateVisibleHeight)
        vv.removeEventListener('scroll', updateVisibleHeight)
      }
      window.removeEventListener('resize', updateVisibleHeight)
    }
  }, [])

  return <App />
}

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<Root />)
