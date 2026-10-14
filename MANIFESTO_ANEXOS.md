# MANIFESTO E MAPA COMPLETO DE ANEXOS E ARQUIVOS — JUCA INFORMÁTICA

Este manifesto descreve a estrutura física, campos de origem, URLs de download e armazenamento dos arquivos, fotos, PDFs e assinaturas do sistema JUCA INFORMÁTICA no PocketBase (Skip Cloud).

---

## 1. Estrutura de Armazenamento no PocketBase

No PocketBase (backend padrão), todos os arquivos binários enviados são armazenados internamente na pasta física:

```text
pb_data/storage/<collectionId_ou_collectionName>/<record_id>/<filename>
```

A URL de download público/autenticado é disponibilizada na rota:

```text
https://<BACKEND_HOST>/api/files/<collectionId>/<record_id>/<filename>
```

No ambiente atual:
`https://assistencia-tecnica-movel-86527.shrd00.internal.goskip.dev/api/files/<collectionId>/<record_id>/<filename>`

---

## 2. Mapa de Coleções e Campos de Anexos

| Coleção               | ID da Coleção     | Campo do Arquivo       | Tipo / Finalidade                           | Mime Types / Formatos Permitidos |
| --------------------- | ----------------- | ---------------------- | ------------------------------------------- | -------------------------------- |
| `service_orders`      | `pbc_4228091215`  | `customer_signature`   | Assinatura digital do cliente na O.S.       | PNG / JPEG                       |
| `service_orders`      | `pbc_4228091215`  | `technician_signature` | Assinatura digital do técnico na O.S.       | PNG / JPEG                       |
| `service_attachments` | `pbc_3421240048`  | `file`                 | Fotos de entrada, laudos e anexos da O.S.   | JPEG, PNG, WEBP, HEIC, PDF       |
| `orcamentos`          | `pbc_3606511530`  | `assinatura_cliente`   | Assinatura de aprovação do cliente          | PNG / JPEG                       |
| `orcamentos`          | `pbc_3606511530`  | `assinatura_tecnico`   | Assinatura do técnico no orçamento          | PNG / JPEG                       |
| `orcamento_anexos`    | `pbc_2045541202`  | `caminho_arquivo`      | Fotos do equipamento, defeitos e orçamentos | JPEG, PNG, WEBP, HEIC            |
| `laudos_tecnicos`     | `pbc_781251809`   | `assinatura_tecnico`   | Assinatura do responsável pelo laudo        | PNG / JPEG                       |
| `laudos_tecnicos`     | `pbc_781251809`   | `assinatura_cliente`   | Assinatura do cliente no laudo técnico      | PNG / JPEG                       |
| `equipment`           | `equipment`       | `photos`               | Foto cadastral do equipamento               | JPEG, PNG                        |
| `products`            | `products`        | `photo_file`           | Foto do produto no estoque/catálogo         | JPEG, PNG, WEBP                  |
| `campaigns`           | `campaigns`       | `flyer`                | Imagem/folheto da campanha promocional      | JPEG, PNG, PDF                   |
| `users`               | `_pb_users_auth_` | `avatar`               | Foto de perfil do usuário/técnico           | JPEG, PNG                        |

---

## 3. Inventário Apurado de Arquivos na Base Atual

1. **`service_attachments` (Anexos de O.S.):**
   - 50+ arquivos vinculados a ordens de serviço ativas e históricas.
   - Padrões de nomes: `img_*.jpeg`, `*.jpg`, `*.png`.
   - Exemplos reais confirmados no banco:
     - `a549a723_800d_4518_9ffa_e2b8de5de8ad_vd3myvhg84.jpeg` (OS `z7og7raj1slcm7d`)
     - `img_0061_p0als99sjr.jpeg` (OS `3uqytne6am9hexj` - OS-0001)
     - `304763_msg4amct3j.jpg` (OS `2fo462gghs368zx` - OS-0008)

2. **`orcamento_anexos` (Fotos de Equipamentos/Orçamentos):**
   - 33 arquivos vinculados aos orçamentos emitidos.
   - Exemplos reais confirmados no banco:
     - `image_yiwovpoxyo.jpg` (Orçamento ORC-0041, id `g3yqox0wpqy8pam`)
     - `img_6481_9a3wtgyg19.jpeg` (Orçamento ORC-0043, id `d2woavigxfvz6va`)
     - `d_nq_np_2_x_940271_mla114610203683_072026_f_5pjgil8q3o.webp` (Orçamento ORC-0085, id `aozhhlhihi3vilv`)

3. **Assinaturas Digitais em `orcamentos` e `service_orders`:**
   - Armazenadas como arquivos `.png` gerados pelo canvas de assinatura.
   - Preservadas integralmente sem perda de resolução nem redimensionamento destrutivo.
   - Exemplos reais confirmados:
     - `assinatura_cliente_boye4jxzc7.png` e `assinatura_tecnico_szpn3yw5ym.png` no orçamento `g3yqox0wpqy8pam`.
     - `signature_phvds8fjgf.png` na OS-0001 (`3uqytne6am9hexj`).

---

## 4. Procedimento Seguro de Cópia e Download Físico

Como o Skip Cloud não expõe acesso SSH ou rsync direto à pasta `pb_data/storage`, o download em massa deve ser realizado pelo manifesto gerado:

### Opção A: Download Automatizado via Script de Migração (Node.js ou Python)

Utilize o manifesto gerado pelo sistema (`manifesto_anexos_juca_YYYY-MM-DD.csv` ou a chave `attachments_manifest` do arquivo `juca_backup_completo_migracao_YYYY-MM-DD.json`):

```bash
# Exemplo de download via script Node.js:
# Para cada item no manifesto:
# 1. Faz GET na url_download
# 2. Salva no caminho local idêntico: destination_storage/<collection>/<record_id>/<filename>
# 3. Calcula hash SHA-256 e compara com integridade local
```

### Opção B: Cópia Direta de Storage para Storage (Destino PocketBase)

Se o novo ambiente for um servidor PocketBase próprio (VPS Docker / Linux):

1. Crie a estrutura de diretórios `pb_data/storage/<collectionId>/<record_id>/`.
2. Baixe os arquivos diretamente preservando os nomes originais (ex.: `filename_token.png`).
3. Ao restaurar os dados do banco SQLite (`pb_data/data.db`), os nomes gravados nas colunas baterão 100% com os arquivos presentes em `pb_data/storage/`.

---

## 5. Garantia de Preservação e Restrições

- Não foram gerados links temporários com expiração curta: a URL de download é a rota permanente do endpoint de storage da API do PocketBase.
- Não altere nomes de arquivos nem extensões, pois o hash de token sufixado pelo PocketBase (ex: `_vd3myvhg84.jpeg`) é o identificador exato registrado na tupla do banco.
- Nenhum anexo foi removido ou alterado durante este inventário.
