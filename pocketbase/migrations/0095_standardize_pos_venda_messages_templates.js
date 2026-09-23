migrate(
  (app) => {
    // Migration 0095: Regenera textos e wa_me_link dos registros pendentes em pos_venda_messages
    // (status IN ['pending', 'ready', 'lembrete']) seguindo o padrão unificado oficial:
    // - Cabeçalho: "🛠️ *JUCA INFORMÁTICA*\n\n" (emoji Unicode puro)
    // - Assinatura única: "\n\n— *Juquinha — JUCA Informática*\n📞 (67) 3441-4981 | (67) 99654-4981"
    // - Sanitização de equipamento na frase ("do seu *...*", "da sua *...*", "do seu equipamento")
    // - SEM número de O.S. na mensagem do cliente
    // - Link do funil "/avaliar/:token" nas etapas aplicáveis (check-in, 7d, avaliação, etc.)
    // - NÃO toca em status 'sent' nem 'sem_resposta' (histórico preservado)
    // - Idempotente: se já estiver no padrão novo, não quebra nem altera desnecessariamente

    const HEADER = '🛠️ *JUCA INFORMÁTICA*\n\n'
    const FOOTER = '\n\n— *Juquinha — JUCA Informática*\n📞 (67) 3441-4981 | (67) 99654-4981'

    function sanitizeEquipment(eq) {
      if (!eq) return 'seu equipamento'
      const trimmed = eq.trim()
      if (!trimmed) return 'seu equipamento'
      const up = trimmed.toUpperCase()
      if (
        up === 'SEM MARCA' ||
        up === 'NÃO INFORMADO' ||
        up === 'NAO INFORMADO' ||
        up === 'OUTRO' ||
        up === 'OUTROS' ||
        up === 'EQUIPAMENTO' ||
        up === 'DESCONHECIDO'
      ) {
        return 'seu equipamento'
      }
      return trimmed
    }

    function buildEquipPhrase(eq, prefix) {
      const s = sanitizeEquipment(eq)
      if (s === 'seu equipamento') {
        if (prefix === 'do') return 'do seu equipamento'
        if (prefix === 'o') return 'o seu equipamento'
        return 'de seu equipamento'
      }
      const low = s.toLowerCase()
      const isFem =
        low.startsWith('impressora') ||
        low.startsWith('multifuncional') ||
        low.startsWith('placa') ||
        low.startsWith('fonte') ||
        low.startsWith('tela') ||
        low.startsWith('caixa') ||
        low.startsWith('tv') ||
        low.startsWith('máquina') ||
        low.startsWith('maquina')
      if (prefix === 'do') {
        return isFem ? 'da sua *' + s + '*' : 'do seu *' + s + '*'
      }
      if (prefix === 'o') {
        return isFem ? 'a sua *' + s + '*' : 'o seu *' + s + '*'
      }
      return isFem ? 'da sua *' + s + '*' : 'do seu *' + s + '*'
    }

    let originUrl = 'https://assistencia-tecnica-movel-86527--skip-app.shrd00.internal.goskip.dev'
    const envPublic = $os.getenv('APP_PUBLIC_URL') || $os.getenv('FRONTEND_URL') || ''
    if (envPublic) originUrl = envPublic.replace(/\/+$/, '')

    let googleReviewUrl = 'https://g.page/r/CfKb0UxVRFNsEAI/review'
    try {
      const setRec = app.findFirstRecordByData('settings', 'key', 'google_review_url')
      if (setRec && setRec.getString('value')) {
        googleReviewUrl = setRec.getString('value').trim()
      }
    } catch (_) {}

    // Busca todas as mensagens com status pendente (pending, ready, lembrete)
    let pendingRecords = []
    try {
      pendingRecords = app.findRecordsByFilter(
        'pos_venda_messages',
        'status = "pending" || status = "ready" || status = "lembrete"',
        'created',
        5000,
        0,
      )
    } catch (findErr) {
      console.log('0095: Erro ao listar pos_venda_messages:', String(findErr))
      return
    }

    console.log(
      '0095: Encontrados ' +
        pendingRecords.length +
        ' registros de pós-venda pendentes para padronização de template.',
    )

    let updatedCount = 0

    for (let i = 0; i < pendingRecords.length; i++) {
      const msgRec = pendingRecords[i]
      try {
        const tipo = msgRec.getString('tipo')
        const isLembrete = msgRec.getString('status') === 'lembrete'

        // Log interno mantém apenas log interno
        if (tipo === 'log_interno') continue

        const custId = msgRec.getString('customer')
        const soId = msgRec.getString('service_order')

        let custName = 'Cliente'
        let rawPhone = ''
        if (custId) {
          try {
            const cust = app.findRecordById('customers', custId)
            custName =
              cust.getString('nome_fantasia') ||
              cust.getString('razao_social') ||
              cust.getString('name') ||
              'Cliente'
            rawPhone = cust.getString('celular') || cust.getString('phone') || ''
          } catch (_) {}
        }
        const firstName = custName.trim().split(' ')[0] || 'Cliente'

        let equip = ''
        let serviceReport = ''
        let techName = ''
        let itemsSummary = ''
        let soDocUrl = ''

        if (soId) {
          try {
            const so = app.findRecordById('service_orders', soId)
            equip = so.getString('equipment') || ''
            serviceReport = so.getString('service_report') || so.getString('description') || ''

            const soToken = so.getString('token_acesso')
            if (soToken) {
              soDocUrl = originUrl + '/ordens/' + soToken + '/imprimir'
            }

            const techId = so.getString('technician')
            if (techId) {
              try {
                const tech = app.findRecordById('users', techId)
                techName = tech.getString('name') || tech.getString('username') || ''
              } catch (_) {}
            }

            try {
              const items = app.findRecordsByFilter(
                'service_order_items',
                'service_order = "' + soId + '"',
                'created',
                5,
                0,
              )
              if (items && items.length > 0) {
                const itemNames = []
                for (let j = 0; j < items.length; j++) {
                  const desc = items[j].getString('description')
                  if (desc && desc.trim()) itemNames.push(desc.trim())
                }
                if (itemNames.length > 0) {
                  itemsSummary = itemNames.slice(0, 3).join(', ')
                }
              }
            } catch (_) {}
          } catch (_) {}
        }

        let digits = rawPhone.replace(/\D/g, '')
        if (digits.startsWith('0')) digits = digits.substring(1)
        if (digits && !digits.startsWith('55')) digits = '55' + digits

        let token = msgRec.getString('token_acesso')
        if (!token) {
          token = $security.randomString(32)
          msgRec.set('token_acesso', token)
        }

        const evalUrl = originUrl + '/avaliar/' + token

        function buildEvalLinkBlock(url) {
          if (url && url.trim()) {
            return '\n\nDe 0 a 5, como você avalia? Toque na sua nota aqui 👉 ' + url.trim()
          }
          return '\n\nDe 0 a 5, como você avalia? Se puder responder com a sua nota, ficamos imensamente gratos! 🙏'
        }

        const equipPhraseDo = buildEquipPhrase(equip, 'do')
        const techPart = techName.trim() ? ' pelo técnico *' + techName.trim() + '*' : ''
        const evalLinkBlock = buildEvalLinkBlock(evalUrl)

        let body = ''

        switch (tipo) {
          case 'documento_os': {
            const docLink = soDocUrl ? '\n\n👉 ' + soDocUrl + '\n\n' : '\n\n'
            body =
              'Olá, *' +
              firstName +
              '*! Tudo bem? 😊\n\n' +
              'Segue o documento oficial do atendimento ' +
              equipPhraseDo +
              '.' +
              docLink +
              'Qualquer dúvida ou caso precise de algo mais, estamos à total disposição!'
            break
          }
          case 'follow_up_proposta': {
            body =
              'Oi, ' +
              firstName +
              '! Tudo bem? 😊\n\n' +
              'Estou acompanhando sua proposta referente ' +
              equipPhraseDo +
              '.\n\n' +
              'Queria saber: ficou dentro do que você estava procurando ou gostaria que eu verificasse outra opção para você?\n\n' +
              'Pode me falar com sinceridade, assim consigo te ajudar melhor!'
            break
          }
          case 'checkin_pos_venda': {
            const lembreteIntro = isLembrete
              ? 'Passando apenas para um lembrete rápido sobre o atendimento ' +
                equipPhraseDo +
                '.\n\n'
              : 'Passando rapidinho para saber: como está o funcionamento ' +
                equipPhraseDo +
                '?\n\n'

            body =
              'Oi, ' +
              firstName +
              '! Tudo bem com você? 😄\n\n' +
              lembreteIntro +
              'Já conseguiu testar no dia a dia? Ficou tudo 100% como você esperava?\n\n' +
              (techName.trim()
                ? 'O atendimento foi realizado com toda dedicação' + techPart + '. '
                : '') +
              'Se tiver qualquer dúvida ou precisar de um ajuste, estamos à sua inteira disposição!' +
              evalLinkBlock
            break
          }
          case 'pos_venda_7d': {
            let detailsLine = ''
            if (serviceReport) {
              detailsLine = ' após ' + serviceReport
            } else if (itemsSummary) {
              detailsLine = ' após ' + itemsSummary
            }

            const lembreteIntro = isLembrete
              ? 'Passando para um breve lembrete de acompanhamento ' +
                equipPhraseDo +
                detailsLine +
                '.\n\n'
              : 'Já se passou uma semaninha desde o serviço ' +
                equipPhraseDo +
                detailsLine +
                techPart +
                '.\n\n'

            body =
              'Olá, ' +
              firstName +
              '! Tudo bem? 🛠️\n\n' +
              lembreteIntro +
              'Como tem sido o uso na rotina? O equipamento está respondendo rápido e perfeitamente?\n\n' +
              'Conta para a gente! Se precisar de qualquer orientação complementar, estamos por aqui!' +
              evalLinkBlock
            break
          }
          case 'avaliacao_satisfacao':
          case 'avaliacao_tecnico': {
            const techLabel = techName.trim()
              ? '*' + techName.trim() + '*'
              : 'da nossa equipe técnica'
            body =
              'Oi, ' +
              firstName +
              '! Que bom falar com você! 😊\n\n' +
              'O atendimento ' +
              equipPhraseDo +
              ' foi realizado pelo técnico ' +
              techLabel +
              '.\n\n' +
              'Como você avalia o serviço e a atenção dele?' +
              evalLinkBlock
            break
          }
          case 'avaliacao_google': {
            const gLink = googleReviewUrl.trim()
              ? '\n\n👉 ' + googleReviewUrl.trim() + '\n\n'
              : '\n\n(Acesse nossa página no Google e deixe seu comentário!)\n\n'
            body =
              'Oi, ' +
              firstName +
              '! Que bom falar com você! 🌐✨\n\n' +
              'A sua opinião no Google é muito importante para nós e ajuda outros clientes a conhecerem a dedicação da nossa equipe.\n\n' +
              'Poderia dedicar 30 segundinhos para deixar uma avaliação 5 estrelas no nosso perfil do Google?' +
              gLink +
              'Muito obrigado pela parceria e carinho de sempre! 🚀'
            break
          }
          case 'avaliacao_30min': {
            body =
              'Oi, ' +
              firstName +
              '! Tudo bem? 😊\n\n' +
              'Passando para agradecer pela confiança no atendimento ' +
              equipPhraseDo +
              '!\n\n' +
              'A sua opinião é fundamental para nós.' +
              evalLinkBlock
            break
          }
          case 'oferta_30d': {
            const lembreteIntro = isLembrete
              ? 'Passando para um lembrete amigo: já faz 1 mês que cuidamos ' +
                equipPhraseDo +
                '!\n\n'
              : 'Já faz 1 mês que cuidamos ' +
                equipPhraseDo +
                ' e esperamos que tudo continue funcionando perfeitamente por aí!\n\n'

            body =
              'Oi, ' +
              firstName +
              '! Como você está? ✨😊\n\n' +
              lembreteIntro +
              'Manutenção preventiva e cuidado contínuo evitam surpresas e mantêm seu trabalho sempre fluindo.\n\n' +
              'Se estiver precisando de recarga de cartuchos, toners, cabos, SSD/memória ou um check-up com condições especiais de cliente parceiro, me dá um toque aqui no WhatsApp!\n\n' +
              (techName.trim()
                ? 'O técnico *' + techName.trim() + '* e toda a nossa equipe mandam aquele abraço!'
                : 'Toda a nossa equipe da JUCA manda aquele abraço!')
            break
          }
          default: {
            body =
              'Oi, ' +
              firstName +
              '! Tudo bem? 😄\n\n' +
              'Passando para saber se está tudo bem ' +
              equipPhraseDo +
              '. Qualquer dúvida ou suporte, estamos sempre à disposição!'
            break
          }
        }

        const newText = HEADER + body + FOOTER
        const newWaLink = digits
          ? 'https://wa.me/' + digits + '?text=' + encodeURIComponent(newText)
          : ''

        const currentText = msgRec.getString('texto_gerado')
        const currentWaLink = msgRec.getString('wa_me_link')

        // Idempotência: só salva se houver diferença no texto, wa_me_link ou token
        if (
          currentText !== newText ||
          currentWaLink !== newWaLink ||
          msgRec.getString('token_acesso') !== token
        ) {
          msgRec.set('texto_gerado', newText)
          if (newWaLink) {
            msgRec.set('wa_me_link', newWaLink)
          }
          app.save(msgRec)
          updatedCount++
        }
      } catch (recErr) {
        console.log('0095: Erro ao atualizar registro ' + msgRec.id + ':', String(recErr))
      }
    }

    console.log('0095: Padronização concluída com sucesso. Registros atualizados: ' + updatedCount)
  },
  (app) => {
    // Reversão no-op: dados migrados não necessitam rollback destrutivo
    console.log('0095: Reversão da padronização de templates concluída.')
  },
)
