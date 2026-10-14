# PACOTE COMPLETO E VERIFICÁVEL DE MIGRAÇÃO — JUCA INFORMÁTICA

**Data de Inventário & Exportação:** Outubro / 2026  
**Prazo Limite Estabelecido:** 02/11/2026  
**Sistema:** JUCA INFORMÁTICA (Gestão de Assistência Técnica, OS, Clientes, Orçamentos, Locação e Precificação)  
**Stack de Origem:** Frontend React 19 + TypeScript + Vite + Tailwind PWA sobre Backend PocketBase v0.36 (Skip Cloud)

---

## 1. CÓDIGO E CONFIGURAÇÃO

### 1.1 Estado das Versões e Ambientes

- **Versão Publicada em Produção:** `v0.0.232` (mantida estável e intacta por solicitação do usuário, sem publicação recente).
- **Versão da Prévia Atual:** `v0.0.395` (inclui todas as migrações aplicadas, módulos de locação de impressoras, precificação moderna, contratos, laudos técnicos, pós-venda Juquinha automatizado, auditoria de equipe e divisão de OS, e o exportador completo de migração).
- **Repositório Conectado:** GitHub sincronizado com controle de versão Git.
- **Data da Exportação deste Pacote:** 14/10/2026.

### 1.2 Dependências e Ferramentas

- **Node.js:** v20+ ou v22 LTS recomendado.
- **Gerenciador de Pacotes:** `npm` ou `pnpm`.
- **Bibliotecas Principais do Frontend:**
  - `react`: `^19.2.7`, `react-dom`: `^19.2.7`
  - `vite`: `8.0.16`
  - `pocketbase`: `~0.26.9` (SDK client JS)
  - `xlsx`: `^0.18.5` (importação/exportação de planilhas de produtos e clientes)
  - `@radix-ui/*`: conjunto completo shadcn/ui
  - `recharts`: `^3.8.1` (gráficos de faturamento e evolução)
  - `html5-qrcode`, `quagga2`: leitura de código de barras
  - `heic2any`: conversão de imagens iPhone no upload de anexos
  - `date-fns`: manipulação de datas

### 1.3 Comandos para Executar e Construir

```bash
# 1. Instalar dependências
npm install

# 2. Executar em modo desenvolvimento local
npm run dev

# 3. Executar testes automatizados
npm run test

# 4. Verificação estática (linter e types)
npm run lint
npx tsc --noEmit

# 5. Build de produção (gera a pasta dist/)
npm run build

# 6. Pré-visualizar o build local
npm run preview
```

### 1.4 Nomes das Configurações Necessárias (Environment Variables)

> **Aviso de Segurança:** Por rígida diretriz de conformidade, **nenhum valor secreto, chave de API ou token é registrado neste relatório**. Apenas os NOMES das variáveis necessárias são informados abaixo.

#### Frontend (.env / build-time):

- `VITE_POCKETBASE_URL`: URL base do backend PocketBase (ex: `https://seu-pocketbase.com`).

#### Backend (PocketBase / pb_hooks / $os.getenv):

- `PB_INSTANCE_URL`: URL da instância backend interna.
- `PB_SUPERUSER_TOKEN`: Token de autenticação superuser do PocketBase para hooks administrativos.
- `SITE_URL` / `APP_PUBLIC_URL` / `FRONTEND_URL`: Endereço web público da aplicação cliente (utilizado para gerar os links de avaliação `/avaliar/:token`, propostas e O.S. compartilhada).
- `SKIP_AI_GATEWAY_API_KEY`: Chave da API do gateway de IA (caso utilize a geração customizada do assistente Juquinha).
- `SKIP_AI_GATEWAY_URL`: Endpoint do gateway de IA.

#### Procedimento Seguro para Transferência das Chaves:

1. Gere um arquivo `.env` seguro no servidor de destino com permissões restritas de leitura (`chmod 600 .env`).
2. Transfira as credenciais reais através de canal cifrado de ponta a ponta (ex: Bitwarden, 1Password Secrets, GPG ou SSH seguro). Nunca envie por e-mail ou canais abertos.
3. Cadastre novos usuários administradores diretamente pelo painel do PocketBase no destino (`/_/`) com credenciais fortes e gere novas chaves para o serviço de IA.

---

## 2. BANCO DE DADOS COMPLETO E ESQUEMA

O backend é construído sobre o **PocketBase v0.36** (SQLite com camada de metadados, regras de acesso RLS e hooks transacionais).

### 2.1 Lista Completa das 37 Coleções do Sistema

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
15. `quick_accounts` (view): Visão de contas de acesso rápido.
16. `service_types` (base): Tipos de atendimento configurados.
17. `settings` (base): Parâmetros globais de precificação, taxas de cartão, dólar, URLs e comissões.
18. `pos_venda_messages` (base): Mensagens e funil de pós-venda Juquinha (check-in, 7 dias, avaliação 0-5, oferta 30 dias).
19. `campaigns` (base): Campanhas de marketing e divulgação promocional.
20. `campanha_messages` (base): Histórico de disparos das mensagens das campanhas.
21. `orcamentos` (base): Orçamentos comerciais (independentes e vinculados a O.S.), propostas e condições de pagamento.
22. `orcamento_itens` (base): Peças e serviços discriminados no orçamento.
23. `orcamento_anexos` (base): Fotos do equipamento e laudos vinculados aos orçamentos.
24. `pricing_history` (base): Histórico e memória de cálculo de precificação de produtos.
25. `rental_machines` (base): Máquinas e impressoras disponíveis para locação.
26. `rental_quotes` (base): Propostas comerciais e simulações de locação de impressoras.
27. `rental_contracts` (base): Contratos formalizados de locação com franquias, números e cláusulas.
28. `funcoes` (base): Cargos e funções de colaboradores.
29. `parametros` (base): Parâmetros de margem e vida útil para locação.
30. `suprimentos` (base): Catálogo de toners, tintas, fotocondutores e cálculo de CPP fornecedor.
31. `impressoras` (base): Modelos de impressoras com vinculação de suprimentos e custo PrintWayy.
32. `contratos` (base): Contratos legados/adicionais de locação de impressoras.
33. `auditoria_precos` (base): Trilha de auditoria de alterações de custos e preços.
34. `laudos_tecnicos` (base): Laudos técnicos formais com parecer, testes e assinaturas.
35. `financial_receivables` (base): Tabela de títulos a receber.
36. `rental_documents` (base): Documentos anexos dos contratos de locação.
37. `rental_reserve` (base): Configuração e alíquota de reserva técnica para locações.
38. `order_division_history` (base): Auditoria completa de mudanças de divisão e equipe na O.S.

### 2.2 Preservação e Integridade dos Identificadores Originais

- **Identificadores (IDs):** Todos os registros utilizam IDs estáveis de 15 caracteres alfanuméricos gerados pelo PocketBase (ex: `czio1ycdppa5i9w`). Na migração, os IDs **devem ser mantidos idênticos** para preservar todas as relações estrangeiras (`relation`).
- **Precisão Decimal:** Valores monetários e taxas utilizam números de ponto flutuante com centavos exatos preservados. A rotina de divisão de equipe do sistema apura resíduos inteiros em centavos para evitar discrepâncias.
- **Datas:** Todas as datas de criação (`created`) e atualização (`updated`) estão em formato UTC ISO-8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`).

### 2.3 Arquivos de Migração Versionados no Repositório

Todas as 99 migrações estruturais do PocketBase estão salvas na pasta `pocketbase/migrations/` (de `0001_create_schema.js` até `0099_create_order_division_history.js`).
Ao inicializar uma nova instância limpa do PocketBase com essas migrações, todo o esquema, índices, regras de acesso (RLS) e campos são recriados automaticamente na ordem correta.

---

## 3. FOTOS, ANEXOS E DOCUMENTOS

Consulte o arquivo dedicado `MANIFESTO_ANEXOS.md` na raiz do projeto para o mapa detalhado de cada arquivo por coleção, caminho de armazenamento e instrução de download em lote.

### 3.1 Resumo dos Anexos no Banco

- Anexos de Ordem de Serviço (`service_attachments`): Fotos de chegada, defeitos e vistorias.
- Fotos de Orçamentos (`orcamento_anexos`): Registro fotográfico de peças e orçamentos.
- Assinaturas Digitais em canvas (`service_orders`, `orcamentos`, `laudos_tecnicos`): Assinaturas do cliente e do técnico colhidas no PWA e mantidas como PNG.

### 3.2 Exportação do Manifesto

O sistema conta com exportação em 1 clique do manifesto completo em formato CSV e no pacote JSON através do modal em **Relatórios e Auditoria > Rel. Geral / Migração > Gerar Pacote Completo de Migração**.

---

## 4. REGRAS DE NEGÓCIO E AUTOMAÇÕES IMPLEMENTADAS

### 4.1 Situação da Participação de Dois Técnicos e Vendedor na OS

- **Situação Real:** **COMPLETAMENTE IMPLEMENTADA NO BANCO, NO BACKEND E NA CAMADA DE DADOS; CAMADA DE TELA E RELATÓRIO PRONTA PARA AUDITORIA.**
  - **Campos:** `technician` (técnico principal), `second_technician` (segundo técnico), `seller` (vendedor), `division_model` e `division_details` na tabela `service_orders`.
  - **Histórico e Trava:** Tabela `order_division_history` registrando `previous_state`, `new_state`, `reason`, usuário e status da OS no momento da alteração.
  - **Fórmula de Cálculo:** Divisão centavo a centavo com truncamento e atribuição do resíduo ao primeiro participante com cota $> 0\%$, separando rigorosamente Serviços de Produtos.
  - **Regra de Faturamento Único:** A presença de múltiplos colaboradores divide a atribuição interna de produção, mas **nunca duplica** a contagem de OS ou a receita financeira total da empresa.
  - **Validação com Usuário:** Aguarda conferência visual final dos administradores em homologação antes da entrada em rotina operacional plena.

### 4.2 Precificação de Produtos e Serviços

- **Módulo de Precificação (`src/services/pricing.ts` e `src/lib/pricing-engine.ts`):**
  - Considera Custo do Produto (em BRL ou USD com conversão cambial `cotacao_dolar`), Frete, Despesas Fixas (%), ICMS/Simples (%), Comissão de Vendas (%), Substituição Tributária (%), Taxa de Cartão (conforme bandeira/parcelamento em `payment_methods_tax`) e Margem de Lucratividade Desejada.
  - Fórmulas de Markup sobre o custo e Margem sobre o preço de venda.

### 4.3 Locação de Impressoras e Suprimentos

- **Simulador Comercial e Contratos:**
  - Cálculo de Custo por Página (CPP) de cada suprimento (toners, fusores, cilindros) baseado no rendimento de páginas declarado pelo fabricante.
  - Cálculo de amortização/depreciação da máquina no prazo de payback contratual (12, 18, 24, 36 meses).
  - Adição do custo de software PrintWayy por máquina.
  - Reserva técnica parametrizada em `rental_reserve`.
  - Propostas comerciais com token público de visualização e geração de contratos sequenciais no formato `CT-YYYY-XXX`.

### 4.4 Numeração Sequencial

- **Ordens de Serviço:** Formato `OS-XXXX` gerado de forma atômica no hook de criação (`pocketbase/hooks/service_order_number.js`).
- **Orçamentos:** Formato `ORC-XXXX` ou derivado da OS vinculada (`ORC-OSXXXX`).
- **Laudos Técnicos:** Formato `LAU-XXXX`.
- **Contratos de Locação:** Formato `CT-YYYY-XXX` gerado a partir do contador anual em `settings`.

### 4.5 Automações e Crons no Servidor (pb_hooks)

- **`juquinha_pos_venda_cron` (1 em 1 minuto):**
  - Avalia mensagens pendentes do funil de pós-venda.
  - Respeita rigorosamente o consentimento LGPD (`whatsapp_consent`).
  - Promove mensagens prontas para envio com link formatado `https://wa.me/...`.
- **`on_order_completed_pos_venda` (Trigger ao concluir OS):**
  - Cria automaticamente a sequência das 4 etapas no banco:
    1. Check-in de atendimento (~30 min após fechamento).
    2. Pós-venda 7 dias.
    3. Avaliação de satisfação 0-5 com token público `/avaliar/:token`.
    4. Oferta preventiva 30 dias.
- **`deduct_stock_on_complete`:**
  - Baixa automática no estoque físico dos produtos ao marcar a OS como concluída/fechada.
- **`import_products_cron`:**
  - Sincronização periódica de catálogo de produtos via CSV.

### 4.6 Links Públicos que Dependem do Domínio Atual

O domínio público atual configurado nos servidores é:
`https://assistencia-tecnica-movel-86527.goskip.app`

Rotas públicas ativas:

1. `/avaliar/:token`: Funil público de avaliação de atendimento (notas 0 a 5 com redirecionamento inteligente para Google Reviews se 4-5 ou captura de crítica interna se 0-3).
2. `/proposta/:token`: Visualização e aprovação online de propostas e orçamentos pelo cliente.
3. `/proposta-locacao/:token`: Visualização da proposta de locação de impressoras.
4. `/compartilhar-os/:id`: Visualização resumida e coleta de assinatura remota da O.S.

**Localização da Parametrização:**

- Definido como fallback nos hooks: `pocketbase/hooks/cron_juquinha_pos_venda.js` e `pocketbase/hooks/on_order_completed_pos_venda.js`.
- Parametrizável via variável de ambiente `$os.getenv('APP_PUBLIC_URL')` ou `$os.getenv('FRONTEND_URL')`.
- No novo ambiente, ao cadastrar `APP_PUBLIC_URL=https://novo-dominio.com`, todos os hooks passarão a gerar links no novo endereço automaticamente.

---

## 5. CONTINUIDADE DURANTE A MIGRAÇÃO (DELTA E TRANSIÇÃO)

O sistema de produção continuará ativo até o momento do corte oficial ("cutover").

### 5.1 Identificação de Alterações Incrementais (Delta)

Todas as coleções do PocketBase possuem os campos de auditoria nativos:

- `created`: data e hora da criação do registro.
- `updated`: data e hora da última modificação.

### 5.2 Procedimento para Exportar e Aplicar o Delta:

1. **Ponto de Corte Inicial:** Registre a data/hora exata do primeiro backup completo (ex: `2026-10-14T00:00:00Z`).
2. **Exportação Incremental:** Na data de virada, execute consulta filtrando por:
   `updated >= "2026-10-14T00:00:00Z"`
3. **Importação sem Duplicação:**
   - Como os IDs originais são preservados como chave primária (`id`), execute operação de **Upsert** (se o ID já existe no destino, atualiza; se não existe, insere).
   - Nenhuma nova O.S., orçamento ou cliente receberá novo número, impedindo qualquer conflito de chave.
4. **Tratamento de Exclusões:**
   - O SQLite nativo não registra tuplas de "soft delete" por padrão.
   - Para identificar exclusões ocorridas entre a primeira cópia e a data de troca:
     - Compare a lista de IDs de cada coleção entre a base de origem e o destino.
     - IDs que existiam no primeiro backup e não constam mais na base atual representam registros excluídos no período.

---

## 6. RELATÓRIO DE CONFERÊNCIA E RESTAURAÇÃO

### 6.1 Totais Financeiros de Controle (Consolidados na Base)

- **Ordens de Serviço Cadastradas:** 142 ordens de serviço.
- **Total Faturado em Ordens de Serviço:** R$ 38.309,16 (sem duplicação).
- **Recebimentos Confirmados (`payments` - status `paid`):** R$ 1.356,72.
- **Recebimentos Pendentes (`payments` - status `pending`):** R$ 4.740,70.
- **Clientes Cadastrados:** 1.545 clientes.
- **Orçamentos Emitidos:** 112 orçamentos.
- **Produtos/Itens em Estoque:** 4.195 produtos.
- **Laudos Técnicos:** 2 laudos emitidos.
- **Contratos de Locação:** 3 contratos formalizados.
- **Histórico de Auditoria de Divisão (`order_division_history`):** 1 alteração registrada com snapshot de estado anterior e posterior.

### 6.2 Instruções para Restauração no Ambiente de Destino

#### Cenário 1: Novo Ambiente com PocketBase Próprio (Recomendado)

1. Instale o PocketBase oficial no novo servidor (Linux/Docker).
2. Copie os arquivos de migração da pasta `pocketbase/migrations/` para a pasta do novo PocketBase.
3. Inicie o PocketBase para que as migrações sejam aplicadas e criem todas as tabelas e índices.
4. Execute o script de importação JSON restaurando os registros tabela por tabela com seus IDs originais:
   - Ordem de inserção respeitando chaves estrangeiras: `users` → `customers` → `services` → `products` → `equipment` → `service_types` → `appointments` → `service_orders` → `service_order_items` → `payments` → `orcamentos` → `orcamento_itens` → `rental_*` → `laudos_tecnicos` → `order_division_history`.
5. Baixe os anexos através do `MANIFESTO_ANEXOS.md` e coloque na pasta `pb_data/storage/`.
6. Copie os hooks de `pocketbase/hooks/` para a pasta `pb_hooks/` do novo servidor.
7. Configure o frontend apontando `VITE_POCKETBASE_URL` para o novo endereço.
8. Teste a restauração e navegação completa em ambiente isolado antes de alterar o DNS de produção.

---

## 7. BLOQUEIOS PENDENTES E PRÓXIMOS PASSOS ESPECÍFICOS

| Item                                   | Situação Atual                           | Bloqueio / Limitação                                                      | Próximo Passo Necessário                                                                                                           |
| -------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Ambiente Isolado de Homologação**    | Indisponível nesta execução              | Não é permitido restaurar ou testar sobre a produção do Skip              | Provisionar servidor VPS isolado de teste para rodar o ensaio de restauração do JSON e dos anexos.                                 |
| **Download Binário Físico dos Anexos** | Manifesto gerado com URLs completas      | Acesso SSH direto à pasta `pb_data/storage` não é exposto pelo Skip Cloud | Executar script de download em lote através das URLs permanentes do manifesto para armazenar o ZIP dos arquivos em storage seguro. |
| **Validação da Equipe & Divisão**      | Backend, banco e tela 100% implementados | Aguarda aprovação visual do usuário                                       | Administrador conferir os lançamentos da OS-0122 e relatórios antes da homologação final.                                          |
| **Data Limite**                        | Planejada para 02/11/2026                | Produção permanece ativa                                                  | Manter a rotina de exportação delta pronta para rodar na véspera do desligamento definitivo.                                       |
