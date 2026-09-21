import { Navigate, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import type { PermissionModule } from '@/lib/permissions'

interface PermissionRouteProps {
  module: PermissionModule
  children?: React.ReactNode
}

const FIRST_MODULE_FALLBACK: { module: PermissionModule; path: string }[] = [
  { module: 'ordens', path: '/ordens' },
  { module: 'orcamentos', path: '/orcamentos' },
  { module: 'clientes', path: '/clientes' },
  { module: 'pos_venda', path: '/pos-venda' },
  { module: 'pedido_mercadoria', path: '/pedido-mercadorias' },
  { module: 'precificacao', path: '/precificacao' },
  { module: 'locacao', path: '/locacao' },
  { module: 'campanhas', path: '/campanhas' },
  { module: 'servicos', path: '/servicos' },
  { module: 'produtos', path: '/produtos' },
  { module: 'equipamentos', path: '/equipamentos' },
  { module: 'relatorios', path: '/relatorios' },
  { module: 'tecnicos', path: '/tecnicos' },
  { module: 'service_types', path: '/tipos-atendimento' },
]

export function PermissionRoute({ module, children }: PermissionRouteProps) {
  const { loading } = useAuth()
  const { hasPermission } = usePermissions()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!hasPermission(module)) {
    // 1. Se o módulo bloqueado NÃO é o dashboard e o usuário tem acesso ao dashboard, vai para /dashboard
    if (module !== 'dashboard' && hasPermission('dashboard')) {
      return <Navigate to="/dashboard" replace />
    }

    // 2. Se o usuário NÃO tem dashboard (ex: rota /dashboard acessada sem permissão),
    // tenta redirecioná-lo para o primeiro módulo que ele possui permissão
    const alternative = FIRST_MODULE_FALLBACK.find((item) => hasPermission(item.module))
    if (alternative) {
      return <Navigate to={alternative.path} replace />
    }

    // 3. Se não tem permissão em módulo algum, cai de forma estável na tela informativa /sem-acesso
    return <Navigate to="/sem-acesso" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
