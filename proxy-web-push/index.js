/**
 * juca-push-proxy
 *
 * Serviço Node.js mínimo que atua como proxy Web Push para o JUCA Informática.
 *
 * POR QUE EXISTE:
 *   O PocketBase (Skip Cloud) roda hooks em JSVM (goja), que não suporta as
 *   primitivas criptográficas (ECDH/AES-128-GCM) necessárias para o protocolo
 *   Web Push. Por isso o hook `push_send.js` repassa o envio para este proxy
 *   via HTTP (secret `PUSH_PROXY_URL`), que por sua vez usa a lib `web-push`
 *   (Node puro) para assinar e criptografar a notificação.
 *
 * ENDPOINT:
 *   POST /send
 *   Content-Type: application/json
 *   Body: { "subscription": { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } },
 *           "payload":     { "title": "...", "body": "...", "url": "...", "tag": "...", "icon": "..." } }
 *
 *   - 200/201 em sucesso
 *   - 410 quando a subscription expirou/é inválida (o hook desativa a subscription)
 *   - 400 em corpo malformado
 *   - 500 em erro interno
 *
 * VARIÁVEIS DE AMBIENTE (configure no painel do deploy):
 *   VAPID_PUBLIC_KEY  - chave pública ECDSA P-256 (base64url)
 *   VAPID_PRIVATE_KEY - chave privada ECDSA P-256 (base64url)  [SEGREDO]
 *   VAPID_SUBJECT     - ex.: mailto:rafaeljucacartuchos@gmail.com
 *   PORT              - porta HTTP (default 3000, injetada pela maioria dos PaaS)
 *   CORS_ORIGIN       - origem permitida (ex.: https://juca.app). Default: *
 *
 * ROTAÇÃO DE CHAVES:
 *   Gere um novo par com `npx web-push generate-vapid-keys` e atualize
 *   simultaneamente: esta variável de ambiente, os secrets do backend
 *   (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY) e a constante no frontend
 *   (`src/hooks/use-push-notifications.ts`). Trocar as chaves invalida
 *   todas as subscriptions existentes.
 */

const http = require('http')
const webpush = require('web-push')

const PORT = parseInt(process.env.PORT || '3000', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || ''

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
  console.error(
    '[juca-push-proxy] Faltam variáveis de ambiente VAPID. ' +
      'Defina VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT.',
  )
  process.exit(1)
}

// Configura o par VAPID usado para assinar todas as notificações.
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

/** Lê o corpo JSON de uma requisição (limitado a 64 KB). */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 64 * 1024) {
        reject(new Error('Payload muito grande'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!raw) return resolve(null)
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(new Error('JSON inválido'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(body)
}

const server = http.createServer(async (req, res) => {
  // Preflight CORS.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    })
    return res.end()
  }

  if (req.method !== 'POST' || req.url !== '/send') {
    return sendJson(res, 404, { ok: false, error: 'Not found' })
  }

  let data
  try {
    data = await readJsonBody(req)
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: e.message })
  }

  const subscription = data && data.subscription
  const payload = data && data.payload

  if (
    !subscription ||
    typeof subscription !== 'object' ||
    !subscription.endpoint ||
    !subscription.keys ||
    !subscription.keys.p256dh ||
    !subscription.keys.auth
  ) {
    return sendJson(res, 400, { ok: false, error: 'subscription inválida' })
  }

  if (!payload || typeof payload !== 'object') {
    return sendJson(res, 400, { ok: false, error: 'payload inválido' })
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 2419200, // 28 dias
    })
    return sendJson(res, 200, { ok: true })
  } catch (err) {
    const status = err.statusCode || 0
    // 404/410 = subscription expirou/inexistente. Sinaliza para o hook
    // desativar a subscription no banco.
    if (status === 404 || status === 410) {
      return sendJson(res, 410, { ok: false, error: 'subscription expirada', code: 'gone' })
    }
    console.error('[juca-push-proxy] erro ao enviar notificação:', status, err.message)
    return sendJson(res, 500, { ok: false, error: err.message || 'erro interno' })
  }
})

server.listen(PORT, () => {
  console.log(`[juca-push-proxy] ouvindo na porta ${PORT}`)
})
