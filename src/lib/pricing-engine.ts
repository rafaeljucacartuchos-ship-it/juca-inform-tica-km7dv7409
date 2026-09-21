/**
 * MOTOR DE PRECIFICAÇÃO DE LOCAÇÃO DE IMPRESSORAS — JUCA CARTUCHOS
 * Fonte de Verdade: Especificação Técnica (20 de setembro de 2026)
 *
 * FÓRMULAS & DIRETRIZES CANÔNICAS:
 * 1. CPP_suprimento = valor_compra / rendimento_paginas
 * 2. CPP_suprimentos = sum(slot_1 .. slot_5), nulo/vazio = 0.000000
 * 3. CPP_equipamento = valor_impressora / (vida_util_meses * producao_mensal_estimada)
 * 4. CPP_fornecedor_total = CPP_suprimentos + CPP_equipamento
 * 5. CPP_venda = CPP_fornecedor_total * mark_up_revenda (Mark-up SEMPRE aplicado ao final sobre o custo total)
 * 6. custo_mensal = producao_mensal * CPP_venda
 * 7. break_even = (locacao_B - locacao_A) / |CPP_venda_A - CPP_venda_B|
 *
 * PRECISÃO:
 * Persistência e cálculos internos em alta precisão (arredondamento para 6 casas decimais nos valores unitários de CPP).
 * Exibição gráfica e contratos arredondados para 2 casas decimais.
 */

export interface SupplySlotInput {
  slotNumber: 1 | 2 | 3 | 4 | 5
  supplyId?: string | null
  modelo: string
  tipo:
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
    | string
  fabricante?: string
  valorCompra?: number | null
  rendimentoPaginas?: number | null
  cppCalculado?: number
  isProvision?: boolean
  riskWarning?: string
  integratedToChassis?: boolean
  included?: boolean
}

export interface PricingEngineInput {
  printerId?: string
  modelo: string
  fabricante: string
  tecnologia: 'laser_mono' | 'laser_colorido' | 'tinta' | 'termica' | 'matricial'
  valorCompra?: number | null
  vidaUtilMeses?: number
  producaoMensalEstimada: number
  locacaoMensalProposta?: number
  markUpRevenda?: number
  supplies: (SupplySlotInput | null | undefined)[]
  bloqueada?: boolean
  motivoBloqueio?: string
}

export interface PricingEngineResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  isThermalOrMatrix: boolean

  // CPPs com alta precisão
  cppSuprimentos: number
  cppEquipamento: number
  cppFornecedorTotal: number
  markUpAplicado: number
  cppVenda: number

  // Métricas financeiras
  custoMensalProducao: number
  faturamentoTotalMensal: number

  // Slots enriquecidos com status visual
  slotsEnriquecidos: EnrichedSupplySlot[]

  // Resumo formatado
  formatted: {
    cppSuprimentos: string
    cppEquipamento: string
    cppFornecedorTotal: string
    cppVenda: string
    custoMensalProducao: string
    faturamentoTotalMensal: string
  }
}

export type SlotVisualStatus =
  | 'complete' // Verde claro: dados completos
  | 'provision_risk' // Amarelo: provisão de reparo Epson
  | 'integrated' // Cinza: fusor integrado ao chassi
  | 'empty' // Tracejado: vazio / não aplicável
  | 'missing_price' // Vermelho: sem preço homologado

export interface EnrichedSupplySlot {
  slotNumber: 1 | 2 | 3 | 4 | 5
  supplyId?: string | null
  modelo: string
  tipo: string
  fabricante: string
  valorCompra: number | null
  rendimentoPaginas: number | null
  cppCalculado: number
  visualStatus: SlotVisualStatus
  statusMessage?: string
  isProvision: boolean
  riskWarning?: string
  integratedToChassis?: boolean
  included: boolean
  isStructural?: boolean
  structuralWarning?: string
}

export interface BreakEvenScenario {
  modelo: string
  locacaoMensal: number
  cppVenda: number
  producaoMensal?: number
}

export interface BreakEvenResult {
  valid: boolean
  diferencaLocacao: number
  diferencaCPP: number
  paginasBreakEven: number | null
  recomendacao: string
  cenarioMaisEconomicoParaVolume?: 'A' | 'B' | 'equivalente'
  error?: string
}

/** Arredonda número para N casas decimais */
export function roundTo(val: number, decimals: number): number {
  if (isNaN(val) || !isFinite(val)) return 0
  const factor = Math.pow(10, decimals)
  return Math.round((val + Number.EPSILON) * factor) / factor
}

/** Formata CPP com 6 casas decimais */
export function formatCPP6(val: number): string {
  const num = Number(val) || 0
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })
}

/** Formata BRL moeda (2 casas decimais) */
export function formatBRL2(val: number): string {
  const num = Number(val) || 0
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * 3.1 Custo por Página Individual do Suprimento
 * CPP_suprimento = valor_compra / rendimento_paginas
 */
export function calculateSupplyCPP(
  valorCompra?: number | null,
  rendimentoPaginas?: number | null,
): number {
  if (
    valorCompra === null ||
    valorCompra === undefined ||
    rendimentoPaginas === null ||
    rendimentoPaginas === undefined ||
    rendimentoPaginas <= 0 ||
    valorCompra <= 0
  ) {
    return 0.0
  }
  return valorCompra / rendimentoPaginas
}

/**
 * 3.3 Depreciação Diluída do Equipamento
 * CPP_equipamento = valor_impressora / (vida_util_meses * producao_mensal_estimada)
 */
export function calculateEquipmentDepreciationCPP(
  valorImpressora?: number | null,
  vidaUtilMeses?: number,
  producaoMensalEstimada?: number,
): number {
  const meses = vidaUtilMeses && vidaUtilMeses > 0 ? vidaUtilMeses : 48
  const producao = producaoMensalEstimada && producaoMensalEstimada > 0 ? producaoMensalEstimada : 0
  const totalPaginasVida = meses * producao
  if (!valorImpressora || valorImpressora <= 0 || totalPaginasVida <= 0) {
    return 0.0
  }
  return valorImpressora / totalPaginasVida
}

/**
 * Classifica o status visual de um slot conforme Seção 15.3 da especificação
 */
export function classifySlotStatus(slot: SupplySlotInput | null | undefined): {
  status: SlotVisualStatus
  message?: string
  isProvision: boolean
  integrated: boolean
} {
  if (!slot || !slot.modelo || slot.modelo.trim() === '' || slot.modelo === 'N/A') {
    return {
      status: 'empty',
      message: 'Não Aplicável / Vazio (CPP = R$ 0,000000)',
      isProvision: false,
      integrated: false,
    }
  }

  const modelUpper = slot.modelo.toUpperCase().trim()

  // Slot Integrado ao Chassi (Brother compactas: HL-1200, HL-1210W, etc.)
  if (modelUpper === 'INTEGRADO' || slot.integratedToChassis) {
    return {
      status: 'integrated',
      message: 'Fusor Integrado (Amortização no Ativo)',
      isProvision: false,
      integrated: true,
    }
  }

  // Cabeçote Epson: Provisão de Reparo / Risco de Inatividade
  const isEpsonProvision =
    modelUpper.includes('FA04061') ||
    modelUpper.includes('CAB-FA04061') ||
    slot.isProvision ||
    (slot.tipo === 'cabecote' && slot.fabricante?.toLowerCase() === 'epson')

  const hasPrice =
    slot.valorCompra !== null &&
    slot.valorCompra !== undefined &&
    !isNaN(Number(slot.valorCompra)) &&
    Number(slot.valorCompra) > 0

  const hasYield =
    slot.rendimentoPaginas !== null &&
    slot.rendimentoPaginas !== undefined &&
    !isNaN(Number(slot.rendimentoPaginas)) &&
    Number(slot.rendimentoPaginas) > 0

  if (!hasPrice || !hasYield) {
    return {
      status: 'missing_price',
      message: 'Insumo sem preço ou rendimento homologado (Preencher manualmente)',
      isProvision: isEpsonProvision,
      integrated: false,
    }
  }

  if (isEpsonProvision) {
    return {
      status: 'provision_risk',
      message:
        'Provisão de Reparo / Risco de Inatividade (baixos volumes elevam taxa de sinistro por ressecamento de micropiezos)',
      isProvision: true,
      integrated: false,
    }
  }

  return {
    status: 'complete',
    message: 'Ativo com dados completos',
    isProvision: false,
    integrated: false,
  }
}

/**
 * MOTOR DE PRECIFICAÇÃO PRINCIPAL (Calcula todos os indicadores em tempo real < 100ms)
 */
export function calculatePricing(input: PricingEngineInput): PricingEngineResult {
  const errors: string[] = []
  const warnings: string[] = []

  const producao = input.producaoMensalEstimada
  const vidaUtil = input.vidaUtilMeses && input.vidaUtilMeses > 0 ? input.vidaUtilMeses : 48
  const markUp =
    input.markUpRevenda !== undefined && input.markUpRevenda !== null ? input.markUpRevenda : 1.45
  const valorCompra =
    input.valorCompra !== undefined && input.valorCompra !== null ? Number(input.valorCompra) : 0
  const isThermalOrMatrix = input.tecnologia === 'termica' || input.tecnologia === 'matricial'

  // VALIDAÇÕES DA MATRIZ DE ERROS (Seção 18)
  if (input.bloqueada) {
    errors.push(
      input.motivoBloqueio ||
        'Insumo essencial não homologado para este modelo. Cadastre o suprimento para prosseguir.',
    )
  }

  if (producao <= 0) {
    errors.push('Informe um volume mensal de páginas válido (mínimo: 1 página/mês).')
  }

  if (markUp < 1.0) {
    errors.push(
      'O fator de mark-up comercial não pode ser inferior a 1,00 (margem nula ou negativa).',
    )
  }

  if (!isThermalOrMatrix && (valorCompra <= 0 || isNaN(valorCompra))) {
    errors.push(
      'O equipamento selecionado requer preenchimento do valor de aquisição na base patrimonial.',
    )
  }

  // Determina se um tipo de suprimento é de desgaste estrutural
  const checkIsStructural = (tipo: string, modelo: string) => {
    const t = tipo.toLowerCase().trim()
    const m = modelo.toLowerCase().trim()
    return (
      t === 'fotocondutor' ||
      t === 'unidade_fusora' ||
      t === 'pelicula' ||
      t === 'cabecote' ||
      t.includes('fusor') ||
      t.includes('cilindro') ||
      t.includes('drum') ||
      m.includes('drum') ||
      m.includes('fusor') ||
      m.includes('fotocondutor') ||
      m.includes('cabeçote') ||
      m.includes('cabecote')
    )
  }

  // Verifica se a impressora tem pelo menos um suprimento cadastrado/vinculado (não-vazio)
  const hasAnyConfiguredSupply = input.supplies.some(
    (s) => s && s.modelo && s.modelo.trim() !== '' && s.modelo !== 'N/A',
  )
  if (!hasAnyConfiguredSupply && !isThermalOrMatrix) {
    errors.push('Sem suprimentos cadastrados — precificação incompleta')
  }

  // PROCESSAMENTO DOS SLOTS (1 a 5)
  const enrichedSlots: EnrichedSupplySlot[] = []
  let sumSuppliesCpp = 0.0
  let hasMissingEssentialSupply = false

  for (let i = 1; i <= 5; i++) {
    const rawSlot = input.supplies[i - 1]
    const classified = classifySlotStatus(rawSlot)
    const isSlotIncluded = rawSlot?.included !== false
    const isStructural = rawSlot ? checkIsStructural(rawSlot.tipo, rawSlot.modelo) : false

    let cppSlot = 0.0
    if (rawSlot && classified.status !== 'empty' && classified.status !== 'integrated') {
      if (classified.status === 'missing_price') {
        // Suprimento sem preço ou rendimento bloqueia
        hasMissingEssentialSupply = true
      } else {
        cppSlot = calculateSupplyCPP(rawSlot.valorCompra, rawSlot.rendimentoPaginas)
        if (isSlotIncluded) {
          sumSuppliesCpp += cppSlot
        }
      }
    }

    if (classified.status === 'provision_risk' && isSlotIncluded) {
      warnings.push(
        'Atenção: Cabeçote Piezoelétrico provisionado como risco operacional. Baixos volumes de impressão elevam taxa de sinistro.',
      )
    }

    let structuralWarning: string | undefined = undefined
    if (
      rawSlot &&
      classified.status !== 'empty' &&
      classified.status !== 'integrated' &&
      !isSlotIncluded &&
      isStructural
    ) {
      structuralWarning =
        'Item de manutenção estrutural desmarcado — o custo desta peça ficará sob sua responsabilidade'
    }

    enrichedSlots.push({
      slotNumber: i as 1 | 2 | 3 | 4 | 5,
      supplyId: rawSlot?.supplyId || null,
      modelo: rawSlot?.modelo || '',
      tipo: rawSlot?.tipo || '',
      fabricante: rawSlot?.fabricante || '',
      valorCompra: rawSlot?.valorCompra ?? null,
      rendimentoPaginas: rawSlot?.rendimentoPaginas ?? null,
      cppCalculado: cppSlot,
      visualStatus: classified.status,
      statusMessage: classified.message,
      isProvision: classified.isProvision,
      riskWarning: classified.isProvision
        ? 'baixos volumes elevam taxa de sinistro por ressecamento de micropiezos'
        : undefined,
      integratedToChassis: classified.integrated,
      included: isSlotIncluded,
      isStructural,
      structuralWarning,
    })
  }

  if (hasMissingEssentialSupply && !isThermalOrMatrix) {
    errors.push(
      'Insumo essencial não homologado para este modelo. Cadastre o suprimento para prosseguir.',
    )
  }

  // Se térmico ou matricial, regra 4.4: proposta fica fora do cálculo tradicional por página
  if (isThermalOrMatrix) {
    warnings.push(
      'Equipamento térmico/matricial: proposta faturada por mensalidade fixa + consumo unitário de bobina/fita/ribbon.',
    )
  }

  // CÁLCULOS PRINCIPAIS
  // CPP_equipamento = valor_impressora / (vida_util_meses * producao_mensal_estimada)
  const cppEquipamento = isThermalOrMatrix
    ? 0.0
    : calculateEquipmentDepreciationCPP(valorCompra, vidaUtil, producao)

  // CPP_fornecedor_total = CPP_suprimentos + CPP_equipamento
  const cppFornecedorTotal = sumSuppliesCpp + cppEquipamento

  // CPP_venda = CPP_fornecedor_total * mark_up_revenda
  // Regra crítica: mark-up incide ao FINAL sobre a soma integral de suprimentos + equipamento
  const cppVenda = cppFornecedorTotal * markUp

  // custo_mensal = producao_mensal * CPP_venda
  const custoMensalProducao = producao * cppVenda

  // Faturamento total mensal = locação base (se informada) + custo mensal de páginas
  const locacaoBase =
    input.locacaoMensalProposta && input.locacaoMensalProposta > 0 ? input.locacaoMensalProposta : 0
  const faturamentoTotalMensal = locacaoBase + custoMensalProducao

  const valid = errors.length === 0

  return {
    valid,
    errors,
    warnings,
    isThermalOrMatrix,
    cppSuprimentos: sumSuppliesCpp,
    cppEquipamento,
    cppFornecedorTotal,
    markUpAplicado: markUp,
    cppVenda,
    custoMensalProducao,
    faturamentoTotalMensal,
    slotsEnriquecidos: enrichedSlots,
    formatted: {
      cppSuprimentos: formatCPP6(sumSuppliesCpp),
      cppEquipamento: formatCPP6(cppEquipamento),
      cppFornecedorTotal: formatCPP6(cppFornecedorTotal),
      cppVenda: formatCPP6(cppVenda),
      custoMensalProducao: formatBRL2(custoMensalProducao),
      faturamentoTotalMensal: formatBRL2(faturamentoTotalMensal),
    },
  }
}

/**
 * 3.6 Análise de Ponto de Equilíbrio (Break-Even) entre Cenários
 * paginas_break_even = (locacao_B - locacao_A) / |CPP_venda_A - CPP_venda_B|
 */
export function calculateBreakEven(
  cenarioA: BreakEvenScenario,
  cenarioB: BreakEvenScenario,
  volumeAtual = 0,
): BreakEvenResult {
  const diffLocacao = cenarioB.locacaoMensal - cenarioA.locacaoMensal
  const diffCpp = Math.abs(cenarioA.cppVenda - cenarioB.cppVenda)

  // Matriz de erros: se locações idênticas E CPPs idênticos
  if (Math.abs(diffLocacao) < 0.000001 && diffCpp < 0.0000001) {
    return {
      valid: false,
      diferencaLocacao: 0,
      diferencaCPP: 0,
      paginasBreakEven: null,
      recomendacao:
        'Os cenários informados são equivalentes; não há ponto de equilíbrio aplicável.',
      error: 'ERR_BREAKEVEN_PARALLEL_LINES',
      cenarioMaisEconomicoParaVolume: 'equivalente',
    }
  }

  if (diffCpp < 0.00000001) {
    return {
      valid: false,
      diferencaLocacao: roundTo(diffLocacao, 2),
      diferencaCPP: 0,
      paginasBreakEven: null,
      recomendacao: 'CPPs de venda idênticos; a opção de menor locação é sempre mais vantajosa.',
      error: 'ERR_IDENTICAL_CPP',
      cenarioMaisEconomicoParaVolume: diffLocacao > 0 ? 'A' : 'B',
    }
  }

  // paginas_break_even = |locacao_B - locacao_A| / |CPP_A - CPP_B|
  const paginasBreakEven = Math.abs(diffLocacao) / diffCpp

  // Identifica quem tem menor custo fixo e quem tem menor CPP
  const menorFixo = cenarioA.locacaoMensal <= cenarioB.locacaoMensal ? cenarioA : cenarioB
  const menorCpp = cenarioA.cppVenda <= cenarioB.cppVenda ? cenarioA : cenarioB

  let recomendacao = ''
  let cenarioMaisEconomico: 'A' | 'B' | 'equivalente' = 'equivalente'

  if (menorFixo === menorCpp) {
    // Uma opção é superior em ambos (locação menor e CPP menor)
    const melhorNome = menorFixo === cenarioA ? 'Cenário A' : 'Cenário B'
    recomendacao = `${melhorNome} (${menorFixo.modelo}) apresenta menor locação e menor CPP, sendo mais econômico em qualquer volume.`
    cenarioMaisEconomico = menorFixo === cenarioA ? 'A' : 'B'
  } else {
    const nomeMenorCpp = menorCpp === cenarioA ? 'Cenário A' : 'Cenário B'
    const nomeMenorFixo = menorFixo === cenarioA ? 'Cenário A' : 'Cenário B'
    const beArredondado = Math.round(paginasBreakEven).toLocaleString('pt-BR')

    recomendacao = `Para volumes superiores a ${beArredondado} páginas/mês, o ${nomeMenorCpp} (${menorCpp.modelo}) apresenta menor custo total de propriedade (TCO). Para volumes inferiores, o ${nomeMenorFixo} (${menorFixo.modelo}) é mais vantajoso.`

    if (volumeAtual > 0) {
      if (Math.abs(volumeAtual - paginasBreakEven) < 1) {
        cenarioMaisEconomico = 'equivalente'
      } else if (volumeAtual > paginasBreakEven) {
        cenarioMaisEconomico = menorCpp === cenarioA ? 'A' : 'B'
      } else {
        cenarioMaisEconomico = menorFixo === cenarioA ? 'A' : 'B'
      }
    }
  }

  return {
    valid: true,
    diferencaLocacao: roundTo(Math.abs(diffLocacao), 2),
    diferencaCPP: roundTo(diffCpp, 6),
    paginasBreakEven,
    recomendacao,
    cenarioMaisEconomicoParaVolume: cenarioMaisEconomico,
  }
}
