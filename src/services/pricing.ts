import pb from '@/lib/pocketbase/client'
import {
  CompanyPricingParameters,
  CurrencyType,
  PaymentMethodTax,
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
  IMPOSTO_SAIDA_PCT: 'imposto_saida_pct',
  SUBST_TRIBUTARIA_PCT: 'subst_tributaria_pct',
  DESPESA_FIXA_MENSAL: 'despesa_fixa_mensal',
  FATURAMENTO_MEDIO_MENSAL: 'faturamento_medio_mensal',
  LUCRATIVIDADE_DESEJADA_PCT: 'lucratividade_desejada_pct',
  PAYMENT_METHODS_TAX: 'payment_methods_tax',
  CUSTO_FIXO_PCT: 'custo_fixo_pct',
  CUSTO_FIXO_MENSAL: 'custo_fixo_mensal',
  VOLUME_ESTIMADO_SERVICOS_MES: 'volume_estimado_servicos_mes',
} as const

export const DEFAULT_PAYMENT_METHODS_TAX: PaymentMethodTax[] = [
  { id: 'debito', nome: 'Débito', taxa_pct: 1.5, parcelas: 1 },
  { id: 'credito_vista', nome: 'Crédito à vista (1x)', taxa_pct: 3.5, parcelas: 1 },
  { id: 'credito_2x', nome: 'Crédito 2x', taxa_pct: 4.5, parcelas: 2 },
  { id: 'credito_3x', nome: 'Crédito 3x', taxa_pct: 5.5, parcelas: 3 },
  { id: 'credito_4x', nome: 'Crédito 4x', taxa_pct: 6.5, parcelas: 4 },
  { id: 'credito_5x', nome: 'Crédito 5x', taxa_pct: 7.5, parcelas: 5 },
  { id: 'credito_6x', nome: 'Crédito 6x', taxa_pct: 8.5, parcelas: 6 },
  { id: 'credito_7x', nome: 'Crédito 7x', taxa_pct: 9.5, parcelas: 7 },
  { id: 'credito_8x', nome: 'Crédito 8x', taxa_pct: 10.5, parcelas: 8 },
  { id: 'credito_9x', nome: 'Crédito 9x', taxa_pct: 11.5, parcelas: 9 },
  { id: 'credito_10x', nome: 'Crédito 10x', taxa_pct: 12.5, parcelas: 10 },
  { id: 'credito_11x', nome: 'Crédito 11x', taxa_pct: 13.5, parcelas: 11 },
  { id: 'credito_12x', nome: 'Crédito 12x', taxa_pct: 14.5, parcelas: 12 },
]

export const DEFAULT_COMPANY_PARAMS: CompanyPricingParameters = {
  cotacao_dolar: 5.65,
  frete_padrao: 0,
  taxa_cartao_pct: 3.5,
  icms_pct: 4.0,
  comissao_pct: 2.5,
  ipi_pct: 0,
  imposto_saida_pct: 4.0,
  subst_tributaria_pct: 0,
  despesa_fixa_mensal: 15000,
  faturamento_medio_mensal: 100000,
  lucratividade_desejada_pct: 25.0,
  despesa_fixa_pct: 15.0,
  custos_variaveis_pct: 14.0,
  payment_methods_tax: DEFAULT_PAYMENT_METHODS_TAX,
  custo_fixo_pct: 0,
  custo_fixo_mensal: 12000,
  volume_estimado_servicos_mes: 300,
  custo_fixo_rateado_unitario: 40.0,
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
    const imposto_saida_pct = parseNum(
      map.get(SETTING_KEYS.IMPOSTO_SAIDA_PCT),
      DEFAULT_COMPANY_PARAMS.imposto_saida_pct ?? 4.0,
    )
    const subst_tributaria_pct = parseNum(
      map.get(SETTING_KEYS.SUBST_TRIBUTARIA_PCT),
      DEFAULT_COMPANY_PARAMS.subst_tributaria_pct ?? 0,
    )
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
    const custo_fixo_mensal = parseNum(
      map.get(SETTING_KEYS.CUSTO_FIXO_MENSAL),
      DEFAULT_COMPANY_PARAMS.custo_fixo_mensal ?? 12000,
    )
    const custo_fixo_pct = parseNum(
      map.get(SETTING_KEYS.CUSTO_FIXO_PCT),
      DEFAULT_COMPANY_PARAMS.custo_fixo_pct ?? 0,
    )
    const volume_estimado_servicos_mes = parseNum(
      map.get(SETTING_KEYS.VOLUME_ESTIMADO_SERVICOS_MES),
      DEFAULT_COMPANY_PARAMS.volume_estimado_servicos_mes ?? 300,
    )

    let payment_methods_tax = DEFAULT_PAYMENT_METHODS_TAX
    const rawMethods = map.get(SETTING_KEYS.PAYMENT_METHODS_TAX)
    if (rawMethods) {
      try {
        const parsed = JSON.parse(rawMethods)
        if (Array.isArray(parsed) && parsed.length > 0) {
          payment_methods_tax = parsed
        }
      } catch {
        /* fallback para default */
      }
    }

    const despesa_fixa_pct =
      faturamento_medio_mensal > 0
        ? Math.round((despesa_fixa_mensal / faturamento_medio_mensal) * 10000) / 100
        : 0

    const custos_variaveis_pct =
      Math.round((taxa_cartao_pct + icms_pct + imposto_saida_pct + comissao_pct + ipi_pct) * 100) /
      100

    const custo_fixo_rateado_unitario =
      volume_estimado_servicos_mes > 0
        ? Math.round((custo_fixo_mensal / volume_estimado_servicos_mes) * 100) / 100
        : 0

    return {
      cotacao_dolar,
      frete_padrao,
      taxa_cartao_pct,
      icms_pct,
      comissao_pct,
      ipi_pct,
      imposto_saida_pct,
      subst_tributaria_pct,
      despesa_fixa_mensal,
      faturamento_medio_mensal,
      lucratividade_desejada_pct,
      despesa_fixa_pct,
      custos_variaveis_pct,
      payment_methods_tax,
      custo_fixo_pct,
      custo_fixo_mensal,
      volume_estimado_servicos_mes,
      custo_fixo_rateado_unitario,
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
  if (params.imposto_saida_pct !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.IMPOSTO_SAIDA_PCT,
        String(params.imposto_saida_pct),
        'Alíquota de imposto de saída (%) incidente nas vendas',
      ),
    )
  }
  if (params.subst_tributaria_pct !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.SUBST_TRIBUTARIA_PCT,
        String(params.subst_tributaria_pct),
        'Alíquota de substituição tributária (%) incidente no custo do produto',
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
  if (params.payment_methods_tax !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.PAYMENT_METHODS_TAX,
        JSON.stringify(params.payment_methods_tax),
        'Tabela de formas de pagamento e taxas de cartão (%) em formato JSON',
      ),
    )
  }
  if (params.custo_fixo_pct !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.CUSTO_FIXO_PCT,
        String(params.custo_fixo_pct),
        'Custo fixo em porcentagem (%) na precificação',
      ),
    )
  }
  if (params.custo_fixo_mensal !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.CUSTO_FIXO_MENSAL,
        String(params.custo_fixo_mensal),
        'Custo fixo mensal para rateio por serviço (R$/mês)',
      ),
    )
  }
  if (params.volume_estimado_servicos_mes !== undefined) {
    updates.push(
      setSettingValue(
        SETTING_KEYS.VOLUME_ESTIMADO_SERVICOS_MES,
        String(params.volume_estimado_servicos_mes),
        'Volume estimado de serviços realizados por mês (qtd)',
      ),
    )
  }

  await Promise.all(updates)
}

/**
 * Salva apenas a tabela de taxas de formas de pagamento em settings.
 */
export async function updatePaymentMethodsTax(methods: PaymentMethodTax[]): Promise<void> {
  await setSettingValue(
    SETTING_KEYS.PAYMENT_METHODS_TAX,
    JSON.stringify(methods),
    'Tabela de formas de pagamento e taxas de cartão (%) em formato JSON',
  )
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
  imposto_saida_pct?: number
  subst_tributaria_pct?: number
  payment_method_nome?: string
  custo_fixo_pct?: number
  custo_fixo_rateado_unitario?: number
  custo_fixo_mensal?: number
  volume_estimado_servicos_mes?: number
}): Promise<PricingHistory> {
  const currentUserId = pb.authStore.model?.id || undefined
  const payload: Record<string, any> = {
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
    imposto_saida_pct: data.imposto_saida_pct ?? 0,
    subst_tributaria_pct: data.subst_tributaria_pct ?? 0,
    payment_method_nome: data.payment_method_nome || null,
    created_by: currentUserId || null,
  }

  if (data.custo_fixo_pct !== undefined) {
    payload.custo_fixo_pct = data.custo_fixo_pct
  }
  if (data.custo_fixo_rateado_unitario !== undefined) {
    payload.custo_fixo_rateado_unitario = data.custo_fixo_rateado_unitario
  }
  if (data.custo_fixo_mensal !== undefined) {
    payload.custo_fixo_mensal = data.custo_fixo_mensal
  }
  if (data.volume_estimado_servicos_mes !== undefined) {
    payload.volume_estimado_servicos_mes = data.volume_estimado_servicos_mes
  }

  return pb.collection('pricing_history').create<PricingHistory>(payload)
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
  custoFixoRateado: number // custo_fixo_rateado_unitario (R$/serviço)
  custoAquisicao: number // custo BRL + frete + adicional1 + adicional2 (sem ST)
  substTributariaPct: number // Alíquota de ST (%)
  substTributariaValor: number // Valor R$ da Substituição Tributária calculada
  custoTotalProduto: number // Custo Estimado + Frete + Custos Extras + Subst. Tributária (Custo Direto Total de Entrada com ST)
  custoTotalCompleto: number // Custo Total com TODOS os custos (diretos + fixos + operacionais + variáveis + ST) exceto APENAS Lucro Líquido
  custoTotalCompletoPct: number // Percentual do Custo Total Completo sobre o Preço Final (% Preço)
  custoDiretoTotal: number // Igual a custoTotalProduto (base direta usada no markup)
  custoBaseComRateio: number // custoTotalProduto + custoFixoRateado

  // Percentuais aplicados
  custoFixoPct: number // Custo Fixo (%) v0.0.211/v0.0.212
  despesaFixaPct: number
  taxaCartaoPct: number
  icmsPct: number
  impostoSaidaPct?: number
  comissaoPct: number
  ipiPct: number
  custosVariaveisPct: number // soma das variáveis
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
    custoTotalCompleto?: { valor: number; pct: number } // Agrupamento de TODOS os custos do produto exceto Lucro Líquido
    custoDireto: { valor: number; pct: number }
    custoAquisicao?: { valor: number; pct: number } // Mercadoria + frete + extras (sem ST)
    substTributaria?: { valor: number; pct: number } // Card próprio quando ST > 0
    custoFixoRateado: { valor: number; pct: number }
    custoFixo: { valor: number; pct: number } // Custo Fixo (%) em R$ e %
    despesaFixa: { valor: number; pct: number }
    custosVariaveis: {
      valor: number
      pct: number
      detalhe?: {
        cartao: { valor: number; pct: number }
        icms: { valor: number; pct: number }
        impostoSaida?: { valor: number; pct: number }
        comissao: { valor: number; pct: number }
        ipi: { valor: number; pct: number }
      }
    }
    lucro: { valor: number; pct: number }
    totalPct: number // soma das fatias (deve fechar ~100%)
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
  substTributariaPct?: number // Substituição Tributária (%) v0.0.226
  custoFixoRateado?: number
  custoFixoPct?: number
  despesaFixaPct: number
  taxaCartaoPct?: number
  icmsPct?: number
  impostoSaidaPct?: number
  comissaoPct?: number
  ipiPct?: number
  custosVariaveisPctOverride?: number
  lucratividadePct: number
}

/**
 * Nova metodologia de cálculo completa (JUCA INFORMÁTICA):
 *
 * 1. Custo de Aquisição = Custo do produto em R$ + frete + custos adicionais unitários
 * 2. Substituição Tributária (ST) = Custo de Aquisição × (subst_tributaria_pct / 100)
 * 3. Custo Total do Produto = Custo de Aquisição + Substituição Tributária
 * 4. Custo Direto Total = Custo Total do Produto (inclui ST como componente de custo tributário na entrada)
 * 5. Markup divisor = 1 / (1 - custo_fixo% - despesa_fixa% - custos_variaveis% - lucratividade%)
 * 6. Preço de venda = (Custo Total do Produto + Custo Fixo Rateado) * Markup divisor
 * 7. Todas as fatias fecham 100% do preço de venda: Custo de Aquisição (ou Direto), Subst. Tributária (se > 0), Custo Fixo, Despesa Fixa, Variáveis, Lucro Líquido
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
  const custoFixoRateado = Math.max(0, input.custoFixoRateado || 0)

  // Custo de aquisição sem a Substituição Tributária
  const custoAquisicao = Math.round((custoProdutoBRL + frete + adicional1 + adicional2) * 100) / 100
  const substTributariaPct = Math.max(0, input.substTributariaPct || 0)
  const substTributariaValor =
    substTributariaPct > 0 ? Math.round(custoAquisicao * (substTributariaPct / 100) * 100) / 100 : 0

  // CUSTO TOTAL DO PRODUTO = Custo Estimado + Frete + Custos Extras + Substituição Tributária calculada
  const custoTotalProduto = Math.round((custoAquisicao + substTributariaValor) * 100) / 100
  // Custo Direto Total usado nos cálculos de markup e preço sugerido
  const custoDiretoTotal = custoTotalProduto
  const custoBaseComRateio = Math.round((custoDiretoTotal + custoFixoRateado) * 100) / 100

  const custoFixoPct = Math.max(0, input.custoFixoPct || 0)
  const despesaFixaPct = Math.max(0, input.despesaFixaPct || 0)
  const taxaCartaoPct = Math.max(0, input.taxaCartaoPct || 0)
  const icmsPct = Math.max(0, input.icmsPct || 0)
  const impostoSaidaPct = Math.max(0, input.impostoSaidaPct || 0)
  const comissaoPct = Math.max(0, input.comissaoPct || 0)
  const ipiPct = Math.max(0, input.ipiPct || 0)

  const custosVariaveisPct =
    input.custosVariaveisPctOverride !== undefined
      ? Math.max(0, input.custosVariaveisPctOverride)
      : Math.round((taxaCartaoPct + icmsPct + impostoSaidaPct + comissaoPct + ipiPct) * 100) / 100
  const lucratividadePct = Math.max(0, input.lucratividadePct || 0)

  // Divisor decimal: 1 - (custo_fixo% + despesa_fixa% + variaveis% + lucratividade%) / 100
  const somaDeducoesPct = custoFixoPct + despesaFixaPct + custosVariaveisPct + lucratividadePct
  const divisorDecimal = 1 - somaDeducoesPct / 100

  // Quando divisorDecimal <= 0.0001 (markup impossível), ainda assim calculamos o custo consolidado
  // conhecido até ali (custo direto + rateio fixo, ou custo direto se não houver preço de venda para calcular % de despesas).
  // Se houver percentual de custos/despesas sobre a base direta ou se o preço não puder ser calculado,
  // custoTotalCompleto não deve ser zero e deve refletir a base de custo com rateio fixo conhecida.
  if (divisorDecimal <= 0.0001) {
    const custoConsolidadoAntecipado = custoBaseComRateio
    return {
      custoProdutoBRL,
      custoProdutoUSD,
      moeda,
      cotacaoDolar: cotacao,
      frete,
      custoAdicional1: adicional1,
      custoAdicional2: adicional2,
      custoFixoRateado,
      custoAquisicao,
      substTributariaPct,
      substTributariaValor,
      custoTotalProduto,
      custoTotalCompleto: custoConsolidadoAntecipado,
      custoTotalCompletoPct: 0,
      custoDiretoTotal,
      custoBaseComRateio,
      custoFixoPct,
      despesaFixaPct,
      taxaCartaoPct,
      icmsPct,
      impostoSaidaPct,
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
        custoTotalCompleto: {
          valor: custoConsolidadoAntecipado,
          pct: 0,
        },
        custoDireto: { valor: 0, pct: 0 },
        custoAquisicao: { valor: 0, pct: 0 },
        substTributaria: { valor: 0, pct: 0 },
        custoFixoRateado: { valor: 0, pct: 0 },
        custoFixo: { valor: 0, pct: 0 },
        despesaFixa: { valor: 0, pct: 0 },
        custosVariaveis: {
          valor: 0,
          pct: 0,
          detalhe: {
            cartao: { valor: 0, pct: 0 },
            icms: { valor: 0, pct: 0 },
            impostoSaida: { valor: 0, pct: 0 },
            comissao: { valor: 0, pct: 0 },
            ipi: { valor: 0, pct: 0 },
          },
        },
        lucro: { valor: 0, pct: 0 },
        totalPct: 0,
      },
      cost: custoDiretoTotal,
      despesasPct: custoFixoPct + despesaFixaPct + custosVariaveisPct,
      markupPct: 0,
      margemPct: lucratividadePct,
      lucroPctSobrePreco: lucratividadePct,
      isPossible: false,
      errorMessage: `A soma de Custo Fixo (${custoFixoPct}%) + Despesa Fixa (${despesaFixaPct}%) + Custos Variáveis (${custosVariaveisPct}%) + Lucratividade (${lucratividadePct}%) é ${somaDeducoesPct.toFixed(1)}%, que é igual ou superior a 100%. Reduza as margens ou custos.`,
    }
  }

  const markupDivisor = 1 / divisorDecimal
  // O markup incide sobre a base de custo (custo direto + custo fixo rateado)
  const rawSalePrice = custoBaseComRateio * markupDivisor
  const salePrice = Math.round(rawSalePrice * 100) / 100

  // Cálculo das fatias em R$
  const custoFixoValor = Math.round(salePrice * (custoFixoPct / 100) * 100) / 100
  const despesaFixaValor = Math.round(salePrice * (despesaFixaPct / 100) * 100) / 100
  const cartaoValor = Math.round(salePrice * (taxaCartaoPct / 100) * 100) / 100
  const icmsValor = Math.round(salePrice * (icmsPct / 100) * 100) / 100
  const impostoSaidaValor = Math.round(salePrice * (impostoSaidaPct / 100) * 100) / 100
  const comissaoValor = Math.round(salePrice * (comissaoPct / 100) * 100) / 100
  const ipiValor = Math.round(salePrice * (ipiPct / 100) * 100) / 100
  const custosVariaveisValor =
    input.custosVariaveisPctOverride !== undefined
      ? Math.round(salePrice * (custosVariaveisPct / 100) * 100) / 100
      : Math.round((cartaoValor + icmsValor + impostoSaidaValor + comissaoValor + ipiValor) * 100) /
        100

  // Lucro R$ = Preço - custo direto - custo fixo rateado - custo fixo% - despesa fixa% - variáveis%
  const lucroUnitario =
    Math.round(
      (salePrice -
        custoDiretoTotal -
        custoFixoRateado -
        custoFixoValor -
        despesaFixaValor -
        custosVariaveisValor) *
        100,
    ) / 100

  // Custo Total Completo do Produto (TODOS os custos: diretos + fixos + operacionais + variáveis + ST)
  // Ficando de fora APENAS o Lucro Líquido.
  // Preço Final = Custo Total Completo + Lucro Líquido
  const custoTotalCompleto =
    Math.round(
      (custoDiretoTotal +
        custoFixoRateado +
        custoFixoValor +
        despesaFixaValor +
        custosVariaveisValor) *
        100,
    ) / 100

  const custoTotalCompletoPct =
    salePrice > 0 ? Math.round(((salePrice - lucroUnitario) / salePrice) * 1000) / 10 : 0

  // Fatias percentuais sobre o preço final gerado (deve somar 100%)
  const custoDiretoPct = salePrice > 0 ? (custoDiretoTotal / salePrice) * 100 : 0
  const custoAquisicaoPct = salePrice > 0 ? (custoAquisicao / salePrice) * 100 : 0
  const substTributariaPctDoPreco = salePrice > 0 ? (substTributariaValor / salePrice) * 100 : 0
  const custoFixoRateadoPct = salePrice > 0 ? (custoFixoRateado / salePrice) * 100 : 0
  const custoFixoRealPct = salePrice > 0 ? (custoFixoValor / salePrice) * 100 : 0
  const lucroRealPct = salePrice > 0 ? (lucroUnitario / salePrice) * 100 : 0
  const despesaFixaRealPct = salePrice > 0 ? (despesaFixaValor / salePrice) * 100 : 0
  const custosVariaveisRealPct = salePrice > 0 ? (custosVariaveisValor / salePrice) * 100 : 0

  // Se ST > 0, dividimos a fatia do Custo Total em: Custo Aquisição + Subst. Tributária
  // A soma de (custoAquisicaoPct + substTributariaPctDoPreco) == custoDiretoPct.
  const totalFatiasPct =
    Math.round(
      ((substTributariaValor > 0 ? custoAquisicaoPct + substTributariaPctDoPreco : custoDiretoPct) +
        custoFixoRateadoPct +
        custoFixoRealPct +
        despesaFixaRealPct +
        custosVariaveisRealPct +
        lucroRealPct) *
        100,
    ) / 100

  // Markup sobre o custo (lucro / custoBaseComRateio * 100) para compatibilidade
  const markupSobreCustoPct =
    custoBaseComRateio > 0 ? Math.round((lucroUnitario / custoBaseComRateio) * 10000) / 100 : 0

  return {
    custoProdutoBRL,
    custoProdutoUSD,
    moeda,
    cotacaoDolar: cotacao,
    frete,
    custoAdicional1: adicional1,
    custoAdicional2: adicional2,
    custoFixoRateado,
    custoAquisicao,
    substTributariaPct,
    substTributariaValor,
    custoTotalProduto,
    custoTotalCompleto,
    custoTotalCompletoPct,
    custoDiretoTotal,
    custoBaseComRateio,
    despesaFixaPct,
    taxaCartaoPct,
    icmsPct,
    impostoSaidaPct,
    comissaoPct,
    ipiPct,
    custosVariaveisPct,
    lucratividadePct,
    markupDivisor: Math.round(markupDivisor * 1000) / 1000,
    markupMultiplicador: Math.round(markupDivisor * 100) / 100,
    markupSobreCustoPct,
    salePrice,
    lucroUnitario,
    custoFixoPct,
    fatias: {
      custoTotalCompleto: {
        valor: custoTotalCompleto,
        pct: custoTotalCompletoPct,
      },
      custoDireto: {
        valor: custoDiretoTotal,
        pct: Math.round(custoDiretoPct * 10) / 10,
      },
      custoAquisicao: {
        valor: custoAquisicao,
        pct: Math.round(custoAquisicaoPct * 10) / 10,
      },
      substTributaria: {
        valor: substTributariaValor,
        pct: Math.round(substTributariaPctDoPreco * 10) / 10,
      },
      custoFixoRateado: {
        valor: custoFixoRateado,
        pct: Math.round(custoFixoRateadoPct * 10) / 10,
      },
      custoFixo: {
        valor: custoFixoValor,
        pct: Math.round(custoFixoRealPct * 10) / 10,
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
          impostoSaida: {
            valor: impostoSaidaValor,
            pct: Math.round((impostoSaidaValor / (salePrice || 1)) * 1000) / 10,
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
    cost: custoBaseComRateio,
    despesasPct: Math.round((custoFixoPct + despesaFixaPct + custosVariaveisPct) * 10) / 10,
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
  impostoSaidaPct = 0,
  substTributariaValor = 0,
) {
  const price = Math.max(0, currentPrice)
  const custo = Math.max(0, custoDiretoTotal)

  const despesaFixaValor = Math.round(price * (despesaFixaPct / 100) * 100) / 100
  const cartaoValor = Math.round(price * (taxaCartaoPct / 100) * 100) / 100
  const icmsValor = Math.round(price * (icmsPct / 100) * 100) / 100
  const impostoSaidaValor = Math.round(price * (impostoSaidaPct / 100) * 100) / 100
  const comissaoValor = Math.round(price * (comissaoPct / 100) * 100) / 100
  const ipiValor = Math.round(price * (ipiPct / 100) * 100) / 100
  const custosVariaveisValor =
    Math.round((cartaoValor + icmsValor + impostoSaidaValor + comissaoValor + ipiValor) * 100) / 100

  // Lucro R$ no preço atual
  const lucroUnitario =
    Math.round((price - custo - despesaFixaValor - custosVariaveisValor) * 100) / 100

  const custoTotalCompleto =
    Math.round((custo + despesaFixaValor + custosVariaveisValor) * 100) / 100
  const custoTotalCompletoPct = price > 0 ? Math.round((custoTotalCompleto / price) * 1000) / 10 : 0

  const custoPct = price > 0 ? (custo / price) * 100 : 0
  const despesaFixaRealPct = price > 0 ? (despesaFixaValor / price) * 100 : 0
  const custosVariaveisRealPct = price > 0 ? (custosVariaveisValor / price) * 100 : 0
  const margemLiquidaPct = price > 0 ? (lucroUnitario / price) * 100 : 0

  const substTributariaPctDoPreco = price > 0 ? (substTributariaValor / price) * 100 : 0

  return {
    price,
    custoDiretoTotal: custo,
    custoTotalCompleto,
    custoTotalCompletoPct,
    custoPct: Math.round(custoPct * 10) / 10,
    substTributariaValor,
    substTributariaPctDoPreco: Math.round(substTributariaPctDoPreco * 10) / 10,
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
    custoFixoRateado: 0,
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
