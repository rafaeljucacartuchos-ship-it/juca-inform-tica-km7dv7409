// Cabeçalho padrão exibido no topo de TODAS as mensagens WhatsApp.
export const WHATSAPP_HEADER = '🛠️ *JUCA CARTUCHOS E INFORMÁTICA*\n\n'
// Rodapé padrão com a assinatura da empresa.
export const WHATSAPP_FOOTER =
  '\n\nJuca Cartuchos e Informática Ltda\n(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981'
// Link de avaliação no Google (fixo conforme solicitado).
export const GOOGLE_REVIEW_URL = 'https://g.page/r/CfKb0UxVRFNsEAI/review'

import { normalizePhone, sanitizePhone } from './phones'

export { normalizePhone, sanitizePhone } from './phones'

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = sanitizePhone(phone)
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

/**
 * Mensagem de apresentação da empresa e do técnico responsável para conversar com o cliente na O.S.
 * Abre o WhatsApp SOMENTE para conversar com o cliente, SEM enviar link algum.
 */
export function buildTechnicianPresentationMessage(params: {
  customerName: string
  technicianName?: string
  orderNumber?: string
  equipment?: string
}): string {
  const { customerName, technicianName, orderNumber, equipment } = params
  const firstName = customerName.split(' ')[0] || customerName
  const tech = technicianName?.trim() ? technicianName.trim() : 'da equipe técnica'
  const equipPart = equipment?.trim() ? ` (${equipment.trim()})` : ''
  const osPart = orderNumber?.trim()
    ? ` referente à sua O.S. *${orderNumber.trim()}*${equipPart}`
    : ''

  return (
    `🛠️ *JUCA INFORMÁTICA*\n\n` +
    `Olá, *${firstName}*! Tudo bem?\n\n` +
    `Aqui é o *${tech}*, da JUCA INFORMÁTICA — estamos cuidando do seu atendimento${osPart}.\n\n` +
    `Qualquer dúvida ou informação que precisar, pode me chamar por aqui! 🙂\n\n` +
    `Juca Cartuchos e Informática Ltda\n` +
    `(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981`
  )
}

/**
 * Mensagem de contato inicial / boas-vindas com o cliente na OS aberta.
 * Inclui o nome do técnico responsável para identificação pessoal.
 * O técnico abre a conversa em 1 toque sem precisar digitar nada.
 */
export function buildOpenOrderWelcomeMessage(
  customerName: string,
  orderNumber: string,
  equipment?: string,
  technicianName?: string,
): string {
  const intro = technicianName?.trim()
    ? `Aqui é o técnico ${technicianName.trim()}, da equipe técnica da *JUCA INFORMÁTICA*.`
    : `Aqui é da equipe técnica da *JUCA INFORMÁTICA*.`

  const equipStr = equipment?.trim() ? ` (${equipment.trim()})` : ''

  return (
    `JUCA INFORMÁTICA\n\n` +
    `Olá, ${customerName}! Tudo bem?\n\n` +
    `${intro} Estamos com a sua Ordem de Serviço *${orderNumber}* aberta em nosso sistema${equipStr}.\n\n` +
    `Este é o nosso canal direto para qualquer dúvida ou acompanhamento do seu atendimento!\n\n` +
    `Juca Informática\n\n` +
    `(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981`
  )
}

/**
 * Mensagem com o RESUMO COMPLETO da finalização da O.S.:
 * Itens executados, peças aplicadas, descrição do serviço e valor total.
 */
export function buildOrderCompletionSummaryMessage(params: {
  customerName: string
  orderNumber: string
  equipment?: string
  serviceReport?: string
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>
  total: number
  shareUrl: string
}): string {
  const { customerName, orderNumber, equipment, serviceReport, items, total, shareUrl } = params

  const itemsList =
    items.length > 0
      ? items
          .map(
            (it, idx) =>
              `  ${idx + 1}. ${it.description} (${it.quantity}x R$ ${it.unitPrice.toFixed(2)}) = *R$ ${it.total.toFixed(2)}*`,
          )
          .join('\n')
      : '  • Serviço de mão de obra técnica especializada.'

  return (
    WHATSAPP_HEADER +
    `Olá, *${customerName}*! Sua Ordem de Serviço *${orderNumber}* foi *CONCLUÍDA*! 🎉\n\n` +
    (equipment ? `🖥️ *Equipamento:* ${equipment}\n` : '') +
    (serviceReport ? `📝 *Serviço Executado:*\n${serviceReport}\n\n` : '') +
    `📦 *Itens e Serviços Realizados:*\n${itemsList}\n\n` +
    `💰 *Valor Total:* *R$ ${total.toFixed(2)}*\n\n` +
    `Acesse o comprovante digital e assine o recebimento pelo link:\n${shareUrl}\n\n` +
    `Muito obrigado pela confiança em nossa assistência técnica!` +
    WHATSAPP_FOOTER
  )
}

/**
 * Abre o WhatsApp (wa.me) no navegador/app.
 *
 * NOTA DE TRANSPARÊNCIA ARQUITETURAL:
 * A integração via wa.me depende das APIs nativas do navegador (window.open/redirecionamento).
 * Navegadores modernos impõem políticas estritas anti-popup: chamadas a window.open() disparadas
 * fora de um gesto direto do usuário (como um clique ou toque de tela) são normalmente bloqueadas
 * ou silenciadas sem autorização explícita.
 *
 * Para contornar essa restrição técnica sem um gateway/servidor pago de WhatsApp (ex: Evolution API,
 * Z-API, Baileys), o sistema tenta abrir automaticamente quando a notificação em tempo real chega,
 * e se o navegador bloquear o popup, exibe imediatamente um banner destacado de UM TOQUE ("🎉 Toque
 * para Enviar"). Isso garante o caminho mais automático possível suportado pela web moderna.
 *
 * Retorna boolean indicando se o popup foi potencialmente aberto (não nulo) ou se foi bloqueado.
 */
export function openWhatsApp(phone: string, message: string): boolean {
  try {
    const url = buildWhatsAppUrl(phone, message)
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win || win.closed || typeof win.closed === 'undefined') {
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Mensagem de ENVIO INICIAL / atualização de status da O.S. (status != "Concluída").
 * Contém apenas o link de compartilhamento/assinatura — SEM avaliação.
 * A avaliação é disparada separadamente por `triggerWhatsAppEvaluation`
 * quando a O.S. muda para "Concluída".
 */
export function buildServiceMessage(
  customerName: string,
  orderNumber: string,
  status: string,
  shareUrl: string,
): string {
  const statusLabels: Record<string, string> = {
    open: 'Aberta',
    in_progress: 'Em Andamento',
    paused: 'Pausada',
    waiting_parts: 'Aguardando Peças',
    completed: 'Concluída',
    closed: 'Fechada',
    cancelled: 'Cancelada',
  }
  const statusText = statusLabels[status] || status
  return (
    WHATSAPP_HEADER +
    `Olá ${customerName}! Tudo bem?

Sua Ordem de Serviço *${orderNumber}* foi atualizada e está com status: *${statusText}*.

Acompanhe os detalhes e assine digitalmente sua OS através do link:
${shareUrl}

Qualquer dúvida, estamos à disposição!` +
    WHATSAPP_FOOTER
  )
}

/**
 * Mensagem enviada APENAS quando a O.S. muda para "Concluída".
 * Segunda mensagem separada, contendo agradecimento + link de avaliação
 * do técnico (shareUrl) + link de avaliação no Google.
 */
/**
 * Mensagem de envio do link da proposta online de orçamento ao cliente.
 * Padrão: "Olá [primeiro nome]" + aguardamos clicar no link para analisar a proposta e assinar para aprovação + assinatura JUCA INFORMÁTICA.
 */
export function buildOrcamentoPropostaMessage(params: {
  customerName: string
  numeroOrcamento?: string
  propostaUrl: string
  equipment?: string
  osNumber?: string
  subtotalProdutos?: number
  subtotalServicos?: number
  totalGeral?: number
  resumoServico?: string
}): string {
  const { customerName, propostaUrl, equipment, resumoServico } = params
  const firstName = customerName.trim().split(/\s+/)[0] || 'Cliente'

  // Resumo opcional da proposta ("a proposta da impressora", "a proposta do notebook", ou apenas "a proposta")
  const resumo = (resumoServico || equipment || '').trim()
  const propostaFrase =
    resumo &&
    resumo.toLowerCase() !== 'não especificado' &&
    resumo.toLowerCase() !== 'serviços e peças'
      ? `a proposta ${resumo.toLowerCase().startsWith('da ') || resumo.toLowerCase().startsWith('do ') || resumo.toLowerCase().startsWith('de ') ? resumo : `do(a) ${resumo}`}`
      : 'a proposta'

  return (
    `Oi, ${firstName}! Tudo bem?\n\n` +
    `Estou acompanhando alguns orçamentos e vi que você recebeu ${propostaFrase}.\n\n` +
    `Queria saber: ficou dentro do que você estava procurando ou gostaria que eu verificasse outra opção para você?\n\n` +
    `👉 ${propostaUrl}\n\n` +
    `Pode me falar com sinceridade, assim consigo te ajudar melhor.`
  )
}

/**
 * Mensagem oficial de envio da Ordem de Serviço completa ao cliente (com check-in, laudo e orçamento).
 */
export function buildOsDocumentMessage(params: {
  customerName: string
  osNumber: string
  documentUrl: string
  numeroOrcamento?: string
  equipment?: string
  technicianName?: string
  serviceReport?: string
}): string {
  const {
    customerName,
    osNumber,
    documentUrl,
    numeroOrcamento,
    equipment,
    technicianName,
    serviceReport,
  } = params
  const firstName = customerName.split(' ')[0] || customerName
  const orcPart = numeroOrcamento ? ` · *${numeroOrcamento}*` : ''
  const equipPart = equipment ? ` referente ao seu equipamento *${equipment}*` : ''
  const techPart = technicianName ? `\n👨‍🔧 *Técnico Responsável:* ${technicianName}` : ''
  const laudoPart = serviceReport
    ? `\n🛠️ *Laudo / Execução:* ${serviceReport.slice(0, 90)}${serviceReport.length > 90 ? '...' : ''}`
    : ''

  return (
    `🛠️ *JUCA CARTUCHOS E INFORMÁTICA*\n\n` +
    `Olá, *${firstName}*! Tudo bem?\n\n` +
    `Segue o documento oficial da sua *Ordem de Serviço (${osNumber}${orcPart})*${equipPart}.\n\n` +
    `📄 *Documento Completo da O.S.:* Contém os dados de check-in, fotos do equipamento, laudo técnico/serviço executado, itens do orçamento vinculado e assinaturas.${techPart}${laudoPart}\n\n` +
    `Acesse o documento oficial no link abaixo (otimizado para leitura e impressão em folha única A4):\n\n` +
    `👉 ${documentUrl}\n\n` +
    `Agradecemos a preferência e confiança!\n\n` +
    `JUCA INFORMÁTICA\n` +
    `(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981`
  )
}

/**
 * Mensagem de confirmação/agradecimento enviada ao cliente após a aprovação da proposta no tom do Juquinha.
 */
export function buildOrcamentoAprovadoAgradecimentoMessage(params: {
  customerName: string
  numeroOrcamento: string
  equipment?: string
}): string {
  const { customerName, numeroOrcamento, equipment } = params
  const firstName = customerName.split(' ')[0] || customerName
  const equipPart = equipment ? ` da sua *${equipment}*` : ''

  return (
    `🛠️ *JUCA CARTUCHOS E INFORMÁTICA*\n\n` +
    `Olá, *${firstName}*! 🎉 Que alegria que a proposta *${numeroOrcamento}* foi aprovada!\n\n` +
    `O reparo${equipPart} já está em boas mãos com a equipe JUCA. Muito obrigado pela confiança — a gente cuida de tudo pra você! 💙\n\n` +
    `Juca Informática\n` +
    `(67) 3441-4981 | (67) 3441-9275 | (67) 99654-4981`
  )
}

/**
 * Mensagem oficial unificada de Avaliação de Satisfação (nota 0 a 5).
 * Pergunta PRIMEIRO a nota de satisfação, antes de qualquer pedido do Google.
 * Modelo solicitado pelo usuário Rafael:
 *
 * "🔧 *JUCA CARTUCHOS E INFORMÁTICA*
 *
 * Oi, {NOME}! *Juquinha* aqui de novo! 😊
 *
 * Seu equipamento foi atendido pelo técnico {TÉCNICO} e encerramos a O.S. {NUMERO_OS} hoje.
 *
 * *De 0 a 5, como você avalia o atendimento que recebeu?*
 *
 * Me responde com uma notinha (0 a 5) que eu fico muito grato! 🙏"
 */
export function buildAvaliacaoSatisfacaoMessage(params: {
  customerName: string
  technicianName?: string
  orderNumber?: string
}): string {
  const { customerName, technicianName, orderNumber } = params
  const firstName = customerName.trim().split(/\s+/)[0] || 'Cliente'
  const tech = technicianName?.trim() || 'da nossa equipe técnica'
  const osLabel = orderNumber?.trim() ? orderNumber.trim() : 'sua O.S.'

  return (
    `🔧 *JUCA CARTUCHOS E INFORMÁTICA*\n\n` +
    `Oi, ${firstName}! *Juquinha* aqui de novo! 😊\n\n` +
    `Seu equipamento foi atendido pelo técnico ${tech} e encerramos a O.S. ${osLabel} hoje.\n\n` +
    `*De 0 a 5, como você avalia o atendimento que recebeu?*\n\n` +
    `Me responde com uma notinha (0 a 5) que eu fico muito grato! 🙏` +
    WHATSAPP_FOOTER
  )
}

/**
 * Segunda etapa do funil (disponível quando a nota registrada for 4 ou 5):
 * Convite amigável para registrar uma avaliação de 5 estrelas no Google Meu Negócio.
 */
export function buildGoogleReviewRequestMessage(params: {
  customerName: string
  googleReviewUrl?: string
}): string {
  const { customerName, googleReviewUrl = GOOGLE_REVIEW_URL } = params
  const firstName = customerName.trim().split(/\s+/)[0] || 'Cliente'
  const gLink = googleReviewUrl?.trim() || GOOGLE_REVIEW_URL

  return (
    `🔧 *JUCA CARTUCHOS E INFORMÁTICA*\n\n` +
    `Oi, ${firstName}! *Juquinha* por aqui mais uma vez! 🌐✨\n\n` +
    `Muito obrigado pelo feedback tão positivo! A sua opinião é muito importante para nós e ajuda outros clientes a conhecerem a dedicação da nossa equipe.\n\n` +
    `Poderia dedicar 30 segundinhos para deixar uma avaliação 5 estrelas no nosso perfil do Google?\n\n` +
    `👉 ${gLink}\n\n` +
    `Muito obrigado pela parceria e carinho de sempre! 🚀` +
    WHATSAPP_FOOTER
  )
}

export function buildCompletionEvaluationMessage(
  customerName: string,
  orderNumber: string,
  shareUrl: string,
  details?: {
    equipment?: string
    serviceReport?: string
    technicianName?: string
    itemsSummary?: string
  },
): string {
  const firstName = customerName.split(' ')[0] || customerName
  const equipPart = details?.equipment
    ? ` o seu *${details.equipment.trim()}*`
    : ' o seu equipamento'
  const osPart = orderNumber ? ` (O.S. *${orderNumber}*)` : ''
  const techPart = details?.technicianName?.trim()
    ? `cuidado com carinho pelo nosso técnico *${details.technicianName.trim()}*`
    : `cuidado com toda dedicação pela nossa equipe técnica`

  let servicePart = ''
  if (details?.itemsSummary && details?.serviceReport) {
    servicePart = `após ${details.serviceReport.trim()} e itens: ${details.itemsSummary.trim()}`
  } else if (details?.itemsSummary) {
    servicePart = `após ${details.serviceReport.trim()}`
  } else if (details?.serviceReport) {
    servicePart = `após ${details.serviceReport.trim()}`
  }

  return (
    WHATSAPP_HEADER +
    `Olá, *${firstName}*! Tudo bem? Aqui é o *Juquinha* da JUCA Informática! 🙋‍♂️\n\n` +
    `Sua Ordem de Serviço *${orderNumber}* foi finalizada com sucesso! 🎉\n\n` +
    `Agradecemos de coração pela confiança em trazer${equipPart}${osPart}, ${techPart}${servicePart ? ' (' + servicePart + ')' : ''}.\n\n` +
    (shareUrl
      ? `Acompanhe os detalhes da OS e o termo de conclusão pelo link:\n${shareUrl}\n\n`
      : '') +
    `A sua avaliação é muito importante para valorizar o trabalho do técnico e ajudar a JUCA a crescer!\n` +
    `Dedique 30 segundinhos para nos avaliar no Google — é rapidinho e ajuda muito: ⭐⭐⭐⭐⭐\n` +
    `${GOOGLE_REVIEW_URL}\n\n` +
    `Qualquer dúvida, estamos sempre à disposição!` +
    WHATSAPP_FOOTER
  )
}
/**
 * Abre o WhatsApp com a mensagem de avaliação de conclusão.
 * Usada quando o status da O.S. muda para "Concluída".
 */
export function triggerWhatsAppEvaluation(
  phone: string,
  customerName: string,
  orderNumber: string,
  shareUrl?: string,
  details?: {
    equipment?: string
    serviceReport?: string
    technicianName?: string
    itemsSummary?: string
  },
) {
  const link = shareUrl || ''
  const msg = buildCompletionEvaluationMessage(customerName, orderNumber, link, details)
  openWhatsApp(phone, msg)
}

/**
 * Mensagem em pt-BR apresentando a Proposta de Locação de Impressoras da JUCA INFORMÁTICA.
 * Apresenta dados do cliente, opções de equipamentos, franquia mensal, valor mensal,
 * valor da página excedente, vigência do contrato e itens inclusos.
 */
/**
 * Constrói a mensagem curta e direta focada em fechamento com link do documento de locação:
 * "Olá, {cliente}! 👋 Segue a proposta de locação da JUCA INFORMÁTICA: {link} — {equipamento} • Franquia {franquia} páginas/mês • R$ {valor mensal}/mês. Qualquer dúvida estou à disposição — pode fechar por aqui mesmo! ✅"
 */
export function buildRentalProposalClosingMessage(params: {
  customerName: string
  propostaUrl: string
  equipamento: string
  franquiaPaginas: number
  valorMensal: number
}): string {
  const { customerName, propostaUrl, equipamento, franquiaPaginas, valorMensal } = params
  const firstName = customerName.split(' ')[0] || customerName
  const fmtValor = (valorMensal || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const fmtFranquia = (franquiaPaginas || 0).toLocaleString('pt-BR')
  const equipNome = equipamento?.trim() || 'Equipamento de Impressão'

  return (
    `Olá, ${firstName}! 👋 Segue a proposta de locação da JUCA INFORMÁTICA: ${propostaUrl} — ` +
    `${equipNome} • Franquia ${fmtFranquia} páginas/mês • R$ ${fmtValor}/mês. ` +
    `Qualquer dúvida estou à disposição — pode fechar por aqui mesmo! ✅`
  )
}

/**
 * Mensagem amigável de retomada de negociação para orçamentos pendentes/enviados.
 * 'Olá, {primeiro nome}! Passando para saber se consegui te ajudar com o orçamento {numero} — {resumo}? A proposta fica válida por {X dias|tempo limitado} e temos condição de fechar por {total BRL}. {link da proposta, se houver} Qualquer dúvida me chama por aqui! 😉'
 */
/**
 * Mensagem da PRIMEIRA apresentação da proposta de serviço ao cliente via WhatsApp (v0.0.265).
 * Template oficial exato:
 * "Oi, {NOME}! Tudo bem?
 *
 * Aqui é o(a) {TÉCNICO}, da JUCA Informática. 😊
 *
 * Finalizei o diagnóstico do seu {EQUIPAMENTO} e preparei a proposta de serviço para você conferir:
 *
 * 👉 {LINK DA PROPOSTA}
 *
 * Nela estão o diagnóstico do problema, o que será feito e os valores — tudo detalhado, sem surpresa. Qualquer dúvida é só me chamar que eu te explico com prazer.
 *
 * Aprovar por aí ou me dar um retorno aqui, e já agendamos o serviço! 🚀"
 */
export function buildOrcamentoPrimeiraApresentacaoMessage(params: {
  customerName: string
  technicianName?: string
  equipment?: string
  propostaUrl: string
}): string {
  const { customerName, technicianName, equipment, propostaUrl } = params
  const firstName = customerName.trim().split(/\s+/)[0] || 'Cliente'
  const tech = technicianName?.trim() || 'Técnico(a)'
  const equip =
    equipment?.trim() && equipment.toLowerCase() !== 'não especificado'
      ? equipment.trim()
      : 'equipamento'

  return (
    `Oi, ${firstName}! Tudo bem?\n\n` +
    `Aqui é o(a) ${tech}, da JUCA Informática. 😊\n\n` +
    `Finalizei o diagnóstico do seu ${equip} e preparei a proposta de serviço para você conferir:\n\n` +
    `👉 ${propostaUrl}\n\n` +
    `Nela estão o diagnóstico do problema, o que será feito e os valores — tudo detalhado, sem surpresa. Qualquer dúvida é só me chamar que eu te explico com prazer.\n\n` +
    `Aprovar por aí ou me dar um retorno aqui, e já agendamos o serviço! 🚀`
  )
}

export function buildOrcamentoRetomadaNegociacaoMessage(params: {
  customerName: string
  numeroOrcamento?: string
  resumoServico?: string
  validadeDias?: number
  totalGeral?: number
  propostaUrl?: string
}): string {
  const { customerName, resumoServico, propostaUrl } = params
  const firstName = customerName.trim().split(/\s+/)[0] || 'Cliente'

  const resumo = (resumoServico || '').trim()
  const propostaFrase =
    resumo &&
    resumo.toLowerCase() !== 'não especificado' &&
    resumo.toLowerCase() !== 'serviços e peças'
      ? `a proposta ${resumo.toLowerCase().startsWith('da ') || resumo.toLowerCase().startsWith('do ') || resumo.toLowerCase().startsWith('de ') ? resumo : `do(a) ${resumo}`}`
      : 'a proposta'

  const linkBlock = propostaUrl ? `\n\n👉 ${propostaUrl}` : ''

  return (
    `Oi, ${firstName}! Tudo bem?\n\n` +
    `Estou acompanhando alguns orçamentos e vi que você recebeu ${propostaFrase}.\n\n` +
    `Queria saber: ficou dentro do que você estava procurando ou gostaria que eu verificasse outra opção para você?` +
    linkBlock +
    `\n\nPode me falar com sinceridade, assim consigo te ajudar melhor.`
  )
}

export function buildRentalProposalMessage(params: {
  customerName: string
  titulo?: string
  franquiaPaginas: number
  contratoMeses: number
  machines: Array<{
    machineName: string
    serial?: string
    franquiaSugerida: number
    excedenteSugerido: number
    scanner?: boolean
    scannerDados?: string
  }>
  propostaUrl?: string
}): string {
  const { customerName, titulo, franquiaPaginas, contratoMeses, machines, propostaUrl } = params
  const firstName = customerName.split(' ')[0] || customerName

  // Se houver URL da proposta, preferir a mensagem curta e direta de fechamento solicitada pelo usuário
  if (propostaUrl) {
    const mainMachine = machines[0]
    const equipNome =
      machines.length > 1
        ? `${mainMachine?.machineName || 'Equipamento'} (+1 opção)`
        : mainMachine?.machineName || 'Equipamento'
    const valorMensal = mainMachine?.franquiaSugerida || 0

    return buildRentalProposalClosingMessage({
      customerName,
      propostaUrl,
      equipamento: equipNome,
      franquiaPaginas,
      valorMensal,
    })
  }

  const fmtBRL = (v: number) =>
    (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtCPP = (v: number) =>
    (v || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  const fmtInt = (v: number) => (v || 0).toLocaleString('pt-BR')

  const machinesText =
    machines.length > 0
      ? machines
          .map((m, idx) => {
            const num = machines.length > 1 ? `*Opção ${idx + 1}:* ` : ''
            const serialTxt = m.serial ? ` (Série: ${m.serial})` : ''
            const scannerTxt = m.scanner
              ? `  • Scanner/Digitalização: Incluso (${m.scannerDados || 'Em rede'})\n`
              : ''
            return (
              `🖨️ ${num}*${m.machineName}*${serialTxt}\n` +
              `  • Mensalidade (Franquia): *${fmtBRL(m.franquiaSugerida)}/mês*\n` +
              `  • Franquia de Impressão: *${fmtInt(franquiaPaginas)} páginas/mês*\n` +
              `  • Página Excedente: *${fmtCPP(m.excedenteSugerido)}/página*\n` +
              scannerTxt
            ).trimEnd()
          })
          .join('\n\n')
      : `🖨️ *Plano de Locação Corporativa*\n  • Franquia: *${fmtInt(franquiaPaginas)} páginas/mês*\n`

  return (
    `🖨️ *JUCA INFORMÁTICA - PROPOSTA DE LOCAÇÃO*\n\n` +
    `Olá, *${firstName}*! Tudo bem?\n\n` +
    `Elaboramos a sua *Proposta de Locação de Equipamentos de Impressão* (${titulo || 'Impressoras Corporativas'}).\n\n` +
    `👤 *Cliente / Locatário:* ${customerName}\n` +
    `📅 *Prazo Contratual:* ${contratoMeses || 12} meses\n` +
    `📄 *Franquia Base:* ${fmtInt(franquiaPaginas)} páginas/mês\n\n` +
    `📋 *Equipamento(s) e Valores:*\n${machinesText}\n\n` +
    `✅ *Incluso no Plano JUCA:*\n` +
    `  • Fornecimento completo de toners, cartuchos e cilindros sem custo extra\n` +
    `  • Peças de reposição e manutenção preventiva periódica inclusas\n` +
    `  • Atendimento prioritário e suporte técnico especializado\n` +
    `  • Equipamento reserva em caso de manutenção complexa\n\n` +
    `Ficamos à total disposição para esclarecer qualquer dúvida ou ajustar os termos conforme a necessidade da sua empresa!\n\n` +
    `*JUCA INFORMÁTICA*\n` +
    `Telefone: (67) 3441-4981 | Celular: (67) 99654-4981\n` +
    `Rua Vearni Castro, 1515, Centro - Nova Andradina/MS`
  )
}
