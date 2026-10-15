import { useEffect } from 'react'

/**
 * Guarda de alterações não salvas para a precificação simplificada.
 * Avisa o usuário antes de recarregar/fechar a página mantendo os dados digitados em sessão.
 */
export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
  return null
}
