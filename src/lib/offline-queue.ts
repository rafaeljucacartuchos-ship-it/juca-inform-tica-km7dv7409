import pb from '@/lib/pocketbase/client'

/**
 * Fila de operações offline armazenada no IndexedDB.
 *
 * Cada entrada representa uma mutação (create/update/delete) que não pôde
 * ser enviada ao PocketBase por falta de conexão. Quando a conexão volta,
 * `processQueue()` percorre a fila em ordem e executa cada operação contra
 * o PocketBase. Se uma operação falha, o processamento para e as restantes
 * permanecem na fila.
 */

export type QueueAction = 'create' | 'update' | 'delete'

export interface QueueEntry {
  id: string
  collection: string
  action: QueueAction
  /** ID do registro (real para update/delete; temporário para create). */
  recordId?: string
  /** Payload da operação (dados do registro para create/update). */
  data?: Record<string, unknown>
  timestamp: number
}

const DB_NAME = 'juca-offline'
const STORE = 'queue'
const DB_VERSION = 1
const KEY_PATH = 'id'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: KEY_PATH })
        store.createIndex('timestamp', 'timestamp')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const store = transaction.objectStore(STORE)
        const request = fn(store)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

function genId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** Adiciona uma operação à fila offline. */
export async function addToQueue(entry: Omit<QueueEntry, 'id' | 'timestamp'>): Promise<QueueEntry> {
  const full: QueueEntry = {
    ...entry,
    id: genId(),
    timestamp: Date.now(),
  }
  await tx('readwrite', (store) => store.add(full))
  notifyQueueChange()
  return full
}

/** Retorna todas as operações pendentes, em ordem cronológica. */
export async function getQueue(): Promise<QueueEntry[]> {
  try {
    const all = await tx<QueueEntry[]>('readonly', (store) => store.getAll())
    return (all || []).sort((a, b) => a.timestamp - b.timestamp)
  } catch {
    return []
  }
}

/** Remove uma operação específica da fila. */
export async function removeFromQueue(id: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(id))
  notifyQueueChange()
}

/** Conta as operações pendentes. */
export async function getQueueCount(): Promise<number> {
  try {
    return await tx<number>('readonly', (store) => store.count())
  } catch {
    return 0
  }
}

export interface ProcessResult {
  processed: number
  failed: QueueEntry | null
  error: unknown
}

/**
 * Processa a fila em ordem. Se uma operação falhar, interrompe o
 * processamento e mantém as restantes na fila.
 */
export async function processQueue(): Promise<ProcessResult> {
  const queue = await getQueue()
  let processed = 0
  for (const entry of queue) {
    try {
      await executeEntry(entry)
      await removeFromQueue(entry.id)
      processed++
    } catch (error) {
      notifyQueueChange()
      return { processed, failed: entry, error }
    }
  }
  notifyQueueChange()
  return { processed, failed: null, error: null }
}

async function executeEntry(entry: QueueEntry): Promise<void> {
  const { collection, action, recordId, data } = entry
  if (action === 'create') {
    await pb.collection(collection).create(data || {})
  } else if (action === 'update') {
    if (!recordId) throw new Error('update sem recordId')
    await pb.collection(collection).update(recordId, data || {})
  } else if (action === 'delete') {
    if (!recordId) throw new Error('delete sem recordId')
    await pb.collection(collection).delete(recordId)
  }
}

// --- Eventos de mudança na fila ---------------------------------------------

const QUEUE_CHANGE_EVENT = 'juca-queue-change'

function notifyQueueChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(QUEUE_CHANGE_EVENT))
}

/** Assina mudanças na fila (tamanho). Retorna função de cleanup. */
export function onQueueChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(QUEUE_CHANGE_EVENT, handler)
  return () => window.removeEventListener(QUEUE_CHANGE_EVENT, handler)
}
