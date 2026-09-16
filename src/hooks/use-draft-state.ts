import { useState, useEffect, useCallback, useRef } from 'react'

export interface DraftEnvelope<T = any> {
  route: string
  title?: string
  formData: T
  updatedAt: string
}

const LAST_ROUTE_KEY = 'juca:last-route'

/**
 * Hook genérico de rascunho em localStorage com debounce.
 * @param draftKey Chave específica (ex.: 'juca:draft:precificacao', 'juca:draft:orcamento-novo', 'juca:draft:locacao-maquina')
 * @param route Rota correspondente para restauração
 * @param title Nome amigável da tela exibido no banner do Dashboard
 * @param debounceMs Tempo de debounce para persistência automática (padrão 500ms)
 */
export function useDraftState<T>(
  draftKey: string,
  route: string,
  title?: string,
  debounceMs = 500,
) {
  const [draft, setDraft] = useState<DraftEnvelope<T> | null>(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return null
      return JSON.parse(raw) as DraftEnvelope<T>
    } catch {
      return null
    }
  })

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Registra a rota atual como última rota ativa
  useEffect(() => {
    try {
      localStorage.setItem(LAST_ROUTE_KEY, route)
    } catch {
      /* ignore storage errors */
    }
  }, [route])

  // Salva rascunho com debounce
  const saveDraft = useCallback(
    (formData: T) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        try {
          const envelope: DraftEnvelope<T> = {
            route,
            title: title || route,
            formData,
            updatedAt: new Date().toISOString(),
          }
          localStorage.setItem(draftKey, JSON.stringify(envelope))
          setDraft(envelope)
          // Notifica outros ouvintes na mesma janela (custom event)
          window.dispatchEvent(
            new CustomEvent('juca:draft-changed', { detail: { key: draftKey, envelope } }),
          )
        } catch (err) {
          console.warn('Erro ao salvar rascunho no localStorage:', err)
        }
      }, debounceMs)
    },
    [draftKey, route, title, debounceMs],
  )

  // Salva de forma imediata (sem debounce)
  const saveDraftImmediate = useCallback(
    (formData: T) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      try {
        const envelope: DraftEnvelope<T> = {
          route,
          title: title || route,
          formData,
          updatedAt: new Date().toISOString(),
        }
        localStorage.setItem(draftKey, JSON.stringify(envelope))
        setDraft(envelope)
        window.dispatchEvent(
          new CustomEvent('juca:draft-changed', { detail: { key: draftKey, envelope } }),
        )
      } catch (err) {
        console.warn('Erro ao salvar rascunho imediato:', err)
      }
    },
    [draftKey, route, title],
  )

  // Limpa o rascunho salvo
  const clearDraft = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    try {
      localStorage.removeItem(draftKey)
      setDraft(null)
      window.dispatchEvent(
        new CustomEvent('juca:draft-changed', { detail: { key: draftKey, envelope: null } }),
      )
    } catch (err) {
      console.warn('Erro ao limpar rascunho:', err)
    }
  }, [draftKey])

  // Lê o valor atual gravado no localStorage
  const readDraft = useCallback((): DraftEnvelope<T> | null => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return null
      const parsed = JSON.parse(raw) as DraftEnvelope<T>
      setDraft(parsed)
      return parsed
    } catch {
      return null
    }
  }, [draftKey])

  // Cleanup de timers
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    draft,
    saveDraft,
    saveDraftImmediate,
    clearDraft,
    readDraft,
  }
}

/**
 * Lê todos os rascunhos conhecidos ativos do sistema para exibição no Dashboard.
 * Retorna o rascunho mais recente (maior updatedAt).
 */
export function getLatestDraft(): { key: string; draft: DraftEnvelope } | null {
  const KNOWN_DRAFT_KEYS = [
    'juca:draft:precificacao',
    'juca:draft:orcamento-novo',
    'juca:draft:locacao-maquina',
  ]

  let latest: { key: string; draft: DraftEnvelope } | null = null

  for (const k of KNOWN_DRAFT_KEYS) {
    try {
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const env = JSON.parse(raw) as DraftEnvelope
      if (env && env.route && env.updatedAt) {
        if (
          !latest ||
          new Date(env.updatedAt).getTime() > new Date(latest.draft.updatedAt).getTime()
        ) {
          latest = { key: k, draft: env }
        }
      }
    } catch {
      /* ignore corrupt entries */
    }
  }

  return latest
}

/**
 * Limpa todos os rascunhos conhecidos ou um específico.
 */
export function removeDraftByKey(key: string) {
  try {
    localStorage.removeItem(key)
    window.dispatchEvent(new CustomEvent('juca:draft-changed', { detail: { key, envelope: null } }))
  } catch {
    /* ignore */
  }
}
