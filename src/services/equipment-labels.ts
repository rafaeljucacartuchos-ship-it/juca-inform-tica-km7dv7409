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
}

export const PRESET_LABEL_SIZES: LabelPreset[] = [
  {
    id: '40x30',
    name: '40 × 30 mm',
    widthMm: 40,
    heightMm: 30,
    description: 'Térmica compacta (pequeno porte / bijuteria / joia / peças)',
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
    description: 'Térmica média (Argox, Zebra, Elgin, Bematech)',
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
  },
]

export interface LabelPrintConfig {
  presetId: string
  widthMm: number
  heightMm: number
  orientation: LabelOrientation
  marginTopMm: number
  marginBottomMm: number
  marginLeftMm: number
  marginRightMm: number
  copies: number
  codeType: LabelCodeType
  showSerialNumber: boolean
  showEntryDate: boolean
  showInternalId: boolean
  showTechnician: boolean
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
  copies: 1,
  codeType: 'qr',
  showSerialNumber: true,
  showEntryDate: true,
  showInternalId: true,
  showTechnician: false,
}

const SETTINGS_KEY = 'equipment_label_config'
const LOCAL_STORAGE_KEY = 'juca_equipment_label_config_v1'

/**
 * Carrega a configuração de etiquetas salva no backend (settings) ou no localStorage como fallback rápido.
 */
export async function getEquipmentLabelConfig(): Promise<LabelPrintConfig> {
  // 1. Tenta carregar do localStorage imediatamente
  let localConfig: LabelPrintConfig | null = null
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) {
      localConfig = { ...DEFAULT_LABEL_CONFIG, ...JSON.parse(raw) }
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
      const merged = { ...DEFAULT_LABEL_CONFIG, ...serverConfig }
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
  // Salva no localStorage imediatamente
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config))
  } catch {
    /* ignore */
  }

  // Tenta persistir no servidor
  try {
    const payload = JSON.stringify(config)
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
        description: 'Configurações de dimensões e modelo das etiquetas térmicas de equipamentos',
      })
    }
  } catch (err) {
    console.warn(
      '[EquipmentLabel] Não foi possível salvar configuração no backend (persistido localmente):',
      err,
    )
  }
}
