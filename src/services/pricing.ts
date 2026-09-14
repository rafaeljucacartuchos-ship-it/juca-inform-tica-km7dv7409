import pb from '@/lib/pocketbase/client'
import {
  CompanyPricingParameters,
  CurrencyType,
  PricingHistory,
  PricingMode,
  SystemSetting,
} from '@/types'

// Chaves legadas (mantidas para compatibilidade)
export const DEFAULT_EXPENSES_SETTING_KEY = 'pricing_default_expenses_pct'
export const DEFAULT_MIN_MARGIN_SETTING_KEY = 'pricing_min_margin_pct'

// Novas chaves da metodologia JUCA INFORMÁTICA
export const SETTING_KEYS = {
  COTACAO_DOLAR: 'cotacao_dolar',
  FRETE_PADRAO: 'frete_padrao',
  TAXA_CARTAO_PCT: 'taxa_cartao_pct',
  ICMS_PCT: 'icms_pct',
  COMISSAO_PCT: 'comissao_pct',
  IPI_PCT: 'ipi_pct',
  DESPESA_FIXA_MENSAL: 'despesa_fixa_mensal',
  FATURAMENTO_MEDIO_MENSAL: 'faturamento_medio_mensal',
  LUCRATIVIDADE_DESEJADA_PCT: 'lucratividade_desejada_pct',
} as const

export const DEFAULT_COMPANY_PARAMS: CompanyPricingParameters = {
  cotacao_dolar: 5.65,
  frete_padrao: 0,
  taxa_cartao_pct: 3.5,
  icms_pct: 4.0,
  comissao_pct: 2.5,
  ipi_pct: 0,
  despesa_fixa_mensal: 15000,
  faturamento_medio_mensal: 100000,
  lucratividade_desejada_pct: 25.0,
  despesa_fixa_pct: 15.0,
  custos_variaveis_pct: 10.0,
}

/**
 * Busca uma configuração por chave no settings.
 */
async function getSettingValue(key: string, defaultValue: string): Promise<string> {
  try {
    const records = await pb.collection('settings').getFullList<SystemSetting>({
      filter: `key = "${key}"`,
    })
    if (records.length > 0 && records[0].value != null && records[0].value !== '') {
      return records[0].value
    }
  } catch {
    /* fallback */
  }
  return defaultValue
}

/**
 * Salva ou atualiza uma configuração no settings.
 */
async function setSettingValue(key: string, value: string, description?: string): Promise<void> {
  try {
    const records = await pb.collection('settings').getFullList<SystemSetting>({
      filter: `key = "${key}"`,
    })
    if (records.length > 0) {
      await pb.collection('settings').update(records[0].id, { value })
    } else {
      await pb.collection('settings').create({
        key,
        value,
        description: description || `Parâmetro ${key}`,
      })
    }
  } catch (err) {
    console.error(`Erro ao salvar setting ${key}:`, err)
    throw err
  }
}

/**
 * Carrega todos os parâmetros de precificação da empresa de settings.
 */
export async function getCompanyPricingParameters(): Promise<CompanyPricingParameters> {
  try {
    const records = await pb.collection('settings').getFullList<SystemSetting>()
    const map = new Map<string, string>()
    records.forEach((r) => map.set(r.key, r.value))

    const parseNum = (val: string | undefined, def: number): number => {
      if (!val) return def
      const parsed = parseFloat(val.replace(',', '.'))
      return isNaN(parsed) ? def : parsed
    }

    const cotacao_dolar = parseNum(
      map.get(SETTING_KEYS.COTACAO_DOLAR),
      DEFAULT_COMPANY_PARAMS.cotacao_dolar,
    )
    const frete_padrao = parseNum(
      map.get(SETTING_KEYS.FRETE_PADRAO),
      DEFAULT_COMPANY_PARAMS.frete_padrao,
    )
    const taxa_cartao_pct = parseNum(
      map.get(SETTING_KEYS.TAXA_CARTAO_PCT),
      DEFAULT_COMPANY_PARAMS.taxa_cartao_pct,
    )
    const icms_pct = parseNum(map.get(SETTING_KEYS.ICMS_PCT), DEFAULT_COMPANY_PARAMS.icms_pct)
    const comissao_pct = parseNum(
      map.get(SETTING_KEYS.COMISSAO_PCT),
      DEFAULT_COMPANY_PARAMS.comissao_pct,
    )
    const ipi_pct = parseNum(map.get(SETTING_KEYS.IPI_PCT), DEFAULT_COMPANY_PARAMS.ipi_pct)
    const despesa_fixa_mensal = parseNum(
      map.get(SETTING_KEYS.DESPESA_FIXA_MENSAL),
      DEFAULT_COMPANY_PARAMS.despesa_fixa_mensal,
    )
    const faturamento_medio_mensal = parseNum(
      map.get(SETTING_KEYS.FATURAMENTO_MEDIO_MENSAL),
      DEFAULT_COMPANY_PARAMS.faturamento_medio_mensal,
    )
    const lucratividade_desejada_pct = parseNum(
      map.get(SETTING_KEYS.LUCRATIVIDADE_DESEJADA_PCT),
      DEFAULT_COMPANY_PARAMS.lucratividade_desejada_pct,
    )

    const despesa_fixa_pct =
      faturamento_medio_mensal > 0
        ? Math.round((despesa_fixa_mensal / faturamento_medio_mensal) * 10000) / 100
        : 0

    const custos_variaveis_pct =
      Math.round((taxa_cartao_pct + icms_pct + comissao_pct + ipi_pct) * 100) / 100

    return {
      cotacao_dolar,
      frete_padrao,
      taxa_cartao_pct,
      icms_pct,
      comissao_pct,
      ipi_pct,
      despesa_fixa_mensal,
      faturamento_medio_mensal,
      lucratividade_desejada_pct,
      despesa_fixa_pct,
      custos_variaveis_pct,
    }
  } catch {
    return DEFAULT_COMPANY_PARAMS
  }
}

/**
 * Atualiza múltiplos parâmetros da empresa de uma só vez.
 */
export async function updateCompanyPricingParameters(
  params: Partial<Omit<CompanyPricingParameters, 'despesa_fixa_pct' | 'custos_variaveis_pct'>>,
): Promise<void> {
  const updates: Promise<void>[] = []

  if (params.cotacao_dolar !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.COTACAO_DOLAR,
        String(params.cotacao_dolar),
        'Cotação do Dólar (R$ por US$)',
      ),
    )
  }
  if (params.frete_padrao !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.FRETE_PADRAO,
        String(params.frete_padrao),
        'Frete padrão por item precificado (R$)',
      ),
    )
  }
  if (params.taxa_cartao_pct !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.TAXA_CARTAO_PCT,
        String(params.taxa_cartao_pct),
        'Taxa média de cartão de crédito/débito (%)',
      ),
    )
  }
  if (params.icms_pct !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.ICMS_PCT,
        String(params.icms_pct),
        'Alíquota ICMS / Simples Nacional (%)',
      ),
    )
  }
  if (params.comissao_pct !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.COMISSAO_PCT,
        String(params.comissao_pct),
        'Comissão de vendas (%)',
      ),
    )
  }
  if (params.ipi_pct !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.IPI_PCT,
        String(params.ipi_pct),
        'Alíquota IPI / outros tributos incidentes (%)',
      ),
    )
  }
  if (params.despesa_fixa_mensal !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.DESPESA_FIXA_MENSAL,
        String(params.despesa_fixa_mensal),
        'Despesa fixa mensal total (R$)',
      ),
    )
  }
  if (params.faturamento_medio_mensal !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.FATURAMENTO_MEDIO_MENSAL,
        String(params.faturamento_medio_mensal),
        'Faturamento médio mensal (R$)',
      ),
    )
  }
  if (params.lucratividade_desejada_pct !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.LUCRATIVIDADE_DESEJADA_PCT,
        String(params.lucratividade_desejada_pct),
        'Lucratividade líquida desejada alvo (%)',
      ),
    )
    // Sincroniza também com o legacy min_margin
    updates.push(updateDefaultMinMarginPct(params.lucratividade_desejada_pct))
  }

  await Promise.all(updates)
}

/**
 * Busca a alíquota padrão de despesas variáveis (%) salva em Configurações (compatibilidade).
 */
export async function getDefaultExpensesPct(): Promise<number> {
  const params = await getCompanyPricingParameters()
  return params.custos_variaveis_pct
}

/**
 * Salva a alíquota padrão de despesas variáveis (%) em Configurações (compatibilidade).
 */
export async function updateDefaultExpensesPct(pct: number): Promise<void> {
  await setSettingValue(DEFAULT_EXPENSES_SETTING_KEY, String(pct))
}

/**
 * Busca a margem mínima desejada (%) para alerta de margem muito baixa (compatibilidade).
 */
export async function getDefaultMinMarginPct(): Promise<number> {
  const val = await getSettingValue(DEFAULT_MIN_MARGIN_SETTING_KEY, '20')
  const parsed = parseFloat(val.replace(',', '.'))
  return isNaN(parsed) ? 20 : parsed
}

/**
 * Salva a margem mínima padrão (%) (compatibilidade).
 */
export async function updateDefaultMinMarginPct(pct: number): Promise<void> {
  await setSettingValue(DEFAULT_MIN_MARGIN_SETTING_KEY, String(pct))
}

/**
 * Registra um cálculo de precificação no histórico com todos os campos novos.
 */
export async function createPricingHistory(data: {
  product?: string
  cost?: number
  despesas_pct?: number
  markup_pct?: number
  margem_pct?: number
  sale_price: number
  lucro_unitario?: number
  mode: PricingMode
  frete?: number
  custos_adicionais?: number
  custos_variaveis_pct?: number
  despesa_fixa_pct?: number
  custo_moeda?: CurrencyType
  cost_usd?: number
  cotacao_dolar?: number
  taxa_cartao_pct?: number
  icms_pct?: number
  comissao_pct?: number
  ipi_pct?: number
}): Promise<PricingHistory> {
  const currentUserId = pb.authStore.model?.id || undefined
  return pb.collection('pricing_history').create<PricingHistory>({
    product: data.product || null,
    cost: data.cost ?? 0,
    despesas_pct: data.despesas_pct ?? 0,
    markup_pct: data.markup_pct ?? 0,
    margem_pct: data.margem_pct ?? 0,
    sale_price: data.sale_price,
    lucro_unitario: data.lucro_unitario ?? 0,
    mode: data.mode,
    frete: data.frete ?? 0,
    custos_adicionais: data.custos_adicionais ?? 0,
    custos_variaveis_pct: data.custos_variaveis_pct ?? 0,
    despesa_fixa_pct: data.despesa_fixa_pct ?? 0,
    custo_moeda: data.custo_moeda ?? 'BRL',
    cost_usd: data.cost_usd ?? 0,
    cotacao_dolar: data.cotacao_dolar ?? 0,
    taxa_cartao_pct: data.taxa_cartao_pct ?? 0,
    icms_pct: data.icms_pct ?? 0,
    comissao_pct: data.comissao_pct ?? 0,
    ipi_pct: data.ipi_pct ?? 0,
    created_by: currentUserId || null,
  })
}

/**
 * Busca histórico recente de precificações com produto e criador expandidos.
 */
export async function getPricingHistory(limit = 100): Promise<PricingHistory[]> {
  return pb.collection('pricing_history').getFullList<PricingHistory>({
    sort: '-created',
    expand: 'product,created_by',
    limit,
  })
}

/**
 * Interface completa com todas as fatias da metodologia Rafael (JUCA INFORMÁTICA):
 *
 * Custo direto = Custo em R$ (convertido de US$ se aplicável) + Frete + Custos adicionais (embalagem/outros)
 * Markup divisor = 1 ÷ (1 − Despesa fixa % − Custos variáveis % − Lucratividade %)
 * Preço de venda = Custo direto × Markup divisor
 *
 * Fatias do preço de venda (soma fecha 100%):
 * 1) Custo Direto (R$ e %)
 * 2) Despesas Fixas (R$ e %)
 * 3) Custos Variáveis (R$ e %) [Cartão + ICMS + Comissão + IPI]
 * 4) Lucro Líquido (R$ e %)
 */
export interface PricingCalculationResult {
  // Entradas de custos diretos
  custoProdutoBRL: number
  custoProdutoUSD?: number
  moeda: CurrencyType
  cotacaoDolar: number
  frete: number
  custoAdicional1: number
  custoAdicional2: number
  custoDiretoTotal: number // custo BRL + frete + adicional1 + adicional2

  // Percentuais aplicados
  despesaFixaPct: number
  taxaCartaoPct: number
  icmsPct: number
  comissaoPct: number
  ipiPct: number
  custosVariaveisPct: number // soma das 4 variáveis
  lucratividadePct: number // margem de lucro líquido alvo

  // Divisor e Multiplicador de markup
  markupDivisor: number // 1 / (1 - fixas - variaveis - margem)
  markupMultiplicador: number // igual ao markupDivisor (ex: 1.96x)
  markupSobreCustoPct: number // lucro / custoDireto * 100 (para compatibilidade)

  // Resultado
  salePrice: number
  lucroUnitario: number

  // Fatias decompostas em R$ e em % (para gráfico cascata 100%)
  fatias: {
    custoDireto: { valor: number; pct: number }
    despesaFixa: { valor: number; pct: number }
    custosVariaveis: {
      valor: number
      pct: number
      detalhe: {
        cartao: { valor: number; pct: number }
        icms: { valor: number; pct: number }
        comissao: { valor: number; pct: number }
        ipi: { valor: number; pct: number }
      }
    }
    lucro: { valor: number; pct: number }
    totalPct: number // soma das 4 fatias (deve fechar ~100%)
  }

  // Compatibilidade com a interface anterior
  cost: number // custoDiretoTotal
  despesasPct: number // despesaFixaPct + custosVariaveisPct
  markupPct: number // markupSobreCustoPct
  margemPct: number // lucratividadePct
  lucroPctSobrePreco: number // lucratividadePct
  isPossible: boolean
  errorMessage?: string
}

export interface PricingInputData {
  custoProduto: number
  moeda: CurrencyType
  cotacaoDolar?: number
  frete?: number
  custoAdicional1?: number
  custoAdicional2?: number
  despesaFixaPct: number
  taxaCartaoPct: number
  icmsPct: number
  comissaoPct: number
  ipiPct: number
  lucratividadePct: number
}

/**
 * Nova metodologia de cálculo completa (JUCA INFORMÁTICA):
 *
 * 1. Custo direto = Custo do produto em R$ + frete + custos adicionais unitários
 * 2. Custos variáveis % = taxa_cartao% + icms% + comissao% + ipi%
 * 3. Markup divisor = 1 / (1 - despesa_fixa% - custos_variaveis% - lucratividade%)
 * 4. Preço de venda = Custo direto * Markup divisor
 * 5. Lucro R$ = Preço - Custo direto - Despesa fixa$ - Custos variáveis$
 * 6. Todas as fatias fecham 100% do preço de venda
 */
export function calculateJucaPricing(input: PricingInputData): PricingCalculationResult {
  const cotacao = input.cotacaoDolar && input.cotacaoDolar > 0 ? input.cotacaoDolar : 5.65
  const moeda = input.moeda || 'BRL'

  // Conversão de moeda se USD
  const custoProdutoUSD = moeda === 'USD' ? Math.max(0, input.custoProduto) : 0
  const custoProdutoBRL =
    moeda === 'USD'
      ? Math.round(custoProdutoUSD * cotacao * 100) / 100
      : Math.max(0, input.custoProduto)

  const frete = Math.max(0, input.frete || 0)
  const adicional1 = Math.max(0, input.custoAdicional1 || 0)
  const adicional2 = Math.max(0, input.custoAdicional2 || 0)

  const custoDiretoTotal =
    Math.round((custoProdutoBRL + frete + adicional1 + adicional2) * 100) / 100

  const despesaFixaPct = Math.max(0, input.despesaFixaPct || 0)
  const taxaCartaoPct = Math.max(0, input.taxaCartaoPct || 0)
  const icmsPct = Math.max(0, input.icmsPct || 0)
  const comissaoPct = Math.max(0, input.comissaoPct || 0)
  const ipiPct = Math.max(0, input.ipiPct || 0)
  const custosVariaveisPct =
    Math.round((taxaCartaoPct + icmsPct + comissaoPct + ipiPct) * 100) / 100
  const lucratividadePct = Math.max(0, input.lucratividadePct || 0)

  // Divisor decimal: 1 - (despesa_fixa% + variaveis% + lucratividade%) / 100
  const somaDeducoesPct = despesaFixaPct + custosVariaveisPct + lucratividadePct
  const divisorDecimal = 1 - somaDeducoesPct / 100

  if (divisorDecimal <= 0.0001) {
    return {
      custoProdutoBRL,
      custoProdutoUSD,
      moeda,
      cotacaoDolar: cotacao,
      frete,
      custoAdicional1: adicional1,
      custoAdicional2: adicional2,
      custoDiretoTotal,
      despesaFixaPct,
      taxaCartaoPct,
      icmsPct,
      comissaoPct,
      ipiPct,
      custosVariaveisPct,
      lucratividadePct,
      markupDivisor: 0,
      markupMultiplicador: 0,
      markupSobreCustoPct: 0,
      salePrice: 0,
      lucroUnitario: 0,
      fatias: {
        custoDireto: { valor: 0, pct: 0 },
        despesaFixa: { valor: 0, pct: 0 },
        custosVariaveis: {
          valor: 0,
          pct: 0,
          detalhe: {
            cartao: { valor: 0, pct: 0 },
            icms: { valor: 0, pct: 0 },
            comissao: { valor: 0, pct: 0 },
            ipi: { valor: 0, pct: 0 },
          },
        },
        lucro: { valor: 0, pct: 0 },
        totalPct: 0,
      },
      cost: custoDiretoTotal,
      despesasPct: despesaFixaPct + custosVariaveisPct,
      markupPct: 0,
      margemPct: lucratividadePct,
      lucroPctSobrePreco: lucratividadePct,
      isPossible: false,
      errorMessage: `A soma de Despesa Fixa (${despesaFixaPct}%) + Custos Variáveis (${custosVariaveisPct}%) + Lucratividade (${lucratividadePct}%) é ${somaDeducoesPct.toFixed(1)}%, que é igual ou superior a 100%. Reduza as margens ou custos.`,
    }
  }

  const markupDivisor = 1 / divisorDecimal
  const rawSalePrice = custoDiretoTotal * markupDivisor
  const salePrice = Math.round(rawSalePrice * 100) / 100

  // Cálculo das fatias em R$
  const despesaFixaValor = Math.round(salePrice * (despesaFixaPct / 100) * 100) / 100
  const cartaoValor = Math.round(salePrice * (taxaCartaoPct / 100) * 100) / 100
  const icmsValor = Math.round(salePrice * (icmsPct / 100) * 100) / 100
  const comissaoValor = Math.round(salePrice * (comissaoPct / 100) * 100) / 100
  const ipiValor = Math.round(salePrice * (ipiPct / 100) * 100) / 100
  const custosVariaveisValor =
    Math.round((cartaoValor + icmsValor + comissaoValor + ipiValor) * 100) / 100

  // Lucro R$ = Preço - custo direto - despesa fixa$ - variáveis$
  const lucroUnitario =
    Math.round((salePrice - custoDiretoTotal - despesaFixaValor - custosVariaveisValor) * 100) / 100

  // Fatias percentuais sobre o preço final gerado (deve somar 100%)
  const custoDiretoPct = salePrice > 0 ? (custoDiretoTotal / salePrice) * 100 : 0
  const lucroRealPct = salePrice > 0 ? (lucroUnitario / salePrice) * 100 : 0
  const despesaFixaRealPct = salePrice > 0 ? (despesaFixaValor / salePrice) * 100 : 0
  const custosVariaveisRealPct = salePrice > 0 ? (custosVariaveisValor / salePrice) * 100 : 0
  const totalFatiasPct =
    Math.round(
      (custoDiretoPct + despesaFixaRealPct + custosVariaveisRealPct + lucroRealPct) * 100,
    ) / 100

  // Markup sobre o custo (lucro / custo * 100) para compatibilidade
  const markupSobreCustoPct =
    custoDiretoTotal > 0 ? Math.round((lucroUnitario / custoDiretoTotal) * 10000) / 100 : 0

  return {
    custoProdutoBRL,
    custoProdutoUSD,
    moeda,
    cotacaoDolar: cotacao,
    frete,
    custoAdicional1: adicional1,
    custoAdicional2: adicional2,
    custoDiretoTotal,
    despesaFixaPct,
    taxaCartaoPct,
    icmsPct,
    comissaoPct,
    ipiPct,
    custosVariaveisPct,
    lucratividadePct,
    markupDivisor: Math.round(markupDivisor * 1000) / 1000,
    markupMultiplicador: Math.round(markupDivisor * 100) / 100,
    markupSobreCustoPct,
    salePrice,
    lucroUnitario,
    fatias: {
      custoDireto: {
        valor: custoDiretoTotal,
        pct: Math.round(custoDiretoPct * 10) / 10,
      },
      despesaFixa: {
        valor: despesaFixaValor,
        pct: Math.round(despesaFixaRealPct * 10) / 10,
      },
      custosVariaveis: {
        valor: custosVariaveisValor,
        pct: Math.round(custosVariaveisRealPct * 10) / 10,
        detalhe: {
          cartao: {
            valor: cartaoValor,
            pct: Math.round((cartaoValor / (salePrice || 1)) * 1000) / 10,
          },
          icms: {
            valor: icmsValor,
            pct: Math.round((icmsValor / (salePrice || 1)) * 1000) / 10,
          },
          comissao: {
            valor: comissaoValor,
            pct: Math.round((comissaoValor / (salePrice || 1)) * 1000) / 10,
          },
          ipi: {
            valor: ipiValor,
            pct: Math.round((ipiValor / (salePrice || 1)) * 1000) / 10,
          },
        },
      },
      lucro: {
        valor: lucroUnitario,
        pct: Math.round(lucroRealPct * 10) / 10,
      },
      totalPct: totalFatiasPct,
    },
    cost: custoDiretoTotal,
    despesasPct: Math.round((despesaFixaPct + custosVariaveisPct) * 10) / 10,
    markupPct: markupSobreCustoPct,
    margemPct: Math.round(lucroRealPct * 10) / 10,
    lucroPctSobrePreco: Math.round(lucroRealPct * 10) / 10,
    isPossible: true,
  }
}

/**
 * Decompõe um preço de venda EXISTENTE (ex: preço atual de um produto) nas 4 fatias,
 * permitindo comparar o preço atual cadastrado com o preço sugerido pela metodologia.
 */
export function decomposeExistingPrice(
  currentPrice: number,
  custoDiretoTotal: number,
  despesaFixaPct: number,
  taxaCartaoPct: number,
  icmsPct: number,
  comissaoPct: number,
  ipiPct: number,
) {
  const price = Math.max(0, currentPrice)
  const custo = Math.max(0, custoDiretoTotal)

  const despesaFixaValor = Math.round(price * (despesaFixaPct / 100) * 100) / 100
  const cartaoValor = Math.round(price * (taxaCartaoPct / 100) * 100) / 100
  const icmsValor = Math.round(price * (icmsPct / 100) * 100) / 100
  const comissaoValor = Math.round(price * (comissaoPct / 100) * 100) / 100
  const ipiValor = Math.round(price * (ipiPct / 100) * 100) / 100
  const custosVariaveisValor =
    Math.round((cartaoValor + icmsValor + comissaoValor + ipiValor) * 100) / 100

  // Lucro R$ no preço atual
  const lucroUnitario =
    Math.round((price - custo - despesaFixaValor - custosVariaveisValor) * 100) / 100

  const custoPct = price > 0 ? (custo / price) * 100 : 0
  const despesaFixaRealPct = price > 0 ? (despesaFixaValor / price) * 100 : 0
  const custosVariaveisRealPct = price > 0 ? (custosVariaveisValor / price) * 100 : 0
  const margemLiquidaPct = price > 0 ? (lucroUnitario / price) * 100 : 0

  return {
    price,
    custoDiretoTotal: custo,
    custoPct: Math.round(custoPct * 10) / 10,
    despesaFixaValor,
    despesaFixaPct: Math.round(despesaFixaRealPct * 10) / 10,
    custosVariaveisValor,
    custosVariaveisPct: Math.round(custosVariaveisRealPct * 10) / 10,
    lucroUnitario,
    margemLiquidaPct: Math.round(margemLiquidaPct * 10) / 10,
    isPrejuizo: lucroUnitario < 0,
  }
}

/**
 * Funções Legadas (mantidas para retrocompatibilidade de testes ou chamadas existentes)
 */
export function calculateFromMargem(
  cost: number,
  despesasPct: number,
  margemPct: number,
): PricingCalculationResult {
  return calculateJucaPricing({
    custoProduto: cost,
    moeda: 'BRL',
    frete: 0,
    custoAdicional1: 0,
    custoAdicional2: 0,
    despesaFixaPct: 0,
    taxaCartaoPct: despesasPct,
    icmsPct: 0,
    comissaoPct: 0,
    ipiPct: 0,
    lucratividadePct: margemPct,
  })
}

export function calculateFromMarkup(
  cost: number,
  despesasPct: number,
  markupPct: number,
): PricingCalculationResult {
  // Converte markup sobre custo em margem sobre preço
  const mkDec = (markupPct || 0) / 100
  const dDec = (despesasPct || 0) / 100
  const safeCost = Math.max(0, cost)

  if (dDec >= 0.9999) {
    return calculateFromMargem(safeCost, despesasPct, 0)
  }

  const salePrice = (safeCost * (1 + mkDec)) / (1 - dDec)
  const lucro = salePrice * (1 - dDec) - safeCost
  const margem = salePrice > 0 ? (lucro / salePrice) * 100 : 0

  return calculateFromMargem(safeCost, despesasPct, margem)
}

export function calculateFromPrice(
  cost: number,
  despesasPct: number,
  salePrice: number,
): PricingCalculationResult {
  const safeCost = Math.max(0, cost)
  const safePrice = Math.max(0, salePrice)
  const dDec = (despesasPct || 0) / 100

  const revenueAfterExpenses = safePrice * (1 - dDec)
  const lucroUnitario = revenueAfterExpenses - safeCost
  const margemPct = safePrice > 0 ? (lucroUnitario / safePrice) * 100 : 0

  return calculateFromMargem(safeCost, despesasPct, margemPct)
}
