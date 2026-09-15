import pb from '@/lib/pocketbase/client'
import type {
  RentalMachine,
  RentalQuote,
  RentalContract,
  RentalMachineCalculation,
  RentalSupplyItem,
  RentalQuoteResults,
} from '@/types'

// ============================================================================
// SETTINGS DE LOCAÇÃO
// ============================================================================

export interface RentalSettings {
  defaultPaybackMonths: number
  defaultMarginPct: number
}

export async function getRentalSettings(): Promise<RentalSettings> {
  let defaultPaybackMonths = 18
  let defaultMarginPct = 50

  try {
    const records = await pb.collection('settings').getFullList({
      filter: "key = 'rental_default_payback_months' || key = 'rental_default_margin_pct'",
    })
    for (const r of records) {
      if (r.key === 'rental_default_payback_months') {
        const val = parseFloat(r.value)
        if (!isNaN(val) && val > 0) defaultPaybackMonths = val
      }
      if (r.key === 'rental_default_margin_pct') {
        const val = parseFloat(r.value)
        if (!isNaN(val) && val >= 0) defaultMarginPct = val
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar configurações de locação:', err)
  }

  return { defaultPaybackMonths, defaultMarginPct }
}

export async function updateRentalSettings(settings: Partial<RentalSettings>): Promise<void> {
  if (settings.defaultPaybackMonths !== undefined) {
    try {
      const rec = await pb
        .collection('settings')
        .getFirstListItem("key = 'rental_default_payback_months'")
      await pb.collection('settings').update(rec.id, {
        value: String(settings.defaultPaybackMonths),
      })
    } catch {
      await pb.collection('settings').create({
        key: 'rental_default_payback_months',
        value: String(settings.defaultPaybackMonths),
        description: 'Prazo padrão de payback para máquinas de locação (meses)',
      })
    }
  }

  if (settings.defaultMarginPct !== undefined) {
    try {
      const rec = await pb
        .collection('settings')
        .getFirstListItem("key = 'rental_default_margin_pct'")
      await pb.collection('settings').update(rec.id, {
        value: String(settings.defaultMarginPct),
      })
    } catch {
      await pb.collection('settings').create({
        key: 'rental_default_margin_pct',
        value: String(settings.defaultMarginPct),
        description: 'Margem percentual padrão sobre o CPP e locação de impressoras (%)',
      })
    }
  }
}

// ============================================================================
// RENTAL MACHINES (CADASTRO / GERENCIAMENTO)
// ============================================================================

export async function getRentalMachines(): Promise<RentalMachine[]> {
  try {
    return await pb.collection('rental_machines').getFullList<RentalMachine>({
      sort: '-created',
      expand: 'produto',
    })
  } catch (err) {
    console.error('Erro ao buscar máquinas de locação:', err)
    return []
  }
}

export async function getRentalMachine(id: string): Promise<RentalMachine | null> {
  try {
    return await pb.collection('rental_machines').getOne<RentalMachine>(id, {
      expand: 'produto',
    })
  } catch {
    return null
  }
}

export async function createRentalMachine(data: Partial<RentalMachine>): Promise<RentalMachine> {
  return await pb.collection('rental_machines').create<RentalMachine>(data)
}

export async function updateRentalMachine(
  id: string,
  data: Partial<RentalMachine>,
): Promise<RentalMachine> {
  return await pb.collection('rental_machines').update<RentalMachine>(id, data)
}

export async function deleteRentalMachine(id: string): Promise<boolean> {
  try {
    await pb.collection('rental_machines').delete(id)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// RENTAL QUOTES (PROPOSTAS / SIMULAÇÕES)
// ============================================================================

export async function getRentalQuotes(): Promise<RentalQuote[]> {
  try {
    return await pb.collection('rental_quotes').getFullList<RentalQuote>({
      sort: '-created',
      expand: 'cliente_id,maquinas',
    })
  } catch (err) {
    console.error('Erro ao buscar propostas de locação:', err)
    return []
  }
}

/**
 * Gera token aleatório alfanumérico seguro para compartilhamento de propostas
 */
export async function generateRentalToken(len = 32): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
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

export async function getRentalQuote(id: string): Promise<RentalQuote | null> {
  try {
    const quote = await pb.collection('rental_quotes').getOne<RentalQuote>(id, {
      expand: 'cliente_id,maquinas',
    })
    // Se não tiver token_acesso (registro antigo), gera e salva se autenticado
    if (!quote.token_acesso && pb.authStore.isValid) {
      try {
        const token = await generateRentalToken(32)
        const updated = await pb.collection('rental_quotes').update<RentalQuote>(id, {
          token_acesso: token,
        })
        quote.token_acesso = updated.token_acesso || token
      } catch {
        /* ignore */
      }
    }
    return quote
  } catch {
    return null
  }
}

/**
 * Busca proposta pública por ID e token_acesso (sem exigir login)
 */
export async function getPublicRentalQuote(id: string, token: string): Promise<RentalQuote | null> {
  if (!id || !token) return null
  try {
    // Passa query param ?token=... para satisfazer a API rule de view/list
    return await pb.collection('rental_quotes').getOne<RentalQuote>(id, {
      expand: 'cliente_id,maquinas',
      query: { token },
    })
  } catch (err) {
    console.error('Erro ao buscar proposta de locação pública por token:', err)
    return null
  }
}

/**
 * Garante que uma proposta de locação possua token_acesso persistido.
 * Se já tiver, retorna o existente; se não, gera e salva no PocketBase.
 */
export async function ensureRentalQuoteToken(quote: RentalQuote): Promise<string> {
  if (quote.token_acesso) return quote.token_acesso
  const token = await generateRentalToken(32)
  try {
    await pb.collection('rental_quotes').update(quote.id, { token_acesso: token })
    quote.token_acesso = token
  } catch (err) {
    console.warn('Erro ao persistir token_acesso na proposta:', err)
  }
  return token
}

export async function createRentalQuote(data: Partial<RentalQuote>): Promise<RentalQuote> {
  const token = data.token_acesso || (await generateRentalToken(32))
  return await pb.collection('rental_quotes').create<RentalQuote>({
    ...data,
    token_acesso: token,
  })
}

export async function updateRentalQuote(
  id: string,
  data: Partial<RentalQuote>,
): Promise<RentalQuote> {
  return await pb.collection('rental_quotes').update<RentalQuote>(id, data)
}

export async function deleteRentalQuote(id: string): Promise<boolean> {
  try {
    await pb.collection('rental_quotes').delete(id)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// RENTAL CONTRACTS (CONTRATOS GERADOS)
// ============================================================================

export async function getRentalContracts(): Promise<RentalContract[]> {
  try {
    return await pb.collection('rental_contracts').getFullList<RentalContract>({
      sort: '-created',
      expand: 'proposta',
    })
  } catch (err) {
    console.error('Erro ao buscar contratos de locação:', err)
    return []
  }
}

export async function getRentalContract(id: string): Promise<RentalContract | null> {
  try {
    return await pb.collection('rental_contracts').getOne<RentalContract>(id, {
      expand: 'proposta',
    })
  } catch {
    return null
  }
}

export async function createRentalContract(data: Partial<RentalContract>): Promise<RentalContract> {
  return await pb.collection('rental_contracts').create<RentalContract>(data)
}

export async function updateRentalContract(
  id: string,
  data: Partial<RentalContract>,
): Promise<RentalContract> {
  return await pb.collection('rental_contracts').update<RentalContract>(id, data)
}

export async function deleteRentalContract(id: string): Promise<boolean> {
  try {
    await pb.collection('rental_contracts').delete(id)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// GERAÇÃO SEQUENCIAL DE NÚMERO DE CONTRATO (ex: CT-2025-001)
// ============================================================================

export async function generateNextContractNumber(): Promise<string> {
  const currentYear = new Date().getFullYear()

  try {
    // Busca contratos existentes do ano atual para pegar o maior número
    const existing = await pb.collection('rental_contracts').getList<RentalContract>(1, 1, {
      filter: `numero ~ 'CT-${currentYear}-'`,
      sort: '-numero',
    })

    if (existing.items.length > 0) {
      const lastNum = existing.items[0].numero
      const parts = lastNum.split('-')
      if (parts.length >= 3) {
        const seq = parseInt(parts[2], 10)
        if (!isNaN(seq)) {
          const nextSeq = String(seq + 1).padStart(3, '0')
          return `CT-${currentYear}-${nextSeq}`
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao buscar último contrato por filtro, usando fallback:', err)
  }

  // Fallback seguro: conta total ou começa do 001
  return `CT-${currentYear}-001`
}

// ============================================================================
// FÓRMULAS MATEMÁTICAS DO SIMULADOR (4 CASAS DECIMAIS NO CPP)
// ============================================================================

/**
 * Calcula CPP de um insumo individual (4 casas decimais)
 * CPP = valor ÷ durabilidade_paginas
 */
export function calculateSupplyCpp(valor: number, durabilidadePaginas: number): number {
  if (!durabilidadePaginas || durabilidadePaginas <= 0) return 0
  const cpp = valor / durabilidadePaginas
  return Math.round(cpp * 10000) / 10000
}

/**
 * Calcula todos os parâmetros para uma máquina no simulador
 */
export function calculateMachineRental(params: {
  machineId?: string
  machineName: string
  serial?: string
  contadorInicial?: number
  valorCompra: number
  paybackMeses: number
  supplies: RentalSupplyItem[]
  franquiaPaginas: number
  contratoMeses: number
  margemPct: number
  scanner?: boolean
  scannerDados?: string
  excedenteManual?: number
}): RentalMachineCalculation {
  const {
    machineId,
    machineName,
    serial,
    contadorInicial,
    valorCompra,
    paybackMeses,
    supplies,
    franquiaPaginas,
    contratoMeses,
    margemPct,
    scanner,
    scannerDados,
    excedenteManual,
  } = params

  // 1. CPP Fornecedor = soma do CPP de cada insumo (4 casas decimais)
  const cppFornecedor = supplies.reduce((sum, s) => {
    const itemCpp =
      s.cpp > 0 ? s.cpp : calculateSupplyCpp(s.valor || 0, s.durabilidade_paginas || 0)
    return sum + itemCpp
  }, 0)
  const cppFornecedorRound = Math.round(cppFornecedor * 10000) / 10000

  // 2. CPP Revenda = CPP Fornecedor × (1 + margem_pct / 100) (ou se margem for multiplicador)
  // Regra do prompt: "CPP revenda = CPP × margem;" (onde margem pode ser fator como 1.5 ou margem %)
  // Normalização: se margemPct for 50%, fator = 1.50
  const marginFactor = margemPct > 0 ? 1 + margemPct / 100 : 1
  const cppRevenda = Math.round(cppFornecedorRound * marginFactor * 10000) / 10000

  // 3. Locação mensal = valor de compra ÷ payback
  const paybackSafe = paybackMeses > 0 ? paybackMeses : 18
  const locacaoMensal = valorCompra > 0 ? valorCompra / paybackSafe : 0
  const locacaoMensalRound = Math.round(locacaoMensal * 100) / 100

  // 4. FRANQUIA SUGERIDA = locação + (franquia_páginas × CPP revenda)
  const franquiaSugerida =
    Math.round((locacaoMensalRound + franquiaPaginas * cppRevenda) * 100) / 100

  // 5. Excedente por página acima da franquia (sugerido = CPP revenda × margem, editável)
  const excedenteSugeridoAuto = Math.round(cppRevenda * marginFactor * 10000) / 10000
  const excedenteFinal =
    excedenteManual !== undefined && excedenteManual > 0 ? excedenteManual : excedenteSugeridoAuto

  // 6. TCO do contrato = franquia sugerida (mensal) × contrato_meses
  const tco = Math.round(franquiaSugerida * (contratoMeses || 12) * 100) / 100

  return {
    machineId,
    machineName,
    serial,
    contador_inicial: contadorInicial,
    valorCompra,
    paybackMeses: paybackSafe,
    locacaoMensal: locacaoMensalRound,
    supplies,
    cppFornecedor: cppFornecedorRound,
    cppRevenda,
    franquiaSugerida,
    excedenteSugerido: excedenteFinal,
    tco,
    scanner,
    scannerDados,
  }
}

/**
 * Calcula a comparação entre 2 máquinas (break-even em páginas e card destacando a mais vantajosa)
 * break-even em páginas = diferença das locações ÷ diferença dos CPPs revenda
 */
export function calculateComparison(
  m1: RentalMachineCalculation,
  m2: RentalMachineCalculation,
  volumeMensalDesejado: number,
): {
  breakEvenPaginas: number | null
  vantagemDescricao: string
  melhorOpcaoIndex: number
} {
  const diffLocacao = Math.abs(m1.locacaoMensal - m2.locacaoMensal)
  const diffCpp = Math.abs(m1.cppRevenda - m2.cppRevenda)

  let breakEvenPaginas: number | null = null
  if (diffCpp > 0.0001) {
    breakEvenPaginas = Math.round(diffLocacao / diffCpp)
  }

  // Qual é mais vantajosa no volume mensal especificado?
  // Custo da máquina = locacaoMensal + volumeMensal * cppRevenda
  const custoM1 = m1.locacaoMensal + volumeMensalDesejado * m1.cppRevenda
  const custoM2 = m2.locacaoMensal + volumeMensalDesejado * m2.cppRevenda

  let melhorOpcaoIndex = 0
  let vantagemDescricao = ''

  if (Math.abs(custoM1 - custoM2) < 0.01) {
    vantagemDescricao =
      'Ambas as máquinas possuem custo operacional praticamente equivalente para esta franquia.'
    melhorOpcaoIndex = 0
  } else if (custoM1 < custoM2) {
    const econ = custoM2 - custoM1
    melhorOpcaoIndex = 0
    vantagemDescricao = `${m1.machineName} é mais econômica em R$ ${econ.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês para o volume de ${volumeMensalDesejado.toLocaleString('pt-BR')} páginas.`
  } else {
    const econ = custoM1 - custoM2
    melhorOpcaoIndex = 1
    vantagemDescricao = `${m2.machineName} é mais econômica em R$ ${econ.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês para o volume de ${volumeMensalDesejado.toLocaleString('pt-BR')} páginas.`
  }

  return {
    breakEvenPaginas,
    vantagemDescricao,
    melhorOpcaoIndex,
  }
}
