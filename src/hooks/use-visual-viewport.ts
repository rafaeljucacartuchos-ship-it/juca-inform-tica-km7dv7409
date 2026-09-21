import { useEffect, useState } from 'react'

export interface VisualViewportState {
  visibleHeight: number
  offsetTop: number
  isKeyboardOpen: boolean
}

/**
 * Hook para acompanhar a altura útil visível da tela em tempo real,
 * especialmente em dispositivos móveis (iOS Safari / Android Chrome)
 * quando o teclado virtual é aberto ou fechado.
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(() => {
    if (typeof window === 'undefined') {
      return { visibleHeight: 800, offsetTop: 0, isKeyboardOpen: false }
    }
    const vv = window.visualViewport
    const height = vv ? Math.round(vv.height) : window.innerHeight
    const offsetTop = vv ? Math.round(vv.offsetTop || 0) : 0
    const isKeyboardOpen = window.innerHeight - height > 120
    return { visibleHeight: height, offsetTop, isKeyboardOpen }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleUpdate = () => {
      const vv = window.visualViewport
      const height = vv ? Math.round(vv.height) : window.innerHeight
      const offsetTop = vv ? Math.round(vv.offsetTop || 0) : 0
      // No iOS, quando o teclado abre, a diferença entre window.innerHeight e vv.height supera ~100px
      const isKeyboardOpen = typeof window !== 'undefined' && window.innerHeight - height > 100

      // Atualiza variáveis CSS em documentElement para fallback global
      document.documentElement.style.setProperty('--app-visible-height', `${height}px`)
      document.documentElement.style.setProperty('--teclado-altura', `${height}px`)
      document.documentElement.style.setProperty('--visual-viewport-height', `${height}px`)
      document.documentElement.style.setProperty('--visual-viewport-offset-top', `${offsetTop}px`)
      document.documentElement.setAttribute('data-keyboard-open', isKeyboardOpen ? 'true' : 'false')

      setState({ visibleHeight: height, offsetTop, isKeyboardOpen })
    }

    handleUpdate()

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', handleUpdate)
      vv.addEventListener('scroll', handleUpdate)
    }
    window.addEventListener('resize', handleUpdate)
    window.addEventListener('orientationchange', handleUpdate)

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleUpdate)
        vv.removeEventListener('scroll', handleUpdate)
      }
      window.removeEventListener('resize', handleUpdate)
      window.removeEventListener('orientationchange', handleUpdate)
    }
  }, [])

  return state
}
