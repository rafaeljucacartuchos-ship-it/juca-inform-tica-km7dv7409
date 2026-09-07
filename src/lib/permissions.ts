import type { UserRole } from '@/types'

export type PermissionModule =
  | 'clientes'
  | 'os_create'
  | 'agendamentos'
  | 'ordens'
  | 'pos_venda'
  | 'campanhas'
  | 'pedido_mercadoria'
  | 'tecnicos'
  | 'relatorios'
  | 'exportacoes'
  | 'permissoes'
  | 'equipamentos'
  | 'produtos'
  | 'servicos'
  | 'service_types'

export type UserPermissions = Record<PermissionModule, boolean>

export const PERMISSION_LABELS: Record<PermissionModule, string> = {
  clientes: 'Cadastro de Clientes',
  os_create: 'Cadastro de Ordens de Serviço (criar OS)',
  agendamentos: 'Atendimentos / Agendamentos',
  ordens: 'Ordens de Serviço (Listagem e Detalhe)',
  pos_venda: 'Pós-venda — Juquinha',
  campanhas: 'Campanhas de Marketing',
  pedido_mercadoria: 'Pedido de Mercadorias e Reposição',
  tecnicos: 'Técnicos (Gerenciar Usuários)',
  relatorios: 'Relatórios',
  exportacoes: 'Exportações',
  permissoes: 'Configurações / Permissões',
  equipamentos: 'Cadastro de Equipamentos',
  produtos: 'Cadastro de Produtos',
  servicos: 'Cadastro de Serviços',
  service_types: 'Tipos de Atendimento (Admin)',
}

export const ALL_PERMISSION_MODULES: PermissionModule[] = [
  'clientes',
  'os_create',
  'agendamentos',
  'ordens',
  'pos_venda',
  'campanhas',
  'pedido_mercadoria',
  'tecnicos',
  'relatorios',
  'exportacoes',
  'permissoes',
  'equipamentos',
  'produtos',
  'servicos',
  'service_types',
]

export function getDefaultPermissions(role: UserRole): UserPermissions {
  switch (role) {
    case 'admin':
      return {
        clientes: true,
        os_create: true,
        agendamentos: true,
        ordens: true,
        pos_venda: true,
        campanhas: true,
        pedido_mercadoria: true,
        tecnicos: true,
        relatorios: true,
        exportacoes: true,
        permissoes: true,
        equipamentos: true,
        produtos: true,
        servicos: true,
        service_types: true,
      }
    case 'attendant':
      return {
        clientes: true,
        os_create: true,
        agendamentos: true,
        ordens: true,
        pos_venda: true,
        campanhas: true,
        pedido_mercadoria: true,
        tecnicos: false,
        relatorios: false,
        exportacoes: true,
        permissoes: false,
        equipamentos: true,
        produtos: true,
        servicos: true,
        service_types: false,
      }
    case 'technician':
      return {
        clientes: false,
        os_create: false,
        agendamentos: true,
        ordens: true,
        pos_venda: true,
        campanhas: false,
        pedido_mercadoria: false,
        tecnicos: false,
        relatorios: false,
        exportacoes: false,
        permissoes: false,
        equipamentos: false,
        produtos: false,
        servicos: false,
        service_types: false,
      }
    default:
      return {
        clientes: false,
        os_create: false,
        agendamentos: false,
        ordens: false,
        pos_venda: false,
        campanhas: false,
        pedido_mercadoria: false,
        tecnicos: false,
        relatorios: false,
        exportacoes: false,
        permissoes: false,
        equipamentos: false,
        produtos: false,
        servicos: false,
        service_types: false,
      }
  }
}

export function getUserPermissions(
  role: UserRole,
  custom?: Record<string, boolean> | null,
): UserPermissions {
  const defaults = getDefaultPermissions(role)
  if (custom && typeof custom === 'object') {
    return { ...defaults, ...custom }
  }
  return defaults
}
