import type { UserRole } from '@/types'

export type PermissionModule =
  | 'clientes'
  | 'os_create'
  | 'agendamentos'
  | 'ordens'
  | 'tecnicos'
  | 'relatorios'
  | 'exportacoes'
  | 'permissoes'
  | 'equipamentos'
  | 'produtos'
  | 'servicos'

export type UserPermissions = Record<PermissionModule, boolean>

export const PERMISSION_LABELS: Record<PermissionModule, string> = {
  clientes: 'Cadastro de Clientes',
  os_create: 'Cadastro de Ordens de Serviço (criar OS)',
  agendamentos: 'Atendimentos / Agendamentos',
  ordens: 'Ordens de Serviço (Listagem e Detalhe)',
  tecnicos: 'Técnicos (Gerenciar Usuários)',
  relatorios: 'Relatórios',
  exportacoes: 'Exportações',
  permissoes: 'Configurações / Permissões',
  equipamentos: 'Cadastro de Equipamentos',
  produtos: 'Cadastro de Produtos',
  servicos: 'Cadastro de Serviços',
}

export const ALL_PERMISSION_MODULES: PermissionModule[] = [
  'clientes',
  'os_create',
  'agendamentos',
  'ordens',
  'tecnicos',
  'relatorios',
  'exportacoes',
  'permissoes',
  'equipamentos',
  'produtos',
  'servicos',
]

export function getDefaultPermissions(role: UserRole): UserPermissions {
  switch (role) {
    case 'admin':
      return {
        clientes: true,
        os_create: true,
        agendamentos: true,
        ordens: true,
        tecnicos: true,
        relatorios: true,
        exportacoes: true,
        permissoes: true,
        equipamentos: true,
        produtos: true,
        servicos: true,
      }
    case 'attendant':
      return {
        clientes: true,
        os_create: true,
        agendamentos: true,
        ordens: true,
        tecnicos: false,
        relatorios: false,
        exportacoes: true,
        permissoes: false,
        equipamentos: true,
        produtos: true,
        servicos: true,
      }
    case 'technician':
      return {
        clientes: false,
        os_create: false,
        agendamentos: true,
        ordens: true,
        tecnicos: false,
        relatorios: false,
        exportacoes: false,
        permissoes: false,
        equipamentos: false,
        produtos: false,
        servicos: false,
      }
    default:
      return {
        clientes: false,
        os_create: false,
        agendamentos: false,
        ordens: false,
        tecnicos: false,
        relatorios: false,
        exportacoes: false,
        permissoes: false,
        equipamentos: false,
        produtos: false,
        servicos: false,
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
