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

  const orderNumber = order.order_number || `OS-${order.id.slice(0, 6)}`
  const clientName = customer?.name || order.customer_name || 'CLIENTE NÃO IDENTIFICADO'

  // Identificação do equipamento
  const equipType = equipment?.type || order.equipment_type || 'Equipamento'
  const equipBrand = equipment?.brand || order.equipment_brand || ''
  const equipModel = equipment?.model || order.equipment_model || ''
  const equipSerial = equipment?.serial_number || order.serial_number || ''
  const equipInternalCode = equipment?.internal_id || equipment?.id?.slice(0, 8) || ''

  const fullEquipmentDesc =
    [equipType, equipBrand, equipModel].filter(Boolean).join(' ') || 'Equipamento'

  // Data formatada de entrada / recolhimento
  const formattedDate = useMemo(() => {
    const rawDate = order.created || order.start_date
    if (!rawDate) return ''
    try {
      const d = new Date(rawDate)
      return d.toLocaleDateString('pt-BR')
    } catch {
      return ''
    }
  }, [order.created, order.start_date])

  // URL segura para a OS (sem parâmetros confidenciais, apenas direcionamento à OS no sistema)
  const orderUrl = useMemo(() => {
    const base = window.location.origin
    return `${base}/ordens/${order.id}`
  }, [order.id])

  // SVG do QR Code
  const qrSvg = useMemo(() => {
    if (config.codeType === 'barcode') return null
    try {
      const matrix = generateQrMatrix(orderUrl)
      // Ajuste proporcional do tamanho do QR conforme a altura da etiqueta
      const sizePx = Math.max(50, Math.min(140, Math.round(config.heightMm * 2.8)))
      return qrMatrixToSvg(matrix, sizePx, 1)
    } catch (err) {
      console.error('Erro ao gerar QR Code:', err)
      return null
    }
  }, [orderUrl, config.codeType, config.heightMm])

  // SVG do Código de Barras Code 128
  const barcodeSvg = useMemo(() => {
    if (config.codeType === 'qr') return null
    try {
      // Código de barras usa o identificador da OS
      const barcodeText = String(orderNumber).replace(/[^a-zA-Z0-9-]/g, '')
      const barHeight = config.heightMm <= 30 ? 22 : 32
      const moduleWidth = config.widthMm < 50 ? 0.8 : 1.05
      return code128ToSvg(barcodeText, barHeight, moduleWidth, true)
    } catch (err) {
      console.error('Erro ao gerar Barcode:', err)
      return null
    }
  }, [orderNumber, config.codeType, config.heightMm, config.widthMm])

  // Escalas e dimensionamento de fontes para impressoras térmicas
  const isCompact = config.widthMm <= 40 || config.heightMm <= 30
  const isLarge = config.widthMm >= 90 && config.heightMm >= 45

  const headerFontSize = isCompact ? '6.5pt' : isLarge ? '10pt' : '8pt'
  const osNumberFontSize = isCompact ? '9pt' : isLarge ? '14pt' : '11pt'
  const clientFontSize = isCompact ? '8pt' : isLarge ? '11pt' : '9pt'
  const equipFontSize = isCompact ? '7pt' : isLarge ? '9.5pt' : '8pt'
  const detailsFontSize = isCompact ? '5.5pt' : isLarge ? '7.5pt' : '6.5pt'

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
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    lineHeight: 1.15,
    overflow: 'hidden',
    position: 'relative',
    pageBreakAfter: 'always',
    pageBreakInside: 'avoid',
  }

  return (
    <div
      className={`equipment-label-printable ${isPrintMode ? 'print-direct' : ''}`}
      style={containerStyle}
    >
      {/* CABEÇALHO: NOME DA EMPRESA E TIPO DE ATENDIMENTO */}
      <div
        style={{
          borderBottom: '1px solid #000000',
          paddingBottom: '1mm',
          marginBottom: '1mm',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span
          style={{
            fontWeight: 800,
            fontSize: headerFontSize,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          JUCA INFORMÁTICA
        </span>

        {attendanceTypeLabel && !isCompact && (
          <span
            style={{
              fontSize: '6pt',
              fontWeight: 700,
              textTransform: 'uppercase',
              backgroundColor: '#000000',
              color: '#ffffff',
              padding: '0.5mm 1.5mm',
              borderRadius: '1mm',
            }}
          >
            {attendanceTypeLabel}
          </span>
        )}

        {config.showEntryDate && formattedDate && (
          <span
            style={{
              fontSize: detailsFontSize,
              fontWeight: 600,
              color: '#222222',
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
          gap: '2mm',
          minHeight: 0,
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
          }}
        >
          {/* NÚMERO DA ORDEM DE SERVIÇO */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.5mm' }}>
            <span style={{ fontSize: '6.5pt', fontWeight: 700, color: '#444' }}>OS:</span>
            <span
              style={{
                fontSize: osNumberFontSize,
                fontWeight: 900,
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {orderNumber}
            </span>
          </div>

          {/* CLIENTE (Prioritário para legibilidade rápida) */}
          <div
            style={{
              fontSize: clientFontSize,
              fontWeight: 700,
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
              fontWeight: 600,
              color: '#111111',
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
              gap: '1.5mm',
              fontSize: detailsFontSize,
              color: '#333333',
              marginTop: '0.5mm',
            }}
          >
            {config.showSerialNumber && equipSerial && (
              <span style={{ whiteSpace: 'nowrap' }}>
                <strong>S/N:</strong> {equipSerial}
              </span>
            )}
            {config.showInternalId && equipInternalCode && !isCompact && (
              <span style={{ whiteSpace: 'nowrap' }}>
                <strong>ID:</strong> {equipInternalCode}
              </span>
            )}
            {config.showTechnician && technicianName && (
              <span style={{ whiteSpace: 'nowrap' }}>
                <strong>Téc:</strong> {technicianName}
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
              }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <span
              style={{
                fontSize: '4.5pt',
                fontWeight: 700,
                textTransform: 'uppercase',
                marginTop: '0.5mm',
                color: '#555',
                letterSpacing: '0.02em',
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
              maxWidth: '48%',
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
            borderTop: '1px dashed #777777',
            paddingTop: '1mm',
            marginTop: '1mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {qrSvg && (
            <div
              style={{ width: '22mm', height: '22mm' }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          )}
          {barcodeSvg && (
            <div
              style={{ flex: 1, marginLeft: '2mm' }}
              dangerouslySetInnerHTML={{ __html: barcodeSvg }}
            />
          )}
        </div>
      )}
    </div>
  )
}
