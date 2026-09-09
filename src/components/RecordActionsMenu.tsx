import React from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface RecordActionItem {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: () => void
  disabled?: boolean
  hidden?: boolean
  variant?: 'default' | 'destructive' | 'warning' | 'success'
  separatorBefore?: boolean
}

interface RecordActionsMenuProps {
  /** Itens disponíveis no menu em cascata */
  items: RecordActionItem[]
  /** Rótulo opcional do menu (padrão: "Mais ações") */
  label?: string
  /** Tamanho do botão disparador */
  triggerSize?: 'default' | 'sm' | 'icon'
  /** Estilo customizado do botão disparador */
  triggerClassName?: string
  /** Alinhamento do dropdown (padrão: 'end') */
  align?: 'start' | 'center' | 'end'
  /** Desativa o botão inteiro */
  disabled?: boolean
  /** Tooltip/título do botão */
  title?: string
}

export function RecordActionsMenu({
  items,
  label,
  triggerSize = 'icon',
  triggerClassName,
  align = 'end',
  disabled = false,
  title = 'Mais ações',
}: RecordActionsMenuProps) {
  // Filtra itens visíveis (respeitando permissões / regras passadas no hidden)
  const visibleItems = items.filter((item) => !item.hidden)

  if (visibleItems.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={triggerSize}
          disabled={disabled}
          title={title}
          aria-label={title}
          onClick={(e) => {
            // Evita disparar cliques de elementos pais (ex.: linhas de tabela ou cards clicáveis)
            e.stopPropagation()
          }}
          className={cn(
            'h-7 w-7 p-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100 data-[state=open]:bg-slate-100 transition-colors',
            triggerClassName,
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{title}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        onClick={(e) => e.stopPropagation()}
        className="w-52 text-xs p-1 shadow-lg"
      >
        {label && (
          <>
            <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              {label}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1 bg-slate-100" />
          </>
        )}

        {visibleItems.map((item, idx) => {
          const Icon = item.icon
          const isDestructive = item.variant === 'destructive'
          const isWarning = item.variant === 'warning'
          const isSuccess = item.variant === 'success'

          return (
            <React.Fragment key={item.key || idx}>
              {item.separatorBefore && <DropdownMenuSeparator className="my-1 bg-slate-100" />}
              <DropdownMenuItem
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  item.onClick()
                }}
                className={cn(
                  'cursor-pointer flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors',
                  isDestructive &&
                    'text-rose-600 focus:text-rose-700 focus:bg-rose-50 hover:text-rose-700 hover:bg-rose-50',
                  isWarning &&
                    'text-amber-700 focus:text-amber-800 focus:bg-amber-50 hover:text-amber-800 hover:bg-amber-50',
                  isSuccess &&
                    'text-emerald-700 focus:text-emerald-800 focus:bg-emerald-50 hover:text-emerald-800 hover:bg-emerald-50',
                  !isDestructive &&
                    !isWarning &&
                    !isSuccess &&
                    'text-slate-700 focus:text-slate-900',
                )}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      isDestructive && 'text-rose-500',
                      isWarning && 'text-amber-600',
                      isSuccess && 'text-emerald-600',
                      !isDestructive && !isWarning && !isSuccess && 'text-slate-500',
                    )}
                  />
                )}
                <span className="truncate">{item.label}</span>
              </DropdownMenuItem>
            </React.Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
export default RecordActionsMenu
