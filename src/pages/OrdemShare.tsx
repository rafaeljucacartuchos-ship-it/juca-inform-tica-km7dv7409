import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, Loader2, Pen, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CompanyHeader } from '@/components/CompanyHeader'
import { SignaturePad } from '@/components/SignaturePad'
import { COMPANY_DATA } from '@/lib/company'
import { getFileUrl } from '@/lib/pocketbase/files'
import pb from '@/lib/pocketbase/client'

interface ShareItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

interface ShareData {
  id: string
  number: string
  status: string
  priority: string
  title: string
  description: string
  equipment: string
  service_report: string
  total: number
  created: string
  customer_signature: string
  technician_signature: string
  customer: {
    name: string
    phone: string
    street: string
    number: string
    city: string
    state: string
    zip: string
  } | null
  technician: { name: string; phone: string } | null
  items: ShareItem[]
  status_history: Array<{
    status: string
    note: string
    changed_by: string
    created: string
  }>
  attachments: Array<{
    id: string
    file: string
    caption: string
  }>
}

const statusLabels: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em Andamento',
  waiting_parts: 'Aguardando Peças',
  completed: 'Concluída',
  closed: 'Fechada',
  cancelled: 'Cancelada',
}

export default function OrdemShare() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signed, setSigned] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    pb.send(`/backend/v1/os/${id}/share`, { method: 'GET' })
      .then((d: ShareData) => {
        setData(d)
        setSigned(!!d.customer_signature)
      })
      .catch(() => setError('Não foi possível carregar esta ordem de serviço.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSign = async (blob: Blob) => {
    if (!id) return
    setSaving(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('signature', blob, 'signature.png')
      const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/os/${id}/sign`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || 'Failed to save signature')
      }
      setSigned(true)
      const fresh: ShareData = await pb.send(`/backend/v1/os/${id}/share`, { method: 'GET' })
      setData(fresh)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar assinatura. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const sigUrl =
    data.customer_signature && data.customer_signature !== 'signed'
      ? `${import.meta.env.VITE_POCKETBASE_URL}/api/files/service_orders/${data.id}/${data.customer_signature}`
      : null

  const paidTotal = data.items.reduce((s, i) => s + i.total, 0)

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="no-print flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="text-xs gap-1.5"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
        <CompanyHeader />

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 font-mono">
                  OS {data.number}
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">{data.title}</p>
              </div>
              <Badge className="capitalize">{statusLabels[data.status] || data.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-semibold text-slate-500">Cliente:</span>
                <p className="font-medium text-slate-900">{data.customer?.name || '—'}</p>
                {data.customer?.phone && <p className="text-slate-500">{data.customer.phone}</p>}
              </div>
              <div>
                <span className="font-semibold text-slate-500">Técnico:</span>
                <p className="font-medium text-slate-900">
                  {data.technician?.name || 'Não atribuído'}
                </p>
              </div>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Equipamento:</span>
              <p className="text-slate-700">{data.equipment || 'Não informado'}</p>
            </div>
            {data.description && (
              <div>
                <span className="font-semibold text-slate-500">Descrição do Problema:</span>
                <p className="text-slate-700 mt-1">{data.description}</p>
              </div>
            )}
            {data.service_report && (
              <div>
                <span className="font-semibold text-slate-500">Relatório de Serviço:</span>
                <p className="text-slate-700 mt-1">{data.service_report}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {data.items.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">Itens e Serviços</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-y border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4">Descrição</th>
                    <th className="py-2.5 px-4 text-center">Qtd</th>
                    <th className="py-2.5 px-4 text-right">Un.</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-2.5 px-4 font-medium">{item.description}</td>
                      <td className="py-2.5 px-4 text-center">{item.quantity}</td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        R$ {item.unit_price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">
                        R$ {item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between font-bold text-sm">
                <span>Total:</span>
                <span className="font-mono text-indigo-600">
                  R$ {(data.total || paidTotal).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {data.attachments && data.attachments.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Fotos do Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {data.attachments.map((a) => (
                  <div key={a.id}>
                    <img
                      src={getFileUrl(a.id, a.file, 'service_attachments', '300x300')}
                      alt={a.caption || ''}
                      className="h-28 w-full rounded-lg border border-slate-200 object-cover"
                    />
                    {a.caption && <p className="mt-0.5 text-[10px] text-slate-600">{a.caption}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.status_history && data.status_history.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Histórico de Alterações
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-left text-xs">
                <thead className="border-y border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Observação</th>
                    <th className="px-4 py-2">Alterado por</th>
                    <th className="px-4 py-2">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.status_history.map((h, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">{statusLabels[h.status] || h.status}</td>
                      <td className="px-4 py-2">{h.note || '—'}</td>
                      <td className="px-4 py-2">{h.changed_by || '—'}</td>
                      <td className="px-4 py-2 font-mono">
                        {h.created?.substring(0, 10).split('-').reverse().join('/')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {data.technician_signature && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Assinatura do Técnico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={getFileUrl(data.id, data.technician_signature, 'service_orders')}
                alt="Assinatura do Técnico"
                className="h-24 w-full rounded-lg border border-slate-200 bg-white object-contain"
              />
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900">
              Assinatura do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {signed ? (
              <div className="space-y-3">
                {sigUrl && (
                  <img
                    src={sigUrl}
                    alt="Assinatura"
                    className="w-full h-28 object-contain border border-slate-200 rounded-lg bg-white"
                  />
                )}
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    Ordem de serviço assinada digitalmente.
                  </span>
                </div>
              </div>
            ) : saving ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="space-y-2">
                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}
                <div className="flex items-center gap-2 text-slate-600 mb-2">
                  <Pen className="h-4 w-4" />
                  <p className="text-xs">Assine abaixo para confirmar esta ordem de serviço.</p>
                </div>
                <SignaturePad onConfirm={handleSign} />
              </div>
            )}{' '}
          </CardContent>
        </Card>

        <div className="text-center text-[11px] text-slate-400 pb-4">
          <p className="font-semibold text-slate-500">{COMPANY_DATA.razaoSocial}</p>
          <p>{COMPANY_DATA.endereco}</p>
          <p>Telefones: {COMPANY_DATA.telefones}</p>
        </div>
      </div>
    </div>
  )
}
