import { useState } from 'react'
import { Pen, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ServiceOrder } from '@/types'
import { SignaturePad } from '@/components/SignaturePad'
import { uploadSignature } from '@/services/service_orders'
import { getFileUrl } from '@/lib/pocketbase/files'
import { useToast } from '@/hooks/use-toast'

interface OrderSignaturesProps {
  order: ServiceOrder
  canEdit: boolean
  onSaved: () => void
}

export function OrderSignatures({ order, canEdit, onSaved }: OrderSignaturesProps) {
  const [showTechPad, setShowTechPad] = useState(false)
  const [showCustPad, setShowCustPad] = useState(false)
  const { toast } = useToast()

  const handleSave = async (field: 'technician_signature' | 'customer_signature', blob: Blob) => {
    try {
      await uploadSignature(order.id, field, blob)
      toast({ title: 'Assinatura salva com sucesso!' })
      setShowTechPad(false)
      setShowCustPad(false)
      onSaved()
    } catch {
      toast({ title: 'Erro ao salvar assinatura', variant: 'destructive' })
    }
  }

  const renderArea = (
    label: string,
    field: 'technician_signature' | 'customer_signature',
    showPad: boolean,
    setShowPad: (v: boolean) => void,
  ) => {
    const sigUrl = order[field]
      ? getFileUrl(order.id, order[field] as string, 'service_orders')
      : null
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        {sigUrl ? (
          <div className="space-y-2">
            <img
              src={sigUrl}
              alt={label}
              className="w-full h-24 object-contain border border-slate-200 rounded-lg bg-white"
            />
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPad(true)}
                className="text-xs gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refazer Assinatura
              </Button>
            )}
          </div>
        ) : showPad ? (
          <SignaturePad
            onConfirm={(blob) => handleSave(field, blob)}
            onCancel={() => setShowPad(false)}
          />
        ) : (
          <div className="flex items-center justify-center h-24 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
            {canEdit ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPad(true)}
                className="text-xs gap-1.5 text-slate-500"
              >
                <Pen className="h-3.5 w-3.5" /> Coletar Assinatura
              </Button>
            ) : (
              <span className="text-xs text-slate-400">Sem assinatura</span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold text-slate-900">Assinaturas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {renderArea('Assinatura do Tecnico', 'technician_signature', showTechPad, setShowTechPad)}
          {renderArea('Assinatura do Cliente', 'customer_signature', showCustPad, setShowCustPad)}
        </div>
      </CardContent>
    </Card>
  )
}
