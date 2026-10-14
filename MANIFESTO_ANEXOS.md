# MANIFESTO E MAPA COMPLETO DE ANEXOS E ARQUIVOS — JUCA INFORMÁTICA

Este documento detalha o inventário de arquivos, fotos, PDFs e assinaturas digitais do sistema JUCA INFORMÁTICA, com o mapeamento completo dos campos, URLs permanentes da plataforma e rotinas de download autenticado com cálculo de hash SHA-256.

---

## 1. Origem e Estrutura dos Arquivos no PocketBase

No PocketBase (Skip Cloud), os arquivos são armazenados com um nome sanitizado acrescido de um token de 10 caracteres alfanuméricos gerado no momento do upload (ex: `img_6889_6mv9yvi9om.jpeg`).

### 1.1 Rota Oficial da API de Arquivos

```text
https://<BACKEND_HOST>/api/files/<collectionId_ou_collectionName>/<record_id>/<filename>
```

**Host do Backend Atual:**
`https://assistencia-tecnica-movel-86527.shrd00.internal.goskip.dev`

> **Atenção:** Embora contenha `.internal.` no nome do host, o endpoint é acessível publicamente via HTTPS direta pelos navegadores autorizados pelo Skip Cloud com CORS aberto.

---

## 2. Mapa Completo de Campos de Arquivos por Coleção

| Coleção               | Campo                  | Tipo de Arquivo         | Formatos Permitidos        | Observação                                    |
| --------------------- | ---------------------- | ----------------------- | -------------------------- | --------------------------------------------- |
| `service_orders`      | `customer_signature`   | Assinatura cliente      | PNG / JPEG                 | Coletada no canvas na entrega/conclusão da OS |
| `service_orders`      | `technician_signature` | Assinatura técnico      | PNG / JPEG                 | Coletada no fechamento do técnico             |
| `service_attachments` | `file`                 | Fotos / Laudos OS       | JPEG, PNG, WEBP, HEIC, PDF | Vistoria de entrada, peças danificadas, etc.  |
| `orcamentos`          | `assinatura_cliente`   | Assinatura cliente      | PNG / JPEG                 | Aprovação presencial de orçamento             |
| `orcamentos`          | `assinatura_tecnico`   | Assinatura técnico      | PNG / JPEG                 | Assinatura técnica na proposta                |
| `orcamento_anexos`    | `caminho_arquivo`      | Fotos do defeito / peça | JPEG, PNG, WEBP, HEIC      | Fotos vinculadas ao orçamento comercial       |
| `laudos_tecnicos`     | `assinatura_tecnico`   | Assinatura responsável  | PNG / JPEG                 | Laudo pericial técnico                        |
| `laudos_tecnicos`     | `assinatura_cliente`   | Assinatura cliente      | PNG / JPEG                 | Ciência do cliente no laudo                   |
| `equipment`           | `photos`               | Foto cadastral          | JPEG, PNG                  | Fotos do equipamento na entrada               |
| `products`            | `photo_file`           | Foto do catálogo        | JPEG, PNG, WEBP            | Foto do produto / insumo em estoque           |
| `campaigns`           | `flyer`                | Imagem da campanha      | JPEG, PNG, PDF             | Folheto promocional para WhatsApp             |
| `users`               | `avatar`               | Foto de perfil          | JPEG, PNG                  | Foto do técnico / atendente                   |

### 2.1 Arquivos e Fotos Embutidos em JSON

Além dos campos nativos de arquivos gerenciados pelo PocketBase, existem anexos armazenados como `DataURL` (Base64) em snapshots de contratos:

- `rental_contracts` (`equipamento_dados.modelo_contrato.photos`): Lista de até 6 fotos por contrato de locação (vistorias e entrega da máquina).
- `rental_documents` (`payload.dataUrl`): Documentos anexos de contratos de locação.

O exportador do sistema rastreia e inclui esses arquivos embutidos no manifesto oficial com `is_embedded_base64: true`.

---

## 3. Formato do Manifesto CSV (Conforme RFC 4180)

O manifesto gerado pelo sistema (`manifesto_anexos_juca_YYYY-MM-DD.csv`) segue a especificação internacional RFC 4180:

- Separador: ponto-e-vírgula (`;`).
- Prefixo BOM UTF-8 (`\uFEFF`) para compatibilidade nativa com Excel, Google Sheets e LibreOffice.
- Campos com aspas, vírgulas e quebras de linha são devidamente escapados com aspas duplas dobradas (`""`).

### 3.1 Colunas do Manifesto

1. `colecao`: Nome da coleção no PocketBase.
2. `registro_id`: ID do registro que detém o arquivo.
3. `campo`: Nome do campo de arquivo no esquema.
4. `nome_arquivo`: Nome original do arquivo.
5. `caminho_storage`: Caminho relativo sugerido no pacote de migração.
6. `url_download`: URL de download autenticada.
7. `tamanho_bytes`: Tamanho físico em bytes apurado no download.
8. `sha256`: Hash criptográfico SHA-256 apurado no download.
9. `status_download`: `success`, `pending`, `failed` ou `not_downloaded`.
10. `motivo_falha`: Descrição detalhada da falha em caso de erro HTTP.

---

## 4. Procedimento de Download e Verificação SHA-256

### 4.1 Via Interface do Sistema (1 Clique na Prévia)

1. Acesse o sistema como Administrador e abra **Relatórios e Auditoria > Rel. Geral / Migração**.
2. Clique em **"Gerar Pacote de Migração"**.
3. Em seguida, clique em **"Baixar e Verificar Arquivos Físicos (SHA-256)"**.
4. O sistema baixará os arquivos em lotes com retentativas automáticas, calculará o SHA-256 de cada um via Web Crypto API e exportará o manifesto CSV completo com a integridade comprovada.

### 4.2 Script de Download em Lote Externo (Node.js)

Caso deseje baixar diretamente no servidor de destino:

```javascript
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// 1. Carregue o pacote JSON completo gerado pelo JUCA
const pkg = JSON.parse(fs.readFileSync('juca_migracao_COMPLETO_...json', 'utf8'))
const manifest = pkg.attachments_manifest

console.log(`Iniciando download de ${manifest.length} arquivos...`)

for (const item of manifest) {
  const destDir = path.join('arquivos_migracao', item.collection, item.record_id)
  fs.mkdirSync(destDir, { recursive: true })
  const destPath = path.join(destDir, item.filename)

  if (item.is_embedded_base64 && item.download_url.startsWith('data:')) {
    // Arquivo Base64 embutido
    const base64Data = item.download_url.split(',')[1]
    const buffer = Buffer.from(base64Data, 'base64')
    fs.writeFileSync(destPath, buffer)
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')
    console.log(`[OK Base64] ${item.filename} (SHA256: ${hash})`)
    continue
  }

  // Arquivo via HTTP
  try {
    const res = await fetch(item.download_url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(destPath, buffer)
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')
    console.log(`[OK HTTP] ${item.filename} - ${buffer.length} bytes (SHA256: ${hash})`)
  } catch (err) {
    console.error(`[FALHA] ${item.filename}: ${err.message}`)
  }
}
```

---

## 5. Garantias de Preservação e Segurança

- **Sem Links Temporários Expiráveis:** As URLs referenciam os endpoints permanentes do PocketBase.
- **Tokens Protegidos:** O token de autenticação administrativa do usuário autenticado é enviado apenas no cabeçalho `Authorization: Bearer <token>` durante a requisição e **nunca é embutido na query string da URL nem no CSV público**.
- **Imutabilidade:** Nomes e extensões originais são preservados para que a restauração no destino faça correspondência 1-para-1 com os registros do banco de dados.
