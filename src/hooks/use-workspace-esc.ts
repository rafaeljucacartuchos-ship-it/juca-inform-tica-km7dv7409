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

      // Prioridade 1: Telas internas/filhas com botão de fechar customizado (ex: [data-workspace-inner-close])
      // Se houver uma tela interna montada diretamente no container (ex: detalhe de orçamento aberto na lista),
      // o ESC aciona o fechamento da tela filha antes de tentar fechar a aba inteira.
      const innerCloseBtn = document.querySelector<HTMLButtonElement>(
        '[data-workspace-inner-close="true"]:not([disabled])',
      )
      if (innerCloseBtn) {
        e.preventDefault()
        e.stopPropagation()
        innerCloseBtn.click()
        return
      }

      // Prioridade 2: Modais, alertas, dropdowns, selects, comboboxes, sheets ou popovers abertos
      // Radix UI e componentes shadcn definem role="dialog", role="alertdialog", role="menu", role="listbox",
      // data-state="open", aria-modal="true", [data-radix-popper-content-wrapper], etc.
      // Também verificar se o foco atual está dentro de um popup ou menu.
      const hasOpenModal = Boolean(
        document.querySelector(
          '[role="dialog"], [role="alertdialog"], [data-state="open"][role="menu"], [data-state="open"][role="listbox"], [data-radix-popper-content-wrapper], [data-state="open"][aria-modal="true"], [data-state="open"][data-radix-select-content], [data-state="open"][data-radix-dropdown-menu-content]',
        ),
      )

      if (hasOpenModal) {
        // Deixa o Radix UI / shadcn lidar com o fechamento do modal / overlay
        return
      }

      // Se o evento foi cancelado ou evitado por algum listener anterior, respeitar
      if (e.defaultPrevented) {
        return
      }

      // Prioridade 3: Se nenhum elemento interno estiver aberto, fecha a aba ativa do workspace
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
