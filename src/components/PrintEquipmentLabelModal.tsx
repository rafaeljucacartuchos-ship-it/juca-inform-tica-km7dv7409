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
} from 'lucide-react'
import { ServiceOrder, Equipment, Customer } from '@/types'
import {
  LabelPrintConfig,
  PRESET_LABEL_SIZES,
  getEquipmentLabelConfig,
  saveEquipmentLabelConfig,
  DEFAULT_LABEL_CONFIG,
} from '@/services/equipment-labels'
import { EquipmentLabelContent } from './EquipmentLabelContent'
import { toast } from '@/hooks/use-toast'

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
  const [activeTab, setActiveTab] = useState<'preview' | 'config'>('preview')
  const [isCopiedLink, setIsCopiedLink] = useState(false)
  const printAreaRef = useRef<HTMLDivElement>(null)

  // Carrega configurações persistidas ao abrir
  useEffect(() => {
    if (open) {
      getEquipmentLabelConfig().then((loaded) => {
        setConfig(loaded)
      })
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
    // Fallback: objeto construído a partir dos dados gravados diretamente na OS
    if (
      order.equipment_type ||
      order.equipment_brand ||
      order.equipment_model ||
      order.serial_number
    ) {
      return {
        id: order.equipment_ref || 'os_equip',
        customer_id: order.customer_id,
        type: order.equipment_type || '',
        brand: order.equipment_brand || '',
        model: order.equipment_model || '',
        serial_number: order.serial_number || '',
        notes: '',
        created: order.created,
        updated: order.updated,
      } as Equipment
    }
    return null
  }, [selectedEquipmentId, equipmentsList, initialEquipment, order])

  // Presets de tamanho
  const handlePresetChange = (presetId: string) => {
    const found = PRESET_LABEL_SIZES.find((p) => p.id === presetId)
    if (found) {
      if (presetId === 'custom') {
        setConfig((prev) => ({
          ...prev,
          presetId,
        }))
      } else {
        setConfig((prev) => ({
          ...prev,
          presetId,
          widthMm: found.widthMm,
          heightMm: found.heightMm,
        }))
      }
    }
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

  // Disparo da impressão nativa ajustada para milímetros exatos da etiqueta térmica
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=750,height=600')
    if (!printWindow) {
      toast({
        title: 'Bloqueador de pop-ups detectado',
        description: 'Permita pop-ups para abrir a janela de impressão da etiqueta térmica.',
        variant: 'destructive',
      })
      return
    }

    const { widthMm, heightMm, orientation, copies } = config
    const copiesArray = Array.from({ length: Math.max(1, copies) })

    // Cria elementos clonados para as cópias
    const labelHtml = printAreaRef.current?.innerHTML || ''
    const copiesHtml = copiesArray
      .map(
        () => `
      <div class="label-page">
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
        <title>Etiqueta OS ${order.order_number || order.id.slice(0, 6)} - JUCA INFORMÁTICA</title>
        <style>
          @page {
            size: ${widthMm}mm ${heightMm}mm ${orientation};
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: system-ui, -apple-system, sans-serif;
          }
          .label-page {
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
            overflow: hidden;
          }
          @media screen {
            body {
              background: #e2e8f0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 20px;
            }
            .label-page {
              background: #ffffff;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
              border-radius: 4px;
            }
          }
        </style>
      </head>
      <body>
        ${copiesHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Gerar PDF / Exportar
  const handleDownloadPDF = () => {
    // Abrir o diálogo de impressão do navegador permite "Salvar como PDF" com as dimensões exatas da página configurada
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
                    OS #{order.order_number || order.id.slice(0, 6)}
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
          onValueChange={(val) => setActiveTab(val as 'preview' | 'config')}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 pt-3 pb-1 border-b border-border bg-background flex items-center justify-between">
            <TabsList className="grid grid-cols-2 w-56 h-8">
              <TabsTrigger value="preview" className="text-xs font-medium">
                Pré-visualização
              </TabsTrigger>
              <TabsTrigger value="config" className="text-xs font-medium flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" />
                Tamanho / Layout
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {config.widthMm} × {config.heightMm} mm
              </span>
              <span>•</span>
              <span className="capitalize">
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

              {/* MOLDURA DE VISUALIZAÇÃO COM SOMBRA E BORDA SIMULANDO A ETIQUETA ADESIVA */}
              <div className="p-4 bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-lg shadow-md flex items-center justify-center max-w-full overflow-auto">
                <div
                  ref={printAreaRef}
                  className="bg-white text-black shadow-sm border border-dashed border-neutral-300"
                  style={{
                    width: `${config.widthMm}mm`,
                    height: `${config.heightMm}mm`,
                    boxSizing: 'border-box',
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

          {/* ABA 2: CONFIGURAÇÕES DE TAMANHO E PRESETS */}
          <TabsContent
            value="config"
            className="flex-1 overflow-y-auto p-6 space-y-6 m-0 bg-background"
          >
            {/* SELEÇÃO DE PRESET */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">
                Tamanho da Etiqueta (Presets Térmicos)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PRESET_LABEL_SIZES.map((preset) => {
                  const isSelected = config.presetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetChange(preset.id)}
                      className={`text-left p-3 rounded-lg border text-xs transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:bg-muted/40'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{preset.name}</span>
                        {preset.isDefault && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            Recomendado
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground mt-1 text-[11px]">
                        {preset.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* DIMENSÕES MANUAIS / PERSONALIZADAS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-lg border border-border">
              <div className="space-y-1">
                <Label htmlFor="widthMm" className="text-xs">
                  Largura (mm)
                </Label>
                <Input
                  id="widthMm"
                  type="number"
                  min="20"
                  max="150"
                  value={config.widthMm}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      presetId: 'custom',
                      widthMm: Math.max(20, Number(e.target.value) || 20),
                    }))
                  }
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="heightMm" className="text-xs">
                  Altura (mm)
                </Label>
                <Input
                  id="heightMm"
                  type="number"
                  min="15"
                  max="150"
                  value={config.heightMm}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      presetId: 'custom',
                      heightMm: Math.max(15, Number(e.target.value) || 15),
                    }))
                  }
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="copies" className="text-xs">
                  Cópias
                </Label>
                <Input
                  id="copies"
                  type="number"
                  min="1"
                  max="10"
                  value={config.copies}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      copies: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                    }))
                  }
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Orientação</Label>
                <Select
                  value={config.orientation}
                  onValueChange={(val: 'landscape' | 'portrait') =>
                    setConfig((prev) => ({ ...prev, orientation: val }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape" className="text-xs">
                      Paisagem
                    </SelectItem>
                    <SelectItem value="portrait" className="text-xs">
                      Retrato
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* TIPO DE CÓDIGO (QR CODE OU CÓDIGO DE BARRAS) */}
            <div className="space-y-2">
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
                  QR Code (Link OS)
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
                  Código de Barras (128)
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
                  Ambos (Etiqueta Larga)
                </button>
              </div>
            </div>

            {/* ELEMENTOS OPCIONAIS */}
            <div className="space-y-3 pt-2 border-t border-border">
              <Label className="text-xs font-semibold">Campos e Detalhes Opcionais</Label>
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
                className="text-xs"
              >
                {isSavingConfig ? 'Salvando...' : 'Salvar como padrão para a empresa'}
              </Button>
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
