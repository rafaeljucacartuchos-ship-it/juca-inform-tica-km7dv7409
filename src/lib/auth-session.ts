import pb from './pocketbase/client'

/**
 * Camada central de sessão (fix do bug de troca de conta no PWA).
 *
 * Sintoma: ao sair e entrar com outra conta, o app continuava enviando o token
 * da sessão ANTIGA nas chamadas de API (403 "Apenas administradores podem criar
 * novos usuarios" mesmo logado como admin).
 *
 * Causas cobertas aqui:
 * 1. O authStore do PocketBase persiste em localStorage (chave `pocketbase_auth`)
 *    e é lido no boot; se o storage contiver um token antigo e o React
 *    atualizar o estado SEM substituir o storage, a próxima recarga volta para
 *    a sessão anterior. Aqui TODA troca de sessão grava/exclui explicitamente
 *    esse storage, de forma síncrona, junto da atualização do authStore.
 * 2. O logout precisa invalidar a sessão para TUDO que possa reutilizá-la:
 *    authStore, storage persistido, rascunhos por usuário e a fila offline.
 *
 * Todas as funções são best-effort em try/catch: falha de storage (modo
 * privado, quota) nunca pode impedir o login/logout.
 */

const PB_STORAGE_KEY = 'pocketbase_auth' // chave padrão do LocalAuthStore do SDK

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

/** Representação persistida do authStore do SDK pocketbase v0.26. */
interface PersistedAuth {
  token?: string
  model?: Record<string, unknown> | null
}

function readPersistedAuth(): PersistedAuth | null {
  const raw = safeGet(PB_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PersistedAuth
  } catch {
    return null
  }
}

/**
 * Garante que o storage reflete EXATAMENTE a sessão atual do authStore.
 * - authStore válido  → grava token+model (sobrescreve qualquer sessão antiga)
 * - authStore inválido → remove o registro persistido
 * Retorna true se havia um token DIFERENTE gravado no storage (sessão órfã).
 */
export function syncSessionStorage(): boolean {
  const persisted = readPersistedAuth()
  const currentToken = pb.authStore.isValid ? pb.authStore.token : ''

  if (pb.authStore.isValid && pb.authStore.record) {
    const payload = JSON.stringify({ token: currentToken, model: pb.authStore.record })
    const changed = !!persisted && persisted.token !== currentToken
    safeSet(PB_STORAGE_KEY, payload)
    return changed
  }

  if (persisted) {
    safeRemove(PB_STORAGE_KEY)
    return true
  }
  return false
}

/**
 * Limpa TODA a sessão do dispositivo (logout):
 * - authStore.clear() (token em memória + dispara onChange → UI volta a null)
 * - remove o registro persistido do authStore
 * - limpa rascunhos vinculados ao usuário (drafts não têm dono gravado, então
 *   removemos as chaves conhecidas — o usuário que logar depois começa limpo)
 * - limpa a fila offline (nenhuma mutação feita pelo usuário anterior pode ser
 *   sincronizada com a sessão nova; o design atual prioriza a integridade)
 * - limpa caches de resposta de API do service worker (para o estado em tela
 *   não "voltar" do cache HTTP na próxima visita)
 */
export async function clearAllSession(): Promise<void> {
  // 1. Token em memória + notifica os ouvintes do authStore
  pb.authStore.clear()
  syncSessionStorage()

  // 2. Rascunhos por usuário (não são dados do app, são rascunhos de UI)
  const KNOWN_DRAFT_KEYS = [
    'juca:draft:precificacao',
    'juca:draft:orcamento-novo',
    'juca:draft:locacao-maquina',
  ]
  for (const key of KNOWN_DRAFT_KEYS) {
    safeRemove(key)
  }

  // 3. Fila offline: mutações pendentes do usuário anterior não podem sair com
  // a sessão nova (e sairiam com o token novo — dados errados no lugar certo).
  try {
    const { clearQueue } = await import('./offline-queue')
    await clearQueue()
  } catch {
    /* IndexedDB pode estar indisponível — segue o fluxo */
  }

  // 4. Cache HTTP do app-shell que o service worker possa ter guardado para
  // respostas de API (defensivo: hoje o SW não intercepta /api/*, mas se um dia
  // passar a interceptar, o logout continua sem expor dados do usuário anterior)
  if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
    try {
      const keys = await caches.keys()
      await Promise.all(
        keys.map(async (key) => {
          if (key.startsWith('juca-api-') || key.startsWith('juca-offline-')) {
            await caches.delete(key)
          }
        }),
      )
    } catch {
      /* ignore */
    }
  }
}

/**
 * Após um login bem-sucedido: garante que o storage guarda o token NOVO e que
 * nenhuma sessão antiga sobreviva ao lado do authStore em memória.
 * Chamar SEMPRE que authWithPassword resolver com sucesso.
 */
export function persistCurrentSession(): void {
  syncSessionStorage()
}

/**
 * Diagnóstico opcional (console) do estado da sessão — útil para confirmar no
 * dispositivo do Rafael qual token cada camada guarda.
 */
export function debugSessionState(): {
  authStoreToken: string
  persistedToken: string
  divergent: boolean
} {
  const persisted = readPersistedAuth()
  const authStoreToken = pb.authStore.isValid ? pb.authStore.token : ''
  const persistedToken = persisted?.token || ''
  return {
    authStoreToken: authStoreToken ? `${authStoreToken.slice(0, 10)}…` : '',
    persistedToken: persistedToken ? `${persistedToken.slice(0, 10)}…` : '',
    divergent: !!authStoreToken && !!persistedToken && authStoreToken !== persistedToken,
  }
}
