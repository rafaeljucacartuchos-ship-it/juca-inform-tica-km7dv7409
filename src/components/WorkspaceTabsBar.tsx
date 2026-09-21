import React from 'react'
import {
  X,
  LayoutDashboard,
  Wrench,
  FileText,
  Tag,
  Printer,
  ShoppingCart,
  Sparkles,
  Megaphone,
  BarChart3,
  Users,
  Monitor,
  Package,
  Briefcase,
  UserCog,
  Layers,
} from 'lucide-react'
import { useWorkspace, WorkspaceTab } from '@/hooks/use-workspace'
import { useWorkspaceEscShortcut } from '@/hooks/use-workspace-esc'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

function getTabIcon(tab: WorkspaceTab) {
  switch (tab.moduleKey) {
    case 'dashboard':
      return LayoutDashboard
    case 'ordens':
    case 'ordens_detail':
      return Wrench
    case 'orcamentos':
    case 'orcamentos_novo':
    case 'orcamentos_detail':
      return FileText
    case 'precificacao':
      return Tag
    case 'locacao':
      return Printer
    case 'pedido_mercadoria':
      return ShoppingCart
    case 'pos_venda':
      return Sparkles
    case 'campanhas':
      return Megaphone
    case 'clientes':
    case 'clientes_detail':
      return Users
    case 'servicos':
      return Briefcase
    case 'produtos':
      return Package
    case 'equipamentos':
      return Monitor
    case 'relatorios':
    case 'relatorios_avaliacoes':
      return BarChart3
    case 'tecnicos':
      return UserCog
    case 'service_types':
      return Tag
    default:
      return Layers
  }
}

export function WorkspaceTabsBar() {
  const { tabs, activeTabId, activateTab, closeTab, isDesktopWorkspace } = useWorkspace()

  // Ativa listener do atalho ESC quando a barra estiver montada
  useWorkspaceEscShortcut()

  // Se for mobile ou se não houver abas, não exibe
  // O dashboard nunca é exibido na lista de abas ("o dashboard não precisa constar na barra")
  const visibleTabs = tabs.filter(
    (t) => t.moduleKey !== 'dashboard' && t.basePath !== '/dashboard' && t.basePath !== '/',
  )

  if (!isDesktopWorkspace || visibleTabs.length === 0) {
    return null
  }

  return (
    <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs overflow-x-auto select-none no-scrollbar shadow-inner">
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {visibleTabs.map((tab) => {
          const isActive = tab.id === activeTabId
          const Icon = getTabIcon(tab)

          return (
            <Tooltip key={tab.id} delayDuration={300}>
              <TooltipTrigger asChild>
                <div
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => activateTab(tab.id)}
                  className={cn(
                    'group relative flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all duration-150 shrink-0 max-w-[210px] border text-left',
                    isActive
                      ? 'bg-slate-800 text-white font-medium border-indigo-500/60 shadow-sm'
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 transition-colors',
                      isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300',
                    )}
                  />

                  <div className="truncate flex-1 min-w-0">
                    <span className="block truncate text-xs leading-tight">{tab.title}</span>
                    {tab.subtitle && (
                      <span className="block truncate text-[10px] text-slate-400 font-normal leading-none">
                        {tab.subtitle}
                      </span>
                    )}
                  </div>

                  {tab.closable && (
                    <button
                      type="button"
                      aria-label={`Fechar ${tab.title}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(tab.id)
                      }}
                      className={cn(
                        'ml-1 rounded p-0.5 text-slate-400 hover:text-white hover:bg-red-500/20 transition-colors shrink-0',
                        isActive
                          ? 'opacity-90 hover:bg-slate-700/80'
                          : 'opacity-0 group-hover:opacity-100',
                      )}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}

                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-500 rounded-full" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="text-xs bg-slate-900 text-slate-200 border-slate-700"
              >
                <div className="space-y-0.5">
                  <p className="font-semibold">{tab.title}</p>
                  {tab.subtitle && <p className="text-slate-400 text-[11px]">{tab.subtitle}</p>}
                  {tab.closable ? (
                    <p className="text-[10px] text-indigo-300 flex items-center gap-1 pt-0.5 border-t border-slate-800">
                      <kbd className="px-1 py-0.2 bg-slate-800 rounded border border-slate-700 font-mono text-[9px]">
                        ESC
                      </kbd>
                      <span>fecha a aba ativa</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400">Aba principal fixada</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <div className="flex items-center gap-2 pl-2 text-[11px] text-slate-400 shrink-0 border-l border-slate-800/80">
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60">
          {visibleTabs.length}/8 telas
        </span>
        <span className="hidden xl:inline text-[10px] text-slate-400">
          Dica:{' '}
          <kbd className="px-1 py-0.2 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono text-[9px]">
            ESC
          </kbd>{' '}
          fecha a tela atual
        </span>
      </div>
    </div>
  )
}
