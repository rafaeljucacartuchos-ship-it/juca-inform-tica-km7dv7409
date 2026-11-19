# Central de gestão — primeira etapa

Rota `/central`, acessível pelo menu do administrador, sem substituir o dashboard
existente. Usa registros reais de OS, orçamentos, pagamentos e nomes de usuários.
Não altera dados e não requer nova migração. Integra as abas desktop e a navegação
mobile; a página verifica o perfil antes de montar o componente que faz consultas.

## Indicadores

- OS ativas e distribuição por técnico: situação atual, todos os períodos;
  exclui completed, closed e cancelled. Não é medição de produtividade.
- Conversão: situação atual das propostas criadas no período, excluindo
  rascunho e substituido; aprovado e faturado contam como convertidos.
  Não mede aprovações ocorridas no período. Sem propostas, exibe traço.
- Recebimentos: registros paid pela data paid_at, no período escolhido.
  Não usa o status faturado do orçamento para inferir recebimento.
- Pendentes: valores dos pagamentos pending, independentemente do período.
  Não equivale ao saldo de todas as OS, nem inclui títulos inexistentes no banco.
- Valores refletem o que já está salvo: eventuais classificações incorretas
  existentes precisam de conciliação separada. Não são saldo bancário.

Consultas trazem somente os campos necessários. Atualização manual, sem promessa
de tempo real. Falha de uma fonte oculta os indicadores e oferece nova tentativa,
sem converter erro em zero. O período usa o calendário local do dispositivo.
Para volumes maiores, substituir getFullList por agregação autenticada no servidor.

## WhatsApp e acessos — pendentes

A seção WhatsApp é um estado de preparação, não uma integração ativa. Não há
mensagens de demonstração, envio, leitura de conversas, presença online ou
contadores inventados. Atendimento, Vendas, Assistência, Caixa e Gestão aparecem
como setores a configurar; não cria usuários nem modifica os três perfis legados.

Antes de ativar a central compartilhada:

1. Conectar a conta empresarial pela integração oficial e verificar elegibilidade
   de coexistência com o aplicativo atual; não remover o número do celular.
2. Configurar backend de webhooks, validação de assinatura, recebimento idempotente,
   fila de envio e acompanhamento de entrega. Credenciais somente no servidor.
3. Criar conversas, mensagens, atribuições, setores, participantes e trilha de
   auditoria com regras de acesso no servidor, incluindo vendedor e caixa.
4. Implantar caixa de entrada, transferência, notas internas, vínculo cliente/OS
   e métricas de espera e primeira resposta.
5. Testar permissões com contas separadas antes de liberar para a equipe.

O bloqueio administrativo desta tela é de interface, não corrige as permissões
amplas existentes na API. Não tratar este PR como implementação de segurança
por setor. A migração de hospedagem continua dependente do backup do Skip.

## Validação

Testes de métricas: `node tests/management-metrics.test.mjs` usando Node 24+
(suporte nativo a TypeScript sem transformação de JSX).
Verificar em homologação a navegação mobile e desktop, login como administrador
e técnico, períodos e falha de conexão. Não publicar sem build completo e QA.
