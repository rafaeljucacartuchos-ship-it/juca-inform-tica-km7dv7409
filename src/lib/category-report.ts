import { ServiceOrder, ServiceOrderItem, ServiceCategory, SERVICE_CATEGORY_LABELS } from '@/types'

export interface CategoryReportData {
  category: ServiceCategory | 'none'
  label: string
  orders: ServiceOrder[]
  count: number
  revenue: number
}

export function buildCategoryReport(
  orders: ServiceOrder[],
  items: ServiceOrderItem[],
): CategoryReportData[] {
  const orderCategories = new Map<string, Set<ServiceCategory>>()
  for (const item of items) {
    if (!item.service_order) continue
    const cat = item.expand?.service?.category
    if (!cat) continue
    if (!orderCategories.has(item.service_order)) {
      orderCategories.set(item.service_order, new Set())
    }
    orderCategories.get(item.service_order)!.add(cat)
  }

  const result: CategoryReportData[] = []

  for (const [cat, label] of Object.entries(SERVICE_CATEGORY_LABELS)) {
    const categoryOrders = orders.filter((o) =>
      orderCategories.get(o.id)?.has(cat as ServiceCategory),
    )
    result.push({
      category: cat as ServiceCategory,
      label,
      orders: categoryOrders,
      count: categoryOrders.length,
      revenue: categoryOrders.reduce((s, o) => s + (o.total || 0), 0),
    })
  }

  const noCategoryOrders = orders.filter((o) => !orderCategories.has(o.id))
  result.push({
    category: 'none',
    label: 'Sem Categoria',
    orders: noCategoryOrders,
    count: noCategoryOrders.length,
    revenue: noCategoryOrders.reduce((s, o) => s + (o.total || 0), 0),
  })

  return result
}

export function buildOrderCategoryMap(report: CategoryReportData[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const cat of report) {
    for (const o of cat.orders) {
      const existing = map.get(o.id) || ''
      map.set(o.id, existing ? `${existing}, ${cat.label}` : cat.label)
    }
  }
  return map
}
