import pb from '@/lib/pocketbase/client'

export interface EvaluationRecord {
  id: string
  service_order: string
  technician?: string
  rating: number
  satisfaction: 'nao_gostei' | 'bom' | 'excelente' | 'pode_melhorar'
  feedback?: string
  created: string
  updated: string
  expand?: {
    service_order?: {
      id: string
      number: string
      title: string
      customer?: string
      expand?: {
        customer?: {
          id: string
          name?: string
          razao_social?: string
          nome_fantasia?: string
          phone?: string
          celular?: string
        }
      }
    }
    technician?: {
      id: string
      name: string
      email?: string
    }
  }
}
export interface TechnicianRatingSummary {
  technicianId: string
  technicianName: string
  totalEvaluations: number
  averageRating: number
  satisfactionCounts: {
    nao_gostei: number
    pode_melhorar: number
    bom: number
    excelente: number
  }
}

export async function getEvaluations(filter: string = ''): Promise<EvaluationRecord[]> {
  try {
    const list = await pb.collection('evaluations').getFullList<EvaluationRecord>({
      filter,
      sort: '-created',
      expand: 'service_order,service_order.customer,technician',
    })
    return list
  } catch (err) {
    console.error('Error fetching evaluations:', err)
    return []
  }
}

export async function getTechnicianRatingSummaries(): Promise<TechnicianRatingSummary[]> {
  try {
    const [evaluations, technicians] = await Promise.all([
      getEvaluations(),
      pb.collection('users').getFullList({ filter: 'role = "technician"' }),
    ])

    const summariesMap: Record<string, TechnicianRatingSummary> = {}

    // Initialize map for technicians
    technicians.forEach((tech) => {
      summariesMap[tech.id] = {
        technicianId: tech.id,
        technicianName: tech.name || 'Técnico',
        totalEvaluations: 0,
        averageRating: 0,
        satisfactionCounts: {
          nao_gostei: 0,
          pode_melhorar: 0,
          bom: 0,
          excelente: 0,
        },
      }
    })

    // Catch-all for unassigned/other technicians present in evaluations
    evaluations.forEach((item) => {
      const techId = item.technician || 'unassigned'
      const techName = item.expand?.technician?.name || 'Técnico Desconhecido'

      if (!summariesMap[techId]) {
        summariesMap[techId] = {
          technicianId: techId,
          technicianName: techName,
          totalEvaluations: 0,
          averageRating: 0,
          satisfactionCounts: {
            nao_gostei: 0,
            pode_melhorar: 0,
            bom: 0,
            excelente: 0,
          },
        }
      }

      const summary = summariesMap[techId]
      summary.totalEvaluations += 1
      summary.averageRating += item.rating
      if (item.satisfaction && summary.satisfactionCounts[item.satisfaction] !== undefined) {
        summary.satisfactionCounts[item.satisfaction] += 1
      }
    })

    // Calculate final averages
    const result = Object.values(summariesMap).map((s) => {
      const avg =
        s.totalEvaluations > 0 ? Number((s.averageRating / s.totalEvaluations).toFixed(1)) : 0
      return {
        ...s,
        averageRating: avg,
      }
    })

    // Sort by average rating descending, then total evaluations
    result.sort(
      (a, b) => b.averageRating - a.averageRating || b.totalEvaluations - a.totalEvaluations,
    )

    return result
  } catch (err) {
    console.error('Error computing technician rating summaries:', err)
    return []
  }
}
