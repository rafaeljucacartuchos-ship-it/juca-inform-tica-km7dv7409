import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Wrench,
  Users,
  Briefcase,
  BarChart3,
  LogOut,
  ShieldAlert,
  Headphones,
  User as UserIcon,
  Database,
  Monitor,
  Package,
  UserCog,
  ChevronDown,
  Tag,
  Sparkles,
  ShoppingCart,
  Megaphone,
  Printer,
  FileText,
  Download,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { usePermissions } from '@/hooks/use-permissions'
import { useWorkspace, getModuleInfoFromPath } from '@/hooks/use-workspace'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import type { PermissionModule } from '@/lib/permissions'

interface SidebarProps {
  onNavClick?: () => void
}

export function Sidebar({ onNavClick }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { hasPermission } = usePermissions()
  const { isInstallable, promptInstall, isStandalone } = usePwaInstall()
  const { tabs, activateTab, isDesktopWorkspace } = useWorkspace()

  const allCadastroChildren = [
    {
      label: 'Clientes',
      path: '/clientes',
      icon: Users,
      permission: 'clientes' as PermissionModule,
    },
    {
      label: 'Equipamentos',
      path: '/equipamentos',
      icon: Monitor,
      permission: 'equipamentos' as PermissionModule,
    },
    {
      label: 'Produtos',
      path: '/produtos',
      icon: Package,
      permission: 'produtos' as PermissionModule,
    },
    {
      label: 'Serviços',
      path: '/servicos',
      icon: Briefcase,
      permission: 'servicos' as PermissionModule,
    },
    ...(user?.role === 'admin'
      ? [
          {
            label: 'Tipos de Atendimento',
            path: '/tipos-atendimento',
            icon: Tag,
            permission: 'service_types' as PermissionModule,
          },
        ]
      : []),
  ]
  const cadastroChildren = allCadastroChildren.filter((c) => hasPermission(c.permission))

  const isCadastroActive = cadastroChildren.some(
    (c) => location.pathname === c.path || location.pathname.startsWith(c.path + '/'),
  )
  const [cadastroOpen, setCadastroOpen] = useState(isCadastroActive)

  useEffect(() => {
    if (isCadastroActive) setCadastroOpen(true)
  }, [isCadastroActive])

  const mainNavItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      show: hasPermission('dashboard'),
    },
    { label: 'Ordens de Serviço', path: '/ordens', icon: Wrench, show: hasPermission('ordens') },
    {
      label: 'Orçamentos',
      path: '/orcamentos',
      icon: FileText,
      show: hasPermission('orcamentos'),
    },
    {
      label: 'Precificação',
      path: '/precificacao',
      icon: Tag,
      show: hasPermission('precificacao') || user?.role === 'admin' || user?.role === 'attendant',
    },
    {
      label: 'Impressoras Locadas',
      path: '/locacao',
      icon: Printer,
      show: hasPermission('locacao') || user?.role === 'admin' || user?.role === 'attendant',
    },
    {
      label: 'Pedido de Mercadoria',
      path: '/pedido-mercadorias',
      icon: ShoppingCart,
      show: hasPermission('pedido_mercadoria'),
    },
    {
      label: 'Pós-venda (Juquinha)',
      path: '/pos-venda',
      icon: Sparkles,
      show: hasPermission('pos_venda'),
    },
    {
      label: 'Campanhas',
      path: '/campanhas',
      icon: Megaphone,
      show: hasPermission('campanhas'),
    },
    {
      label: 'Relatórios OS',
      path: '/relatorios',
      icon: BarChart3,
      show: hasPermission('relatorios'),
    },
    {
      label: 'Avaliações',
      path: '/relatorios/avaliacoes',
      icon: BarChart3,
      show: hasPermission('relatorios'),
    },
  ].filter((item) => item.show)
  const showTecnicos = hasPermission('tecnicos')
  const showCadastro = cadastroChildren.length > 0

  const isPathActive = (path: string) =>
    location.pathname === path ||
    (path !== '/' && path !== '/relatorios' && location.pathname.startsWith(path))

  // Ao clicar em um módulo no desktop:
  // Se já existe aba aberta daquele módulo, ativa ela na última tela em que estava (keep-alive);
  // se não existe, navega normalmente (o que abrirá uma nova aba).
  const handleModuleClick = (e: React.MouseEvent, targetPath: string) => {
    if (onNavClick) {
      onNavClick()
    }

    if (!isDesktopWorkspace) {
      return
    }

    const { moduleKey } = getModuleInfoFromPath(targetPath)
    // Procura se já há uma aba desse módulo aberta no workspace
    // Ordena priorizando a que coincide com o moduleKey ou cujo path inicia por targetPath
    const existingTab = tabs.find(
      (t) =>
        t.moduleKey === moduleKey ||
        t.basePath === targetPath ||
        t.path.startsWith(targetPath + '/') ||
        t.path === targetPath,
    )

    if (existingTab) {
      e.preventDefault()
      activateTab(existingTab.id)
    }
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador'
      case 'attendant':
        return 'Atendente'
      case 'technician':
        return 'Técnico de Campo'
      default:
        return 'Usuário'
    }
  }
  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return <ShieldAlert className="h-3 w-3 text-amber-400" />
      case 'attendant':
        return <Headphones className="h-3 w-3 text-sky-400" />
      default:
        return <UserIcon className="h-3 w-3 text-emerald-400" />
    }
  }

  const navLinkClass = (isActive: boolean) =>
    cn(
      'group relative flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium min-h-[44px] touch-manipulation transition-all duration-200 active:scale-[0.98]',
      isActive
        ? 'bg-indigo-600/20 text-indigo-300 shadow-inner'
        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
    )

  return (
    <aside className="flex h-full w-64 flex-col bg-slate-900 text-slate-100 shadow-xl border-r border-slate-800 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16 items-center gap-3 px-3.5 border-b border-slate-800/80 bg-slate-950/50">
        <div className="h-10 w-20 shrink-0 overflow-hidden rounded-md bg-slate-950 p-1 flex items-center justify-center border border-slate-800">
          <img
            src="https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/819ad1b5-1865-4f2e-9fe9-f488ce98c0b0/img6259-fc419.jpg"
            alt="JUCA Informática"
            className="h-full w-full object-contain"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = '/logo.svg'
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xs font-bold leading-tight tracking-tight text-white truncate">
            JUCA INFORMÁTICA
          </h1>
          <p className="text-[10px] text-blue-400 font-medium truncate">Solução e Tecnologia</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
        {mainNavItems.map((item) => {
          const isActive = isPathActive(item.path)
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={(e) => handleModuleClick(e, item.path)}
              className={navLinkClass(isActive)}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-indigo-500 shadow-sm shadow-indigo-500" />
              )}
              <Icon
                className={cn(
                  'h-5 w-5 transition-transform duration-200 group-hover:scale-110',
                  isActive ? 'text-indigo-400' : 'text-slate-400',
                )}
              />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {showCadastro && (
          <Collapsible open={cadastroOpen} onOpenChange={setCadastroOpen}>
            <CollapsibleTrigger className="w-full group flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium min-h-[44px] touch-manipulation text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-all duration-200 active:scale-[0.98]">
              <Database
                className={cn(
                  'h-5 w-5 transition-transform duration-200 group-hover:scale-110',
                  isCadastroActive && 'text-indigo-400',
                )}
              />
              <span className="flex-1 text-left">Cadastro</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  cadastroOpen && 'rotate-180',
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1 ml-4 pl-3 border-l border-slate-700/50">
              {cadastroChildren.map((item) => {
                const isActive = isPathActive(item.path)
                const Icon = item.icon
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => handleModuleClick(e, item.path)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium min-h-[44px] touch-manipulation transition-all duration-200 active:scale-[0.98]',
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-300'
                        : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {showTecnicos && (
          <Link
            to="/tecnicos"
            onClick={(e) => handleModuleClick(e, '/tecnicos')}
            className={navLinkClass(isPathActive('/tecnicos'))}
          >
            {isPathActive('/tecnicos') && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-indigo-500 shadow-sm shadow-indigo-500" />
            )}
            <UserCog
              className={cn(
                'h-5 w-5 transition-transform duration-200 group-hover:scale-110',
                isPathActive('/tecnicos') ? 'text-indigo-400' : 'text-slate-400',
              )}
            />
            <span>Usuários &amp; Permissões</span>
          </Link>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-950/30 space-y-2">
        {!isStandalone && isInstallable && (
          <button
            type="button"
            onClick={promptInstall}
            className="w-full flex items-center gap-2.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 transition-colors"
          >
            <Download className="h-4 w-4 shrink-0 text-indigo-400" />
            <div className="text-left">
              <p className="leading-tight">Instalar App no celular</p>
              <p className="text-[10px] font-normal text-slate-400">Acesso rápido em campo</p>
            </div>
          </button>
        )}
        <div className="flex items-center gap-3 rounded-lg bg-slate-800/50 p-2.5 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-indigo-300 border border-slate-600">
            {user?.name ? user.name.substring(0, 2).toUpperCase() : 'AT'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {user?.name || 'Técnico'}
            </p>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              {getRoleBadge(user?.role)}
              <span>{getRoleLabel(user?.role)}</span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start gap-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400 min-h-[44px] h-11 font-medium touch-manipulation"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair da conta</span>
        </Button>
      </div>
    </aside>
  )
}
