import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import type { PermissionModule } from '@/lib/permissions'

const MODULE_FALLBACK_ORDER: { module: PermissionModule; path: string }[] = [
  { module: 'dashboard', path: '/dashboard' },
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

/**
 * Retorna a rota inicial ideal para um usuário com base no papel (role) e permissões:
 * - Admin: /dashboard
 * - Técnico: /ordens (se permitido) ou primeiro módulo permitido
 * - Atendente: /dashboard (se permitido) ou /ordens ou primeiro módulo permitido
 */
export function getDefaultRouteForUser(
  role?: string,
  hasPermissionFn?: (module: PermissionModule) => boolean,
): string {
  const hasPerm = hasPermissionFn || (() => true)

  if (role === 'technician') {
    if (hasPerm('ordens')) return '/ordens'
    if (hasPerm('dashboard')) return '/dashboard'
  } else {
    // Admin, Attendant e outros
    if (hasPerm('dashboard')) return '/dashboard'
    if (hasPerm('ordens')) return '/ordens'
  }

  // Fallback: procura o primeiro módulo permitido
  const firstAllowed = MODULE_FALLBACK_ORDER.find((item) => hasPerm(item.module))
  if (firstAllowed) {
    return firstAllowed.path
  }

  return '/sem-acesso'
}

/**
 * Hook para obter a rota inicial do usuário logado
 */
export function useDefaultRoute(): string {
  const { user } = useAuth()
  const { hasPermission } = usePermissions()

  return getDefaultRouteForUser(user?.role, hasPermission)
}
