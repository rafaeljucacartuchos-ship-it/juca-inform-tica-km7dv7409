import pb from '@/lib/pocketbase/client'
import type { LaudoTecnico, ServiceOrder, Equipment, Customer } from '@/types'

const EXPAND_FIELDS =
  'id_ordem,id_orcamento,id_cliente,id_equipamento,tecnico_responsavel,id_ordem.customer,id_ordem.equipment_ref,id_ordem.technician'

/**
 * Deriva número do laudo a partir do número da OS (ex.: OS-0042 -> LAU-0042)
 * ou gera número sequencial no formato LAU-0001, LAU-0002...
 */
export async function generateNextLaudoNumber(osNumber?: string): Promise<string> {
  if (osNumber) {
    const digitsMatch = osNumber.match(/(\d+)/)
    if (digitsMatch) {
      const derived = `LAU-${digitsMatch[1].padStart(4, '0')}`
      // Checa se já existe algum laudo com esse número
      try {
        const existing = await pb.collection('laudos_tecnicos').getFullList<LaudoTecnico>({
          filter: `numero_laudo = "${derived}"`,
        })
        if (existing.length === 0) {
          return derived
        }
        // Se já existe LAU-0042, gera sufixo LAU-0042-2, etc.
        let suffix = 2
        while (true) {
          const candidate = `${derived}-${suffix}`
          const conf = await pb.collection('laudos_tecnicos').getFullList<LaudoTecnico>({
            filter: `numero_laudo = "${candidate}"`,
          })
          if (conf.length === 0) return candidate
          suffix++
        }
      } catch {
        return derived
      }
    }
  }

  // Fallback sequencial
  try {
    const records = await pb.collection('laudos_tecnicos').getFullList<LaudoTecnico>({
      sort: '-created',
      fields: 'id,numero_laudo',
    })
    let maxNum = 0
    const regex = /LAU-(\d+)/
    for (const r of records) {
      const m = r.numero_laudo?.match(regex)
      if (m && m[1]) {
        const val = parseInt(m[1], 10)
        if (val > maxNum) maxNum = val
      }
    }
    return `LAU-${String(maxNum + 1).padStart(4, '0')}`
  } catch {
    return 'LAU-0001'
  }
}

/**
 * Monta o snapshot com os dados do cliente e equipamento cadastrado
 * sem redigitação: modelo, fabricante, nº de série, tipo, cliente, etc.
 */
export function buildSnapshotFromOrderAndEquipment(params: {
  order?: ServiceOrder | null
  equipment?: Equipment | null
  customer?: Customer | null
}) {
  const { order, equipment, customer } = params

  const resolvedCustomer = customer || order?.expand?.customer
  const resolvedEquipment = equipment || order?.expand?.equipment_ref

  let cliente_nome = ''
  let cliente_documento = ''
  let cliente_telefone = ''
  let cliente_endereco = ''

  if (resolvedCustomer) {
    cliente_nome =
      resolvedCustomer.nome_fantasia || resolvedCustomer.razao_social || resolvedCustomer.name || ''
    cliente_documento = resolvedCustomer.cpf_cnpj || ''
    cliente_telefone = resolvedCustomer.celular || resolvedCustomer.phone || ''
    cliente_endereco = resolvedCustomer.endereco
      ? resolvedCustomer.endereco
      : [
          resolvedCustomer.street,
          resolvedCustomer.number ? `nº ${resolvedCustomer.number}` : '',
          resolvedCustomer.bairro ? `Bairro ${resolvedCustomer.bairro}` : '',
          resolvedCustomer.city
            ? `${resolvedCustomer.city}${resolvedCustomer.state ? `/${resolvedCustomer.state}` : ''}`
            : '',
          resolvedCustomer.zip ? `CEP: ${resolvedCustomer.zip}` : '',
        ]
          .filter(Boolean)
          .join(' - ')
  }

  let equipamento_nome = ''
  let equipamento_tipo = ''
  let equipamento_fabricante = ''
  let equipamento_modelo = ''
  let equipamento_serial = ''
  let equipamento_dados_adicionais = ''

  if (resolvedEquipment) {
    equipamento_nome = resolvedEquipment.name || ''
    equipamento_tipo = resolvedEquipment.type || ''
    equipamento_fabricante = resolvedEquipment.brand || ''
    equipamento_modelo = resolvedEquipment.model || ''
    equipamento_serial = resolvedEquipment.serial_number || ''
    equipamento_dados_adicionais = resolvedEquipment.notes || ''
  } else if (order?.equipment) {
    // Texto livre da OS se não tiver registro na tabela equipment
    equipamento_nome = order.equipment
  }

  return {
    cliente_nome,
    cliente_documento,
    cliente_telefone,
    cliente_endereco,
    equipamento_nome,
    equipamento_tipo,
    equipamento_fabricante,
    equipamento_modelo,
    equipamento_serial,
    equipamento_dados_adicionais,
  }
}

export async function getLaudos(options?: {
  id_ordem?: string
  id_orcamento?: string
  status?: string
}): Promise<LaudoTecnico[]> {
  const filters: string[] = []
  if (options?.id_ordem) filters.push(`id_ordem = "${options.id_ordem}"`)
  if (options?.id_orcamento) filters.push(`id_orcamento = "${options.id_orcamento}"`)
  if (options?.status) filters.push(`status = "${options.status}"`)

  try {
    return await pb.collection('laudos_tecnicos').getFullList<LaudoTecnico>({
      filter: filters.length > 0 ? filters.join(' && ') : undefined,
      sort: '-created',
      expand: EXPAND_FIELDS,
    })
  } catch (err) {
    console.error('Erro ao listar laudos técnicos:', err)
    return []
  }
}

export async function getLaudo(id: string): Promise<LaudoTecnico> {
  return await pb.collection('laudos_tecnicos').getOne<LaudoTecnico>(id, {
    expand: EXPAND_FIELDS,
  })
}

export async function getLaudosByOs(osId: string): Promise<LaudoTecnico[]> {
  try {
    return await pb.collection('laudos_tecnicos').getFullList<LaudoTecnico>({
      filter: `id_ordem = "${osId}"`,
      sort: '-created',
      expand: EXPAND_FIELDS,
    })
  } catch {
    return []
  }
}

export async function createLaudo(data: Partial<LaudoTecnico>): Promise<LaudoTecnico> {
  let numero_laudo = data.numero_laudo
  if (!numero_laudo) {
    let osNumber: string | undefined
    if (data.id_ordem) {
      try {
        const order = await pb.collection('service_orders').getOne<ServiceOrder>(data.id_ordem, {
          fields: 'number',
        })
        osNumber = order?.number
      } catch {
        /* ignore */
      }
    }
    numero_laudo = await generateNextLaudoNumber(osNumber)
  }

  const payload: Record<string, any> = {
    status: 'rascunho',
    data_laudo: new Date().toISOString(),
    ...data,
    numero_laudo,
  }

  return await pb.collection('laudos_tecnicos').create<LaudoTecnico>(payload, {
    expand: EXPAND_FIELDS,
  })
}

export async function updateLaudo(id: string, data: Partial<LaudoTecnico>): Promise<LaudoTecnico> {
  return await pb.collection('laudos_tecnicos').update<LaudoTecnico>(id, data, {
    expand: EXPAND_FIELDS,
  })
}

export async function deleteLaudo(id: string): Promise<boolean> {
  return await pb.collection('laudos_tecnicos').delete(id)
}
