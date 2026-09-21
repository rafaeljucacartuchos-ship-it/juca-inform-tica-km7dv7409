/* Main entry point for the application - renders the root React component */
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { installDomMutationCrashGuard } from './lib/dom-guard'

// Proteção preventiva contra erros 'removeChild'/'insertBefore' oriundos de extensões/Google Translate
installDomMutationCrashGuard()

function Root() {
  useEffect(() => {
    const updateVisibleHeight = () => {
      const vv = window.visualViewport
      if (vv) {
        const height = Math.round(vv.height)
        const offsetTop = Math.round(vv.offsetTop || 0)
        // Altura visível real da tela considerando teclado aberto
        document.documentElement.style.setProperty('--app-visible-height', `${height}px`)
        document.documentElement.style.setProperty('--teclado-altura', `${height}px`)
        document.documentElement.style.setProperty('--visual-viewport-height', `${height}px`)
        document.documentElement.style.setProperty('--visual-viewport-offset-top', `${offsetTop}px`)
        // Detecta se teclado está aberto no mobile (diferença expressiva entre window.innerHeight e vv.height)
        const isKeyboardOpen = window.innerHeight - height > 100
        document.documentElement.setAttribute(
          'data-keyboard-open',
          isKeyboardOpen ? 'true' : 'false',
        )
      } else {
        document.documentElement.style.setProperty('--app-visible-height', '100dvh')
        document.documentElement.style.setProperty('--teclado-altura', '100dvh')
        document.documentElement.style.setProperty('--visual-viewport-height', '100dvh')
        document.documentElement.style.setProperty('--visual-viewport-offset-top', '0px')
        document.documentElement.setAttribute('data-keyboard-open', 'false')
      }
    }

    updateVisibleHeight()

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', updateVisibleHeight)
      vv.addEventListener('scroll', updateVisibleHeight)
    }
    window.addEventListener('resize', updateVisibleHeight)
    window.addEventListener('orientationchange', updateVisibleHeight)

    return () => {
      if (vv) {
        vv.removeEventListener('resize', updateVisibleHeight)
        vv.removeEventListener('scroll', updateVisibleHeight)
      }
      window.removeEventListener('resize', updateVisibleHeight)
      window.removeEventListener('orientationchange', updateVisibleHeight)
    }
  }, [])

  return <App />
}

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<Root />)
