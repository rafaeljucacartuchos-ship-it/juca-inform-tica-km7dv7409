import { COMPANY_DATA } from '@/lib/company'
import { getFileUrl } from '@/lib/pocketbase/files'
import { ServiceOrder, ServiceOrderItem, StatusHistory, ServiceAttachment } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em Andamento',
  waiting_parts: 'Aguardando Peças',
  completed: 'Concluída',
  closed: 'Fechada',
  cancelled: 'Cancelada',
}
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}
const fmtDate = (d?: string) => (d ? d.substring(0, 10).split('-').reverse().join('/') : '—')

interface PrintOrderDocumentProps {
  order: ServiceOrder
  items: ServiceOrderItem[]
  history: StatusHistory[]
  attachments: ServiceAttachment[]
}

export function PrintOrderDocument({
  order,
  items,
  history,
  attachments,
}: PrintOrderDocumentProps) {
  const techSig = order.technician_signature
    ? getFileUrl(order.id, order.technician_signature, 'service_orders')
    : null
  const custSig = order.customer_signature
    ? getFileUrl(order.id, order.customer_signature, 'service_orders')
    : null
  const eq = order.expand?.equipment_ref
  const cust = order.expand?.customer
  const tech = order.expand?.technician

  return (
    <div className="print-document mx-auto max-w-4xl text-slate-900">
      <div className="mb-6 flex items-center gap-4 border-b-2 border-slate-800 pb-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <span className="text-2xl font-extrabold">{COMPANY_DATA.initials}</span>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{COMPANY_DATA.razaoSocial}</h1>
          <p className="text-xs text-slate-600">{COMPANY_DATA.endereco}</p>
          <p className="text-xs text-slate-600">Telefones: {COMPANY_DATA.telefones}</p>
        </div>
        <div className="text-right">
          <h2 className="font-mono text-lg font-bold">OS {order.number}</h2>
          <p className="text-xs text-slate-600">Emitida em: {fmtDate(order.created)}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-6 text-xs">
        <span>
          <strong>Status:</strong> {STATUS_LABELS[order.status] || order.status}
        </span>
        <span>
          <strong>Prioridade:</strong> {PRIORITY_LABELS[order.priority] || order.priority}
        </span>
        <span>
          <strong>Título:</strong> {order.title}
        </span>
      </div>

      {order.description && <p className="mb-4 text-xs text-slate-700">{order.description}</p>}

      <div className="mb-4 grid grid-cols-2 gap-4 text-xs">
        <div className="rounded border border-slate-200 p-3">
          <h4 className="mb-1 border-b border-slate-100 pb-1 font-bold">Cliente</h4>
          <p>
            <strong>Nome:</strong> {cust?.name || '—'}
          </p>
          <p>
            <strong>Telefone:</strong> {cust?.phone || '—'}
          </p>
          <p>
            <strong>Endereço:</strong>{' '}
            {[cust?.street, cust?.number, cust?.city, cust?.state].filter(Boolean).join(', ') ||
              '—'}
          </p>
        </div>
        <div className="rounded border border-slate-200 p-3">
          <h4 className="mb-1 border-b border-slate-100 pb-1 font-bold">Técnico</h4>
          <p>
            <strong>Nome:</strong> {tech?.name || 'Não atribuído'}
          </p>
          <p>
            <strong>Telefone:</strong> {tech?.phone || '—'}
          </p>
        </div>
      </div>

      {(eq || order.equipment) && (
        <div className="mb-4 rounded border border-slate-200 p-3 text-xs">
          <h4 className="mb-1 border-b border-slate-100 pb-1 font-bold">Equipamento</h4>
          {eq ? (
            <div className="grid grid-cols-2 gap-1">
              <p>
                <strong>Nome:</strong> {eq.name}
              </p>
              <p>
                <strong>Marca:</strong> {eq.brand || '—'}
              </p>
              <p>
                <strong>Modelo:</strong> {eq.model || '—'}
              </p>
              <p>
                <strong>N° Série:</strong> {eq.serial_number || '—'}
              </p>
            </div>
          ) : (
            <p>{order.equipment}</p>
          )}
        </div>
      )}

      {order.service_report && (
        <div className="mb-4 text-xs">
          <h4 className="mb-1 font-bold">Relatório de Serviço</h4>
          <p className="whitespace-pre-wrap text-slate-700">{order.service_report}</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-1 text-xs font-bold">Itens e Serviços</h4>
          <table className="w-full border border-slate-300 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="border border-slate-300 px-2 py-1 text-left">Descrição</th>
                <th className="border border-slate-300 px-2 py-1 text-center">Qtd</th>
                <th className="border border-slate-300 px-2 py-1 text-right">Unit.</th>
                <th className="border border-slate-300 px-2 py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="border border-slate-300 px-2 py-1">{i.description}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{i.quantity}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">
                    R$ {i.unit_price.toFixed(2)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-bold">
                    R$ {i.total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1 text-right text-sm font-bold">
            Total: R$ {(order.total || 0).toFixed(2)}
          </div>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-1 text-xs font-bold">Fotos do Atendimento</h4>
          <div className="grid grid-cols-3 gap-2">
            {attachments.map((a) => (
              <div key={a.id}>
                <img
                  src={getFileUrl(a.id, a.file, 'service_attachments', '300x300')}
                  alt={a.caption || ''}
                  className="h-28 w-full rounded border border-slate-200 object-cover"
                />
                {a.caption && <p className="mt-0.5 text-[10px] text-slate-600">{a.caption}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-1 text-xs font-bold">Histórico de Alterações</h4>
          <table className="w-full border border-slate-300 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="border border-slate-300 px-2 py-1 text-left">Status</th>
                <th className="border border-slate-300 px-2 py-1 text-left">Observação</th>
                <th className="border border-slate-300 px-2 py-1 text-left">Alterado por</th>
                <th className="border border-slate-300 px-2 py-1 text-left">Data</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="border border-slate-300 px-2 py-1">
                    {STATUS_LABELS[h.status] || h.status}
                  </td>
                  <td className="border border-slate-300 px-2 py-1">{h.note || '—'}</td>
                  <td className="border border-slate-300 px-2 py-1">
                    {h.expand?.changed_by?.name || '—'}
                  </td>
                  <td className="border border-slate-300 px-2 py-1">{fmtDate(h.created)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-6">
        <div>
          {techSig ? (
            <img
              src={techSig}
              alt="Assinatura Técnico"
              className="h-16 border-b border-slate-400 object-contain"
            />
          ) : (
            <div className="h-16 border-b border-slate-400" />
          )}
          <p className="mt-1 text-center text-xs text-slate-600">Assinatura do Técnico</p>
        </div>
        <div>
          {custSig ? (
            <img
              src={custSig}
              alt="Assinatura Cliente"
              className="h-16 border-b border-slate-400 object-contain"
            />
          ) : (
            <div className="h-16 border-b border-slate-400" />
          )}
          <p className="mt-1 text-center text-xs text-slate-600">Assinatura do Cliente</p>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
        <p className="font-semibold">{COMPANY_DATA.razaoSocial}</p>
        <p>{COMPANY_DATA.endereco}</p>
        <p>Telefones: {COMPANY_DATA.telefones}</p>
      </div>
    </div>
  )
}
