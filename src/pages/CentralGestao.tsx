import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { BarChart3, MessageCircle, RefreshCw, ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { managementMetrics, periodStart } from '@/lib/management-metrics'
import type { ManagementOrder, ManagementQuote, ManagementPayment } from '@/lib/management-metrics'

interface ManagementData {
  orders: ManagementOrder[]
  quotes: ManagementQuote[]
  payments: ManagementPayment[]
  users: { id: string; name: string }[]
}
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Gate both route renderers (mobile and desktop keep-alive) before any query.
export default function CentralGestao() {
  const { user } = useAuth()
  if (!user || user.role !== 'admin') return <Navigate to="/sem-acesso" replace />
  return <ManagementDashboard key={user.id} />
}

function ManagementDashboard() {
  const [days, setDays] = useState(30)
  const [refresh, setRefresh] = useState(0)
  const [data, setData] = useState<ManagementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setData(null)
    Promise.all([
      pb.collection('service_orders').getFullList<ManagementOrder>({ fields: 'id,status,technician' }),
      pb.collection('orcamentos').getFullList<ManagementQuote>({ fields: 'id,status,created' }),
      pb.collection('payments').getFullList<ManagementPayment>({ fields: 'id,status,amount,paid_at' }),
      pb.collection('users').getFullList<{ id: string; name: string }>({ fields: 'id,name', sort: 'name' }),
    ]).then(([orders, quotes, payments, users]) => {
      if (!cancelled) {
        setData({ orders, quotes, payments, users })
        setLoadedAt(new Date())
      }
    }).catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refresh])

  const metrics = useMemo(() => data && loadedAt
    ? managementMetrics(data.orders, data.quotes, data.payments, periodStart(days, loadedAt), loadedAt)
    : null, [data, days, loadedAt])

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-300">JUCA • Visão do gestor</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Central de gestão</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">Acompanhe a operação, as propostas e os recebimentos da empresa.</p>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-slate-600 px-3 py-2 text-xs"><ShieldCheck size={16} /> Acesso do gestor</span>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-sm font-medium">Período comercial
          <select className="rounded-lg border bg-white p-2" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>Hoje</option><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option>
          </select>
        </label>
        <button type="button" disabled={loading} onClick={() => setRefresh((v) => v + 1)} className="flex min-h-11 items-center gap-2 rounded-lg border bg-white px-4 text-sm disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>
      {loading && <p role="status" className="rounded-xl border bg-white p-6">Carregando os indicadores…</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">Não foi possível carregar os indicadores. Confira sua conexão e clique em Atualizar.</p>}
      {metrics && data && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['OS em andamento', String(metrics.activeOrders), 'Situação atual, de todos os períodos'],
            ['Conversão de propostas', metrics.conversion === null ? '—' : `${metrics.conversion}%`, `${metrics.approved} aprovadas ou faturadas / ${metrics.quotes} propostas criadas no período`],
            ['Recebimentos registrados', money(metrics.received), 'Pagamentos marcados como pagos, pela data de pagamento'],
            ['Pagamentos pendentes', money(metrics.pending), 'Saldo dos registros pendentes, de todos os períodos'],
          ].map(([title, value, detail]) => <article key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm text-slate-600">{title}</h2><p className="my-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p><p className="text-xs leading-relaxed text-slate-500">{detail}</p>
          </article>)}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border bg-white p-5">
            <h2 className="flex items-center gap-2 font-semibold"><BarChart3 size={18} /> Carga de trabalho atual</h2>
            <p className="mt-1 text-xs text-slate-500">OS ativas por responsável. Não representa presença online ou produtividade.</p>
            <ul className="mt-5 space-y-4">
              {metrics.workload.map(([id, count]) => <li key={id || 'unassigned'}>
                <div className="mb-1 flex justify-between gap-3 text-sm"><span>{id ? data.users.find((u) => u.id === id)?.name || 'Responsável não disponível' : 'Sem responsável'}</span><strong>{count}</strong></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${count / Math.max(1, metrics.activeOrders) * 100}%` }} /></div>
              </li>)}
              {!metrics.workload.length && <li className="py-5 text-sm text-slate-500">Nenhuma OS ativa.</li>}
            </ul>
          </section>
          <section className="rounded-xl border bg-white p-5">
            <h2 className="font-semibold">Prioridades da operação</h2>
            <div className="my-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-amber-50 p-4"><p className="text-2xl font-bold text-amber-900">{metrics.waitingParts}</p><p className="text-xs text-amber-900">OS aguardando peças</p></div>
              <div className="rounded-lg bg-indigo-50 p-4"><p className="text-2xl font-bold text-indigo-900">{metrics.unassigned}</p><p className="text-xs text-indigo-900">OS sem responsável</p></div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-indigo-700" to="/ordens">Abrir ordens <ArrowRight size={15} /></Link>
              <Link className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-indigo-700" to="/orcamentos">Abrir orçamentos <ArrowRight size={15} /></Link>
            </div>
          </section>
        </div>
        <p className="text-xs text-slate-500">Atualizado em {loadedAt?.toLocaleString('pt-BR')}. Período conforme o horário deste dispositivo. Valores refletem os registros do sistema; não são conciliação bancária.</p>
      </>}

      <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold text-emerald-950"><MessageCircle size={20} /> Central WhatsApp JUCA</h2><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900">Aguardando conexão</span></div>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">O número da empresa ainda não está conectado. As conversas, filas, tempos de resposta e transferências entre setores ficarão disponíveis após a integração.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Atendimento', 'Recepção e encaminhamento'], ['Vendas', 'Negociações e propostas'],
            ['Assistência', 'Acompanhamento das OS'], ['Caixa', 'Pagamentos e comprovantes'], ['Gestão', 'Supervisão de todos os setores'],
          ].map(([name, description]) => <div key={name} className="rounded-lg border border-emerald-100 bg-white p-4"><h3 className="text-sm font-semibold">{name}</h3><p className="mt-1 text-xs text-slate-500">{description}</p><p className="mt-3 text-xs text-slate-400">Configuração pendente</p></div>)}
        </div>
      </section>
    </div>
  )
}
