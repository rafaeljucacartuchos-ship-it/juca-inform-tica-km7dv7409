// Endpoint para o Juquinha gerar variação humana usando o agente nativo Skip Cloud
routerAdd(
  'POST',
  '/backend/v1/juquinha/generate-custom',
  (e) => {
    var userId = e.auth?.id
    if (!userId) return e.unauthorizedError('auth required')

    var body = e.requestInfo().body || {}
    var prompt = body.prompt || ''
    var customerName = body.customer_name || 'Cliente'
    var tipo = body.tipo || 'pos_venda'

    var message =
      'Gere uma mensagem amigável e acolhedora de WhatsApp para o cliente ' +
      customerName +
      ' no contexto: ' +
      tipo +
      '. Detalhes adicionais: ' +
      prompt +
      '. Lembre-se de sempre assinar como "Juquinha — JUCA Informática" e incluir contatos.'

    try {
      var result = $ai.agent('juquinha').chat({
        user_id: userId,
        message: message,
      })

      return e.json(200, {
        content: result.content,
        conversation_id: result.conversation_id,
      })
    } catch (err) {
      // Fallback gracioso se a IA estiver temporariamente offline
      return e.json(200, {
        content:
          'Olá, ' +
          customerName +
          '! Aqui é o Juquinha da JUCA Informática! Passando para ver se precisa de ajuda com seus equipamentos ou suprimentos. Qualquer dúvida, conte conosco!\n\n— *Juquinha — JUCA Informática*',
        fallback: true,
      })
    }
  },
  $apis.requireAuth(),
)
