import type { UserRole } from '@/types'

export type PermissionModule =
  | 'dashboard'
  | 'clientes'
  | 'os_create'
  | 'agendamentos'
  | 'ordens'
  | 'os_delete'
  | 'orcamentos'
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
  | 'precificacao'
  | 'locacao'

export type UserPermissions = Record<PermissionModule, boolean>

export const PERMISSION_LABELS: Record<PermissionModule, string> = {
  dashboard: 'Dashboard (Painel Inicial)',
  clientes: 'Cadastro de Clientes',
  os_create: 'Cadastro de Ordens de Serviço (criar OS)',
  agendamentos: 'Atendimentos / Agendamentos',
  ordens: 'Ordens de Serviço (Listagem e Detalhe)',
  os_delete: 'Exclusão de Ordens de Serviço (Excluir OS)',
  orcamentos: 'Módulo de Orçamentos (Listagem e Criação)',
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
  precificacao: 'Módulo de Precificação',
  locacao: 'Locação de Impressoras',
}

export const ALL_PERMISSION_MODULES: PermissionModule[] = [
  'dashboard',
  'clientes',
  'os_create',
  'agendamentos',
  'ordens',
  'os_delete',
  'orcamentos',
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
  'precificacao',
  'locacao',
]

export function getDefaultPermissions(role: UserRole): UserPermissions {
  switch (role) {
    case 'admin':
      return {
        dashboard: true,
        clientes: true,
        os_create: true,
        agendamentos: true,
        ordens: true,
        os_delete: true,
        orcamentos: true,
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
        precificacao: true,
        locacao: true,
      }
    case 'attendant':
      return {
        dashboard: true,
        clientes: true,
        os_create: true,
        agendamentos: true,
        ordens: true,
        os_delete: false,
        orcamentos: true,
        pos_venda: true,
        campanhas: true,
        pedido_mercadoria: true,
        tecnicos: true,
        relatorios: false,
        exportacoes: true,
        permissoes: false,
        equipamentos: true,
        produtos: true,
        servicos: true,
        service_types: false,
        precificacao: true,
        locacao: true,
      }
    case 'technician':
      return {
        dashboard: true,
        clientes: true,
        os_create: true,
        agendamentos: true,
        ordens: true,
        os_delete: false,
        orcamentos: true,
        pos_venda: true,
        campanhas: false,
        pedido_mercadoria: false,
        tecnicos: true,
        relatorios: false,
        exportacoes: false,
        permissoes: false,
        equipamentos: true,
        produtos: true,
        servicos: true,
        service_types: false,
        precificacao: false,
        locacao: false,
      }
    default:
      return {
        dashboard: false,
        clientes: false,
        os_create: false,
        agendamentos: false,
        ordens: false,
        os_delete: false,
        orcamentos: false,
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
        precificacao: false,
        locacao: false,
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
