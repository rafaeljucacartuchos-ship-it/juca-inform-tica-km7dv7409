import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Calendar,
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
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'

interface SidebarProps {
  onNavClick?: () => void
}

export function Sidebar({ onNavClick }: SidebarProps) {
  const location = useLocation()
  const { user, signOut } = useAuth()

  const cadastroChildren = [
    { label: 'Clientes', path: '/clientes', icon: Users },
    { label: 'Equipamentos', path: '/equipamentos', icon: Monitor },
    { label: 'Produtos', path: '/produtos', icon: Package },
    { label: 'Serviços', path: '/servicos', icon: Briefcase },
  ]

  const isCadastroActive = cadastroChildren.some(
    (c) => location.pathname === c.path || location.pathname.startsWith(c.path + '/'),
  )
  const [cadastroOpen, setCadastroOpen] = useState(isCadastroActive)

  useEffect(() => {
    if (isCadastroActive) setCadastroOpen(true)
  }, [isCadastroActive])

  const mainNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Agendamentos', path: '/agendamentos', icon: Calendar },
    { label: 'Ordens de Serviço', path: '/ordens', icon: Wrench },
    { label: 'Relatórios', path: '/relatorios', icon: BarChart3 },
  ]

  const isAdmin = user?.role === 'admin'
  const isPathActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path))

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
      'group relative flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200',
      isActive
        ? 'bg-indigo-600/20 text-indigo-300 shadow-inner'
        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
    )

  return (
    <aside className="flex h-full w-64 flex-col bg-slate-900 text-slate-100 shadow-xl border-r border-slate-800">
      <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
          <Wrench className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold leading-tight tracking-tight text-white">
            Assistência Técnica
          </h1>
          <p className="text-xs text-indigo-400 font-medium">Field Service</p>
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
              onClick={onNavClick}
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

        <Collapsible open={cadastroOpen} onOpenChange={setCadastroOpen}>
          <CollapsibleTrigger className="w-full group flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-all duration-200">
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
                  onClick={onNavClick}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200',
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

        {isAdmin && (
          <Link
            to="/tecnicos"
            onClick={onNavClick}
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
            <span>Técnico</span>
          </Link>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-950/30">
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
          className="w-full justify-start gap-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400 h-9 font-medium"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair da conta</span>
        </Button>
      </div>
    </aside>
  )
}
