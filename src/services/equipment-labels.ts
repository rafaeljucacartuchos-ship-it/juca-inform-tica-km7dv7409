import pb from '@/lib/pocketbase/client'

export type LabelCodeType = 'qr' | 'barcode' | 'both'
export type LabelOrientation = 'landscape' | 'portrait'

export interface LabelPreset {
  id: string
  name: string
  widthMm: number
  heightMm: number
  description: string
  isDefault?: boolean
  isCustom?: boolean
}

export const PRESET_LABEL_SIZES: LabelPreset[] = [
  {
    id: '40x40',
    name: '40 × 40 mm',
    widthMm: 40,
    heightMm: 40,
    description: 'Térmica quadrada (Nome do cliente + QR Code OS centralizado)',
  },
  {
    id: '40x30',
    name: '40 × 30 mm',
    widthMm: 40,
    heightMm: 30,
    description: 'Térmica compacta (pequeno porte / peças / balcão rápido)',
  },
  {
    id: '50x30',
    name: '50 × 30 mm',
    widthMm: 50,
    heightMm: 30,
    description: 'Térmica padrão balcão / identificação ágil',
  },
  {
    id: '60x40',
    name: '60 × 40 mm',
    widthMm: 60,
    heightMm: 40,
    description: 'Térmica universal média (Zebra, Argox, Elgin, Brother, TSC, Datamax)',
    isDefault: true,
  },
  {
    id: '100x50',
    name: '100 × 50 mm',
    widthMm: 100,
    heightMm: 50,
    description: 'Etiqueta ampla para logística / recolhimento externo detalhado',
  },
  {
    id: 'custom',
    name: 'Personalizado',
    widthMm: 60,
    heightMm: 40,
    description: 'Defina largura e altura em milímetros exatos',
    isCustom: true,
  },
]

export interface LabelCustomProfile {
  id: string
  name: string
  widthMm: number
  heightMm: number
  orientation?: LabelOrientation
  marginTopMm?: number
  marginBottomMm?: number
  marginLeftMm?: number
  marginRightMm?: number
  scalePercent?: number
  codeType?: LabelCodeType
  description?: string
  createdAt?: string
}

export interface LabelPrintConfig {
  presetId: string
  widthMm: number
  heightMm: number
  orientation: LabelOrientation
  marginTopMm: number
  marginBottomMm: number
  marginLeftMm: number
  marginRightMm: number
  scalePercent: number // 50% a 150% (escala fina para calibração térmica milimétrica)
  copies: number
  codeType: LabelCodeType
  showSerialNumber: boolean
  showEntryDate: boolean
  showInternalId: boolean
  showTechnician: boolean
  customProfiles: LabelCustomProfile[]
}

export const DEFAULT_LABEL_CONFIG: LabelPrintConfig = {
  presetId: '60x40',
  widthMm: 60,
  heightMm: 40,
  orientation: 'landscape',
  marginTopMm: 1.5,
  marginBottomMm: 1.5,
  marginLeftMm: 2,
  marginRightMm: 2,
  scalePercent: 100,
  copies: 1,
  codeType: 'qr',
  showSerialNumber: true,
  showEntryDate: true,
  showInternalId: true,
  showTechnician: false,
  customProfiles: [],
}

const SETTINGS_KEY = 'equipment_label_config'
const LOCAL_STORAGE_KEY = 'juca_equipment_label_config_v2'
const OLD_LOCAL_STORAGE_KEY = 'juca_equipment_label_config_v1'

/**
 * Carrega a configuração de etiquetas salva no backend (settings) ou no localStorage como fallback rápido.
 */
export async function getEquipmentLabelConfig(): Promise<LabelPrintConfig> {
  // 1. Tenta carregar do localStorage imediatamente
  let localConfig: LabelPrintConfig | null = null
  try {
    const raw =
      localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem(OLD_LOCAL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      localConfig = {
        ...DEFAULT_LABEL_CONFIG,
        ...parsed,
        scalePercent: typeof parsed.scalePercent === 'number' ? parsed.scalePercent : 100,
        customProfiles: Array.isArray(parsed.customProfiles) ? parsed.customProfiles : [],
      }
    }
  } catch {
    /* fallback */
  }

  // 2. Busca do backend se autenticado
  try {
    const records = await pb.collection('settings').getFullList<{ key: string; value: string }>({
      filter: `key = "${SETTINGS_KEY}"`,
      requestKey: null,
    })
    if (records.length > 0 && records[0].value) {
      const serverConfig = JSON.parse(records[0].value)
      const merged: LabelPrintConfig = {
        ...DEFAULT_LABEL_CONFIG,
        ...serverConfig,
        scalePercent:
          typeof serverConfig.scalePercent === 'number' ? serverConfig.scalePercent : 100,
        customProfiles: Array.isArray(serverConfig.customProfiles)
          ? serverConfig.customProfiles
          : localConfig?.customProfiles || [],
      }
      // Atualiza o cache local
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged))
      } catch {
        /* ignore */
      }
      return merged
    }
  } catch {
    /* backend indisponível ou offline */
  }

  return localConfig || DEFAULT_LABEL_CONFIG
}

/**
 * Salva as preferências de etiqueta do usuário na coleção settings e no localStorage.
 */
export async function saveEquipmentLabelConfig(config: LabelPrintConfig): Promise<void> {
  const sanitized: LabelPrintConfig = {
    ...config,
    widthMm: Math.max(15, Math.min(200, Math.round(Number(config.widthMm) || 60))),
    heightMm: Math.max(10, Math.min(200, Math.round(Number(config.heightMm) || 40))),
    marginTopMm: Math.max(0, Math.min(20, Number(config.marginTopMm) || 0)),
    marginBottomMm: Math.max(0, Math.min(20, Number(config.marginBottomMm) || 0)),
    marginLeftMm: Math.max(0, Math.min(20, Number(config.marginLeftMm) || 0)),
    marginRightMm: Math.max(0, Math.min(20, Number(config.marginRightMm) || 0)),
    scalePercent: Math.max(50, Math.min(150, Math.round(Number(config.scalePercent) || 100))),
    copies: Math.max(1, Math.min(50, Math.round(Number(config.copies) || 1))),
    customProfiles: Array.isArray(config.customProfiles) ? config.customProfiles : [],
  }

  // Salva no localStorage imediatamente
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized))
  } catch {
    /* ignore */
  }

  // Tenta persistir no servidor
  try {
    const payload = JSON.stringify(sanitized)
    const records = await pb.collection('settings').getFullList<{ id: string; key: string }>({
      filter: `key = "${SETTINGS_KEY}"`,
      requestKey: null,
    })
    if (records.length > 0) {
      await pb.collection('settings').update(records[0].id, {
        value: payload,
      })
    } else {
      await pb.collection('settings').create({
        key: SETTINGS_KEY,
        value: payload,
        description:
          'Configurações universais de etiquetas térmicas de equipamentos (tamanhos, perfis, margens e escala)',
      })
    }
  } catch (err) {
    console.warn(
      '[EquipmentLabel] Não foi possível salvar configuração no backend (persistido localmente):',
      err,
    )
  }
}
