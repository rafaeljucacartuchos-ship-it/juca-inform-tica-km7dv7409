import React, { useMemo } from 'react'
import { generateQrMatrix, qrMatrixToSvg } from '@/lib/label-qr'
import { code128ToSvg } from '@/lib/label-barcode'
import { LabelPrintConfig } from '@/services/equipment-labels'
import { ServiceOrder, Equipment, Customer } from '@/types'

export interface EquipmentLabelData {
  order: ServiceOrder
  equipment?: Equipment | null
  customer?: Customer | null
  attendanceTypeLabel?: string
  technicianName?: string
}

interface EquipmentLabelContentProps {
  data: EquipmentLabelData
  config: LabelPrintConfig
  isPrintMode?: boolean
}

export const EquipmentLabelContent: React.FC<EquipmentLabelContentProps> = ({
  data,
  config,
  isPrintMode = false,
}) => {
  const { order, equipment, customer, attendanceTypeLabel, technicianName } = data

  const orderNumber = order.number || `OS-${order.id.slice(0, 6)}`
  const clientName =
    customer?.nome_fantasia ||
    customer?.razao_social ||
    customer?.name ||
    order.expand?.customer?.name ||
    'CLIENTE NÃO IDENTIFICADO'

  // Identificação do equipamento
  const equipType = equipment?.type || order.expand?.equipment_ref?.type || 'Equipamento'
  const equipBrand = equipment?.brand || order.expand?.equipment_ref?.brand || ''
  const equipModel = equipment?.model || order.expand?.equipment_ref?.model || ''
  const equipSerial = equipment?.serial_number || order.expand?.equipment_ref?.serial_number || ''
  const equipInternalCode = equipment?.id?.slice(0, 8) || ''

  const fullEquipmentDesc =
    [equipType, equipBrand, equipModel].filter(Boolean).join(' ') ||
    order.equipment ||
    equipment?.name ||
    'Equipamento'

  // Data formatada de entrada / recolhimento
  const formattedDate = useMemo(() => {
    const rawDate = order.attendance_date || order.created
    if (!rawDate) return ''
    try {
      // Se for formato YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const [y, m, d] = rawDate.split('-')
        return `${d}/${m}/${y}`
      }
      const d = new Date(rawDate)
      return d.toLocaleDateString('pt-BR')
    } catch {
      return ''
    }
  }, [order.attendance_date, order.created])

  // URL segura para a OS (sem parâmetros confidenciais, apenas direcionamento à OS no sistema)
  const orderUrl = useMemo(() => {
    const base = window.location.origin
    return `${base}/ordens/${order.id}`
  }, [order.id])

  // Fator de escala fina configurado pelo operador (padrão 100% = 1.0)
  const scale = (config.scalePercent || 100) / 100

  // Detecta se é o formato especial 40 × 40 mm (largura 40mm e altura 40mm com tolerância de 0.5mm)
  const is40x40 = Math.abs(config.widthMm - 40) <= 0.5 && Math.abs(config.heightMm - 40) <= 0.5

  // QR Code específico para o modelo 40x40 mm (dimensão equilibrada, quietZone segura de 2 módulos)
  const qrSvg40x40 = useMemo(() => {
    if (!is40x40) return null
    try {
      const matrix = generateQrMatrix(orderUrl)
      // No modelo 40x40 mm: largura útil ~ 36mm (com margens padrão 2mm de cada lado).
      // Altura disponível após cliente (~8mm) é ~28mm.
      // 25mm a ~3.78 px/mm (96 DPI) = ~95px; multiplicando por scale (padrão 100% = 1.0)
      const basePx = 92
      const sizePx = Math.max(60, Math.min(130, Math.round(basePx * scale)))
      // quietZone = 2 garante margem branca ao redor para facilitar leitura imediata por celulares
      return qrMatrixToSvg(matrix, sizePx, 2)
    } catch (err) {
      console.error('Erro ao gerar QR Code 40x40:', err)
      return null
    }
  }, [is40x40, orderUrl, scale])

  // SVG do QR Code de alto contraste para os demais modelos
  const qrSvg = useMemo(() => {
    if (config.codeType === 'barcode') return null
    try {
      const matrix = generateQrMatrix(orderUrl)
      // Ajuste proporcional do tamanho do QR conforme a altura e largura disponíveis
      const effectiveHeight = Math.max(
        15,
        config.heightMm - (config.marginTopMm + config.marginBottomMm),
      )
      const rawPx = Math.round(effectiveHeight * 2.7 * scale)
      const sizePx = Math.max(42, Math.min(150, rawPx))
      // quietZone 1 garante alto contraste e sem cortes nas bordas térmicas
      return qrMatrixToSvg(matrix, sizePx, 1)
    } catch (err) {
      console.error('Erro ao gerar QR Code:', err)
      return null
    }
  }, [orderUrl, config.codeType, config.heightMm, config.marginTopMm, config.marginBottomMm, scale])

  // SVG do Código de Barras Code 128
  const barcodeSvg = useMemo(() => {
    if (config.codeType === 'qr') return null
    try {
      const barcodeText = String(orderNumber).replace(/[^a-zA-Z0-9-]/g, '')
      const barHeight = Math.max(16, Math.round((config.heightMm <= 30 ? 20 : 30) * scale))
      const moduleWidth = (config.widthMm < 50 ? 0.75 : 0.95) * scale
      return code128ToSvg(barcodeText, barHeight, moduleWidth, true)
    } catch (err) {
      console.error('Erro ao gerar Barcode:', err)
      return null
    }
  }, [orderNumber, config.codeType, config.heightMm, config.widthMm, scale])

  // Escalas e dimensionamento de fontes para impressoras térmicas (100% puro preto #000 sobre #fff)
  const isCompact = config.widthMm <= 42 || config.heightMm <= 32
  const isLarge = config.widthMm >= 90 && config.heightMm >= 45

  const baseHeaderPt = isCompact ? 6.5 : isLarge ? 10 : 8
  const baseOsNumberPt = isCompact ? 9 : isLarge ? 14 : 11
  const baseClientPt = isCompact ? 7.5 : isLarge ? 11 : 9
  const baseEquipPt = isCompact ? 6.8 : isLarge ? 9.5 : 8
  const baseDetailsPt = isCompact ? 5.2 : isLarge ? 7.5 : 6.2

  const headerFontSize = `${(baseHeaderPt * scale).toFixed(1)}pt`
  const osNumberFontSize = `${(baseOsNumberPt * scale).toFixed(1)}pt`
  const clientFontSize = `${(baseClientPt * scale).toFixed(1)}pt`
  const equipFontSize = `${(baseEquipPt * scale).toFixed(1)}pt`
  const detailsFontSize = `${(baseDetailsPt * scale).toFixed(1)}pt`

  const containerStyle: React.CSSProperties = {
    width: `${config.widthMm}mm`,
    height: `${config.heightMm}mm`,
    paddingTop: `${config.marginTopMm}mm`,
    paddingBottom: `${config.marginBottomMm}mm`,
    paddingLeft: `${config.marginLeftMm}mm`,
    paddingRight: `${config.marginRightMm}mm`,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    color: '#000000',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    lineHeight: 1.15,
    overflow: 'hidden',
    position: 'relative',
    pageBreakAfter: 'always',
    pageBreakInside: 'avoid',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  }

  // LAYOUT ESPECÍFICO 40 × 40 MM (Solicitação expressa do usuário / JUCA INFORMÁTICA):
  // Apresentar exclusivamente:
  // 1. Nome do cliente na parte superior, centralizado horizontalmente (até 2 linhas, sem corte).
  // 2. QR Code centralizado horizontalmente e verticalmente no espaço disponível, direcionando à OS.
  // Nenhum outro elemento (sem OS, sem nome da empresa, sem modelo, sem data, sem rodapés).
  if (is40x40) {
    const clientNameFontSize = `${(8.5 * scale).toFixed(1)}pt`

    return (
      <div
        className={`equipment-label-printable thermal-high-contrast thermal-40x40 ${isPrintMode ? 'print-direct' : ''}`}
        style={{
          ...containerStyle,
          justifyContent: 'flex-start',
          alignItems: 'center',
        }}
      >
        {/* NOME DO CLIENTE: SUPERIOR E CENTRALIZADO HORIZONTALMENTE */}
        <div
          style={{
            width: '100%',
            textAlign: 'center',
            fontSize: clientNameFontSize,
            fontWeight: 800,
            lineHeight: 1.15,
            color: '#000000',
            textTransform: 'uppercase',
            letterSpacing: '0.01em',
            wordBreak: 'break-word',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            paddingLeft: '0.5mm',
            paddingRight: '0.5mm',
            boxSizing: 'border-box',
            flexShrink: 0,
            marginBottom: `${(1.0 * scale).toFixed(2)}mm`,
          }}
          title={clientName}
        >
          {clientName}
        </div>

        {/* QR CODE: CENTRALIZADO HORIZONTALMENTE E EQUILIBRADO NO CENTRO DA ÁREA RESTANTE */}
        <div
          style={{
            width: '100%',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {qrSvg40x40 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                backgroundColor: '#ffffff',
              }}
              dangerouslySetInnerHTML={{ __html: qrSvg40x40 }}
            />
          )}
        </div>
      </div>
    )
  }

  // DEMAIS MODELOS DE ETIQUETA (40x30, 50x30, 60x40, 100x50, personalizados, etc.) PRESERVADOS INTEGRALMENTE
  return (
    <div
      className={`equipment-label-printable thermal-high-contrast ${isPrintMode ? 'print-direct' : ''}`}
      style={containerStyle}
    >
      {/* CABEÇALHO: NOME DA EMPRESA E TIPO DE ATENDIMENTO */}
      <div
        style={{
          borderBottom: '1px solid #000000',
          paddingBottom: `${(0.8 * scale).toFixed(2)}mm`,
          marginBottom: `${(0.8 * scale).toFixed(2)}mm`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontWeight: 900,
            fontSize: headerFontSize,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#000000',
          }}
        >
          JUCA INFORMÁTICA
        </span>

        {attendanceTypeLabel && !isCompact && (
          <span
            style={{
              fontSize: `${(5.8 * scale).toFixed(1)}pt`,
              fontWeight: 800,
              textTransform: 'uppercase',
              backgroundColor: '#000000',
              color: '#ffffff',
              padding: '0.4mm 1.2mm',
              borderRadius: '0.6mm',
              letterSpacing: '0.02em',
            }}
          >
            {attendanceTypeLabel}
          </span>
        )}

        {config.showEntryDate && formattedDate && (
          <span
            style={{
              fontSize: detailsFontSize,
              fontWeight: 700,
              color: '#000000',
            }}
          >
            {formattedDate}
          </span>
        )}
      </div>

      {/* CORPO PRINCIPAL: DADOS DA OS E CÓDIGOS */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          gap: `${(1.5 * scale).toFixed(2)}mm`,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* COLUNA ESQUERDA: NÚMERO DA OS, CLIENTE E EQUIPAMENTO */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            minWidth: 0,
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* NÚMERO DA ORDEM DE SERVIÇO (Destaque máximo para leitura visual imediata) */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.2mm' }}>
            <span
              style={{ fontSize: `${(6 * scale).toFixed(1)}pt`, fontWeight: 800, color: '#000000' }}
            >
              OS:
            </span>
            <span
              style={{
                fontSize: osNumberFontSize,
                fontWeight: 900,
                letterSpacing: '-0.02em',
                lineHeight: 1,
                color: '#000000',
              }}
            >
              {orderNumber}
            </span>
          </div>

          {/* CLIENTE (Prioritário para triagem no balcão) */}
          <div
            style={{
              fontSize: clientFontSize,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textTransform: 'uppercase',
              color: '#000000',
            }}
            title={clientName}
          >
            {clientName}
          </div>

          {/* EQUIPAMENTO (Tipo, Marca, Modelo) */}
          <div
            style={{
              fontSize: equipFontSize,
              fontWeight: 700,
              color: '#000000',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={fullEquipmentDesc}
          >
            {fullEquipmentDesc}
          </div>

          {/* DADOS OPCIONAIS (N/S, Cód. Interno, Técnico) */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: `${(1.2 * scale).toFixed(2)}mm`,
              fontSize: detailsFontSize,
              color: '#000000',
              marginTop: '0.4mm',
              lineHeight: 1.1,
            }}
          >
            {config.showSerialNumber && equipSerial && (
              <span style={{ whiteSpace: 'nowrap' }}>
                <strong style={{ fontWeight: 800 }}>S/N:</strong> {equipSerial}
              </span>
            )}
            {config.showInternalId && equipInternalCode && !isCompact && (
              <span style={{ whiteSpace: 'nowrap' }}>
                <strong style={{ fontWeight: 800 }}>ID:</strong> {equipInternalCode}
              </span>
            )}
            {config.showTechnician && technicianName && (
              <span style={{ whiteSpace: 'nowrap' }}>
                <strong style={{ fontWeight: 800 }}>Téc:</strong> {technicianName}
              </span>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: QR CODE OU CÓDIGO DE BARRAS */}
        {config.codeType === 'qr' && qrSvg && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
              }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <span
              style={{
                fontSize: `${(4.5 * scale).toFixed(1)}pt`,
                fontWeight: 900,
                textTransform: 'uppercase',
                marginTop: '0.3mm',
                color: '#000000',
                letterSpacing: '0.04em',
              }}
            >
              SCAN OS
            </span>
          </div>
        )}

        {config.codeType === 'barcode' && barcodeSvg && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              maxWidth: '50%',
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
          </div>
        )}
      </div>

      {/* RODAPÉ CASO "AMBOS" (QR + CÓDIGO DE BARRAS) SEJA SELECIONADO EM ETIQUETAS GRANDES */}
      {config.codeType === 'both' && (
        <div
          style={{
            borderTop: '1px solid #000000',
            paddingTop: '0.8mm',
            marginTop: '0.8mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          {qrSvg && (
            <div
              style={{
                width: `${(20 * scale).toFixed(1)}mm`,
                height: `${(20 * scale).toFixed(1)}mm`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          )}
          {barcodeSvg && (
            <div
              style={{ flex: 1, marginLeft: '2mm', overflow: 'hidden' }}
              dangerouslySetInnerHTML={{ __html: barcodeSvg }}
            />
          )}
        </div>
      )}
    </div>
  )
}
