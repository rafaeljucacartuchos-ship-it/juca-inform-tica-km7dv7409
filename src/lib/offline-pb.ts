import pb from '@/lib/pocketbase/client'
import { addToQueue, getQueueCount, onQueueChange, processQueue } from './offline-queue'

/**
 * Wrapper do PocketBase que opera de forma transparente:
 *
 * - Quando online: chama o PocketBase normalmente (comportamento idêntico
 *   ao uso direto do SDK).
 * - Quando offline: enfileira a operação no IndexedDB e retorna um objeto
 *   mock com ID temporário (`temp_<timestamp>`) para que a UI continue
 *   fluida. A operação é sincronizada quando a conexão volta.
 *
 * Também assina o evento `online` do navegador para disparar
 * `processQueue()` e emite o evento customizado `sync-complete` ao final.
 */

const SYNC_COMPLETE_EVENT = 'juca-sync-complete'

let syncInitialized = false
let syncing = false

function ensureSyncListener(): void {
  if (syncInitialized || typeof window === 'undefined') return
  syncInitialized = true

  window.addEventListener('online', () => {
    void offlinePb.sync()
  })
}

function tempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export interface OfflineCreateResult<T> {
  id: string
  queued: boolean
  data: T
}

export const offlinePb = {
  /**
   * Cria um registro. Online → delega ao PocketBase e retorna o registro real.
   * Offline → enfileira e retorna um mock com ID temporário.
   */
  async create<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string,
    data: Record<string, unknown> | FormData,
  ): Promise<OfflineCreateResult<T>> {
    ensureSyncListener()

    if (navigator.onLine) {
      const created = await pb.collection(collection).create<T>(data)
      return { id: (created as { id?: string }).id || tempId(), queued: false, data: created }
    }

    const serialized = serializePayload(data)
    const id = tempId()
    await addToQueue({
      collection,
      action: 'create',
      recordId: id,
      data: serialized,
    })
    const mock = { ...serialized, id } as unknown as T
    return { id, queued: true, data: mock }
  },

  /**
   * Atualiza um registro. Online → delega ao PocketBase.
   * Offline → enfileira a atualização (mantém o recordId original).
   */
  async update<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Record<string, unknown> | FormData,
  ): Promise<OfflineCreateResult<T>> {
    ensureSyncListener()

    if (navigator.onLine) {
      const updated = await pb.collection(collection).update<T>(id, data)
      return { id, queued: false, data: updated }
    }

    const serialized = serializePayload(data)
    await addToQueue({
      collection,
      action: 'update',
      recordId: id,
      data: serialized,
    })
    const mock = { ...serialized, id } as unknown as T
    return { id, queued: true, data: mock }
  },

  /**
   * Remove um registro. Online → delega ao PocketBase.
   * Offline → enfileira a exclusão.
   */
  async delete(collection: string, id: string): Promise<{ id: string; queued: boolean }> {
    ensureSyncListener()

    if (navigator.onLine) {
      await pb.collection(collection).delete(id)
      return { id, queued: false }
    }

    await addToQueue({
      collection,
      action: 'delete',
      recordId: id,
    })
    return { id, queued: true }
  },

  /**
   * Processa a fila offline. Emite o evento `sync-complete` ao final.
   */
  async sync(): Promise<{ processed: number; failed: boolean }> {
    if (syncing) return { processed: 0, failed: false }
    syncing = true
    try {
      const result = await processQueue()
      window.dispatchEvent(
        new CustomEvent(SYNC_COMPLETE_EVENT, {
          detail: {
            processed: result.processed,
            failed: result.failed,
            error: result.error,
          },
        }),
      )
      return { processed: result.processed, failed: !!result.failed }
    } finally {
      syncing = false
    }
  },

  /** Conta operações pendentes. */
  pendingCount: getQueueCount,

  /** Assina mudanças na fila. */
  onQueueChange,

  /** Assina o evento de sincronização concluída. */
  onSyncComplete(handler: (e: CustomEvent) => void): () => void {
    if (typeof window === 'undefined') return () => {}
    const listener = (e: Event) => handler(e as CustomEvent)
    window.addEventListener(SYNC_COMPLETE_EVENT, listener)
    return () => window.removeEventListener(SYNC_COMPLETE_EVENT, listener)
  },
}

/** Converte FormData em objeto plano (para armazenar no IndexedDB). */
function serializePayload(data: Record<string, unknown> | FormData): Record<string, unknown> {
  if (!(data instanceof FormData)) return { ...data }
  const obj: Record<string, unknown> = {}
  data.forEach((value, key) => {
    if (obj[key] !== undefined) {
      const existing = obj[key]
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        obj[key] = [existing, value]
      }
    } else {
      obj[key] = value
    }
  })
  return obj
}

export default offlinePb
