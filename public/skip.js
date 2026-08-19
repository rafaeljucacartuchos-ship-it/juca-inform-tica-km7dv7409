// SW Killer via CDN externa — bypass total do cache
//
// Este arquivo é referenciado em index.html ANTES dos demais scripts. Por ser
// um asset .js carregado na navegação inicial, o SW ativo (mesmo o antigo) o
// busca pela rede primeiro (NetworkFirst para assets em sw.js), então a versão
// nova chega ao dispositivo mesmo quando o index.html está cacheado.
//
// Roda UMA vez por dispositivo (localStorage, chave sw_cleanup_v2). A chave foi
// bumpada de v1 para v2 para forçar nova execução em dispositivos que rodaram o
// v1 (inline em index.html) sem sucesso — exatamente o caso dos técnicos presos
// na versão antiga, cujo index.html cacheado nem continha o killer inline.
;(function () {
  if (typeof window === 'undefined') return
  var KEY = 'sw_cleanup_v2'
  if (localStorage.getItem(KEY)) return
  if (!('serviceWorker' in navigator)) {
    localStorage.setItem(KEY, '1')
    return
  }
  navigator.serviceWorker
    .getRegistrations()
    .then(function (regs) {
      return Promise.all(
        regs.map(function (r) {
          return r.unregister()
        }),
      )
    })
    .then(function () {
      localStorage.setItem(KEY, '1')
      window.location.reload()
    })
    .catch(function () {
      localStorage.setItem(KEY, '1')
    })
})()
