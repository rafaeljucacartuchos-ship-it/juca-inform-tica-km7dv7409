import pb from '@/lib/pocketbase/client'
import { Product, ServiceOrder, ServiceOrderItem } from '@/types'

export interface ProductMonthlySales {
  month1: number // mês mais recente (M-1)
  month2: number // mês intermediário (M-2)
  month3: number // mês mais antigo (M-3)
  total3Months: number
  averageMonthly: number
  labelMonth1: string
  labelMonth2: string
  labelMonth3: string
}

export interface ProductReplenishmentSuggestion {
  product: Product
  currentStock: number
  sales: ProductMonthlySales
  suggestedQty: number
  fabricante: string
  isZeroStock: boolean
  isCriticalLow: boolean // estoque <= 2
}

export interface ManufacturerOrderGroup {
  fabricante: string
  items: Array<{
    product: Product
    currentStock: number
    suggestedQty: number
    unitCost: number
    totalCost: number
  }>
  totalItems: number
  totalSuggestedUnits: number
  totalEstimatedCost: number
}

/**
 * Retorna os nomes dos últimos 3 meses fechados ou correntes para rótulo
 */
export function getLast3MonthsLabels(): [string, string, string] {
  const now = new Date()
  const monthsNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]

  const getMonthName = (offsetMonths: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1)
    return `${monthsNames[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`
  }

  // month1 = Mês corrente / mais recente, month2 = M-1, month3 = M-2
  return [getMonthName(0), getMonthName(1), getMonthName(2)]
}

/**
 * Carrega todos os itens de O.S. dos últimos 3 meses e calcula as estatísticas de vendas por produto.
 */
export async function calculateReplenishmentData(
  products: Product[],
): Promise<ProductReplenishmentSuggestion[]> {
  const [lbl1, lbl2, lbl3] = getLast3MonthsLabels()
  const now = new Date()

  // Data de corte: 90 dias atrás
  const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const cutoffIso = cutoffDate.toISOString()

  // Buscar itens de O.S. criados após a data de corte com produto vinculado
  let items: ServiceOrderItem[] = []
  try {
    items = (await pb.collection('service_order_items').getFullList({
      filter: `product != "" && created >= "${cutoffIso}"`,
      sort: '-created',
    })) as unknown as ServiceOrderItem[]
  } catch (err) {
    console.warn('[replenishment] Falha ao buscar itens de OS recentes:', err)
  }

  // Mapeia vendas mensais por produtoId: { [productId]: { m1: number, m2: number, m3: number } }
  const salesMap = new Map<string, { m1: number; m2: number; m3: number }>()

  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth()

  items.forEach((item) => {
    const pId = item.product
    if (!pId) return
    const itemDate = new Date(item.created || '')
    const itemYear = itemDate.getFullYear()
    const itemMonth = itemDate.getMonth()

    // Diferença em meses em relação ao mês atual
    const monthDiff = (nowYear - itemYear) * 12 + (nowMonth - itemMonth)
    const qty = item.quantity || 0

    let entry = salesMap.get(pId)
    if (!entry) {
      entry = { m1: 0, m2: 0, m3: 0 }
      salesMap.set(pId, entry)
    }

    if (monthDiff === 0) {
      entry.m1 += qty
    } else if (monthDiff === 1) {
      entry.m2 += qty
    } else if (monthDiff >= 2 && monthDiff <= 3) {
      entry.m3 += qty
    }
  })

  // Monta a sugestão para cada produto cadastrado
  return products
    .filter((p) => (p.type || 'produto') === 'produto') // apenas produtos físicos
    .map((p) => {
      const salesEntry = salesMap.get(p.id) || { m1: 0, m2: 0, m3: 0 }
      const total3 = salesEntry.m1 + salesEntry.m2 + salesEntry.m3
      // Média mensal arredondada
      const avg = total3 / 3
      const currentStock = p.stock_quantity ?? 0

      // Cálculo automático de reposição:
      // Com base no consumo médio dos últimos 3 meses menos o estoque atual,
      // sugerir automaticamente a quantidade de reposição de cada produto (nunca negativa; arredondar para cima).
      // Se a média mensal for 0 mas o produto estiver zerado ou crítico (<= 2), sugerir no mínimo reposição para estoque mínimo padrão (ex: 2 a 3 unidades).
      let suggested = 0
      if (avg > 0) {
        const rawSuggested = avg - currentStock
        suggested = rawSuggested > 0 ? Math.ceil(rawSuggested) : 0
      } else if (currentStock <= 0) {
        // Sugestão mínima de segurança quando zerado sem vendas no trimestre
        suggested = 2
      } else if (currentStock <= 2) {
        suggested = 2 - currentStock > 0 ? 2 - currentStock : 0
      }

      const fabricante = (p.fabricante || '').trim() || 'Sem Fabricante Definido'

      return {
        product: p,
        currentStock,
        sales: {
          month1: salesEntry.m1,
          month2: salesEntry.m2,
          month3: salesEntry.m3,
          total3Months: total3,
          averageMonthly: Number(avg.toFixed(1)),
          labelMonth1: lbl1,
          labelMonth2: lbl2,
          labelMonth3: lbl3,
        },
        suggestedQty: suggested,
        fabricante,
        isZeroStock: currentStock <= 0,
        isCriticalLow: currentStock <= 2,
      }
    })
}

/**
 * Agrupa as sugestões de compra por Fabricante
 */
export function groupByManufacturer(
  suggestions: ProductReplenishmentSuggestion[],
  onlyNeeded = true,
): ManufacturerOrderGroup[] {
  const map = new Map<string, ManufacturerOrderGroup>()

  suggestions.forEach((sug) => {
    if (onlyNeeded && sug.suggestedQty <= 0) return

    const fab = sug.fabricante || 'Sem Fabricante Definido'
    let group = map.get(fab)
    if (!group) {
      group = {
        fabricante: fab,
        items: [],
        totalItems: 0,
        totalSuggestedUnits: 0,
        totalEstimatedCost: 0,
      }
      map.set(fab, group)
    }

    const cost = sug.product.cost || 0
    const totalCost = cost * sug.suggestedQty

    group.items.push({
      product: sug.product,
      currentStock: sug.currentStock,
      suggestedQty: sug.suggestedQty,
      unitCost: cost,
      totalCost,
    })

    group.totalItems += 1
    group.totalSuggestedUnits += sug.suggestedQty
    group.totalEstimatedCost += totalCost
  })

  return Array.from(map.values()).sort((a, b) => a.fabricante.localeCompare(b.fabricante))
}
