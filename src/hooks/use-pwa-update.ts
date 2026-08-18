import { useEffect, useState, useCallback } from 'react'

/**
 * Monitora o Service Worker em busca de uma nova versão waiting.
 *
 * Fluxo:
 *  - quando o navegador instala um novo SW (`onupdatefound`), acompanhamos
 *    `newWorker.onstatechange` até ele ficar `installed`;
 *  - se houver um `registration.waiting`, expomos `updateAvailable = true`;
 *  - `updateApp()` envia `SKIP_WAITING` para o SW waiting e, quando ele assume
 *    o controle (`controllerchange`), recarrega a página.
 *
 * Não dispara no primeiro acesso (sem SW anterior) — só quando existe um
 * novo SW aguardando para assumir.
 */
export function usePwaUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | null = null

    const handleChange = () => {
      if (registration?.waiting) {
        setUpdateAvailable(true)
      }
    }

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg) return
        registration = reg

        // Já existe um SW esperando desde o carregamento.
        if (reg.waiting) {
          setUpdateAvailable(true)
          return
        }

        const newWorker = reg.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', handleChange)
        }

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller &&
              reg.waiting
            ) {
              setUpdateAvailable(true)
            } else if (
              installing.state === 'activated' &&
              reg.active &&
              navigator.serviceWorker.controller
            ) {
              setUpdateAvailable(true)
            }
          })
        })
      })
      .catch(() => {
        /* SW indisponível neste contexto — ignora silenciosamente. */
      })
  }, [])

  const updateApp = useCallback(() => {
    if (!('serviceWorker' in navigator)) return

    const regPromise = navigator.serviceWorker.getRegistration()

    // Quando o novo SW assumir o controle, recarrega a página.
    let reloaded = false
    const onControllerChange = () => {
      if (reloaded) return
      reloaded = true
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    regPromise
      .then((reg) => {
        const waiting = reg?.waiting
        if (waiting) {
          waiting.postMessage({ type: 'SKIP_WAITING' })
        } else {
          // Sem SW waiting: remove o listener e recarrega por segurança.
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
          window.location.reload()
        }
      })
      .catch(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      })

    // Safety net: se o controllerchange não disparar em 4s, recarrega mesmo assim.
    setTimeout(() => {
      if (!reloaded) {
        reloaded = true
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
        window.location.reload()
      }
    }, 4000)
  }, [])

  return { updateAvailable, updateApp }
}
