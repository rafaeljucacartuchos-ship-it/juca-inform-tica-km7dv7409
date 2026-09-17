import { useEffect, useCallback } from 'react'
import { useWorkspace } from '@/hooks/use-workspace'

/**
 * Hook para detectar quando o usuário pressiona ESC no DESKTOP:
 * - Se houver modal/dialog/sheet/dropdown aberto na tela, NÃO fecha a aba (deixa o modal fechar)
 * - Se não houver nenhum modal aberto, fecha a aba ativa atual e volta para a anterior
 */
export function useWorkspaceEscShortcut() {
  const { closeActiveTab, isDesktopWorkspace } = useWorkspace()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (!isDesktopWorkspace) return

      // Verifica se há modais, alertas, dropdowns, sheets ou menus abertos
      // Radix UI e componentes shadcn definem role="dialog", role="alertdialog", role="menu", etc.
      // e atributos data-state="open".
      const hasOpenModal = Boolean(
        document.querySelector(
          '[role="dialog"], [role="alertdialog"], [data-state="open"][role="menu"], [data-radix-popper-content-wrapper], [data-state="open"][aria-modal="true"]',
        ),
      )

      if (hasOpenModal) {
        // Deixa o Radix UI / shadcn lidar com o fechamento do modal
        return
      }

      // Se nenhum modal estiver aberto, fecha a aba ativa
      e.preventDefault()
      closeActiveTab()
    },
    [isDesktopWorkspace, closeActiveTab],
  )

  useEffect(() => {
    // Adiciona listener com captura para interceptar após o event loop se necessário
    // mas usando bubbling padrão para permitir que modais com preventDefault operem primeiro
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}
