import pb from '@/lib/pocketbase/client'
import { Funcao, UserRole } from '@/types'

export const getFuncoes = async (): Promise<Funcao[]> => {
  try {
    return await pb.collection('funcoes').getFullList<Funcao>({
      sort: 'nome',
    })
  } catch (err) {
    console.error('Erro ao listar funções:', err)
    return [
      { id: 'admin', nome: 'Administrador' },
      { id: 'technician', nome: 'Técnico' },
      { id: 'attendant', nome: 'Atendente' },
    ]
  }
}

export const createFuncao = async (nome: string): Promise<Funcao> => {
  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Nome da função é obrigatório')
  }
  return pb.collection('funcoes').create<Funcao>({ nome: trimmed })
}

export const deleteFuncao = async (id: string, nome?: string): Promise<boolean> => {
  if (nome && nome.trim().toLowerCase() === 'administrador') {
    throw new Error('A função Administrador é imutável e não pode ser excluída.')
  }
  return pb.collection('funcoes').delete(id)
}

/**
 * Mapeia o nome da função selecionada para o UserRole compatível ('admin' | 'attendant' | 'technician')
 * Funções customizadas novas assumem 'technician' (perfil operacional sem autonomia de admin)
 */
export const mapFuncaoNameToRole = (funcaoNome: string): UserRole => {
  const normalized = funcaoNome.trim().toLowerCase()
  if (normalized === 'administrador' || normalized === 'admin') {
    return 'admin'
  }
  if (normalized === 'atendente' || normalized === 'attendant') {
    return 'attendant'
  }
  return 'technician'
}
