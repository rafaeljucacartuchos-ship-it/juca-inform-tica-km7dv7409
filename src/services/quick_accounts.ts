import { User } from '@/types'

const PB_URL = (import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/$/, '')

export type QuickAccount = Pick<User, 'id' | 'username' | 'name' | 'role'>

/**
 * Contas de acesso rápido (admin/atendente/técnico) exibidas na tela de login.
 *
 * Usa o endpoint NATIVO do PocketBase (view collection pública `quick_accounts`,
 * exposta em `GET /api/collections/quick_accounts/records`) com a URL absoluta
 * do backend — portanto funciona em produção (o React Router não intercepta,
 * diferentemente das rotas relativas `/backend/v1/*`). Não requer autenticação e
 * retorna apenas id, username, name e role.
 */
export const getQuickAccounts = async (): Promise<QuickAccount[]> => {
  const url = `${PB_URL}/api/collections/quick_accounts/records?fields=id,username,name,role&sort=name&perPage=200`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao buscar contas rápidas')
  const data: { items: QuickAccount[] } = await res.json()
  return data.items || []
}
