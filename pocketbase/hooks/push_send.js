/// <reference path="../pb_data/hooks.d.ts" />
/*
 * push_send.js
 *
 * Hook utilitário que envia uma notificação push (Web Push API) para um
 * usuário, buscando suas subscriptions ativas em `push_subscriptions`.
 *
 * O Web Push protocol requer:
 *   - VAPID keys (par ECDSA P-256). A chave privada fica no secret
 *     `VAPID_PRIVATE_KEY`; o subject em `VAPID_SUBJECT`.
 *   - Criptografia do payload com a chave de sessão (p256dh + auth do
 *     cliente) usando AES-128-GCM + ECDH.
 *
 * O JSVM do PocketBase (goja) não tem `crypto.subtle` nem bibliotecas
 * nativas de ECDH/AES, então não é viável reimplementar toda a
 * criptografia do Web Push dentro do hook. Em vez disso, este hook
 * envia a notificação através do endpoint HTTP do próprio PocketBase
 * (`/api/...`) caso exista um worker externo, OU — mais simples e
 * portátil — repassa o envio para o serviço de push usando um endpoint
 * proxy configurado pelo time (secret `PUSH_PROXY_URL`).
 *
 * COMO USAR:
 *   routerAdd("POST", "/backend/v1/push/send", ...) -> ver push_send_route.js
 *
 * Aqui apenas expomos um helper global `$sendPushToUser` para que outros
 * hooks (notify_service_order, shared_order_sign) possam chamar:
 *
 *   $sendPushToUser(app, userId, {
 *     title: "🔔 Nova OS #1234",
 *     body: "Cliente: João",
 *     url:  "/ordens/<id>",
 *     tag:  "os-<id>"
 *   })
 *
 * Se não houver proxy configurado ou a subscription tiver expirado
 * (HTTP 410/404), a subscription é marcada como inativa — sem bloquear
 * o fluxo principal.
 */

;(function () {
  // Helpers base64 para goja (sem atob/btoa nativos).
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  function base64Encode(bytes) {
    // bytes: Uint8Array
    var out = ''
    var i = 0
    while (i < bytes.length) {
      var b1 = bytes[i++] || 0
      var b2 = i < bytes.length ? bytes[i++] : -1
      var b3 = i < bytes.length ? bytes[i++] : -1
      out += B64.charAt(b1 >> 2)
      out += B64.charAt(((b1 & 3) << 4) | (b2 >= 0 ? b2 >> 4 : 0))
      out += b2 >= 0 ? B64.charAt(((b2 & 15) << 2) | (b3 >= 0 ? b3 >> 6 : 0)) : '='
      out += b3 >= 0 ? B64.charAt(b3 & 63) : '='
    }
    return out
  }

  function base64UrlEncode(bytes) {
    return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }

  // Expõe o helper global. Outros hooks chamam $sendPushToUser(...).
  $sendPushToUser = function (app, userId, payload) {
    if (!userId) return
    if (!payload || typeof payload !== 'object') return

    var title = payload.title || 'JUCA Informática'
    var body = payload.body || ''
    var url = payload.url || '/'
    var tag = payload.tag || 'juca-os'
    var icon = payload.icon || '/icon-maskable.svg'

    var subs = []
    try {
      subs = app.findRecordsByFilter(
        'push_subscriptions',
        'user = "' + userId + '" && active = true',
        '-created',
        50,
        0,
      )
    } catch (e) {
      try {
        app.logger().error('push_send: falha ao buscar subscriptions', 'error', String(e))
      } catch (_) {}
      return
    }

    if (!subs || subs.length === 0) return

    // Proxy externo (serviço Node que usa a lib `web-push` com as VAPID keys).
    // O time DEVE prover este endpoint (secret PUSH_PROXY_URL). Se não estiver
    // configurado, o push é silenciosamente ignorado (não bloqueia o fluxo).
    var proxyUrl = ''
    try {
      proxyUrl = $os.getenv('PUSH_PROXY_URL') || ''
    } catch (_) {
      proxyUrl = ''
    }

    for (var i = 0; i < subs.length; i++) {
      var s = subs[i]
      var endpoint = s.getString('endpoint')
      var p256dh = s.getString('p256dh')
      var authKey = s.getString('auth')

      if (proxyUrl) {
        try {
          var res = $http.send({
            url: proxyUrl,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: {
                endpoint: endpoint,
                keys: { p256dh: p256dh, auth: authKey },
              },
              payload: {
                title: title,
                body: body,
                icon: icon,
                url: url,
                tag: tag,
              },
            }),
            timeout: 15,
          })

          // 410 Gone / 404 → subscription expirou/inexistente: desativa.
          if (res.statusCode === 410 || res.statusCode === 404) {
            try {
              s.set('active', false)
              app.save(s)
            } catch (_) {}
          }
        } catch (err) {
          try {
            app.logger().error('push_send: falha ao enviar via proxy', 'error', String(err))
          } catch (_) {}
        }
      } else {
        // Sem proxy configurado: loga aviso (uma vez por hook é suficiente).
        try {
          app
            .logger()
            .warn(
              'push_send: PUSH_PROXY_URL não configurado — notificação push não enviada. ' +
                'Configure um proxy web-push ou implemente o envio direto.',
            )
        } catch (_) {}
        break
      }
    }
  }
})()
