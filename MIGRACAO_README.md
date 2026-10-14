# PACOTE DE MIGRAÇÃO VERIFICÁVEL — JUCA INFORMÁTICA

**Data de Inventário & Exportação:** Outubro / 2026  
**Prazo Limite Estabelecido:** 02/11/2026  
**Sistema:** JUCA INFORMÁTICA (Gestão de Assistência Técnica, OS, Clientes, Orçamentos, Locação e Precificação)  
**Stack de Origem:** Frontend React 19 + TypeScript + Vite + Tailwind PWA sobre Backend PocketBase v0.36 (Skip Cloud)  
**Destino Previsto:** Aplicação em desenvolvimento no **Sites** (não presume PocketBase e não exige contratação de VPS)

---

## 1. IDENTIFICAÇÃO RIGOROSA DAS VERSÕES E AMBIENTES

Conforme auditoria do repositório Git, logs de migração e dados de execução:

| Ambiente / Componente        | Versão / Tag         | Evidência / Status                                    | Observação                                                                                                                                                                   |
| ---------------------------- | -------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Produção Publicada**       | `v0.0.389`           | **Verificada em publicação anterior**                 | A versão `v0.0.232` correspondia ao marco histórico de congelamento solicitado pelo usuário; a `v0.0.389` foi verificada como a última publicação ativa. Ambas documentadas. |
| **Ambiente de Prévia Atual** | `v0.0.395`           | **Verificada** (`package.json`, commit Git `0086d9b`) | Ambiente ativo de desenvolvimento contendo todas as 99 migrações do banco, precificação moderna, contratos e módulo de migração.                                             |
| **Commit de Origem**         | `0086d9b`            | **Verificado**                                        | Hash do Git do build atual no Skip Cloud.                                                                                                                                    |
| **Data/Hora de Exportação**  | Dinâmica             | **Verificada a cada geração**                         | Gravada em `meta.started_at` e `meta.completed_at` no JSON exportado.                                                                                                        |
| **PocketBase Backend**       | `v0.36` (Skip Cloud) | **Verificado**                                        | Instância interna servida com SQLite subjacente.                                                                                                                             |

---

## 2. STATUS E VALIDAÇÃO DA EXPORTAÇÃO (SEM FALSO POSITIVO)

O exportador (`src/services/migration-export.ts`) classifica formalmente cada pacote:

1. **`complete`**: Todas as coleções do catálogo foram consultadas com sucesso integral (vazias ou com registros).
2. **`partial`**: Uma ou mais coleções falharam ou tiveram leitura negada por permissão RLS, mas dados foram recuperados para diagnóstico.
3. **`error`**: Falha crítica total que impediu a obtenção dos dados.

### 2.1 Distinção entre Coleção Vazia e Coleção com Falha

- **Coleção Vazia (`status: 'empty'`):** A consulta retornou HTTP 200 com array de itens vazio (`totalItems === 0`).
- **Coleção com Falha (`status: 'failed'` ou `'forbidden'`):** A requisição disparou erro de rede, erro de sintaxe ou HTTP 403. O pacote registra explicitamente a mensagem de erro e **não camufla** como coleção vazia.

### 2.2 Auditoria de Permissões da Conta Conectada

- Ao exportar, o sistema inspeciona `pb.authStore.record`.
- Se a conta logada for administrador (`role === 'admin'`), a leitura ignora restrições de RLS.
- Se a conta for atendente ou técnico, o pacote adiciona aviso explícito em `meta.integrity_warnings` informando que registros não autorizados podem ter sido filtrados pelas regras de API.
- **Exportação Administrativa Segura:** Para garantir 100% de integridade, execute o botão "Gerar Pacote de Migração" com o usuário administrador (`administrador`).

---

## 3. COBERTURA DO BANCO DE DADOS (38 COLEÇÕES)

O esquema do JUCA INFORMÁTICA contém **38 coleções reais** (todas contempladas no exportador):

1. `users` (auth): Usuários do sistema, técnicos, atendentes, administradores, permissões granulares e funções.
2. `customers` (base): Clientes cadastrados, CPF/CNPJ, endereços, contatos e consentimento WhatsApp LGPD.
3. `appointments` (base): Agendamentos de visitas e manutenções com técnicos.
4. `service_orders` (base): Ordens de Serviço completas, com equipe (técnico 1, técnico 2, vendedor), modelo de divisão, assinaturas, status e valores.
5. `services` (base): Catálogo de serviços prestados e tabela de preços.
6. `service_order_items` (base): Itens (peças/produtos e serviços) vinculados a cada O.S.
7. `status_history` (base): Histórico de transição de status de cada O.S.
8. `payments` (base): Pagamentos e faturamentos registrados por O.S. (dinheiro, pix, cartões, crediário, etc.).
9. `equipment` (base): Equipamentos cadastrados de clientes (notebooks, impressoras, desktops, etc.).
10. `products` (base): Produtos cadastrados, peças, custos, preços de venda, estoque e código de barras.
11. `service_attachments` (base): Fotos e anexos vinculados às Ordens de Serviço.
12. `notifications` (base): Notificações internas aos usuários do sistema.
13. `evaluations` (base): Notas e feedbacks atribuídos aos atendimentos técnicos.
14. `push_subscriptions` (base): Inscrições para notificações Web Push dos dispositivos.
15. `service_types` (base): Tipos de atendimento configurados.
16. `settings` (base): Parâmetros globais de precificação, taxas de cartão, dólar, URLs e comissões.
17. `pos_venda_messages` (base): Mensagens e funil de pós-venda Juquinha.
18. `campaigns` (base): Campanhas de marketing e divulgação promocional.
19. `campanha_messages` (base): Histórico de disparos das mensagens das campanhas.
20. `orcamentos` (base): Orçamentos comerciais (independentes e vinculados a O.S.), propostas e condições de pagamento.
21. `orcamento_itens` (base): Peças e serviços discriminados no orçamento.
22. `orcamento_anexos` (base): Fotos do equipamento e laudos vinculados aos orçamentos.
23. `pricing_history` (base): Histórico e memória de cálculo de precificação de produtos.
24. `rental_machines` (base): Máquinas e impressoras disponíveis para locação.
25. `rental_quotes` (base): Propostas comerciais e simulações de locação de impressoras.
26. `rental_contracts` (base): Contratos formalizados de locação com franquias, números e cláusulas.
27. `funcoes` (base): Cargos e funções de colaboradores.
28. `parametros` (base): Parâmetros de margem e vida útil para locação.
29. `suprimentos` (base): Catálogo de toners, tintas, fotocondutores e cálculo de CPP fornecedor.
30. `impressoras` (base): Modelos de impressoras com vinculação de suprimentos e custo PrintWayy.
31. `contratos` (base): Contratos legados/adicionais de locação de impressoras.
32. `auditoria_precos` (base): Trilha de auditoria de alterações de custos e preços.
33. `laudos_tecnicos` (base): Laudos técnicos formais com parecer, testes e assinaturas.
34. `financial_receivables` (base): Tabela de títulos a receber.
35. `rental_documents` (base): Documentos anexos dos contratos de locação.
36. `rental_reserve` (base): Configuração e alíquota de reserva técnica para locações.
37. `order_division_history` (base): Auditoria completa de mudanças de divisão e equipe na O.S.
38. `quick_accounts` (view): Visão de contas de acesso rápido (view SQL para suporte ao login).

### 3.1 Integridade dos Dados e Paginação Estável

- **Ordenação Estável:** Todas as leituras utilizam `sort: '+id'`, evitando que a inserção de novos registros durante a paginação altere a ordem e faça registros serem saltados ou duplicados.
- **Tamanho do Lote:** 200 registros por página (`perPage: 200`), compatível com o limite de timeout da plataforma.
- **Preservação:** IDs originais (15 caracteres alfanuméricos), datas ISO-8601 UTC (`created`, `updated`), status, valores numéricos e vínculos são exportados em sua forma bruta e literal, sem qualquer alteração destrutiva ou deduplicação prematura.

---

## 4. FOTOS, ANEXOS, ASSINATURAS E MANIFESTO (RFC 4180)

O sistema trata os arquivos através de um duplo mecanismo:

1. **Manifesto Detalhado de Anexos (`manifesto_anexos_juca_YYYY-MM-DD.csv`):**
   - Formatado com separador `;` e escape estrito RFC 4180 (aspas duplicadas `""`, tratamento de quebras de linha e prefixo BOM `\uFEFF`).
   - Registra: `colecao`, `registro_id`, `campo`, `nome_arquivo`, `caminho_storage`, `url_download`, `tamanho_bytes`, `sha256`, `status_download`, `motivo_falha`.
   - **Campos de Arquivo:**
     - `service_orders`: `customer_signature`, `technician_signature` (PNG).
     - `service_attachments`: `file` (JPEG, PNG, HEIC, PDF).
     - `orcamentos`: `assinatura_cliente`, `assinatura_tecnico` (PNG).
     - `orcamento_anexos`: `caminho_arquivo` (JPEG, PNG, HEIC).
     - `laudos_tecnicos`: `assinatura_tecnico`, `assinatura_cliente` (PNG).
     - `equipment`: `photos`.
     - `products`: `photo_file`.
     - `campaigns`: `flyer`.
     - `users`: `avatar`.
     - **Anexos embutidos em JSON:** `rental_contracts` (`equipamento_dados.modelo_contrato.photos`) e `rental_documents` (`payload.dataUrl`).

2. **Utilitário de Download Autenticado em Lote (`downloadAttachmentsBatch`):**
   - Disponível na interface da prévia em **Relatórios e Auditoria > Exportar Relatórios**.
   - Baixa os arquivos reais da API em lotes de 3 requisições simultâneas com retentativas automáticas (até 2 re-tentativas com backoff exponencial).
   - Calcula o hash criptográfico **SHA-256** de cada arquivo baixado no navegador via `crypto.subtle.digest`.
   - Baixa o CSV atualizado contendo o hash real e o tamanho de cada arquivo obtido.

---

## 5. CONFERÊNCIA FINANCEIRA AUDITADA

O cálculo financeiro **NÃO adota somas nominais como faturamento realizado**. A auditoria financeira estruturada em `financial_audit` separa rigorosamente:

### 5.1 Critérios de Cada Indicador

- **Total Nominal das OS (`service_orders_nominal_total`):** Soma aritmética do campo `total` de todas as ordens de serviço cadastradas, sem filtro de status. Serve como índice de volume nominal emitido na história da assistência.
- **Detalhamento por Status da OS (`service_orders_by_status`):** Apura quantidade e total financeiro discriminado por: `completed`, `closed`, `in_progress`, `open`, `paused`, `waiting_parts`, `cancelled`, `aguardando_orcamento`, `orcamento_enviado`, `orcamento_aprovado`, `orcamento_rejeitado`.
  - **Atenção:** Ordens `open`, `paused`, `waiting_parts` ou `cancelled` **NÃO são tratadas como faturamento realizado**.
- **Faturamento Realmente Recebido (`payments_total_paid`):** Soma exclusiva dos registros da tabela `payments` com `status === 'paid'`.
- **Valores a Receber Pendentes (`payments_total_pending`):** Pagamentos aguardando liquidação.
- **Valores Estornados (`payments_total_refunded`):** Devoluções registradas.
- **Meios de Pagamento (`payments_by_method`):** Apura recebimentos por PIX, Dinheiro, Cartão de Crédito, Cartão de Débito, Boleto, etc.
- **Orçamentos (`quotes_by_status`):** Total nominal e por status (`rascunho`, `enviado`, `aprovado`, `faturado`, `rejeitado`). Não soma com o faturamento das OS para evitar duplicação de receita.
- **Itens de Produtos e Serviços:** Contagem cadastral de itens (`catalog_products_count`, `catalog_services_count`) mantida separada do faturamento das OS.

---

## 6. COMPATIBILIDADE COM O DESTINO (SITES)

A migração tem como destino uma nova aplicação em desenvolvimento na plataforma **Sites**. Ela **não exige PocketBase nem restauração idêntica de servidor VPS**.

### 6.1 Mapeamento de Dados para o Destino

- **Formato dos Dados:** Arquivo JSON hierárquico com chaves correspondentes aos nomes das coleções originais.
- **Estratégia de Identificadores (IDs):**
  - O destino deve criar uma coluna `origem_id` (VARCHAR 30) em cada tabela destino.
  - Ao importar cada entidade, armazena o ID original de 15 caracteres do PocketBase em `origem_id`.
  - Durante o vínculo de chaves estrangeiras (ex: `service_orders.customer` apontando para `customers.id`), o importador do destino faz o DE-PARA consultando a tabela `customers` onde `origem_id = service_order.customer`.
- **Autenticação e Senhas dos Usuários:**
  - O PocketBase armazena os hashes de senha com bcrypt internamente no SQLite (`_pb_users_auth_`). A API do PocketBase não expõe os hashes de senha nem tokens confidenciais por motivos de segurança e LGPD.
  - **Procedimento para o destino:** Os usuários devem ser criados no destino com suas informações cadastrais (`name`, `email`, `role`, `phone`, `funcao`). Na primeira entrada no novo sistema, deve ser utilizado fluxo de "Primeiro Acesso / Redefinir Senha" por e-mail ou SMS/WhatsApp, ou senha padrão provisória com troca obrigatória no primeiro login.
- **Migrations:** Os arquivos em `pocketbase/migrations/` documentam o esquema relacional de origem; não devem ser rodados diretamente no banco de dados do destino se o destino utilizar outro SGBD (PostgreSQL, MySQL, etc.). Crie as tabelas equivalentes no destino com base no JSON e na seção 3 deste documento.

---

## 7. ATUALIZAÇÃO INCREMENTAL ATÉ A TROCA FINAL (DELTA)

O sistema continuará em operação até o momento do corte final (prazo 02/11/2026).

### 7.1 Ponto de Corte e Captura do Delta

1. **Ponto de Corte:** Registre a data UTC exata do primeiro backup completo (ex: `2026-10-14T00:00:00Z`).
2. **Janela de Sobreposição Segura:** Para compensar possíveis divergências de fuso horário ou transações em curso, adote uma sobreposição segura de 2 horas antes do ponto de corte (ex: `2026-10-13T22:00:00Z`).
3. **Filtro de Exportação Incremental:**
   ```text
   updated >= "YYYY-MM-DDTHH:mm:ssZ"
   ```
4. **Deduplicação por ID no Destino:**
   - Como os IDs originais são mantidos, execute sempre operação de **Upsert**:
     - Se `origem_id` já existir na tabela do destino: `UPDATE`.
     - Se não existir: `INSERT`.

### 7.2 Tratamento Rigoroso de Exclusões

- **Regra de Ouro:** Uma falha de consulta ou limitação de permissão de um usuário **nunca pode ser interpretada como exclusão no destino**.
- Para confirmar a exclusão de um registro:
  1. A exportação deve ter status `package_status === 'complete'` e ter sido executada com credencial de **administrador**.
  2. Compare o conjunto completo de IDs da origem atual contra o conjunto do destino.
  3. Somente registros que existiam anteriormente e **não existem mais** em uma listagem 100% íntegra podem ser marcados como excluídos ou inativados no destino.

---

## 8. INSTRUÇÕES DE ACESSO E GERAÇÃO NA PRÉVIA

1. Acesse o sistema JUCA INFORMÁTICA como Administrador.
2. Navegue até o menu lateral ou superior: **Relatórios e Auditoria > Rel. Geral / Migração**.
3. No painel de exportação, clique em:
   - **"Gerar Pacote de Migração (JSON + Manifesto CSV)"**: Executa a paginação de todas as 38 coleções, valida os vínculos, audita os totais por status e faz o download imediato do arquivo JSON estruturado e do manifesto CSV.
   - **"Baixar e Verificar Arquivos Físicos (SHA-256)"**: Após gerar o pacote, clica para disparar o download autenticado de todas as fotos, comprovantes e assinaturas em lote, gerando o manifesto atualizado com os hashes SHA-256 e tamanhos físicos comprovados.
