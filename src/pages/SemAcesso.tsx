import { ShieldAlert, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { Link } from 'react-router-dom'
import type { PermissionModule } from '@/lib/permissions'

const MODULE_ROUTES: { module: PermissionModule; path: string; label: string }[] = [
  { module: 'dashboard', path: '/dashboard', label: 'Dashboard' },
  { module: 'ordens', path: '/ordens', label: 'Ordens de Serviço' },
  { module: 'orcamentos', path: '/orcamentos', label: 'Orçamentos' },
  { module: 'precificacao', path: '/precificacao', label: 'Precificação' },
  { module: 'locacao', path: '/locacao', label: 'Impressoras Locadas' },
  { module: 'pedido_mercadoria', path: '/pedido-mercadorias', label: 'Pedido de Mercadorias' },
  { module: 'pos_venda', path: '/pos-venda', label: 'Pós-venda (Juquinha)' },
  { module: 'campanhas', path: '/campanhas', label: 'Campanhas' },
  { module: 'clientes', path: '/clientes', label: 'Clientes' },
  { module: 'servicos', path: '/servicos', label: 'Serviços' },
  { module: 'produtos', path: '/produtos', label: 'Produtos' },
  { module: 'equipamentos', path: '/equipamentos', label: 'Equipamentos' },
  { module: 'relatorios', path: '/relatorios', label: 'Relatórios' },
  { module: 'tecnicos', path: '/tecnicos', label: 'Usuários & Permissões' },
  { module: 'service_types', path: '/tipos-atendimento', label: 'Tipos de Atendimento' },
]

export default function SemAcesso() {
  const { user, signOut } = useAuth()
  const { hasPermission } = usePermissions()

  const allowedModules = MODULE_ROUTES.filter((m) => hasPermission(m.module))
  const firstAllowed = allowedModules[0]

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <ShieldAlert className="h-9 w-9" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Acesso Restrito</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Seu usuário ({user?.name || user?.username || 'colaborador'}) não possui permissão para
            acessar esta área. Solicite a liberação ao administrador do sistema.
          </p>
        </div>

        {firstAllowed && (
          <div className="pt-2">
            <Button
              asChild
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              <Link to={firstAllowed.path}>Ir para {firstAllowed.label}</Link>
            </Button>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full text-slate-500 hover:text-red-600 hover:bg-red-50 gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair da conta</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
