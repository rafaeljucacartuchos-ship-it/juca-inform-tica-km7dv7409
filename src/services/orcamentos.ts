import pb from '@/lib/pocketbase/client'
import {
  Orcamento,
  OrcamentoItem,
  OrcamentoAnexo,
  OrcamentoStatus,
  ServiceOrder,
  OrderStatus,
} from '@/types'
import { offlinePb } from '@/lib/offline-pb'

/**
 * Retorna todos os orçamentos de uma O.S. (mais recente primeiro)
 */
export async function getOrcamentosByOs(osId: string): Promise<Orcamento[]> {
  try {
    return await pb.collection('orcamentos').getFullList<Orcamento>({
      filter: `id_os = "${osId}"`,
      sort: '-created',
      expand: 'id_os,id_usuario_criador',
    })
  } catch {
    return []
  }
}

/**
 * Retorna o orçamento ativo da O.S. (rascunho, enviado, aguardando_aprovacao, aprovado, faturado ou rejeitado)
 * Ignora orçamentos marcados como 'substituido'.
 */
export async function getActiveOrcamento(osId: string): Promise<Orcamento | null> {
  try {
    const list = await pb.collection('orcamentos').getFullList<Orcamento>({
      filter: `id_os = "${osId}" && status != "substituido"`,
      sort: '-created',
      expand: 'id_os,id_usuario_criador',
    })
    return list[0] || null
  } catch {
    return null
  }
}

/**
 * Retorna um orçamento por ID com expansão
 */
export async function generateRandomToken(len = 32): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let res = ''
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(len)
    crypto.getRandomValues(arr)
    for (let i = 0; i < len; i++) {
      res += chars[arr[i] % chars.length]
    }
    return res
  }
  for (let i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return res
}

/**
 * Retorna um orçamento por ID com expansão.
 * Garante que token_acesso exista para registros legados.
 */
/**
 * Retorna todos os orçamentos (com suporte a filtros e ordenação)
 */
export async function getOrcamentos(options?: {
  status?: OrcamentoStatus | 'todos'
  search?: string
}): Promise<Orcamento[]> {
  try {
    const filters: string[] = []
    if (options?.status && options.status !== 'todos') {
      filters.push(`status = "${options.status}"`)
    }
    if (options?.search) {
      const s = options.search.trim().replace(/"/g, '')
      filters.push(`(numero_orcamento ~ "${s}" || observacoes ~ "${s}")`)
    }

    return await pb.collection('orcamentos').getFullList<Orcamento>({
      filter: filters.length > 0 ? filters.join(' && ') : undefined,
      sort: '-created',
      expand:
        'id_os,id_usuario_criador,cliente_id,responsavel_id,id_os.customer,id_os.technician,id_os.equipment_ref',
    })
  } catch {
    return []
  }
}

export async function getOrcamento(id: string): Promise<Orcamento> {
  const record = await pb.collection('orcamentos').getOne<Orcamento>(id, {
    expand:
      'id_os,id_usuario_criador,cliente_id,responsavel_id,id_os.customer,id_os.technician,id_os.equipment_ref',
  })
  if (!record.token_acesso) {
    try {
      const token = await generateRandomToken(32)
      const updated = await pb.collection('orcamentos').update<Orcamento>(id, {
        token_acesso: token,
      })
      record.token_acesso = updated.token_acesso || token
    } catch {
      /* ignore */
    }
  }
  return record
}

/**
 * Utilitário para formatar a exibição unificada O.S. + Orçamento
 * Ex: "OS-0037 · ORC-0037"
 */
export function formatOsOrcamentoLabel(
  osNumber?: string | null,
  orcamentoNumber?: string | null,
): string {
  const cleanOs = (osNumber || '').trim()
  const cleanOrc = (orcamentoNumber || '').trim()

  if (cleanOs && cleanOrc) {
    // Se o orçamento já tem exatamente o número espelhado (ex: ORC-0037 e OS-0037)
    return `${cleanOs} · ${cleanOrc}`
  }
  if (cleanOrc) return cleanOrc
  if (cleanOs) return cleanOs
  return 'S/N'
}

/**
 * Converte um número de OS (ex: "OS-0037") para o número de orçamento correspondente (ex: "ORC-0037").
 * Se já estiver no formato ORC-, retorna como está.
 */
export function deriveOrcamentoNumberFromOs(osNumber?: string | null): string | null {
  if (!osNumber) return null
  const trimmed = osNumber.trim()
  if (trimmed.startsWith('OS-')) {
    return trimmed.replace(/^OS-/, 'ORC-')
  }
  const digitsMatch = trimmed.match(/\d+/)
  if (digitsMatch) {
    return `ORC-${digitsMatch[0].padStart(4, '0')}`
  }
  return `ORC-${trimmed}`
}

/**
 * Gera o próximo número de orçamento:
 * Se id_os for fornecido ou houver número de OS vinculado, deriva diretamente da OS (ex: OS-0037 -> ORC-0037).
 * Caso contrário, mantém numeração sequencial fallback para compatibilidade.
 */
export async function generateNextOrcamentoNumber(osIdOrNumber?: string): Promise<string> {
  if (osIdOrNumber) {
    // Se veio no formato "OS-XXXX", deriva diretamente
    if (osIdOrNumber.startsWith('OS-')) {
      const derived = deriveOrcamentoNumberFromOs(osIdOrNumber)
      if (derived) return derived
    }
    // Caso contrário, pode ser o ID do registro de service_orders
    try {
      const osRecord = await pb
        .collection('service_orders')
        .getOne<{ number: string }>(osIdOrNumber, {
          fields: 'id,number',
        })
      if (osRecord?.number) {
        const derived = deriveOrcamentoNumberFromOs(osRecord.number)
        if (derived) return derived
      }
    } catch {
      // continua para fallback sequencial
    }
  }

  // Sem vínculo com OS: gera numeração própria ORC-0001, ORC-0002...
  try {
    const records = await pb.collection('orcamentos').getFullList<Orcamento>({
      sort: '-created',
    })

    let maxNum = 0
    // Considera apenas números no formato ORC-XXXX
    const regex = /ORC-(\d+)/
    for (const r of records) {
      const match = r.numero_orcamento?.match(regex)
      if (match && match[1]) {
        const val = parseInt(match[1], 10)
        if (val > maxNum) maxNum = val
      }
    }
    const nextSeq = String(maxNum + 1).padStart(4, '0')
    return `ORC-${nextSeq}`
  } catch {
    return `ORC-0001`
  }
}

/**
 * Cria um novo orçamento:
 * 1) Se houver id_os:
 *    - Herda exatamente o número da O.S. (OS-0041 -> ORC-0041). NUNCA sequencial próprio.
 *    - Apenas 1 orçamento ATIVO por O.S.; anteriores marcados como "substituido".
 *    - Atualiza status da O.S. para "aguardando_orcamento".
 * 2) Se não houver id_os (orçamento independente):
 *    - Gera numeração própria ORC-XXXX.
 */
export async function createOrcamento(params: {
  id_os?: string | null
  id_usuario_criador?: string
  validade?: number
  observacoes?: string
  cliente_id?: string | null
  nome_cliente_livre?: string
  telefone_cliente_livre?: string
  responsavel_id?: string | null
  equipamento_independente?: string
  defeito_independente?: string
}): Promise<Orcamento> {
  const {
    id_os,
    id_usuario_criador,
    validade = 15,
    observacoes = '',
    cliente_id,
    nome_cliente_livre,
    telefone_cliente_livre,
    responsavel_id,
    equipamento_independente,
    defeito_independente,
  } = params

  let numero_orcamento: string = ''

  if (id_os) {
    // 1. Busca orçamentos existentes desta O.S.
    const existingActive = await pb.collection('orcamentos').getFullList<Orcamento>({
      filter: `id_os = "${id_os}"`,
      sort: '-created',
    })

    // Se já existe um orçamento rascunho para esta O.S., reaproveita em vez de criar duplicado
    const existingDraft = existingActive.find((o) => o.status === 'rascunho')
    if (existingDraft) {
      return existingDraft
    }

    // Determina o número base que será usado (espelhado da O.S., ex: ORC-0056)
    let osNumber: string | undefined
    try {
      const osRec = await pb.collection('service_orders').getOne<{ number: string }>(id_os, {
        fields: 'id,number',
      })
      osNumber = osRec?.number
    } catch {
      /* ignore */
    }

    if (osNumber) {
      const derived = deriveOrcamentoNumberFromOs(osNumber)
      if (derived) numero_orcamento = derived
    }

    if (!numero_orcamento) {
      numero_orcamento = await generateNextOrcamentoNumber(id_os)
    }

    // Se houver orçamentos anteriores (ativos ou anteriores) ocupando o mesmo numero_orcamento
    // ou se qualquer registro na coleção já possuir esse numero_orcamento, renomeia com sufixo
    // de revisão (ex: ORC-0056-REV1, ORC-0056-REV2) para liberar o número principal e satisfazer
    // o índice único CREATE UNIQUE INDEX idx_orcamentos_numero.
    try {
      const conflicting = await pb.collection('orcamentos').getFullList<Orcamento>({
        filter: `numero_orcamento = "${numero_orcamento}"`,
      })

      let revIndex = 1
      for (const prev of conflicting) {
        // Encontra o próximo sufixo livre
        let revNumber = `${numero_orcamento}-REV${revIndex}`
        while (
          (
            await pb.collection('orcamentos').getFullList<Orcamento>({
              filter: `numero_orcamento = "${revNumber}"`,
            })
          ).length > 0
        ) {
          revIndex++
          revNumber = `${numero_orcamento}-REV${revIndex}`
        }

        try {
          await pb.collection('orcamentos').update(prev.id, {
            status: 'substituido',
            numero_orcamento: revNumber,
          })
          revIndex++
        } catch (e) {
          console.warn('Erro ao atualizar numero_orcamento do orçamento substituído:', e)
        }
      }
    } catch (e) {
      console.warn('Erro ao verificar conflito de numero_orcamento:', e)
    }

    // Garante que todos os outros orçamentos ativos desta O.S. sejam marcados como 'substituido'
    for (const prev of existingActive) {
      if (prev.status !== 'substituido') {
        try {
          await pb.collection('orcamentos').update(prev.id, {
            status: 'substituido',
          })
        } catch (e) {
          console.warn('Erro ao substituir orçamento anterior:', e)
        }
      }
    }
  } else {
    // Orçamento independente sem OS vinculada
    numero_orcamento = await generateNextOrcamentoNumber()
  }

  // 3. Cria o novo orçamento como rascunho com token de acesso
  const token_acesso = await generateRandomToken(32)
  const createPayload: Record<string, any> = {
    numero_orcamento,
    status: 'rascunho',
    validade: Number(validade) || 15,
    observacoes: observacoes || '',
    id_usuario_criador: id_usuario_criador || undefined,
    desconto_total_valor: 0,
    desconto_total_tipo: 'valor',
    desconto_total_percentual: 0,
    forma_pagamento: 'pix',
    parcelas: 1,
    entrada: 0,
    restante: 0,
    status_pagamento: 'pendente',
    subtotal: 0,
    total_geral: 0,
    token_acesso,
  }

  if (id_os) {
    createPayload.id_os = id_os
  } else {
    // Orçamento independente: preenche campos específicos
    if (cliente_id) createPayload.cliente_id = cliente_id
    if (nome_cliente_livre) createPayload.nome_cliente_livre = nome_cliente_livre
    if (telefone_cliente_livre) createPayload.telefone_cliente_livre = telefone_cliente_livre
    if (responsavel_id) createPayload.responsavel_id = responsavel_id
    if (equipamento_independente) createPayload.equipamento_independente = equipamento_independente
    if (defeito_independente) createPayload.defeito_independente = defeito_independente
  }

  const novo = await pb.collection('orcamentos').create<Orcamento>(createPayload)

  // 4. Se vinculado a OS, atualiza o status da OS para "aguardando_orcamento"
  if (id_os) {
    try {
      await updateOsStatus(
        id_os,
        'aguardando_orcamento',
        `Orçamento ${numero_orcamento} gerado`,
        id_usuario_criador,
      )
    } catch (e) {
      console.warn('Erro ao atualizar status da OS para aguardando_orcamento:', e)
    }
  }

  return novo
}

/**
 * Atualiza campos de um orçamento
 */
export async function updateOrcamento(id: string, data: Partial<Orcamento>): Promise<Orcamento> {
  return await pb.collection('orcamentos').update<Orcamento>(id, data)
}

/**
 * Exclui um orçamento e seus itens/anexos
 */
export async function deleteOrcamento(id: string): Promise<boolean> {
  // Itens e anexos possuem cascadeDelete: true, mas removemos por garantia
  return await pb.collection('orcamentos').delete(id)
}

/**
 * Itens do orçamento
 */
export async function getOrcamentoItens(orcamentoId: string): Promise<OrcamentoItem[]> {
  try {
    return await pb.collection('orcamento_itens').getFullList<OrcamentoItem>({
      filter: `id_orcamento = "${orcamentoId}"`,
      sort: 'created',
      expand: 'id_produto',
    })
  } catch {
    return []
  }
}

function sanitizeNumericValue(val: unknown, fallback: number = 0): number {
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val
  }
  if (typeof val === 'string') {
    let clean = val.trim()
    if (!clean) return fallback
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.')
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.')
    }
    const num = parseFloat(clean)
    return isNaN(num) ? fallback : num
  }
  return fallback
}

function sanitizeOrcamentoItemPayload(data: Partial<OrcamentoItem>): Record<string, any> {
  const payload: Record<string, any> = { ...data }

  // id_produto: relation com products. PocketBase recusa "" (string vazia).
  // Deve ser enviado com ID válido ou omitido/null se vazio.
  if ('id_produto' in payload) {
    if (
      !payload.id_produto ||
      (typeof payload.id_produto === 'string' && !payload.id_produto.trim())
    ) {
      payload.id_produto = null
    }
  }

  // Sanitiza campos numéricos
  if ('quantidade' in payload) {
    payload.quantidade = Math.max(0.01, sanitizeNumericValue(payload.quantidade, 1))
  }
  if ('valor_unitario' in payload) {
    payload.valor_unitario = Math.max(0, sanitizeNumericValue(payload.valor_unitario, 0))
  }
  if ('desconto_item' in payload) {
    payload.desconto_item = Math.max(0, sanitizeNumericValue(payload.desconto_item, 0))
  }
  if ('valor_total_item' in payload) {
    payload.valor_total_item = Math.max(0, sanitizeNumericValue(payload.valor_total_item, 0))
  }

  return payload
}

export async function createOrcamentoItem(data: Partial<OrcamentoItem>): Promise<OrcamentoItem> {
  const sanitized = sanitizeOrcamentoItemPayload(data)
  return await pb.collection('orcamento_itens').create<OrcamentoItem>(sanitized)
}

export async function updateOrcamentoItem(
  id: string,
  data: Partial<OrcamentoItem>,
): Promise<OrcamentoItem> {
  const sanitized = sanitizeOrcamentoItemPayload(data)
  return await pb.collection('orcamento_itens').update<OrcamentoItem>(id, sanitized)
}

export async function deleteOrcamentoItem(id: string): Promise<boolean> {
  return await pb.collection('orcamento_itens').delete(id)
}

/**
 * Anexos do orçamento (fotos / documentos)
 */
export async function getOrcamentoAnexos(orcamentoId: string): Promise<OrcamentoAnexo[]> {
  try {
    return await pb.collection('orcamento_anexos').getFullList<OrcamentoAnexo>({
      filter: `id_orcamento = "${orcamentoId}"`,
      sort: 'created',
    })
  } catch {
    return []
  }
}

export async function createOrcamentoAnexo(
  orcamentoId: string,
  file: File,
  tipo: 'foto_equipamento' | 'foto_defeito' | 'documento',
  legenda?: string,
): Promise<OrcamentoAnexo> {
  const formData = new FormData()
  formData.append('id_orcamento', orcamentoId)
  formData.append('tipo', tipo)
  formData.append('caminho_arquivo', file)
  if (legenda) formData.append('legenda', legenda)

  return await pb.collection('orcamento_anexos').create<OrcamentoAnexo>(formData)
}

export async function deleteOrcamentoAnexo(id: string): Promise<boolean> {
  return await pb.collection('orcamento_anexos').delete(id)
}

/**
 * Salvar assinatura no orçamento (cliente ou técnico)
 */
export async function uploadOrcamentoSignature(
  orcamentoId: string,
  field: 'assinatura_cliente' | 'assinatura_tecnico',
  signatureDataUrl: string,
  ipDispositivo?: string,
): Promise<Orcamento> {
  const res = await fetch(signatureDataUrl)
  const blob = await res.blob()
  const file = new File([blob], `${field}.png`, { type: 'image/png' })
  const formData = new FormData()
  formData.append(field, file, `${field}.png`)
  const now = new Date().toISOString()
  if (field === 'assinatura_cliente') {
    formData.append('data_assinatura_cliente', now)
    formData.append('status', 'aprovado')
  } else {
    formData.append('data_assinatura_tecnico', now)
  }
  if (ipDispositivo) {
    formData.append('ip_dispositivo', ipDispositivo)
  }
  const updatedOrc = await pb.collection('orcamentos').update<Orcamento>(orcamentoId, formData)

  // Mudança 2: na assinatura de cliente ou técnico -> status da O.S. = 'orcamento_aprovado' com registro no histórico
  try {
    if (updatedOrc.id_os) {
      const signerLabel = field === 'assinatura_cliente' ? 'cliente' : 'técnico'
      await updateOsStatus(
        updatedOrc.id_os,
        'orcamento_aprovado',
        `Orçamento ${updatedOrc.numero_orcamento} com assinatura do ${signerLabel} registrada.`,
      )
    }
  } catch (err) {
    console.warn('Erro ao atualizar status da O.S. para orcamento_aprovado após assinatura:', err)
  }

  return updatedOrc
}

/**
 * Recalcula totais do orçamento e persiste no banco
 * subtotal = Σ(valor_unitario × quantidade)
 * total_itens_com_desconto = subtotal - Σ(descontos por item)
 * total_geral = total_itens_com_desconto - desconto_total
 */
export async function recalculateOrcamentoTotals(orcamentoId: string): Promise<{
  subtotal: number
  total_geral: number
  subtotalProdutos: number
  subtotalServicos: number
  somaDescontosItens: number
}> {
  const [orc, itens] = await Promise.all([
    pb.collection('orcamentos').getOne<Orcamento>(orcamentoId),
    getOrcamentoItens(orcamentoId),
  ])

  let subtotalProdutos = 0
  let subtotalServicos = 0
  let somaDescontosItens = 0

  for (const item of itens) {
    const rawTotal = (Number(item.valor_unitario) || 0) * (Number(item.quantidade) || 0)
    if (item.tipo === 'servico') {
      subtotalServicos += rawTotal
    } else {
      subtotalProdutos += rawTotal
    }

    let itemDesc = 0
    if (item.desconto_item && item.desconto_item > 0) {
      if (item.desconto_item_tipo === 'percentual') {
        itemDesc = (rawTotal * item.desconto_item) / 100
      } else {
        itemDesc = item.desconto_item
      }
    }
    somaDescontosItens += itemDesc
  }

  const subtotal = subtotalProdutos + subtotalServicos
  const totalComDescontoItens = Math.max(0, subtotal - somaDescontosItens)

  let descontoTotalValor = Number(orc.desconto_total_valor) || 0
  if (orc.desconto_total_tipo === 'percentual') {
    const pct = Number(orc.desconto_total_percentual) || 0
    descontoTotalValor = (totalComDescontoItens * pct) / 100
  }

  const totalGeral = Math.max(0, totalComDescontoItens - descontoTotalValor)

  await pb.collection('orcamentos').update(orcamentoId, {
    subtotal,
    total_geral: totalGeral,
    desconto_total_valor: descontoTotalValor,
  })

  return {
    subtotal,
    total_geral: totalGeral,
    subtotalProdutos,
    subtotalServicos,
    somaDescontosItens,
  }
}

/**
 * Atualiza status da OS com histórico
 */
export async function updateOsStatus(
  osId: string,
  newStatus: OrderStatus,
  note: string,
  userId?: string,
) {
  await pb.collection('service_orders').update(osId, { status: newStatus })
  await pb.collection('status_history').create({
    service_order: osId,
    status: newStatus,
    note,
    changed_by: userId,
  })
}

/**
 * Envia orçamento para Faturamento:
 * Requisito: Só habilitado quando status === 'aprovado'
 * 1. Muda status do orçamento para "faturado"
 * 2. Cria o lançamento de pagamento na O.S. (pagamentos existentes) com itens/valores/forma de pagamento
 * 3. Baixa de estoque dos produtos do orçamento (se ainda não baixado)
 */
export async function sendOrcamentoToFaturamento(
  orcamentoId: string,
  userId?: string,
): Promise<{ success: boolean; paymentId?: string; isReenviado?: boolean }> {
  const orc = await getOrcamento(orcamentoId)
  if (orc.status !== 'aprovado' && orc.status !== 'faturado') {
    throw new Error('O orçamento só pode ser enviado para faturamento após aprovação do cliente.')
  }

  const isReenvio = orc.status === 'faturado'
  const totalAmount = Number(orc.total_geral) || 0

  // Se for reenvio (já estava faturado):
  // Mantém idempotência: NÃO duplica pagamento, NÃO baixa estoque novamente.
  // Garante que a O.S. vinculada esteja com status 'closed' (se ainda não estiver, fecha via updateOsStatus).
  if (isReenvio) {
    if (orc.id_os) {
      try {
        const currentOs = await pb
          .collection('service_orders')
          .getOne<{ status: string }>(orc.id_os, {
            fields: 'id,status',
          })
        if (currentOs.status !== 'closed') {
          // Atualiza o status real da OS para 'closed' e registra no status_history
          await updateOsStatus(
            orc.id_os,
            'closed',
            `Reenvio de faturamento do Orçamento ${orc.numero_orcamento} realizado. O.S. finalizada com sucesso.`,
            userId,
          )
        } else {
          // Já estava fechada: registra apenas o log do reenvio sem alterar o status da OS
          await pb.collection('status_history').create({
            service_order: orc.id_os,
            status: 'closed',
            note: `Reenvio de faturamento do Orçamento ${orc.numero_orcamento} realizado. Mensagem reenviada ao grupo de faturamento.`,
            changed_by: userId,
          })
        }
      } catch {
        /* ignore */
      }
    }

    // Registra no pós-venda / histórico
    const customerId = orc.cliente_id || orc.expand?.id_os?.customer
    if (customerId) {
      try {
        await pb.collection('pos_venda_messages').create({
          customer: customerId,
          service_order: orc.id_os || null,
          tipo: 'resumo_finalizacao',
          status: 'sent',
          scheduled_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          texto_gerado: `Reenvio de faturamento do Orçamento ${orc.numero_orcamento}.`,
          channel: 'sistema',
        })
      } catch {
        /* ignore */
      }
    }

    return { success: true, isReenviado: true }
  }

  const itens = await getOrcamentoItens(orcamentoId)

  // 1. Mapeia forma de pagamento para pagamentos da OS
  const methodMap: Record<string, string> = {
    dinheiro: 'cash',
    pix: 'pix',
    cartao_credito: 'credit_card',
    cartao_debito: 'debit_card',
    boleto: 'transfer',
    crediario: 'transfer',
    outros: 'transfer',
  }
  const paymentMethod = methodMap[orc.forma_pagamento || 'pix'] || 'pix'

  // 2. Cria registro de pagamento apenas se vinculado à OS (coleção payments exige service_order)
  let paymentId: string | undefined
  if (orc.id_os) {
    try {
      const payment = await pb.collection('payments').create({
        service_order: orc.id_os,
        amount: totalAmount,
        method: paymentMethod,
        status: orc.status_pagamento === 'pago' ? 'paid' : 'pending',
        paid_at: orc.status_pagamento === 'pago' ? new Date().toISOString() : null,
        notes: `Faturamento referente ao Orçamento ${orc.numero_orcamento} (${orc.parcelas || 1}x ${orc.forma_pagamento})`,
      })
      paymentId = payment.id
    } catch (err) {
      console.warn('Erro ao criar pagamento na O.S.:', err)
    }
  }

  // 3. Baixa de estoque nos produtos aprovados e faturados (regra de estoque)
  for (const item of itens) {
    if (item.tipo === 'produto' && item.id_produto) {
      try {
        const prod = await pb.collection('products').getOne(item.id_produto)
        const currentStock = Number(prod.stock_quantity) || 0
        const qtyToDeduct = Number(item.quantidade) || 0
        const newStock = Math.max(0, currentStock - qtyToDeduct)
        await pb.collection('products').update(item.id_produto, {
          stock_quantity: newStock,
        })
      } catch (err) {
        console.warn(`Erro ao baixar estoque do produto ${item.id_produto}:`, err)
      }
    }
  }

  // 4. Marca orçamento como faturado
  await pb.collection('orcamentos').update(orcamentoId, {
    status: 'faturado',
  })

  // 5. Se vinculado a OS, registra no histórico da OS (status da O.S. = 'closed' com histórico)
  if (orc.id_os) {
    try {
      await updateOsStatus(
        orc.id_os,
        'closed',
        `Orçamento ${orc.numero_orcamento} faturado e O.S. finalizada com sucesso. Lançamento financeiro de R$ ${totalAmount.toFixed(2)} gerado.`,
        userId,
      )
    } catch {
      /* intentionally ignored */
    }
  }

  // 6. Registra no pós-venda/histórico do cliente
  const customerId = orc.cliente_id || orc.expand?.id_os?.customer
  if (customerId) {
    try {
      await pb.collection('pos_venda_messages').create({
        customer: customerId,
        service_order: orc.id_os || null,
        tipo: 'resumo_finalizacao',
        status: 'sent',
        scheduled_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        texto_gerado: `Orçamento ${orc.numero_orcamento} aprovado e enviado para faturamento. Valor: R$ ${totalAmount.toFixed(2)}.`,
        channel: 'sistema',
      })
    } catch {
      /* intentionally ignored */
    }
  }

  return { success: true, paymentId, isReenviado: false }
}
