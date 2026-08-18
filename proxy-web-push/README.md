# juca-push-proxy

Proxy Web Push para o **JUCA Informática**. É um serviço Node.js independente que
recebe `{ subscription, payload }` do PocketBase (hook `push_send.js`) e envia a
notificação via Web Push API, assinando/criptografando com as **VAPID keys**.

## Por que um proxy separado?

O PocketBase no Skip Cloud roda hooks em JSVM (goja), que **não suporta** as
primitivas criptográficas (ECDH / AES-128-GCM) exigidas pelo protocolo Web Push.
Por isso o envio é delegado a este serviço Node, que usa a lib
[`web-push`](https://www.npmjs.com/package/web-push).

## Como funciona

```
Evento no app → hook push_send.js (PocketBase)
   → POST {subscription, payload} para PUSH_PROXY_URL
   → juca-push-proxy assina com a VAPID private key
   → web-push envia para o push service (FCM/Mozilla/Apple)
   → navegador recebe a notificação
```

## Endpoint

`POST /send`

```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": { "p256dh": "...", "auth": "..." }
  },
  "payload": {
    "title": "🔔 Nova OS #1234",
    "body": "Cliente: João",
    "url": "/ordens/1234",
    "tag": "os-1234",
    "icon": "/icon-maskable.svg"
  }
}
```

Respostas: `200` sucesso · `400` corpo inválido · `410` subscription expirada · `500` erro.

## Variáveis de ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `VAPID_PUBLIC_KEY` | Chave pública ECDSA P-256 (base64url) | `BGtkbcjr...` |
| `VAPID_PRIVATE_KEY` | Chave privada ECDSA P-256 (base64url) **[SEGREDO]** | `I0_d0vne...` |
| `VAPID_SUBJECT` | Identificador do remetente | `mailto:rafaeljucacartuchos@gmail.com` |
| `PORT` | Porta HTTP (default `3000`) | `3000` |
| `CORS_ORIGIN` | Origem permitida (default `*`) | `https://juca.app` |

> **As VAPID keys precisam ser idênticas** às usadas no frontend
> (`src/hooks/use-push-notifications.ts`) e nos secrets do backend
> (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`). Caso contrário, o envio falha.

## Deploy

### Render (free tier) — recomendado

1. Crie um **Web Service** apontando para este diretório (`proxy-web-push/`).
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Adicione as variáveis de ambiente (`VAPID_*`).
5. A URL ficará algo como `https://juca-push-proxy.onrender.com/send`.
6. Atualize o secret `PUSH_PROXY_URL` no backend (Skip Cloud) com essa URL.

### Railway

1. New Project → Deploy from repo (ou CLI `railway up`).
2. Set as variáveis de ambiente.
3. Use a URL gerada (`https://...up.railway.app/send`) em `PUSH_PROXY_URL`.

### Fly.io

```bash
cd proxy-web-push
fly launch          # gera Dockerfile + fly.toml automaticamente
fly secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...
fly deploy
```

## Rodar localmente

```bash
cd proxy-web-push
npm install
VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:... npm start
# → [juca-push-proxy] ouvindo na porta 3000
```

## Rotacionar as VAPID keys

Gere um novo par e atualize em **todos os lugares ao mesmo tempo** (trocar as
chaves invalida todas as subscriptions existentes):

```bash
npx web-push generate-vapid-keys
```

Depois atualize:
1. `src/hooks/use-push-notifications.ts` (`VAPID_PUBLIC_KEY`)
2. Secrets do backend: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (via `set_env`)
3. Variáveis de ambiente deste proxy (no painel do PaaS)
