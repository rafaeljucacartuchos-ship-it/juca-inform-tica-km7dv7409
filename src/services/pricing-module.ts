import pb from '@/lib/pocketbase/client'
import { calculateSupplyCPP } from '@/lib/pricing-engine'

// ============================================================================
// TIPAGENS DO MÓDULO DE PRECIFICAÇÃO
// ============================================================================

export interface ParametrosGlobais {
  id: string
  mark_up_revenda: number // ex: 1.4500
  vida_util_padrao_meses: number // ex: 48
  producao_mensal_referencia: number // ex: 1000
  created?: string
  updated?: string
}

export type TipoSuprimento =
  | 'toner'
  | 'tinta'
  | 'cartucho'
  | 'fotocondutor'
  | 'unidade_fusora'
  | 'pelicula'
  | 'cabecote'
  | 'bobina'
  | 'fita'
  | 'ribbon'

export interface SuprimentoRecord {
  id: string
  modelo_suprimento: string
  tipo: TipoSuprimento
  fabricante: string
  impressoras_compativeis?: string
  valor_compra?: number | null
  rendimento_paginas?: number | null
  cpp_calculado?: number
  fonte_preco?: string
  ativo: boolean
  created?: string
  updated?: string
}

export type TecnologiaImpressora =
  | 'laser_mono'
  | 'laser_colorido'
  | 'tinta'
  | 'termica'
  | 'matricial'

export interface ImpressoraRecord {
  id: string
  modelo: string
  fabricante: string
  tecnologia: TecnologiaImpressora
  valor_compra?: number | null
  vida_util_meses?: number
  suprimento_1?: string | null
  suprimento_2?: string | null
  suprimento_3?: string | null
  suprimento_4?: string | null
  suprimento_5?: string | null
  cpp_suprimentos?: number
  cpp_equipamento?: number
  cpp_fornecedor_total?: number
  fonte_preco_equipamento?: string
  bloqueada?: boolean
  motivo_bloqueio?: string
  ativo: boolean
  created?: string
  updated?: string
  expand?: {
    suprimento_1?: SuprimentoRecord
    suprimento_2?: SuprimentoRecord
    suprimento_3?: SuprimentoRecord
    suprimento_4?: SuprimentoRecord
    suprimento_5?: SuprimentoRecord
  }
}

export interface AuditoriaPrecoRecord {
  id: string
  tabela_afetada: 'suprimentos' | 'impressoras' | 'parametros' | string
  id_registro: string
  campo_alterado: string
  valor_antigo?: string | null
  valor_novo: string
  usuario_responsavel: string
  data_modificacao?: string
  created?: string
  updated?: string
}

export interface ContratoPrecificacaoRecord {
  id: string
  cliente: string
  id_impressora: string
  producao_mensal_estimada: number
  locacao_mensal: number
  mark_up_aplicado: number
  cpp_venda_fechado: number
  data_inicio: string
  duracao_meses: number
  status: 'ativo' | 'encerrado' | 'cancelado'
  dados_congelados?: any
  created?: string
  updated?: string
  expand?: {
    id_impressora?: ImpressoraRecord
  }
}

// ============================================================================
// AUDITORIA (Seções 10.2 e 20.4)
// ============================================================================

export async function logPriceAudit(params: {
  tabela: 'suprimentos' | 'impressoras' | 'parametros' | string
  idRegistro: string
  campo: string
  valorAntigo?: any
  valorNovo: any
  usuario?: string
}): Promise<void> {
  try {
    const usuarioNome =
      params.usuario ||
      (pb.authStore.model as any)?.name ||
      (pb.authStore.model as any)?.username ||
      'Administrador'

    await pb.collection('auditoria_precos').create({
      tabela_afetada: params.tabela,
      id_registro: params.idRegistro,
      campo_alterado: params.campo,
      valor_antigo:
        params.valorAntigo !== undefined && params.valorAntigo !== null
          ? String(params.valorAntigo)
          : null,
      valor_novo: String(params.valorNovo),
      usuario_responsavel: usuarioNome,
      data_modificacao: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('Falha ao registrar auditoria de preços:', err)
  }
}

export async function getPriceAuditHistory(limit = 100): Promise<AuditoriaPrecoRecord[]> {
  try {
    return await pb.collection('auditoria_precos').getFullList<AuditoriaPrecoRecord>({
      sort: '-created',
      batch: limit,
    })
  } catch (err) {
    console.error('Erro ao buscar auditoria de preços:', err)
    return []
  }
}

// ============================================================================
// PARÂMETROS GLOBAIS
// ============================================================================

export async function getParametrosGlobais(): Promise<ParametrosGlobais> {
  const fallback: ParametrosGlobais = {
    id: 'default',
    mark_up_revenda: 1.45,
    vida_util_padrao_meses: 48,
    producao_mensal_referencia: 1000,
  }

  try {
    const list = await pb.collection('parametros').getFullList<ParametrosGlobais>({
      sort: '-created',
      batch: 1,
    })
    if (list.length > 0) return list[0]
  } catch (err) {
    console.warn('Erro ao carregar parametros globais, usando fallback:', err)
  }
  return fallback
}

export async function updateParametrosGlobais(
  id: string,
  data: Partial<ParametrosGlobais>,
  usuarioNome?: string,
): Promise<ParametrosGlobais> {
  const old = await getParametrosGlobais()

  // Auditoria para campos alterados
  if (data.mark_up_revenda !== undefined && data.mark_up_revenda !== old.mark_up_revenda) {
    await logPriceAudit({
      tabela: 'parametros',
      idRegistro: id,
      campo: 'mark_up_revenda',
      valorAntigo: old.mark_up_revenda,
      valorNovo: data.mark_up_revenda,
      usuario: usuarioNome,
    })
  }

  if (
    data.vida_util_padrao_meses !== undefined &&
    data.vida_util_padrao_meses !== old.vida_util_padrao_meses
  ) {
    await logPriceAudit({
      tabela: 'parametros',
      idRegistro: id,
      campo: 'vida_util_padrao_meses',
      valorAntigo: old.vida_util_padrao_meses,
      valorNovo: data.vida_util_padrao_meses,
      usuario: usuarioNome,
    })
  }

  if (
    data.producao_mensal_referencia !== undefined &&
    data.producao_mensal_referencia !== old.producao_mensal_referencia
  ) {
    await logPriceAudit({
      tabela: 'parametros',
      idRegistro: id,
      campo: 'producao_mensal_referencia',
      valorAntigo: old.producao_mensal_referencia,
      valorNovo: data.producao_mensal_referencia,
      usuario: usuarioNome,
    })
  }

  return await pb.collection('parametros').update<ParametrosGlobais>(id, data)
}

// ============================================================================
// SUPRIMENTOS
// ============================================================================

export async function getSuprimentos(incluirInativos = false): Promise<SuprimentoRecord[]> {
  try {
    const filter = incluirInativos ? '' : 'ativo = true'
    return await pb.collection('suprimentos').getFullList<SuprimentoRecord>({
      sort: 'fabricante,modelo_suprimento',
      filter,
    })
  } catch (err) {
    console.error('Erro ao buscar suprimentos:', err)
    return []
  }
}

export async function getSuprimentoById(id: string): Promise<SuprimentoRecord | null> {
  try {
    return await pb.collection('suprimentos').getOne<SuprimentoRecord>(id)
  } catch {
    return null
  }
}

export async function createSuprimento(
  data: Partial<SuprimentoRecord>,
  usuarioNome?: string,
): Promise<SuprimentoRecord> {
  const cpp = calculateSupplyCPP(data.valor_compra, data.rendimento_paginas)
  const created = await pb.collection('suprimentos').create<SuprimentoRecord>({
    ...data,
    cpp_calculado: cpp,
    ativo: data.ativo !== false,
  })

  await logPriceAudit({
    tabela: 'suprimentos',
    idRegistro: created.id,
    campo: 'criacao',
    valorAntigo: null,
    valorNovo: `Modelo: ${created.modelo_suprimento}, Compra: ${created.valor_compra || 0}, Rend: ${created.rendimento_paginas || 0}`,
    usuario: usuarioNome,
  })

  return created
}

export async function updateSuprimento(
  id: string,
  data: Partial<SuprimentoRecord>,
  oldRecord?: SuprimentoRecord | null,
  usuarioNome?: string,
): Promise<SuprimentoRecord> {
  const current = oldRecord || (await getSuprimentoById(id))

  // Se preço ou rendimento mudaram, recalcula cpp_calculado
  const valorCompra = data.valor_compra !== undefined ? data.valor_compra : current?.valor_compra
  const rendimento =
    data.rendimento_paginas !== undefined ? data.rendimento_paginas : current?.rendimento_paginas
  const cpp = calculateSupplyCPP(valorCompra, rendimento)

  // Auditoria completa: cobre valor_compra, modelo_suprimento (descrição) e rendimento_paginas
  if (current) {
    if (
      data.modelo_suprimento !== undefined &&
      data.modelo_suprimento !== current.modelo_suprimento
    ) {
      await logPriceAudit({
        tabela: 'suprimentos',
        idRegistro: id,
        campo: 'modelo_suprimento',
        valorAntigo: current.modelo_suprimento,
        valorNovo: data.modelo_suprimento,
        usuario: usuarioNome,
      })
    }
    if (data.valor_compra !== undefined && data.valor_compra !== current.valor_compra) {
      await logPriceAudit({
        tabela: 'suprimentos',
        idRegistro: id,
        campo: 'valor_compra',
        valorAntigo: current.valor_compra,
        valorNovo: data.valor_compra,
        usuario: usuarioNome,
      })
    }
    if (
      data.rendimento_paginas !== undefined &&
      data.rendimento_paginas !== current.rendimento_paginas
    ) {
      await logPriceAudit({
        tabela: 'suprimentos',
        idRegistro: id,
        campo: 'rendimento_paginas',
        valorAntigo: current.rendimento_paginas,
        valorNovo: data.rendimento_paginas,
        usuario: usuarioNome,
      })
    }
  }

  const updatedSuprimento = await pb.collection('suprimentos').update<SuprimentoRecord>(id, {
    ...data,
    cpp_calculado: cpp,
  })

  // Recalculo automático em cascata nas impressoras vinculadas
  try {
    await recalculateLinkedPrintersForSupply(id, updatedSuprimento)
  } catch (cascadeErr) {
    console.warn('Erro ao propagar recálculo em cascata para impressoras:', cascadeErr)
  }

  return updatedSuprimento
}

/**
 * Recalcula em cascata o CPP de suprimentos e CPP fornecedor de todas as impressoras
 * vinculadas que utilizam o suprimento especificado em qualquer um dos 5 slots.
 */
export async function recalculateLinkedPrintersForSupply(
  supplyId: string,
  updatedSupply?: SuprimentoRecord,
): Promise<{ updatedCount: number; printers: string[] }> {
  try {
    // Busca todas as impressoras que têm esse suprimento em suprimento_1 .. suprimento_5
    const filter = `suprimento_1 = '${supplyId}' || suprimento_2 = '${supplyId}' || suprimento_3 = '${supplyId}' || suprimento_4 = '${supplyId}' || suprimento_5 = '${supplyId}'`
    const linkedPrinters = await pb.collection('impressoras').getFullList<ImpressoraRecord>({
      filter,
      expand: 'suprimento_1,suprimento_2,suprimento_3,suprimento_4,suprimento_5',
    })

    if (linkedPrinters.length === 0) {
      return { updatedCount: 0, printers: [] }
    }

    // Carrega suprimentos necessários para calcular caso o expand não traga algum
    const allSupplies = await getSuprimentos(true)
    const suppliesMap = new Map<string, SuprimentoRecord>()
    allSupplies.forEach((s) => suppliesMap.set(s.id, s))
    if (updatedSupply) {
      suppliesMap.set(updatedSupply.id, updatedSupply)
    }

    const updatedPrinterModels: string[] = []

    for (const printer of linkedPrinters) {
      const slotIds = [
        printer.suprimento_1,
        printer.suprimento_2,
        printer.suprimento_3,
        printer.suprimento_4,
        printer.suprimento_5,
      ]

      let totalCppSuprimentos = 0.0

      for (let i = 0; i < 5; i++) {
        const sId = slotIds[i]
        if (!sId) continue

        const sup = suppliesMap.get(sId)
        if (sup) {
          const slotCpp = calculateSupplyCPP(sup.valor_compra, sup.rendimento_paginas)
          totalCppSuprimentos += slotCpp
        }
      }

      // CPP do equipamento (depreciação diluída caso tenha valor e vida útil)
      const producaoRef = 1000 // volume de referência padrão
      const vidaUtil =
        printer.vida_util_meses && printer.vida_util_meses > 0 ? printer.vida_util_meses : 48
      const valorCompraPrinter =
        printer.valor_compra && printer.valor_compra > 0 ? printer.valor_compra : 0
      const totalPaginas = vidaUtil * producaoRef
      const cppEquipamento =
        totalPaginas > 0 && valorCompraPrinter > 0 ? valorCompraPrinter / totalPaginas : 0
      const cppFornecedorTotal = totalCppSuprimentos + cppEquipamento

      await pb.collection('impressoras').update(printer.id, {
        cpp_suprimentos: totalCppSuprimentos,
        cpp_equipamento: cppEquipamento,
        cpp_fornecedor_total: cppFornecedorTotal,
      })

      updatedPrinterModels.push(printer.modelo)
    }

    return { updatedCount: linkedPrinters.length, printers: updatedPrinterModels }
  } catch (err) {
    console.error('Falha ao recalcular impressoras vinculadas ao suprimento:', err)
    return { updatedCount: 0, printers: [] }
  }
}

/**
 * Exclusão SEMPRE lógica (ativo = false) — Regra 20.5
 */
export async function softDeleteSuprimento(id: string, usuarioNome?: string): Promise<boolean> {
  try {
    await pb.collection('suprimentos').update(id, { ativo: false })
    await logPriceAudit({
      tabela: 'suprimentos',
      idRegistro: id,
      campo: 'ativo',
      valorAntigo: 'true',
      valorNovo: 'false (exclusão lógica)',
      usuario: usuarioNome,
    })
    return true
  } catch (err) {
    console.error('Erro ao inativar suprimento:', err)
    return false
  }
}

/**
 * Reajuste em lote (Batch Price Update - Seção 19.1)
 * Aplica percentual de correção sobre suprimentos de fabricante e/ou tipo específicos
 */
export async function batchUpdateSupplyPrices(params: {
  fabricante?: string
  tipo?: TipoSuprimento | ''
  percentualReajuste: number // ex: 8.5 (+8.5%) ou -5 (-5%)
  usuarioNome?: string
}): Promise<{
  totalAfetados: number
  itens: { id: string; modelo: string; valorAntigo: number; valorNovo: number }[]
}> {
  const { fabricante, tipo, percentualReajuste, usuarioNome } = params
  const multiplier = 1 + percentualReajuste / 100

  let filter = 'ativo = true'
  if (fabricante && fabricante !== 'todos') {
    filter += ` && fabricante = '${fabricante}'`
  }
  if (tipo) {
    filter += ` && tipo = '${tipo}'`
  }

  const supplies = await pb.collection('suprimentos').getFullList<SuprimentoRecord>({ filter })
  const updatedItens: { id: string; modelo: string; valorAntigo: number; valorNovo: number }[] = []

  for (const s of supplies) {
    if (s.valor_compra !== null && s.valor_compra !== undefined && s.valor_compra > 0) {
      const valorAntigo = s.valor_compra
      const valorNovo = Math.round(valorAntigo * multiplier * 10000) / 10000
      const cppNovo = calculateSupplyCPP(valorNovo, s.rendimento_paginas)

      await pb.collection('suprimentos').update(s.id, {
        valor_compra: valorNovo,
        cpp_calculado: cppNovo,
      })

      await logPriceAudit({
        tabela: 'suprimentos',
        idRegistro: s.id,
        campo: 'valor_compra (lote)',
        valorAntigo,
        valorNovo: `${valorNovo} (${percentualReajuste >= 0 ? '+' : ''}${percentualReajuste}%)`,
        usuario: usuarioNome,
      })

      updatedItens.push({
        id: s.id,
        modelo: s.modelo_suprimento,
        valorAntigo,
        valorNovo,
      })
    }
  }

  return { totalAfetados: updatedItens.length, itens: updatedItens }
}

// ============================================================================
// IMPRESSORAS
// ============================================================================

export async function getImpressoras(incluirInativas = false): Promise<ImpressoraRecord[]> {
  try {
    const filter = incluirInativas ? '' : 'ativo = true'
    return await pb.collection('impressoras').getFullList<ImpressoraRecord>({
      sort: 'fabricante,modelo',
      filter,
      expand: 'suprimento_1,suprimento_2,suprimento_3,suprimento_4,suprimento_5',
    })
  } catch (err) {
    console.error('Erro ao buscar impressoras:', err)
    return []
  }
}

export async function getImpressoraById(id: string): Promise<ImpressoraRecord | null> {
  try {
    return await pb.collection('impressoras').getOne<ImpressoraRecord>(id, {
      expand: 'suprimento_1,suprimento_2,suprimento_3,suprimento_4,suprimento_5',
    })
  } catch {
    return null
  }
}

export async function createImpressora(
  data: Partial<ImpressoraRecord>,
  usuarioNome?: string,
): Promise<ImpressoraRecord> {
  const created = await pb.collection('impressoras').create<ImpressoraRecord>({
    ...data,
    ativo: data.ativo !== false,
  })

  await logPriceAudit({
    tabela: 'impressoras',
    idRegistro: created.id,
    campo: 'criacao',
    valorAntigo: null,
    valorNovo: `Modelo: ${created.modelo}, Compra: ${created.valor_compra || 0}, Vida: ${created.vida_util_meses || 48}m`,
    usuario: usuarioNome,
  })

  return created
}

export async function updateImpressora(
  id: string,
  data: Partial<ImpressoraRecord>,
  oldRecord?: ImpressoraRecord | null,
  usuarioNome?: string,
): Promise<ImpressoraRecord> {
  const current = oldRecord || (await getImpressoraById(id))

  // Auditoria
  if (current) {
    if (data.valor_compra !== undefined && data.valor_compra !== current.valor_compra) {
      await logPriceAudit({
        tabela: 'impressoras',
        idRegistro: id,
        campo: 'valor_compra',
        valorAntigo: current.valor_compra,
        valorNovo: data.valor_compra,
        usuario: usuarioNome,
      })
    }
    if (data.vida_util_meses !== undefined && data.vida_util_meses !== current.vida_util_meses) {
      await logPriceAudit({
        tabela: 'impressoras',
        idRegistro: id,
        campo: 'vida_util_meses',
        valorAntigo: current.vida_util_meses,
        valorNovo: data.vida_util_meses,
        usuario: usuarioNome,
      })
    }
  }

  return await pb.collection('impressoras').update<ImpressoraRecord>(id, data)
}

/**
 * Exclusão lógica de impressoras (ativo = false) — Regra 20.5
 */
export async function softDeleteImpressora(id: string, usuarioNome?: string): Promise<boolean> {
  try {
    await pb.collection('impressoras').update(id, { ativo: false })
    await logPriceAudit({
      tabela: 'impressoras',
      idRegistro: id,
      campo: 'ativo',
      valorAntigo: 'true',
      valorNovo: 'false (exclusão lógica)',
      usuario: usuarioNome,
    })
    return true
  } catch (err) {
    console.error('Erro ao inativar impressora:', err)
    return false
  }
}

// ============================================================================
// CONTRATOS PRECIFICAÇÃO (CONGELAMENTO DE VALORES — Regra 20.3)
// ============================================================================

export async function getContratosPrecificacao(): Promise<ContratoPrecificacaoRecord[]> {
  try {
    return await pb.collection('contratos').getFullList<ContratoPrecificacaoRecord>({
      sort: '-created',
      expand: 'id_impressora',
    })
  } catch (err) {
    console.error('Erro ao buscar contratos:', err)
    return []
  }
}

export async function createContratoPrecificacao(
  data: Partial<ContratoPrecificacaoRecord>,
): Promise<ContratoPrecificacaoRecord> {
  return await pb.collection('contratos').create<ContratoPrecificacaoRecord>({
    ...data,
    status: data.status || 'ativo',
  })
}
