import pb from '@/lib/pocketbase/client'
import { PricingHistory, PricingMode, SystemSetting } from '@/types'

const DEFAULT_EXPENSES_SETTING_KEY = 'pricing_default_expenses_pct'
const DEFAULT_MIN_MARGIN_SETTING_KEY = 'pricing_min_margin_pct'

/**
 * Busca a alíquota padrão de despesas variáveis (%) salva em Configurações.
 * Valor padrão caso não configurado: 12% (impostos + cartão + comissões/frete).
 */
export async function getDefaultExpensesPct(): Promise<number> {
  try {
    const records = await pb.collection('settings').getFullList<SystemSetting>({
      filter: `key = "${DEFAULT_EXPENSES_SETTING_KEY}"`,
    })
    if (records.length > 0 && records[0].value) {
      const parsed = parseFloat(records[0].value.replace(',', '.'))
      if (!isNaN(parsed) && parsed >= 0) return parsed
    }
  } catch {
    /* fallback */
  }
  return 12
}

/**
 * Salva a alíquota padrão de despesas variáveis (%) em Configurações.
 */
export async function updateDefaultExpensesPct(pct: number): Promise<void> {
  const value = String(pct)
  try {
    const records = await pb.collection('settings').getFullList<SystemSetting>({
      filter: `key = "${DEFAULT_EXPENSES_SETTING_KEY}"`,
    })
    if (records.length > 0) {
      await pb.collection('settings').update(records[0].id, { value })
    } else {
      await pb.collection('settings').create({
        key: DEFAULT_EXPENSES_SETTING_KEY,
        value,
        description:
          'Percentual padrão de despesas variáveis (impostos/cartão/frete) para precificação',
      })
    }
  } catch (err) {
    console.error('Erro ao salvar despesas padrão:', err)
    throw err
  }
}

/**
 * Busca a margem mínima desejada (%) para alerta de margem muito baixa.
 * Valor padrão caso não configurado: 20%.
 */
export async function getDefaultMinMarginPct(): Promise<number> {
  try {
    const records = await pb.collection('settings').getFullList<SystemSetting>({
      filter: `key = "${DEFAULT_MIN_MARGIN_SETTING_KEY}"`,
    })
    if (records.length > 0 && records[0].value) {
      const parsed = parseFloat(records[0].value.replace(',', '.'))
      if (!isNaN(parsed)) return parsed
    }
  } catch {
    /* fallback */
  }
  return 20
}

/**
 * Salva a margem mínima padrão (%).
 */
export async function updateDefaultMinMarginPct(pct: number): Promise<void> {
  const value = String(pct)
  try {
    const records = await pb.collection('settings').getFullList<SystemSetting>({
      filter: `key = "${DEFAULT_MIN_MARGIN_SETTING_KEY}"`,
    })
    if (records.length > 0) {
      await pb.collection('settings').update(records[0].id, { value })
    } else {
      await pb.collection('settings').create({
        key: DEFAULT_MIN_MARGIN_SETTING_KEY,
        value,
        description: 'Margem de lucro mínima desejada (%) para avisos no módulo de precificação',
      })
    }
  } catch (err) {
    console.error('Erro ao salvar margem mínima:', err)
    throw err
  }
}

/**
 * Registra um cálculo de precificação no histórico.
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
 * Cálculos matemáticos de precificação seguindo os requisitos da tarefa:
 * - Margem % = Lucro Líquido ÷ Preço Final
 * - Markup % = Lucro Líquido ÷ Custo
 * - Preço Final = Custo ÷ (1 - Despesas% - Margem%)
 *
 * Equivalência entre Margem e Markup:
 * Preço = Custo / (1 - d - m)
 * Lucro = Preço * (1 - d) - Custo
 * Lucro / Custo = Markup
 * Logo:
 * Markup = [ (1 - d) / (1 - d - m) ] - 1  ou  m = [ 1 - d ] * (Markup / (1 + Markup + d*...))
 * Mais direto via Preço Final:
 * Dado Margem m (em decimal):
 *   divisor = 1 - despesasDec - margemDec
 *   Se divisor > 0: Preço = Custo / divisor; Lucro = Preço * (1 - despesasDec) - Custo; Markup = Lucro / Custo
 *
 * Dado Markup mk (em decimal):
 *   Preço com markup sobre o custo + despesas:
 *   Lucro = Custo * mk
 *   Como Preço * (1 - despesasDec) = Custo + Lucro = Custo * (1 + mk)
 *   Preço = Custo * (1 + mk) / (1 - despesasDec)
 *   Margem = Lucro / Preço = (Custo * mk) / Preço = mk * (1 - despesasDec) / (1 + mk)
 */

export interface PricingCalculationResult {
  cost: number
  despesasPct: number
  markupPct: number
  margemPct: number
  salePrice: number
  lucroUnitario: number
  lucroPctSobrePreco: number // = margemPct
  isPossible: boolean
  errorMessage?: string
}

export function calculateFromMargem(
  cost: number,
  despesasPct: number,
  margemPct: number,
): PricingCalculationResult {
  const safeCost = Math.max(0, cost)
  const dDec = (despesasPct || 0) / 100
  const mDec = (margemPct || 0) / 100

  const divisor = 1 - dDec - mDec

  if (divisor <= 0.0001) {
    return {
      cost: safeCost,
      despesasPct,
      markupPct: 0,
      margemPct,
      salePrice: 0,
      lucroUnitario: 0,
      lucroPctSobrePreco: margemPct,
      isPossible: false,
      errorMessage: 'A soma de Despesas (%) e Margem (%) deve ser inferior a 100%.',
    }
  }

  const salePrice = safeCost / divisor
  // Lucro líquido = Preço final recebido após despesas - custo
  const revenueAfterExpenses = salePrice * (1 - dDec)
  const lucroUnitario = revenueAfterExpenses - safeCost
  const markupPct = safeCost > 0 ? (lucroUnitario / safeCost) * 100 : 0

  return {
    cost: safeCost,
    despesasPct,
    markupPct: Math.round(markupPct * 100) / 100,
    margemPct,
    salePrice: Math.round(salePrice * 100) / 100,
    lucroUnitario: Math.round(lucroUnitario * 100) / 100,
    lucroPctSobrePreco: margemPct,
    isPossible: true,
  }
}

export function calculateFromMarkup(
  cost: number,
  despesasPct: number,
  markupPct: number,
): PricingCalculationResult {
  const safeCost = Math.max(0, cost)
  const dDec = (despesasPct || 0) / 100
  const mkDec = (markupPct || 0) / 100

  if (dDec >= 0.9999) {
    return {
      cost: safeCost,
      despesasPct,
      markupPct,
      margemPct: 0,
      salePrice: 0,
      lucroUnitario: 0,
      lucroPctSobrePreco: 0,
      isPossible: false,
      errorMessage: 'Despesas (%) não podem ser iguais ou superiores a 100%.',
    }
  }

  // Preço * (1 - d) = Custo * (1 + markup)
  const salePrice = (safeCost * (1 + mkDec)) / (1 - dDec)
  const revenueAfterExpenses = salePrice * (1 - dDec)
  const lucroUnitario = revenueAfterExpenses - safeCost
  const margemPct = salePrice > 0 ? (lucroUnitario / salePrice) * 100 : 0

  return {
    cost: safeCost,
    despesasPct,
    markupPct,
    margemPct: Math.round(margemPct * 100) / 100,
    salePrice: Math.round(salePrice * 100) / 100,
    lucroUnitario: Math.round(lucroUnitario * 100) / 100,
    lucroPctSobrePreco: Math.round(margemPct * 100) / 100,
    isPossible: true,
  }
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
  const markupPct = safeCost > 0 ? (lucroUnitario / safeCost) * 100 : 0

  return {
    cost: safeCost,
    despesasPct,
    markupPct: Math.round(markupPct * 100) / 100,
    margemPct: Math.round(margemPct * 100) / 100,
    salePrice: safePrice,
    lucroUnitario: Math.round(lucroUnitario * 100) / 100,
    lucroPctSobrePreco: Math.round(margemPct * 100) / 100,
    isPossible: true,
  }
}
