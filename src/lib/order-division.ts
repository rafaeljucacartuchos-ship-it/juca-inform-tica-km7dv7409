import { DivisionModel, DivisionParticipantShare, DivisionDetails } from '@/types'

export interface DivisionScenarioConfig {
  id: DivisionModel
  label: string
  description: string
  requiresSecondTech: boolean
  requiresSeller: boolean
}

export const DIVISION_MODELS: DivisionScenarioConfig[] = [
  {
    id: 'single_tech',
    label: '1. Um técnico realiza todo o serviço',
    description:
      'Técnico principal fica com 100% dos serviços (e produtos, se não houver vendedor).',
    requiresSecondTech: false,
    requiresSeller: false,
  },
  {
    id: 'two_techs_split_services',
    label: '2. Dois técnicos trabalham juntos (divisão dos serviços)',
    description: 'Dois técnicos dividem os serviços (50/50 ou personalizado).',
    requiresSecondTech: true,
    requiresSeller: false,
  },
  {
    id: 'two_split_all',
    label: '3. Dois técnicos dividem tanto serviços quanto produtos',
    description: 'Dois técnicos dividem serviços e produtos (50/50 ou personalizado).',
    requiresSecondTech: true,
    requiresSeller: false,
  },
  {
    id: 'tech_and_seller',
    label: '4. Um técnico realiza serviços e um vendedor responde pelos produtos',
    description: 'Técnico principal com 100% dos serviços; Vendedor com 100% dos produtos.',
    requiresSecondTech: false,
    requiresSeller: true,
  },
  {
    id: 'two_techs_and_seller',
    label: '5. Dois técnicos dividem serviços e um vendedor responde pelos produtos',
    description: 'Dois técnicos dividem serviços (50/50); Vendedor com 100% dos produtos.',
    requiresSecondTech: true,
    requiresSeller: true,
  },
  {
    id: 'custom',
    label: 'Personalizado',
    description: 'Defina livremente os percentuais de serviços e produtos para cada participante.',
    requiresSecondTech: false,
    requiresSeller: false,
  },
]

export interface ComputeDivisionParams {
  model: DivisionModel
  isCustom?: boolean
  tech1: { id: string; name: string } | null
  tech2?: { id: string; name: string } | null
  seller?: { id: string; name: string } | null
  totalServices: number
  totalProducts: number
  orderTotal: number
  customPcts?: {
    tech1ServicesPct?: number
    tech1ProductsPct?: number
    tech2ServicesPct?: number
    tech2ProductsPct?: number
    sellerServicesPct?: number
    sellerProductsPct?: number
  }
}

/**
 * Arredondamento exato em centavos com ajuste residual no primeiro participante do grupo,
 * garantindo que a soma dos centavos coincida exatamente com o total do grupo (100% fechado).
 */
export function roundCents(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

export function computeDivisionDetails(params: ComputeDivisionParams): DivisionDetails {
  const {
    model,
    isCustom = false,
    tech1,
    tech2,
    seller,
    totalServices,
    totalProducts,
    orderTotal,
    customPcts = {},
  } = params

  const hasServices = totalServices > 0.009
  const hasProducts = totalProducts > 0.009

  let t1ServPct = 0
  let t1ProdPct = 0
  let t2ServPct = 0
  let t2ProdPct = 0
  let selServPct = 0
  let selProdPct = 0

  if (isCustom || model === 'custom') {
    t1ServPct = customPcts.tech1ServicesPct ?? (tech1 ? 100 : 0)
    t1ProdPct = customPcts.tech1ProductsPct ?? (tech1 && !seller ? 100 : 0)
    t2ServPct = customPcts.tech2ServicesPct ?? 0
    t2ProdPct = customPcts.tech2ProductsPct ?? 0
    selServPct = customPcts.sellerServicesPct ?? 0
    selProdPct = customPcts.sellerProductsPct ?? (seller ? 100 : 0)
  } else {
    switch (model) {
      case 'single_tech':
        t1ServPct = 100
        t1ProdPct = seller ? 0 : 100
        break
      case 'two_techs_split_services':
        t1ServPct = 50
        t2ServPct = 50
        t1ProdPct = seller ? 0 : 50
        t2ProdPct = seller ? 0 : 50
        break
      case 'two_split_all':
        t1ServPct = 50
        t2ServPct = 50
        t1ProdPct = 50
        t2ProdPct = 50
        break
      case 'tech_and_seller':
        t1ServPct = 100
        t1ProdPct = 0
        selProdPct = 100
        break
      case 'two_techs_and_seller':
        t1ServPct = 50
        t2ServPct = 50
        selProdPct = 100
        break
    }
  }

  // Normalização de percentuais: se não existirem produtos na OS, produtosPct pode ser 0
  // Para grupos existentes, a soma deve dar 100%
  const participants: DivisionParticipantShare[] = []

  if (tech1 && tech1.id) {
    participants.push({
      userId: tech1.id,
      userName: tech1.name || 'Técnico Principal',
      role: 'primary_tech',
      servicesPct: t1ServPct,
      productsPct: t1ProdPct,
      servicesAmount: 0,
      productsAmount: 0,
      totalAmount: 0,
    })
  }

  if (tech2 && tech2.id) {
    participants.push({
      userId: tech2.id,
      userName: tech2.name || 'Segundo Técnico',
      role: 'second_tech',
      servicesPct: t2ServPct,
      productsPct: t2ProdPct,
      servicesAmount: 0,
      productsAmount: 0,
      totalAmount: 0,
    })
  }

  if (seller && seller.id) {
    participants.push({
      userId: seller.id,
      userName: seller.name || 'Vendedor',
      role: 'seller',
      servicesPct: selServPct,
      productsPct: selProdPct,
      servicesAmount: 0,
      productsAmount: 0,
      totalAmount: 0,
    })
  }

  // Cálculo de valores com arredondamento em centavos e preservação exata da soma
  // 1) Serviços
  if (hasServices && participants.length > 0) {
    let runningServices = 0
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i]
      if (i === participants.length - 1) {
        // Último participante absorve centavos residuais para garantir totalServices exato
        p.servicesAmount = roundCents(totalServices - runningServices)
      } else {
        p.servicesAmount = roundCents((totalServices * p.servicesPct) / 100)
        runningServices += p.servicesAmount
      }
    }
  }

  // 2) Produtos
  if (hasProducts && participants.length > 0) {
    let runningProducts = 0
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i]
      if (i === participants.length - 1) {
        p.productsAmount = roundCents(totalProducts - runningProducts)
      } else {
        p.productsAmount = roundCents((totalProducts * p.productsPct) / 100)
        runningProducts += p.productsAmount
      }
    }
  }

  // 3) Totais de cada participante
  for (const p of participants) {
    p.totalAmount = roundCents(p.servicesAmount + p.productsAmount)
  }

  return {
    model,
    isCustom,
    configured: participants.length > 0,
    totalServices: roundCents(totalServices),
    totalProducts: roundCents(totalProducts),
    orderTotal: roundCents(orderTotal),
    participants,
  }
}
