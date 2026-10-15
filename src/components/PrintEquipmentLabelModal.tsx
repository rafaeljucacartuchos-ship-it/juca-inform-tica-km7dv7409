import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Printer,
  QrCode,
  Barcode,
  Settings2,
  Copy,
  ExternalLink,
  Laptop,
  Check,
  FileDown,
  BookmarkPlus,
  Trash2,
  Info,
  Sliders,
  RotateCcw,
  RotateCw,
  CheckCircle2,
} from 'lucide-react'
import { ServiceOrder, Equipment, Customer } from '@/types'
import {
  LabelPrintConfig,
  LabelPreset,
  LabelCustomProfile,
  PRESET_LABEL_SIZES,
  getEquipmentLabelConfig,
  saveEquipmentLabelConfig,
  DEFAULT_LABEL_CONFIG,
} from '@/services/equipment-labels'
import { EquipmentLabelContent } from './EquipmentLabelContent'
import { toast } from '@/hooks/use-toast'

/** Limita o deslocamento fino ao intervalo seguro de calibração (-10 a +10 mm), em passos de 0,5 mm */
const clampOffsetMm = (v: number) => Math.max(-10, Math.min(10, Math.round(v * 2) / 2))

export interface PrintEquipmentLabelModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ServiceOrder
  customer?: Customer | null
  // Lista opcional de equipamentos da OS (para OS com múltiplos equipamentos ou selecionável)
  equipmentsList?: Equipment[]
  // Equipamento pré-selecionado, caso venha de um contexto específico
  initialEquipment?: Equipment | null
  attendanceTypeLabel?: string
  technicianName?: string
  // Contexto de chamada (ex: 'new_order', 'detail', 'external_attendance')
  context?: 'new_order' | 'detail' | 'external_attendance'
}

export const PrintEquipmentLabelModal: React.FC<PrintEquipmentLabelModalProps> = ({
  open,
  onOpenChange,
  order,
  customer,
  equipmentsList = [],
  initialEquipment,
  attendanceTypeLabel,
  technicianName,
  context = 'detail',
}) => {
  const [config, setConfig] = useState<LabelPrintConfig>(DEFAULT_LABEL_CONFIG)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('')
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [activeTab, setActiveTab] = useState<'preview' | 'config' | 'guide'>('preview')
  const [isCopiedLink, setIsCopiedLink] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [showSaveProfileDialog, setShowSaveProfileDialog] = useState(false)
  const printAreaRef = useRef<HTMLDivElement>(null)

  // Etiqueta quadrada 40 × 40 mm (orientação fixa em retrato + nota de calibração de driver)
  const isSquare40x40 =
    Math.abs(config.widthMm - 40) <= 0.5 && Math.abs(config.heightMm - 40) <= 0.5

  // Transform de calibração: rotação manual (0°/90°) + deslocamento fino em mm.
  // A ordem "translate antes de rotate" mantém o deslocamento nos eixos visuais da etiqueta,
  // exatamente como o usuário vê na pré-visualização. A página física continua inalterada —
  // apenas o conteúdo gira/desloca dentro dela (compensa drivers que giram a impressão).
  const calibrationTransform = `translate(${config.offsetXmm || 0}mm, ${config.offsetYmm || 0}mm) rotate(${config.rotationDeg === 90 ? 90 : 0}deg)`

  // Carrega configurações persistidas ao abrir
  useEffect(() => {
    if (open) {
      getEquipmentLabelConfig().then((loaded) => {
        setConfig(loaded)
      })
      setShowSaveProfileDialog(false)
      setNewProfileName('')
    }
  }, [open])

  // Define equipamento selecionado
  useEffect(() => {
    if (initialEquipment?.id) {
      setSelectedEquipmentId(initialEquipment.id)
    } else if (order.equipment_ref) {
      setSelectedEquipmentId(order.equipment_ref)
    } else if (equipmentsList.length > 0) {
      setSelectedEquipmentId(equipmentsList[0].id)
    } else {
      setSelectedEquipmentId('')
    }
  }, [open, initialEquipment, order.equipment_ref, equipmentsList])

  // Resolve equipamento atual
  const currentEquipment: Equipment | null = React.useMemo(() => {
    if (selectedEquipmentId) {
      const found = equipmentsList.find((e) => e.id === selectedEquipmentId)
      if (found) return found
    }
    if (initialEquipment) return initialEquipment
    // Fallback: se existir expand.equipment_ref na OS
    if (order.expand?.equipment_ref) {
      return order.expand.equipment_ref
    }
    // Fallback secundário: objeto construído a partir de order.equipment
    if (order.equipment) {
      return {
        id: order.equipment_ref || 'os_equip',
        customer: order.customer,
        name: order.equipment,
        notes: '',
        created: order.created,
        updated: order.updated,
      } as Equipment
    }
    return null
  }, [selectedEquipmentId, equipmentsList, initialEquipment, order])

  // Lista unificada de perfis (Padrões de fábrica + Perfis customizados salvos pelo usuário)
  const allProfiles: Array<{
    id: string
    name: string
    widthMm: number
    heightMm: number
    description: string
    isDefault?: boolean
    isCustom?: boolean
    profileData?: LabelCustomProfile
  }> = React.useMemo(() => {
    const standard = PRESET_LABEL_SIZES.map((p) => ({
      ...p,
      isCustom: p.id === 'custom',
    }))
    const customs = (config.customProfiles || []).map((cp) => ({
      id: `profile_${cp.id}`,
      name: cp.name,
      widthMm: cp.widthMm,
      heightMm: cp.heightMm,
      description: cp.description || `Perfil salvo: ${cp.widthMm} × ${cp.heightMm} mm`,
      isDefault: false,
      isCustom: true,
      profileData: cp,
    }))
    return [...standard, ...customs]
  }, [config.customProfiles])

  // Presets de tamanho ou seleção de perfil salvo
  const handleProfileSelect = (presetId: string) => {
    const foundCustom = config.customProfiles?.find((cp) => `profile_${cp.id}` === presetId)
    if (foundCustom) {
      setConfig((prev) => ({
        ...prev,
        presetId,
        widthMm: foundCustom.widthMm,
        heightMm: foundCustom.heightMm,
        orientation: foundCustom.orientation || prev.orientation,
        marginTopMm: foundCustom.marginTopMm ?? prev.marginTopMm,
        marginBottomMm: foundCustom.marginBottomMm ?? prev.marginBottomMm,
        marginLeftMm: foundCustom.marginLeftMm ?? prev.marginLeftMm,
        marginRightMm: foundCustom.marginRightMm ?? prev.marginRightMm,
        scalePercent: foundCustom.scalePercent ?? prev.scalePercent,
        rotationDeg: foundCustom.rotationDeg === 90 ? 90 : 0,
        offsetXmm: typeof foundCustom.offsetXmm === 'number' ? foundCustom.offsetXmm : 0,
        offsetYmm: typeof foundCustom.offsetYmm === 'number' ? foundCustom.offsetYmm : 0,
        codeType: foundCustom.codeType || prev.codeType,
      }))
      toast({
        title: `Perfil "${foundCustom.name}" aplicado`,
        description: `${foundCustom.widthMm} × ${foundCustom.heightMm} mm com margens e escala personalizadas.`,
      })
      return
    }

    const foundStandard = PRESET_LABEL_SIZES.find((p) => p.id === presetId)
    if (foundStandard) {
      if (presetId === 'custom') {
        setConfig((prev) => ({
          ...prev,
          presetId,
        }))
      } else {
        setConfig((prev) => ({
          ...prev,
          presetId,
          widthMm: foundStandard.widthMm,
          heightMm: foundStandard.heightMm,
        }))
      }
    }
  }

  // Salvar a configuração atual como um novo perfil personalizado
  const handleCreateCustomProfile = () => {
    const trimmed = newProfileName.trim()
    if (!trimmed) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para o perfil (ex: Argox 50x30, Zebra Gaveta, Balcão Mini).',
        variant: 'destructive',
      })
      return
    }

    const newProfile: LabelCustomProfile = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: trimmed,
      widthMm: config.widthMm,
      heightMm: config.heightMm,
      orientation: config.orientation,
      marginTopMm: config.marginTopMm,
      marginBottomMm: config.marginBottomMm,
      marginLeftMm: config.marginLeftMm,
      marginRightMm: config.marginRightMm,
      scalePercent: config.scalePercent,
      rotationDeg: config.rotationDeg === 90 ? 90 : 0,
      offsetXmm: config.offsetXmm || 0,
      offsetYmm: config.offsetYmm || 0,
      codeType: config.codeType,
      description: `${trimmed} (${config.widthMm} × ${config.heightMm} mm • ${config.scalePercent}%)`,
      createdAt: new Date().toISOString(),
    }

    const updatedProfiles = [...(config.customProfiles || []), newProfile]
    const updatedConfig: LabelPrintConfig = {
      ...config,
      presetId: `profile_${newProfile.id}`,
      customProfiles: updatedProfiles,
    }

    setConfig(updatedConfig)
    setNewProfileName('')
    setShowSaveProfileDialog(false)

    // Persiste imediatamente
    saveEquipmentLabelConfig(updatedConfig)
      .then(() => {
        toast({
          title: 'Perfil de etiqueta salvo!',
          description: `"${newProfile.name}" agora está disponível na lista de modelos.`,
        })
      })
      .catch(() => {
        toast({
          title: 'Perfil salvo localmente',
          description: 'Disponível neste dispositivo.',
        })
      })
  }

  // Excluir um perfil personalizado
  const handleDeleteCustomProfile = (
    profileId: string,
    profileName: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()
    const updatedProfiles = (config.customProfiles || []).filter((cp) => cp.id !== profileId)
    const isCurrent = config.presetId === `profile_${profileId}`
    const updatedConfig: LabelPrintConfig = {
      ...config,
      presetId: isCurrent ? '60x40' : config.presetId,
      widthMm: isCurrent ? 60 : config.widthMm,
      heightMm: isCurrent ? 40 : config.heightMm,
      customProfiles: updatedProfiles,
    }
    setConfig(updatedConfig)
    saveEquipmentLabelConfig(updatedConfig).then(() => {
      toast({
        title: 'Perfil removido',
        description: `O perfil "${profileName}" foi excluído.`,
      })
    })
  }

  // Redefinir margens e escala para padrão universal (evita cortes)
  const handleResetCalibration = () => {
    setConfig((prev) => ({
      ...prev,
      marginTopMm: 1.5,
      marginBottomMm: 1.5,
      marginLeftMm: 2,
      marginRightMm: 2,
      scalePercent: 100,
      rotationDeg: 0,
      offsetXmm: 0,
      offsetYmm: 0,
    }))
    toast({
      title: 'Calibração redefinida',
      description:
        'Valores restaurados para o padrão seguro: margens 1.5/2mm, escala 100%, rotação 0° e deslocamento 0mm.',
    })
  }

  // Salvar preferências
  const handleSavePreferences = async () => {
    setIsSavingConfig(true)
    try {
      await saveEquipmentLabelConfig(config)
      toast({
        title: 'Preferências salvas',
        description: 'Padrão de etiqueta e medidas salvos com sucesso.',
      })
    } catch {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível persistir as preferências.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingConfig(false)
    }
  }

  // Disparo da impressão nativa universal com CSS @page em milímetros exatos
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=650')
    if (!printWindow) {
      toast({
        title: 'Bloqueador de pop-ups detectado',
        description: 'Permita pop-ups para abrir a janela de impressão da etiqueta térmica.',
        variant: 'destructive',
      })
      return
    }

    const { widthMm, heightMm, orientation, copies } = config
    const copiesCount = Math.max(1, copies || 1)
    const copiesArray = Array.from({ length: copiesCount })

    // REGRA 40 × 40 MM (etiqueta quadrada): NENHUMA rotação/orientação automática é aplicada.
    // Para 40×40 mm a sintaxe @page com keyword de orientação misturada a comprimentos (ex: "40mm 40mm portrait")
    // é inválida segundo o CSS Paged Media. Usa-se estritamente "size: 40mm 40mm;" com "margin: 0;" sem keyword de orientação.
    // Demais tamanhos mantêm sua declaração com orientação configurada.
    const pageSizeDeclaration = isSquare40x40
      ? `${widthMm}mm ${heightMm}mm`
      : `${widthMm}mm ${heightMm}mm ${orientation}`

    // Conteúdo HTML da etiqueta estilizada
    const labelHtml = printAreaRef.current?.innerHTML || ''
    const copiesHtml = copiesArray
      .map(
        () => `
      <div class="thermal-label-sheet">
        ${labelHtml}
      </div>
    `,
      )
      .join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Etiqueta OS ${order.number || order.id.slice(0, 6)} - JUCA INFORMÁTICA</title>
        <style>
          /* REQUISITO UNIVERSAL: Impressão milimétrica direta para Zebra, Argox, Elgin, Brother, TSC, Datamax e genéricas.
             Para o ramo 40 × 40 mm a regra CSS @page é estritamente "size: 40mm 40mm; margin: 0;",
             sem keyword de orientação inválida, evitando qualquer rotação involuntária do driver/navegador. */
          @page {
            size: ${pageSizeDeclaration};
            margin: 0 !important;
          }
          @media print {
            @page {
              size: ${pageSizeDeclaration};
              margin: 0 !important;
            }
          }
          * {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${widthMm}mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            text-rendering: geometricPrecision;
            /* ANTI-PÁGINA-EM-BRANCO: nada pode transbordar e criar uma folha extra */
            height: auto !important;
            overflow: hidden !important;
          }
          .thermal-label-sheet {
            width: ${widthMm}mm !important;
            height: ${heightMm}mm !important;
            display: flex;
            align-items: stretch;
            justify-content: stretch;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden;
            background: #ffffff;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          /* A ÚLTIMA cópia NÃO recebe quebra de página — quebra após a última etiqueta é o que
             gerava a etiqueta/página EM BRANCO EXTRA antes/imediatamente após o conteúdo. */
          .thermal-label-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .thermal-label-sheet:not(:last-child) {
            page-break-after: always !important;
            break-after: page !important;
          }
          /* Sem bordas/sombras na impressão: qualquer pixel extra fora dos mm da etiqueta vira página em branco */
          @media print {
            .thermal-label-sheet {
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
          }
          /* Garante alto contraste térmico e sem sombras */
          svg {
            shape-rendering: crispEdges !important;
          }
          @media screen {
            body {
              background: #f1f5f9;
              padding: 24px;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 16px;
            }
            .thermal-label-sheet {
              background: #ffffff;
              box-shadow: 0 4px 10px rgba(0,0,0,0.15);
              border: 1px dashed #cbd5e1;
              border-radius: 3px;
            }
            .screen-hint {
              background: #ffffff;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 12px 18px;
              max-width: 500px;
              font-size: 13px;
              color: #334155;
              text-align: center;
            }
          }
          @media print {
            .screen-hint {
              display: none !important;
            }
            body {
              background: #ffffff !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="screen-hint">
          <strong>Preparando impressão térmica universal...</strong>
          <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">
            No diálogo de impressão: selecione a sua impressora térmica (ou "Salvar como PDF"), defina as margens como <strong>Nenhuma</strong> e a escala como <strong>Padrão (100%)</strong> (desmarque "Ajustar à página" / "Fit to page" para evitar deslocamento).
          </p>
        </div>
        ${copiesHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 350);
          };
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Gerar PDF / Exportar milimetricamente
  const handleDownloadPDF = () => {
    const is40x40 = Math.abs(config.widthMm - 40) <= 0.5 && Math.abs(config.heightMm - 40) <= 0.5
    toast({
      title: 'Gerando PDF com dimensões exatas',
      description: `Na janela aberta, escolha "Salvar como PDF" com tamanho ${config.widthMm} × ${config.heightMm} mm, margens "Nenhuma" e orientação ${
        is40x40 ? 'RETRATO (fixa — etiqueta quadrada, sem rotação)' : 'igual à configurada'
      }.`,
    })
    handlePrint()
  }

  // Copiar link da OS
  const handleCopyLink = () => {
    const url = `${window.location.origin}/ordens/${order.id}`
    navigator.clipboard.writeText(url)
    setIsCopiedLink(true)
    setTimeout(() => setIsCopiedLink(false), 2000)
    toast({
      title: 'Link copiado!',
      description: 'O link seguro de acesso à OS foi copiado para a área de transferência.',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-xl">
        <DialogHeader className="px-6 py-4 border-b border-border bg-slate-50 dark:bg-slate-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  Etiqueta de Equipamento
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    OS #{order.number || order.id.slice(0, 6)}
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Identificação para balcão e recolhimento externo • Impressão térmica e
                  convencional
                </p>
              </div>
            </div>

            {context === 'external_attendance' && (
              <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-1 rounded-md border border-amber-300">
                Recolhimento Externo
              </span>
            )}
          </div>
        </DialogHeader>

        {/* MÚLTIPLOS EQUIPAMENTOS: SELETOR SE HOUVER MAIS DE UM */}
        {equipmentsList.length > 1 && (
          <div className="px-6 py-2.5 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-200/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-950 dark:text-blue-200">
              <Laptop className="w-4 h-4 text-blue-600" />
              <span>Esta OS possui múltiplos equipamentos vinculados:</span>
            </div>
            <div className="w-64">
              <Select
                value={selectedEquipmentId}
                onValueChange={(val) => setSelectedEquipmentId(val)}
              >
                <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Selecione o equipamento" />
                </SelectTrigger>
                <SelectContent>
                  {equipmentsList.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id} className="text-xs">
                      {eq.type} {eq.brand} {eq.model || ''} ({eq.serial_number || 'Sem S/N'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'preview' | 'config' | 'guide')}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 pt-3 pb-1 border-b border-border bg-background flex items-center justify-between">
            <TabsList className="grid grid-cols-3 w-80 h-8">
              <TabsTrigger value="preview" className="text-xs font-medium">
                Pré-visualização
              </TabsTrigger>
              <TabsTrigger value="config" className="text-xs font-medium flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" />
                Tamanho / Margens
              </TabsTrigger>
              <TabsTrigger value="guide" className="text-xs font-medium flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Compatibilidade
              </TabsTrigger>
            </TabsList>

            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {config.widthMm} × {config.heightMm} mm
              </span>
              <span>•</span>
              <span className="text-[11px]">Escala: {config.scalePercent || 100}%</span>
              {(config.rotationDeg === 90 || config.offsetXmm || config.offsetYmm) && (
                <>
                  <span>•</span>
                  <span className="text-[11px]">
                    Rotação {config.rotationDeg === 90 ? '90°' : '0°'} • Desloc.{' '}
                    {config.offsetXmm || 0} / {config.offsetYmm || 0} mm
                  </span>
                </>
              )}
              <span>•</span>
              <span className="capitalize font-medium text-foreground">
                {config.codeType === 'qr'
                  ? 'QR Code'
                  : config.codeType === 'barcode'
                    ? 'Cód. Barras'
                    : 'QR + Barras'}
              </span>
            </div>
          </div>

          {/* ABA 1: PRÉ-VISUALIZAÇÃO */}
          <TabsContent
            value="preview"
            className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-slate-100/70 dark:bg-slate-950/40 m-0"
          >
            <div className="w-full flex flex-col items-center gap-4">
              <div className="text-xs text-muted-foreground text-center flex items-center gap-2">
                <span>Visualização em escala real com as dimensões configuradas:</span>
              </div>

              {/* ALERTA INFORMATIVO CASO O TAMANHO SEJA 40x40 MM */}
              {Math.abs(config.widthMm - 40) <= 0.5 && Math.abs(config.heightMm - 40) <= 0.5 && (
                <div className="w-full max-w-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg p-2.5 text-xs text-emerald-900 dark:text-emerald-200 text-center">
                  <strong>Layout Simplificado 40 × 40 mm Ativo:</strong> Exibição exclusiva do Nome
                  do Cliente e QR Code centralizado da OS.
                </div>
              )}

              {/* MOLDURA DE VISUALIZAÇÃO COM SOMBRA E BORDA SIMULANDO A ETIQUETA ADESIVA */}
              <div className="p-4 bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-lg shadow-md flex items-center justify-center max-w-full overflow-auto">
                <div
                  ref={printAreaRef}
                  className="bg-white text-black shadow-sm border border-dashed border-neutral-300"
                  style={{
                    width: `${config.widthMm}mm`,
                    height: `${config.heightMm}mm`,
                    boxSizing: 'border-box',
                    // Igual à janela de impressão (.thermal-label-sheet): conteúdo fora dos
                    // milímetros físicos da etiqueta é cortado, na tela e no papel.
                    overflow: 'hidden',
                  }}
                >
                  {/* CALIBRAÇÃO: rotação 0°/90° e deslocamento fino aplicados DENTRO da página
                      física — o wrapper entra no innerHTML capturado pela janela de impressão,
                      então pré-visualização e papel recebem exatamente o mesmo transform. */}
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      transform: calibrationTransform,
                      transformOrigin: 'center center',
                    }}
                  >
                    <EquipmentLabelContent
                      data={{
                        order,
                        equipment: currentEquipment,
                        customer,
                        attendanceTypeLabel,
                        technicianName,
                      }}
                      config={config}
                    />
                  </div>
                </div>
              </div>

              {/* AÇÕES DE SUPORTE */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={handleCopyLink}
                >
                  {isCopiedLink ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {isCopiedLink ? 'Copiado!' : 'Copiar URL do QR Code'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-blue-600 hover:text-blue-700"
                  asChild
                >
                  <a href={`/ordens/${order.id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir link da OS
                  </a>
                </Button>
              </div>

              {context === 'external_attendance' && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 px-3 py-2 rounded-lg text-xs max-w-lg text-center">
                  <strong>Dica para atendimento externo:</strong> Você pode visualizar a etiqueta
                  agora no celular para conferência e realizar a impressão física na empresa ao
                  retornar com o equipamento recolhido.
                </div>
              )}
            </div>
          </TabsContent>

          {/* ABA 2: CONFIGURAÇÕES DE TAMANHO, PERFIS, MARGENS E ESCALA */}
          <TabsContent
            value="config"
            className="flex-1 overflow-y-auto p-6 space-y-6 m-0 bg-background"
          >
            {/* PERFIS DE ETIQUETAS (PADRÕES + SALVOS) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">
                    Perfis de Etiquetas Térmicas (Compatibilidade Universal)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Selecione um tamanho predefinido ou escolha um perfil salvo para sua impressora.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveProfileDialog((prev) => !prev)}
                  className="h-8 text-xs gap-1.5"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-primary" />
                  Salvar Perfil Atual
                </Button>
              </div>

              {/* FORMULÁRIO RÁPIDO PARA SALVAR PERFIL */}
              {showSaveProfileDialog && (
                <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary">
                      Salvar medidas atuais ({config.widthMm} × {config.heightMm} mm) como novo
                      perfil:
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground"
                      onClick={() => setShowSaveProfileDialog(false)}
                    >
                      ×
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: Argox Balcão, Zebra Gaveta, 50x30 Compacta"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      className="h-8 text-xs bg-white dark:bg-slate-900"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1 shrink-0"
                      onClick={handleCreateCustomProfile}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Salvar
                    </Button>
                  </div>
                </div>
              )}

              {/* GRID DE PERFIS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {allProfiles.map((profile) => {
                  const isSelected = config.presetId === profile.id
                  return (
                    <div
                      key={profile.id}
                      onClick={() => handleProfileSelect(profile.id)}
                      className={`text-left p-3 rounded-lg border text-xs transition-all flex flex-col justify-between cursor-pointer relative ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-foreground">{profile.name}</span>
                        {profile.isDefault && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
                            Padrão
                          </span>
                        )}
                        {profile.profileData && (
                          <button
                            type="button"
                            title="Remover perfil salvo"
                            className="text-muted-foreground hover:text-destructive p-1"
                            onClick={(e) =>
                              handleDeleteCustomProfile(
                                profile.profileData!.id,
                                profile.profileData!.name,
                                e,
                              )
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <span className="text-muted-foreground mt-1.5 text-[11px] line-clamp-2">
                        {profile.description}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* DIMENSÕES MANUAIS, CÓPIAS E ORIENTAÇÃO */}
            <div className="space-y-3 pt-2 border-t border-border">
              <Label className="text-xs font-semibold">
                Dimensões Físicas da Etiqueta (em milímetros)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-lg border border-border">
                <div className="space-y-1">
                  <Label htmlFor="widthMm" className="text-xs">
                    Largura (mm)
                  </Label>
                  <Input
                    id="widthMm"
                    type="number"
                    min="15"
                    max="200"
                    value={config.widthMm}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        presetId: 'custom',
                        widthMm: Math.max(15, Number(e.target.value) || 15),
                      }))
                    }
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="heightMm" className="text-xs">
                    Altura (mm)
                  </Label>
                  <Input
                    id="heightMm"
                    type="number"
                    min="10"
                    max="200"
                    value={config.heightMm}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        presetId: 'custom',
                        heightMm: Math.max(10, Number(e.target.value) || 10),
                      }))
                    }
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="copies" className="text-xs">
                    Quantidade de Cópias
                  </Label>
                  <Input
                    id="copies"
                    type="number"
                    min="1"
                    max="50"
                    value={config.copies}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        copies: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                      }))
                    }
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Orientação</Label>
                  {Math.abs(config.widthMm - 40) <= 0.5 && Math.abs(config.heightMm - 40) <= 0.5 ? (
                    <div
                      className="h-8 flex items-center px-2 rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300"
                      title="Etiqueta quadrada 40 × 40 mm: a orientação é sempre retrato (sem rotação de 90°)."
                    >
                      Retrato (fixo — quadrada)
                    </div>
                  ) : (
                    <Select
                      value={config.orientation}
                      onValueChange={(val: 'landscape' | 'portrait') =>
                        setConfig((prev) => ({ ...prev, orientation: val }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="landscape" className="text-xs">
                          Paisagem (Horizontal)
                        </SelectItem>
                        <SelectItem value="portrait" className="text-xs">
                          Retrato (Vertical)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>

            {/* CONTROLE DE MARGENS E ESCALA (ANTI-CORTE TÉRMICO) */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-primary" />
                    Calibração de Margens e Escala (Anti-Corte e Ajuste Fino)
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Ajuste fino caso a cabeça de impressão da sua impressora corte as bordas ou o
                    sensor de etiqueta desloque a área útil.
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetCalibration}
                  className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3 h-3" />
                  Redefinir
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-lg border border-border">
                <div className="space-y-1">
                  <Label htmlFor="marginTopMm" className="text-[11px]">
                    Margem Sup. (mm)
                  </Label>
                  <Input
                    id="marginTopMm"
                    type="number"
                    step="0.5"
                    min="0"
                    max="15"
                    value={config.marginTopMm}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        marginTopMm: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="marginBottomMm" className="text-[11px]">
                    Margem Inf. (mm)
                  </Label>
                  <Input
                    id="marginBottomMm"
                    type="number"
                    step="0.5"
                    min="0"
                    max="15"
                    value={config.marginBottomMm}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        marginBottomMm: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="marginLeftMm" className="text-[11px]">
                    Margem Esq. (mm)
                  </Label>
                  <Input
                    id="marginLeftMm"
                    type="number"
                    step="0.5"
                    min="0"
                    max="15"
                    value={config.marginLeftMm}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        marginLeftMm: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="marginRightMm" className="text-[11px]">
                    Margem Dir. (mm)
                  </Label>
                  <Input
                    id="marginRightMm"
                    type="number"
                    step="0.5"
                    min="0"
                    max="15"
                    value={config.marginRightMm}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        marginRightMm: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="scalePercent" className="text-[11px]">
                    Escala Conteúdo (%)
                  </Label>
                  <Input
                    id="scalePercent"
                    type="number"
                    step="5"
                    min="50"
                    max="150"
                    value={config.scalePercent || 100}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        scalePercent: Math.max(50, Math.min(150, Number(e.target.value) || 100)),
                      }))
                    }
                    className="h-8 text-xs bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* ROTAÇÃO E DESLOCAMENTO FINO (CALIBRAÇÃO DE DRIVER TÉRMICO) */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5 text-primary" />
                  Rotação da Impressão e Deslocamento (Calibração do Driver)
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Use quando a etiqueta sair girada em 90° ou deslocada no papel: o driver da
                  impressora térmica pode girar a impressão independentemente do sistema. A
                  pré-visualização reflete o ajuste em escala real.
                </p>
              </div>

              {isSquare40x40 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 text-[11px] text-amber-900 dark:text-amber-200">
                  <strong>40 × 40 mm:</strong> Se a etiqueta sair girada ou deslocada na impressora,
                  ajuste <strong>Rotação</strong> e <strong>Deslocamento</strong> aqui até calibrar
                  com o seu driver. (Orientação permanece fixa em retrato para etiqueta quadrada.)
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-lg border border-border">
                <div className="space-y-1">
                  <Label className="text-[11px]">Rotação da impressão</Label>
                  <Select
                    value={config.rotationDeg === 90 ? '90' : '0'}
                    onValueChange={(val) =>
                      setConfig((prev) => ({ ...prev, rotationDeg: val === '90' ? 90 : 0 }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" className="text-xs">
                        0° (padrão)
                      </SelectItem>
                      <SelectItem value="90" className="text-xs">
                        90° (compensa driver que gira a impressão)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="offsetXmm" className="text-[11px]">
                    Deslocamento horizontal (mm)
                  </Label>
                  <Input
                    id="offsetXmm"
                    type="number"
                    step="0.5"
                    min="-10"
                    max="10"
                    value={config.offsetXmm || 0}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '' || raw === '-') {
                        setConfig((prev) => ({ ...prev, offsetXmm: 0 }))
                        return
                      }
                      const parsed = parseFloat(raw)
                      if (Number.isFinite(parsed)) {
                        setConfig((prev) => ({ ...prev, offsetXmm: clampOffsetMm(parsed) }))
                      }
                    }}
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="offsetYmm" className="text-[11px]">
                    Deslocamento vertical (mm)
                  </Label>
                  <Input
                    id="offsetYmm"
                    type="number"
                    step="0.5"
                    min="-10"
                    max="10"
                    value={config.offsetYmm || 0}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '' || raw === '-') {
                        setConfig((prev) => ({ ...prev, offsetYmm: 0 }))
                        return
                      }
                      const parsed = parseFloat(raw)
                      if (Number.isFinite(parsed)) {
                        setConfig((prev) => ({ ...prev, offsetYmm: clampOffsetMm(parsed) }))
                      }
                    }}
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* TIPO DE CÓDIGO (QR CODE OU CÓDIGO DE BARRAS) */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-xs font-semibold">Identificador Escaneável</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, codeType: 'qr' }))}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    config.codeType === 'qr'
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  QR Code (Link Seguro OS)
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, codeType: 'barcode' }))}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    config.codeType === 'barcode'
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <Barcode className="w-4 h-4" />
                  Cód. Barras (128)
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, codeType: 'both' }))}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    config.codeType === 'both'
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  Ambos (QR + Barras)
                </button>
              </div>
            </div>

            {/* ELEMENTOS OPCIONAIS */}
            <div className="space-y-3 pt-2 border-t border-border">
              <Label className="text-xs font-semibold">Campos e Detalhes da Etiqueta</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-2 rounded border border-border">
                  <span className="text-xs">Número de Série (S/N)</span>
                  <Switch
                    checked={config.showSerialNumber}
                    onCheckedChange={(val) =>
                      setConfig((prev) => ({ ...prev, showSerialNumber: val }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded border border-border">
                  <span className="text-xs">Data de Entrada / Recolhimento</span>
                  <Switch
                    checked={config.showEntryDate}
                    onCheckedChange={(val) =>
                      setConfig((prev) => ({ ...prev, showEntryDate: val }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded border border-border">
                  <span className="text-xs">ID Interno do Equipamento</span>
                  <Switch
                    checked={config.showInternalId}
                    onCheckedChange={(val) =>
                      setConfig((prev) => ({ ...prev, showInternalId: val }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded border border-border">
                  <span className="text-xs">Nome do Técnico Responsável</span>
                  <Switch
                    checked={config.showTechnician}
                    onCheckedChange={(val) =>
                      setConfig((prev) => ({ ...prev, showTechnician: val }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSavePreferences}
                disabled={isSavingConfig}
                className="text-xs gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                {isSavingConfig ? 'Salvando...' : 'Salvar como padrão para a empresa'}
              </Button>
            </div>
          </TabsContent>

          {/* ABA 3: GUIA TÉCNICO DE COMPATIBILIDADE UNIVERSAL & LIMITAÇÕES */}
          <TabsContent
            value="guide"
            className="flex-1 overflow-y-auto p-6 space-y-4 m-0 bg-background text-xs"
          >
            <div className="border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 p-4 rounded-lg space-y-2">
              <h4 className="font-bold text-sm text-blue-950 dark:text-blue-100 flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-600" />
                Arquitetura Universal de Impressão Térmica JUCA
              </h4>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                O módulo foi projetado para operar com{' '}
                <strong>qualquer impressora térmica do mercado</strong> (Zebra, Argox, Elgin,
                Brother, TSC, Datamax, Bematech, G-Printer, Xprinter e genéricas), sem criar amarras
                com comandos exclusivos de um fabricante (ZPL, EPL, TSPL ou ESC/POS).
              </p>
            </div>

            <div className="space-y-3">
              <h5 className="font-semibold text-slate-900 dark:text-slate-100">
                1. Tipos de Conexão Compatíveis:
              </h5>
              <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
                <li>
                  <strong>USB:</strong> Instale o driver oficial do fabricante ou driver genérico
                  texto/gráfico do Windows/macOS/Linux. A impressão é enviada via spooler padrão do
                  sistema operacional.
                </li>
                <li>
                  <strong>Rede / Wi-Fi / Ethernet:</strong> Compartilhe a impressora via IP ou fila
                  de rede do Windows/Samba. O navegador imprime diretamente na fila configurada.
                </li>
                <li>
                  <strong>Bluetooth:</strong> Emparelhe a impressora térmica portátil no computador
                  ou tablet. O sistema operacional gera uma porta virtual de impressora reconhecida
                  pelo navegador.
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-2 border-t border-border">
              <h5 className="font-semibold text-slate-900 dark:text-slate-100">
                2. Como Evitar Desperdício e Cortes de Bordas:
              </h5>
              <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-md space-y-1.5 text-slate-700 dark:text-slate-300">
                <p>
                  ✓ <strong>No diálogo de impressão do navegador:</strong> configure{' '}
                  <em>Margens</em> como <strong>Nenhuma</strong> (ou <em>Personalizada: 0</em>) e{' '}
                  <em>Ajustar à página / Escala</em> como <strong>Padrão (100%)</strong>. Desmarque
                  opções como "Ajustar à área de impressão" que provocam deslocamentos assimétricos.
                </p>
                <p>
                  ✓ <strong>Nas propriedades do driver da impressora térmica:</strong> certifique-se
                  de que o tamanho do papel cadastrado no driver (ex: 60 × 40 mm) coincide com as
                  medidas configuradas aqui no sistema.
                </p>
                <p>
                  ✓ Utilize o controle de <strong>Calibração de Margens e Escala</strong> na aba
                  anterior para pequenos desvios físicos causados pelo sensor gap/black mark do rolo
                  de etiquetas.
                </p>
                <p>
                  ✓{' '}
                  <strong>Se o conteúdo sair girado em 90° ou deslocado para uma das bordas</strong>
                  (o driver pode girar/deslocar a imagem independentemente do sistema), use{' '}
                  <strong>Rotação da Impressão (0°/90°)</strong> e{' '}
                  <strong>Deslocamento Horizontal/Vertical (mm)</strong> na aba de configuração até
                  a etiqueta sair alinhada no papel.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <h5 className="font-semibold text-slate-900 dark:text-slate-100">
                3. Transparência Técnica sobre Comandos Nativos (ZPL / EPL / TSPL):
              </h5>
              <p className="text-muted-foreground leading-relaxed">
                Navegadores web executam em ambiente seguro (sandbox) e não possuem acesso direto a
                portas de hardware para enviar comandos binários puros de protocolo proprietário
                (como ZPL ou TSPL) sem auxílio de softwares locais (como QZ Tray ou Zebra Browser
                Print). A solução universal via drivers de sistema operacional garante que a JUCA
                possa trocar qualquer equipamento sem precisar refazer código.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-3 border-t border-border bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={handleDownloadPDF}
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF / Impressão
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Imprimir Etiqueta
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
