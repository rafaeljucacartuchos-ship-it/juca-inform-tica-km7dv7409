import { useEffect, useState } from 'react'

/**
 * Detecta quando o app carregado está desatualizado em relação ao que está
 * deployado no servidor.
 *
 * Sinal usado
 * -----------
 * O build injeta o MESMO timestamp em dois lugares (scripts/inject-sw-timestamp.mjs):
 *  - no `<html data-app-version="<ts>">` de index.html (versão do HTML servido);
 *  - na linha `// BUILD: <ts>` de sw.js (versão do SW deployado).
 *
 * Em runtime o app lê `data-app-version` do `<html>` e busca `/sw.js` pela rede
 * (o SW ativo trata assets `.js` como NetworkFirst, então chegamos à versão
 * nova mesmo quando o index.html servido está cacheado). Se os dois timestamps
 * forem ISO válidos e divergirem, o HTML em uso está stale (cacheado pelo SW
 * antigo) e deve ser exibido o banner "App desatualizado".
 *
 * Falsos positivos
 * ---------------
 * Só dispara quando ambos os timestamps casam com o formato ISO. Em `vite dev`
 * os arquivos-fonte mantêm os placeholders (`__APP_VERSION__` / `__TIMESTAMP__`),
 * que não casam, então nunca alerta em desenvolvimento.
 */
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
const BUILD_RE = /^\/\/ BUILD:\s*(.+)$/m

export function useStaleApp(): { stale: boolean } {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    const htmlVersion = document.documentElement.dataset.appVersion || ''
    // Placeholder de dev/build sem timestamp real: nada a comparar.
    if (!htmlVersion || !ISO_RE.test(htmlVersion)) return

    let cancelled = false

    async function check() {
      try {
        // cache: 'no-store' + query cache-bust garantem que o fetch do sw.js
        // vá à rede (o SW ativo repassa o Request, preservando cache:'no-store').
        const res = await fetch(`/sw.js?v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const text = await res.text()
        const match = BUILD_RE.exec(text)
        const swVersion = match ? match[1].trim() : ''
        if (!swVersion || !ISO_RE.test(swVersion)) return
        if (swVersion !== htmlVersion && !cancelled) {
          setStale(true)
        }
      } catch {
        // Rede falhou ou SW indisponível: não dá para afirmar que está stale.
      }
    }

    check()

    // Re-checa ao voltar ao primeiro plano (deploy pode ter acontecido enquanto
    // o app estava em background).
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return { stale }
}
