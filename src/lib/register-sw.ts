/**
 * Registers the Service Worker for the JUCA Informática PWA.
 *
 * Centralised so every registration site uses the same options. The key option
 * is `updateViaCache: 'none'`: the browser must always fetch `sw.js` from the
 * network when checking for updates, never the HTTP cache. Without this, a
 * stale cached copy of `sw.js` can mask a newly deployed Service Worker (the
 * browser would keep comparing against the old bytes and never see the new
 * `// BUILD:` timestamp), which is exactly the "technicians stuck on the old
 * version forever" problem this project hit.
 *
 * This complements `scripts/inject-sw-timestamp.mjs`, which rewrites the
 * `// BUILD:` line in the emitted `sw.js` on every build so the SW body is
 * byte-for-byte different between deploys — that difference is what the
 * browser's update check detects to install the new SW.
 *
 * Update flow (self-healing, à prova de clientes travados):
 *  - the SW calls `skipWaiting()` on install, so a new worker NEVER waits —
 *    and `clients.claim()` on activate takes over open pages at once;
 *  - when the new worker assumes control, `controllerchange` fires here and we
 *    reload the page ONCE (guarded by a sessionStorage timestamp so we never
 *    loop), landing on the freshly cached app shell / assets;
 *  - as a reinforcement, if a worker is found in `waiting` (e.g. left over
 *    from an OLD deployed SW that lacked skipWaiting — the v0.0.248 case), we
 *    send it `SKIP_WAITING` proactively so it activates without any click.
 */

/** Chave do guard anti-loop de recarregamento (sessionStorage, por aba). */
const SW_RELOAD_GUARD_KEY = 'juca:sw-reloaded'

/** Intervalo mínimo entre recarregamentos automáticos (anti-loop). */
const SW_RELOAD_GUARD_MS = 10_000

/**
 * Recarrega a página UMA vez por janela, com guard de tempo: só recarrega se a
 * última recarga automática foi há mais de 10s (ou não houve). Evita loop de
 * reload se algo der errado na troca de worker.
 */
function reloadOnceWithGuard(): void {
  try {
    const last = Number(sessionStorage.getItem(SW_RELOAD_GUARD_KEY) || 0)
    const now = Date.now()
    if (last && now - last < SW_RELOAD_GUARD_MS) return
    sessionStorage.setItem(SW_RELOAD_GUARD_KEY, String(now))
  } catch {
    // sessionStorage indisponível (modo privado): recarrega sem guard —
    // controllerchange só dispara em trocas reais de worker, o risco é baixo.
  }
  window.location.reload()
}

/** Envia SKIP_WAITING ao worker waiting (se houver) para forçar a ativação. */
function promoteWaitingWorker(registration: ServiceWorkerRegistration): void {
  if (registration.waiting && navigator.serviceWorker.controller) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }
}

/**
 * Reforço manual (banner "App desatualizado" / "Nova versão disponível"):
 * promove o worker waiting (SKIP_WAITING) e recarrega a página quando ele
 * assumir o controle. Usada pelo botão "Atualizar" — o fluxo automático
 * (skipWaiting no install + controllerchange) não depende dela.
 */
export function forceActivateUpdate(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    window.location.reload()
    return
  }
  navigator.serviceWorker
    .getRegistration()
    .then((reg) => {
      if (reg?.waiting) {
        promoteWaitingWorker(reg)
        // Se nada assumir o controle (edge case), recarrega por segurança.
        setTimeout(() => window.location.reload(), 4000)
      } else {
        window.location.reload()
      }
    })
    .catch(() => window.location.reload())
}

/**
 * Registers `/sw.js` with update-friendly options. Safe to call repeatedly —
 * calling `register()` with the same URL/scope is a no-op per the spec.
 * Resolves to the registration, or `null` if SW is unsupported or registration
 * failed (never throws — the PWA is an enhancement, not a requirement).
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      // Always consult the network for the SW script on update checks, never
      // the HTTP cache. Critical for deployed updates to reach installed PWAs.
      updateViaCache: 'none',
    })

    // Take-over da versão nova: quando o worker novo assume o controle,
    // recarrega uma única vez para o app rodar o JS novo (não só os assets).
    // (O guard sessionStorage evita loop de recarregamento.)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      reloadOnceWithGuard()
    })

    // Primeira carga sob um worker recém-chegado (clients.claim tomou o controle
    // desta página logo após o register): recarrega uma vez para o app rodar o
    // bundle novo em vez do antigo já em memória.
    if (!navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(() => {
        if (navigator.serviceWorker.controller) reloadOnceWithGuard()
      })
    }

    // Reforço: se um worker ficou em "waiting" (SW antigo sem skipWaiting,
    // caso v0.0.248), promove-o agora — sem depender de clique no banner.
    promoteWaitingWorker(registration)
    registration.addEventListener('updatefound', () => {
      // O novo worker (com skipWaiting no código novo) ativa sozinho; se for
      // um worker velho em waiting, o próximo register/update promove.
      setTimeout(() => {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg) promoteWaitingWorker(reg)
        })
      }, 3000)
    })

    return registration
  } catch {
    // Registration failures are non-fatal: the app still works online.
    return null
  }
}
