# Correção inicial do acesso a orçamentos

A migração `0096_require_auth_for_orcamentos.js` exige autenticação nas regras
vazias de consulta, criação, atualização e exclusão de `orcamentos`,
`orcamento_itens` e `orcamento_anexos`. Regras personalizadas e bloqueadas (`null`)
são preservadas. Nenhum registro, assinatura, token ou senha é modificado.

O cliente continua usando as rotas `/backend/v1/proposta/{token}` e
`/backend/v1/proposta/{token}/aprovar`, que buscam o token no servidor.
Esta correção não cria restrições adicionais entre os perfis autenticados.

## Validação local

Execute `npm test` (Node.js 18 ou superior). Os testes executam a migração e os
hooks reais com adaptadores em memória. Verificam regras, preservação de
configurações restritivas, propagação de erros, tokens inválidos, consulta e
aprovação sem login, repetição da aprovação e estados não aprováveis.
Eles não substituem testes HTTP com a versão de PocketBase usada no servidor.

## Aplicação em homologação e produção

1. Identifique a versão do PocketBase e os diretórios efetivamente usados pelo
   provedor. O projeto usa `pocketbase/migrations`; o diretório padrão do
   PocketBase é `pb_migrations`. Confirme o mapeamento do provedor antes de aplicar.
2. Faça backup recuperável do banco e arquivos. Confira o histórico de migrações
   aplicadas e todas as pendências antes de usar `migrate up` ou reiniciar o
   servidor: existem migrações antigas de exclusão de dados neste repositório.
   Não copie/reaplique todo o histórico em uma base existente sem essa conferência.
3. Aplique primeiro em uma cópia isolada, com a mesma versão do servidor. A
   migração usa a transação fornecida pelo PocketBase; erros devem abortá-la.
4. Usando registros fictícios conhecidos, verifique as três coleções pela API:
   sem autenticação, listagem deve retornar lista vazia (ou bloqueio se a regra
   já era `null`), leitura individual e alteração/exclusão devem ser negadas e
   criação deve falhar. Ter um token de proposta não autoriza a API genérica.
5. Confira CRUD com contas de administrador, atendente e técnico conforme as
   regras existentes. Abra o link público em janela anônima; confira itens,
   fotos, assinatura e aprovação de uma proposta de teste. Confirme rejeição
   de tokens inválidos e ausência de alteração de outro orçamento.
6. Aplique no servidor somente após essa validação e confira as 15 regras no
   painel. Publicar o frontend ou mesclar o PR não comprova aplicação no banco.

## Limites e reversão

O rollback desta migração é bloqueado deliberadamente para não restaurar
alteração/exclusão anônima. Corrija incompatibilidades com uma nova migração
revisada; não esvazie as regras novamente.

Arquivos já públicos em `/api/files` continuam com sua política atual. Esta
etapa fecha a API de registros, não transforma URLs de arquivos já conhecidas
em privadas. Proteção de arquivos, rotação dos tokens que possam ter sido
expostos, revisão de credenciais, permissões por função e consistência de
estoque/pagamentos precisam de etapas próprias. Tokens antigos permanecem
válidos para preservar os links já enviados.

Referências: [regras de API](https://pocketbase.io/docs/api-rules-and-filters/)
e [migrações](https://pocketbase.io/docs/js-migrations/).
