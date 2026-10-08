import { buildContractSnapshot, contractMissingDetails } from '@/lib/rental-contract-template'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/StatusBadge'
import { DashboardProductSearchModal } from '@/components/DashboardProductSearchModal'
import { ExportReportsModal } from '@/components/ExportReportsModal'
import { ExportOrdersListModal } from '@/components/ExportOrdersListModal'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'

// METRICS_START
const zone = 'America/Campo_Grande'
function instant(value: any) {
  if (!value) return NaN
  const text = String(value).replace(' ', 'T')
  return Date.parse(text.length > 10 && !/(Z|[+-]\d\d:\d\d)$/.test(text) ? text + 'Z' : text)
}
function day(value: any) {
  const time = typeof value === 'number' ? value : instant(value)
  if (!Number.isFinite(time)) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time))
  const part = (type: string) => parts.find((p) => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
function validAmount(value: any) {
  return (
    value !== null &&
    value !== '' &&
    value !== undefined &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0
  )
}
function sum(rows: any[], field: string) {
  return rows.reduce((n, r) => n + (validAmount(r[field]) ? Number(r[field]) : 0), 0)
}
function metrics(data: any, start: string, end: string, now: number) {
  const { orders, quotes, payments, history } = data
  const within = (value: any) => {
    const date = day(value)
    return Boolean(date && date >= start && date <= end)
  }
  const terminal = ['completed', 'closed', 'cancelled', 'orcamento_rejeitado']
  const active = orders.filter((o: any) => !terminal.includes(o.status))
  const completion = new Map<string, number>()
  for (const h of history) {
    const time = instant(h.created)
    if (h.status === 'completed' && Number.isFinite(time))
      completion.set(h.service_order, Math.max(completion.get(h.service_order) || 0, time))
  }
  const finished = orders.filter((o: any) => ['completed', 'closed'].includes(o.status))
  const completed = finished.filter((o: any) => within(completion.get(o.id)))
  const missingCompletion = finished.filter((o: any) => !completion.has(o.id))
  const negotiations = quotes.filter((q: any) =>
    ['enviado', 'aguardando_aprovacao'].includes(q.status),
  )
  const drafts = quotes.filter((q: any) => q.status === 'rascunho')
  const paid = payments.filter((p: any) => p.status === 'paid' && within(p.paid_at))
  const pending = payments.filter((p: any) => p.status === 'pending')
  const age = (o: any) =>
    Number.isFinite(instant(o.created))
      ? Math.max(0, Math.floor((now - instant(o.created)) / 86400000))
      : null
  const rank = (o: any) =>
    !o.technician
      ? 0
      : o.priority === 'urgent' || o.priority === 'high'
        ? 1
        : o.status === 'aguardando_orcamento'
          ? 2
          : 3
  const queue = [...active].sort(
    (a: any, b: any) => rank(a) - rank(b) || (age(b) ?? -1) - (age(a) ?? -1),
  )
  return {
    active,
    completed,
    missingCompletion,
    negotiations,
    drafts,
    paid,
    pending,
    queue,
    age,
    noTech: active.filter((o: any) => !o.technician),
    awaiting: active.filter((o: any) => o.status === 'aguardando_orcamento'),
    parts: active.filter((o: any) => o.status === 'waiting_parts'),
    old: active.filter((o: any) => (age(o) ?? 0) > 7),
    missingPaidDate: payments.filter((p: any) => p.status === 'paid' && !day(p.paid_at)),
    noCustomer: orders.filter((o: any) => !o.customer),
    quoteNoCustomer: quotes.filter(
      (q: any) =>
        q.status !== 'substituido' &&
        !q.cliente_id &&
        !q.nome_cliente_livre &&
        !q.expand?.id_os?.customer,
    ),
    invalidOrders: orders.filter((o: any) => !validAmount(o.total)),
    invalidPayments: payments.filter((p: any) => !validAmount(p.amount)),
    invalidQuotes: quotes.filter(
      (q: any) => q.status !== 'substituido' && !validAmount(q.total_geral),
    ),
    zeroNegotiations: negotiations.filter((q: any) => Number(q.total_geral) === 0),
  }
}
// METRICS_END
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateLabel = (d: string) => (d ? d.split('-').reverse().join('/') : 'Sem data')
const customer = (o: any) =>
  o.expand?.customer?.razao_social ||
  o.expand?.customer?.nome_fantasia ||
  o.expand?.customer?.name ||
  'Cliente não identificado'
const initialData = { orders: [], quotes: [], payments: [], history: [], users: [] }

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(0)
  const [period, setPeriod] = useState('month')
  const today = day(Date.now())
  const [startInput, setStartInput] = useState(today)
  const [endInput, setEndInput] = useState(today)
  const [detail, setDetail] = useState<any>(null)
  const [productOpen, setProductOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const request = useRef(0)
  const load = useCallback(async () => {
    if (!user?.id) return
    const current = ++request.current
    setLoading(true)
    try {
      // Read directly: failures must propagate instead of becoming empty arrays.
      const [orders, quotes, payments, history, users] = await Promise.all([
        pb
          .collection('service_orders')
          .getFullList({ expand: 'customer,technician', requestKey: null }),
        pb.collection('orcamentos').getFullList({
          expand: 'cliente_id,responsavel_id,id_usuario_criador,id_os,id_os.customer',
          requestKey: null,
        }),
        pb.collection('payments').getFullList({ requestKey: null }),
        pb.collection('status_history').getFullList({ requestKey: null }),
        pb.collection('users').getFullList({ requestKey: null }),
      ])
      if (current !== request.current) return
      const scoped =
        user.role === 'technician' ? orders.filter((o) => o.technician === user.id) : orders
      const ids = new Set(scoped.map((o) => o.id))
      setData({
        orders: scoped,
        users,
        quotes:
          user.role === 'technician'
            ? quotes.filter((q) =>
                q.id_os ? ids.has(q.id_os) : (q.responsavel_id || q.id_usuario_criador) === user.id,
              )
            : quotes,
        payments:
          user.role === 'technician' ? payments.filter((p) => ids.has(p.service_order)) : payments,
        history:
          user.role === 'technician' ? history.filter((h) => ids.has(h.service_order)) : history,
      })
      setUpdated(Date.now())
      setError('')
    } catch {
      if (current === request.current)
        setError(
          'Não foi possível conferir todas as fontes. Indicadores indisponíveis; tente atualizar.',
        )
    } finally {
      if (current === request.current) setLoading(false)
    }
  }, [user?.id, user?.role])
  useEffect(() => {
    load()
    return () => {
      request.current++
    }
  }, [load])
  useRealtime('service_orders', load)
  useRealtime('orcamentos', load)
  useRealtime('payments', load)
  useRealtime('status_history', load)
  useRealtime('users', load)
  let start = today,
    end = today
  if (period === 'month') start = today.slice(0, 8) + '01'
  if (period === 'week') {
    const d = new Date(today + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    start = d.toISOString().slice(0, 10)
  }
  if (period === 'custom') {
    start = startInput
    end = endInput
  }
  const rangeValid = Boolean(start && end && start <= end)
  const m = metrics(data, start, end, updated || Date.now())
  const users = new Map<string, any>(data.users.map((u: any) => [u.id, u]))
  const name = (id: string) => users.get(id)?.name?.trim() || 'Sem responsável'
  const show = (title: string, rows: any[], kind = 'orders', note = '') =>
    setDetail({ title, rows, kind, note })
  const card = (
    title: string,
    value: string,
    note: string,
    rows: any[],
    kind = 'orders',
    color = 'text-slate-900',
  ) => (
    <button
      className="rounded-xl border bg-white p-4 text-left shadow-sm hover:border-indigo-400 focus-visible:outline-indigo-600"
      onClick={() => show(title, rows, kind, note)}
    >
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className={`my-2 text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{note}</p>
      <p className="mt-3 text-xs font-semibold text-indigo-600">Conferir registros →</p>
    </button>
  )
  const renderRows = (rows: any[], kind: string) => (
    <div className="overflow-auto max-h-[500px]">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50">
          <tr>
            <th className="p-3">Registro / Cliente</th>
            <th className="p-3">Responsável / Situação</th>
            <th className="p-3">Data / Idade</th>
            <th className="p-3 text-right">Valor registrado</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r: any) => {
            const order =
              kind === 'payments' ? data.orders.find((o: any) => o.id === r.service_order) : r
            const isQuote = kind === 'quotes'
            const href = isQuote ? `/orcamentos/${r.id}` : order?.id ? `/ordens/${order.id}` : ''
            const title = isQuote
              ? r.numero_orcamento
              : kind === 'payments'
                ? `Pagamento ${r.id} · ${order?.number || 'sem OS acessível'}`
                : r.number
            const client = isQuote
              ? r.expand?.cliente_id?.razao_social ||
                r.expand?.cliente_id?.name ||
                r.nome_cliente_livre ||
                customer(r.expand?.id_os || {})
              : customer(order || {})
            const value = isQuote ? r.total_geral : kind === 'payments' ? r.amount : r.total
            return (
              <tr key={r.id}>
                <td className="p-3">
                  {href ? (
                    <Link className="text-indigo-700 font-semibold underline" to={href}>
                      {title}
                    </Link>
                  ) : (
                    title
                  )}
                  <p className="text-xs text-slate-600">{client}</p>
                </td>
                <td className="p-3">
                  {isQuote
                    ? name(r.responsavel_id || r.id_usuario_criador)
                    : name(order?.technician)}
                  <div className="text-xs mt-1">
                    {kind === 'orders' ? (
                      <StatusBadge status={r.status} />
                    ) : (
                      (
                        {
                          paid: 'Recebido',
                          pending: 'Pendente',
                          enviado: 'Enviado',
                          aguardando_aprovacao: 'Aguardando aprovação',
                          rascunho: 'Rascunho',
                          aprovado: 'Aprovado',
                          faturado: 'Faturado',
                        } as any
                      )[r.status] || r.status
                    )}
                  </div>
                </td>
                <td className="p-3 text-xs">
                  {kind === 'payments'
                    ? dateLabel(day(r.paid_at))
                    : `${m.age(r) ?? '—'} dias desde a criação`}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {validAmount(value) ? money(Number(value)) : 'Valor inválido'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!rows.length && <p className="p-6 text-slate-500">Nenhum registro neste grupo.</p>}
    </div>
  )
  const quality = [
    ['OS concluídas sem histórico de conclusão', m.missingCompletion, 'orders'],
    ['Pagamentos recebidos sem data válida', m.missingPaidDate, 'payments'],
    ['OS sem cliente', m.noCustomer, 'orders'],
    ['Orçamentos ativos sem cliente identificado', m.quoteNoCustomer, 'quotes'],
    ['OS com valor inválido', m.invalidOrders, 'orders'],
    ['Pagamentos com valor inválido', m.invalidPayments, 'payments'],
    ['Orçamentos com valor inválido', m.invalidQuotes, 'quotes'],
    ['Negociações com valor zero', m.zeroNegotiations, 'quotes'],
  ].filter((row: any) => row[1].length) as any[]
  const techIds = Array.from(
    new Set<string>([
      ...data.users.filter((u: any) => u.role === 'technician').map((u: any) => u.id),
      ...data.orders.map((o: any) => o.technician || ''),
    ]),
  )
  const available = !error && updated > 0
  return (
    <div className="space-y-6 pb-8">
      <RentalDashboardPanel />
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            JUCA INFORMÁTICA · {user?.role === 'technician' ? 'Minha operação' : 'Visão de gestão'}
          </p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">O que precisa de atenção</h1>
          <p className="text-xs text-slate-500 mt-2">
            {updated
              ? `Última conferência: ${new Date(updated).toLocaleString('pt-BR', { timeZone: zone })} · horário de MS`
              : 'Conferindo registros…'}
            {loading && updated > 0 ? ' · Atualizando…' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            Atualizar
          </Button>
          <Button variant="outline" onClick={() => setProductOpen(true)}>
            Estoque
          </Button>
          {available && (
            <>
              <Button variant="outline" onClick={() => setExportOpen(true)}>
                Relatórios
              </Button>
              <Button variant="outline" onClick={() => setListOpen(true)}>
                Lista OS
              </Button>
            </>
          )}
        </div>
      </header>
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
          {error}
        </div>
      )}
      {!updated && loading && <p>Carregando dados reais…</p>}
      {available && (
        <>
          <section>
            <h2 className="font-bold text-lg">Situação atual</h2>
            <p className="text-xs text-slate-500 mb-3">
              Todas as pendências atuais, independentemente da data de criação. Os grupos de OS
              podem se sobrepor.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {card(
                'OS em aberto',
                String(m.active.length),
                'Exclui concluídas, fechadas, canceladas e rejeitadas.',
                m.active,
              )}
              {card(
                'Sem técnico',
                String(m.noTech.length),
                'Distribuir os atendimentos sem responsável.',
                m.noTech,
                'orders',
                'text-rose-700',
              )}
              {card(
                'Aguardando orçamento',
                String(m.awaiting.length),
                'Preparar proposta para o cliente.',
                m.awaiting,
                'orders',
                'text-amber-700',
              )}
              {card(
                'Aguardando peças',
                String(m.parts.length),
                'Conferir compra e chegada de materiais.',
                m.parts,
              )}
            </div>
          </section>
          <section className="rounded-xl border bg-white overflow-hidden">
            <div className="p-4 border-b flex flex-wrap justify-between gap-2">
              <div>
                <h2 className="font-bold">Fila de prioridades</h2>
                <p className="text-xs text-slate-500">
                  Sem técnico → prioridade alta → aguardando orçamento → mais antigas. Idade não
                  significa prazo vencido.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => show('Todas as OS em aberto', m.queue)}
              >
                Ver todas ({m.queue.length})
              </Button>
            </div>
            {renderRows(m.queue.slice(0, 6), 'orders')}
            <button
              className="p-3 text-sm text-indigo-700 underline"
              onClick={() => show('OS abertas há mais de 7 dias', m.old)}
            >
              Conferir {m.old.length} OS abertas há mais de 7 dias
            </button>
          </section>
          <section>
            <h2 className="font-bold text-lg">Negociação e cobrança · situação atual</h2>
            <p className="text-xs text-slate-500 mb-3">
              Valores separados: propostas ainda não são recebimentos. Administrador e não
              atribuídos estão incluídos.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {card(
                'Em negociação',
                money(sum(m.negotiations, 'total_geral')),
                `${m.negotiations.length} enviados ou aguardando aprovação.`,
                m.negotiations,
                'quotes',
                'text-amber-700',
              )}
              {card(
                'Rascunhos',
                String(m.drafts.length),
                'Ainda em preparação; fora das negociações.',
                m.drafts,
                'quotes',
              )}
              {card(
                'Pagamentos pendentes registrados',
                money(sum(m.pending, 'amount')),
                `${m.pending.length} lançamentos pendentes. Não é o saldo de todas as OS.`,
                m.pending,
                'payments',
              )}
            </div>
          </section>
          <section className="rounded-xl border bg-slate-50 p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg">Produção e recebimentos</h2>
                <p className="text-xs text-slate-600">
                  {rangeValid
                    ? `${dateLabel(start)} a ${dateLabel(end)} · horário de MS`
                    : 'Informe um intervalo válido.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ['today', 'Hoje'],
                  ['week', 'Semana'],
                  ['month', 'Mês'],
                  ['custom', 'Personalizado'],
                ].map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={period === key ? 'default' : 'outline'}
                    onClick={() => {
                      setPeriod(key)
                      setDetail(null)
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {period === 'custom' && (
              <div className="flex flex-wrap gap-3 mt-3">
                <label className="text-xs">
                  De
                  <Input
                    aria-label="Data inicial"
                    type="date"
                    value={startInput}
                    onChange={(e) => {
                      setStartInput(e.target.value)
                      setDetail(null)
                    }}
                  />
                </label>
                <label className="text-xs">
                  Até
                  <Input
                    aria-label="Data final"
                    type="date"
                    value={endInput}
                    onChange={(e) => {
                      setEndInput(e.target.value)
                      setDetail(null)
                    }}
                  />
                </label>
              </div>
            )}
            {rangeValid && (
              <>
                <div className="grid sm:grid-cols-3 gap-3 mt-4">
                  {card(
                    'OS concluídas no período',
                    String(m.completed.length),
                    'Pelo último evento de conclusão; apenas OS atualmente concluídas ou fechadas.',
                    m.completed,
                  )}
                  {card(
                    'Valor das OS concluídas',
                    money(sum(m.completed, 'total')),
                    'Valor atual dessas OS. Não é lucro nem dinheiro recebido.',
                    m.completed,
                  )}
                  {card(
                    'Recebimentos registrados no período',
                    money(sum(m.paid, 'amount')),
                    `${m.paid.length} pagamentos confirmados, pela data de recebimento.`,
                    m.paid,
                    'payments',
                    'text-emerald-700',
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-3">
                  Recebimentos dependem dos lançamentos no sistema; não representam conciliação
                  bancária. Sem somar orçamento e OS do mesmo serviço.
                </p>
                <div className="overflow-auto bg-white rounded-lg border mt-4">
                  <table className="w-full text-sm">
                    <thead className="text-left bg-slate-100">
                      <tr>
                        <th className="p-3">Responsável atual</th>
                        <th className="p-3">OS abertas agora</th>
                        <th className="p-3">Concluídas no período</th>
                        <th className="p-3 text-right">Valor concluído</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {techIds.map((id) => {
                        const active = m.active.filter((o: any) => (o.technician || '') === id)
                        const done = m.completed.filter((o: any) => (o.technician || '') === id)
                        return (
                          <tr key={id || 'none'}>
                            <td className="p-3 font-medium">{name(id)}</td>
                            <td className="p-3">
                              <button
                                className="underline text-indigo-700"
                                onClick={() => show(`OS abertas · ${name(id)}`, active)}
                              >
                                {active.length}
                              </button>
                            </td>
                            <td className="p-3">
                              <button
                                className="underline text-indigo-700"
                                onClick={() => show(`Concluídas · ${name(id)}`, done)}
                              >
                                {done.length}
                              </button>
                            </td>
                            <td className="p-3 text-right">{money(sum(done, 'total'))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="font-bold">Qualidade dos dados</h2>
            <p className="text-xs text-slate-600 mt-1">
              Sem estimar datas ausentes. Valores inválidos não entram nas somas; confira os
              registros abaixo.
            </p>
            {quality.length ? (
              <div className="flex flex-wrap gap-2 mt-3">
                {quality.map(([label, rows, kind]) => (
                  <button
                    key={label}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm underline"
                    onClick={() => show(label, rows, kind)}
                  >
                    {label}: {rows.length}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm mt-2">
                Nenhuma pendência encontrada nos critérios verificados.
              </p>
            )}
          </section>
          {detail && (
            <section
              className="rounded-xl border-2 border-indigo-300 bg-white overflow-hidden"
              aria-label="Registros do indicador"
            >
              <div className="p-4 flex justify-between gap-3">
                <div>
                  <h2 className="font-bold">
                    {detail.title} · {detail.rows.length} registros
                  </h2>
                  <p className="text-xs text-slate-500">{detail.note}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setDetail(null)}>
                  Fechar detalhes
                </Button>
              </div>
              {renderRows(detail.rows, detail.kind)}
            </section>
          )}
          <p className="text-xs text-slate-500">
            Base conferida: {data.orders.length} OS · {data.quotes.length} orçamentos ·{' '}
            {data.payments.length} pagamentos. Clique em “Conferir registros” para abrir os detalhes
            ao final do painel.
          </p>
        </>
      )}
      <DashboardProductSearchModal open={productOpen} onOpenChange={setProductOpen} />
      <ExportReportsModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        orders={data.orders}
        payments={data.payments}
        technicians={data.users.filter((u: any) => u.role === 'technician')}
        history={data.history}
      />
      <ExportOrdersListModal
        open={listOpen}
        onOpenChange={setListOpen}
        orders={data.orders}
        payments={data.payments}
      />
    </div>
  )
}

// Rental alerts are independent from the dashboard's cash/OS date filter.
export function rentalDate(value: any) {
  const d = String(value || '').slice(0, 10)
  const time = Date.parse(d + 'T12:00:00Z')
  return /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === d
    ? d
    : ''
}
export function rentalAddMonths(value: string, months: number) {
  if (!rentalDate(value) || !Number.isInteger(months) || months < 1) return ''
  const [y, m, d] = value.split('-').map(Number)
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10)
}
export function rentalSummary(c: any, today: string) {
  const e = c.equipamento_dados || {},
    management = e.gestao_locacao || {}
  const actual = rentalDate(management.inicio_efetivo)
  const start = actual || rentalDate(c.data_inicio)
  const end =
    rentalDate(management.fim_vigencia) || rentalAddMonths(start, Number(c.contrato_meses))
  const days = end
    ? Math.round((Date.parse(end + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000)
    : null
  return {
    actual,
    start,
    end,
    days,
    management,
    legacy: !e.modelo_contrato?.version,
    due: rentalAddMonths(rentalDate(management.ultimo_reajuste) || actual || start, 12),
  }
}
export function rentalCorrection(
  monthly: number,
  excess: number,
  rate: number,
  positiveOnly: boolean,
) {
  if (![monthly, excess, rate].every(Number.isFinite) || monthly < 0 || excess < 0 || rate <= -100)
    throw new Error('Valores inválidos para reajuste.')
  const applied = positiveOnly ? Math.max(0, rate) : rate
  return {
    rate: applied,
    monthly: Math.round((monthly * (1 + applied / 100) + Number.EPSILON) * 100) / 100,
    excess: Math.round((excess * (1 + applied / 100) + Number.EPSILON) * 10000) / 10000,
  }
}
function RentalDashboardPanel() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<any[]>([])
  const [failure, setFailure] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [index, setIndex] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [renewalMonths, setRenewalMonths] = useState(12)
  const [renewalStart, setRenewalStart] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const today = day(Date.now())
  const refresh = useCallback(async () => {
    if (user?.role !== 'admin') return
    try {
      const rows = await pb
        .collection('rental_contracts')
        .getFullList({ sort: 'numero', requestKey: null })
      setContracts(rows)
      setFailure('')
      setReady(true)
    } catch {
      setFailure(
        'Não foi possível conferir os contratos. Os totais de locação estão indisponíveis.',
      )
      setReady(false)
    }
  }, [user?.role])
  useEffect(() => {
    refresh()
    const focus = () => refresh()
    window.addEventListener('focus', focus)
    return () => window.removeEventListener('focus', focus)
  }, [refresh])
  const testContracts = contracts.filter((c) => c.equipamento_dados?.registro_teste === true)
  const active = contracts.filter(
    (c) => c.status === 'ativo' && c.equipamento_dados?.registro_teste !== true,
  )
  const rows = active
    .map((c) => ({ c, s: rentalSummary(c, today) }))
    .sort((a, b) => (a.s.days ?? Infinity) - (b.s.days ?? Infinity))
  const alerts = rows.filter((r) => r.s.days !== null && r.s.days <= 90)
  const missing = rows.filter(
    (r) =>
      !r.s.actual ||
      !r.s.end ||
      !r.c.equipamento_dados?.serial ||
      !r.c.locatario_dados?.nome ||
      /^\d+$/.test(r.c.locatario_dados.nome),
  )
  const inspect = async (c: any) => {
    if (busy) return
    setSelected(c)
    setIndex(null)
    setMessage('')
    setBusy(true)
    setReviewed(false)
    setRenewalMonths(Number(c.contrato_meses) || 12)
    setRenewalStart(rentalSummary(c, today).end)
    try {
      const s = rentalSummary(c, today)
      if (!s.due) throw new Error('Informe o início da locação no contrato antes de calcular.')
      const d = new Date(s.due + 'T12:00:00Z')
      d.setUTCDate(1)
      d.setUTCMonth(d.getUTCMonth() - 1)
      const period = d.toISOString().slice(0, 7).replace('-', '')
      if (period >= today.slice(0, 7).replace('-', ''))
        throw new Error(
          'O IPCA do período deste reajuste ainda não foi publicado. O contrato será revisado no aniversário; nenhum índice futuro será estimado.',
        )
      // Official national IPCA accumulated over 12 months, never a future estimate.
      const source = `https://servicodados.ibge.gov.br/api/v3/agregados/1737/periodos/${period}/variaveis/2265?localidades=N1%5B1%5D`
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 15000)
      let response: Response
      try {
        response = await fetch(source, { signal: controller.signal, credentials: 'omit' })
      } finally {
        window.clearTimeout(timeout)
      }
      if (!response.ok)
        throw new Error(
          'O IBGE não disponibilizou o índice para esse período. Nenhum valor foi estimado.',
        )
      const payload = await response.json()
      const variable = payload?.[0]
      if (
        String(variable?.id) !== '2265' ||
        !String(variable?.variavel).toLowerCase().includes('12 meses') ||
        variable?.unidade !== '%'
      )
        throw new Error('A resposta do IBGE não corresponde ao IPCA acumulado em 12 meses.')
      const series = variable.resultados
        ?.flatMap((r: any) => r.series || [])
        .find((r: any) => String(r.localidade?.id) === '1')?.serie
      const raw = series?.[period]
      if (raw === undefined || !/^-?\d+(\.\d+)?$/.test(String(raw)))
        throw new Error(
          'Índice ainda não publicado para o aniversário do contrato. Tente novamente após a divulgação do IBGE.',
        )
      const rate = Number(raw),
        result = rentalCorrection(
          Number(c.valor_mensal),
          Number(c.excesso_pagina_valor),
          rate,
          s.legacy,
        )
      setIndex({
        period,
        source,
        officialRate: rate,
        ...result,
        due: s.due,
        consultedAt: new Date().toISOString(),
      })
    } catch (e: any) {
      setMessage(e.message || 'Não foi possível consultar o IPCA. Nenhum valor foi alterado.')
    } finally {
      setBusy(false)
    }
  }
  const setTest = async (c: any, isTest: boolean) => {
    if (busy || user?.role !== 'admin') return
    setBusy(true)
    try {
      const fresh = await pb.collection('rental_contracts').getOne(c.id, { requestKey: null })
      await pb.collection('rental_contracts').update(
        c.id,
        {
          equipamento_dados: {
            ...fresh.equipamento_dados,
            registro_teste: isTest,
            classificacao_teste: { por: user.id, em: new Date().toISOString() },
          },
        },
        { requestKey: null },
      )
      const saved = await pb.collection('rental_contracts').getOne(c.id, { requestKey: null })
      if (saved.equipamento_dados?.registro_teste !== isTest)
        throw new Error('Classificação não confirmada.')
      await refresh()
      setMessage('Classificação de teste atualizada. Registro preservado.')
    } catch (e: any) {
      setFailure('Não foi possível confirmar a classificação de teste. Atualize para conferir.')
    } finally {
      setBusy(false)
    }
  }
  const prepareRenewal = async () => {
    if (busy || !selected || !index || !reviewed || user?.role !== 'admin') return
    setBusy(true)
    setMessage('')
    try {
      const fresh = await pb
        .collection('rental_contracts')
        .getOne(selected.id, { requestKey: null })
      if (fresh.updated !== selected.updated || fresh.status !== 'ativo')
        throw new Error('O contrato mudou. Feche e consulte o reajuste novamente.')
      const s = rentalSummary(fresh, today),
        snap = fresh.equipamento_dados?.modelo_contrato
      if (!s.actual)
        throw new Error('Confirme primeiro a data efetiva de instalação no cadastro do contrato.')
      if (!snap?.version || contractMissingDetails(snap.details || {}).length)
        throw new Error(
          'Complete e revise os dados do contrato no modelo atual antes de preparar a renovação.',
        )
      if (
        today < s.due ||
        !rentalDate(renewalStart) ||
        renewalStart < s.end ||
        !Number.isInteger(renewalMonths) ||
        renewalMonths < 1 ||
        renewalMonths > 120
      )
        throw new Error(
          'Confira o aniversário do reajuste, início da nova vigência e prazo de 1 a 120 meses.',
        )
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(fresh.id + ':renovacao:' + index.period),
      )
      const id = Array.from(new Uint8Array(digest))
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 15)
      const existing = await pb
        .collection('rental_contracts')
        .getList(1, 1, { filter: pb.filter('id = {:id}', { id }), requestKey: null })
      if (existing.items.length) {
        setMessage(
          'Já existe um rascunho de renovação para esse período. Abra-o na lista de contratos.',
        )
        return
      }
      const number = fresh.numero + '-R' + index.period
      const snapshot = buildContractSnapshot(
        {
          ...snap.data,
          numeroContrato: number,
          valorMensal: index.monthly,
          valorExcedentePagina: index.excess,
          prazoMeses: renewalMonths,
          dataInicio: renewalStart,
        },
        { ...snap.details },
        snap.adicionais || '',
      )
      const payload = {
        id,
        numero: number,
        proposta: fresh.proposta,
        locatario_dados: fresh.locatario_dados,
        franquia_paginas: fresh.franquia_paginas,
        valor_mensal: index.monthly,
        excesso_pagina_valor: index.excess,
        contrato_meses: renewalMonths,
        data_inicio: renewalStart,
        status: 'rascunho',
        equipamento_dados: {
          ...fresh.equipamento_dados,
          gestao_locacao: {},
          modelo_contrato: snapshot,
          renovacao_de: fresh.id,
          reajuste_preparado: {
            ...index,
            anterior_mensal: Number(fresh.valor_mensal),
            anterior_excedente: Number(fresh.excesso_pagina_valor),
            inicio_efetivo_origem: s.actual,
            por: user.id,
            em: new Date().toISOString(),
          },
        },
      }
      await pb.collection('rental_contracts').create(payload, { requestKey: null })
      const saved = await pb.collection('rental_contracts').getOne(id, { requestKey: null })
      if (saved.status !== 'rascunho' || Number(saved.valor_mensal) !== index.monthly)
        throw new Error(
          'O rascunho foi enviado, mas a conferência não terminou. Verifique a lista antes de repetir.',
        )
      setMessage(
        'Reajuste aplicado somente ao novo rascunho ' +
          number +
          '. O contrato original permanece intacto. Revise e recolha a concordância do cliente antes de ativar a renovação.',
      )
      setReviewed(false)
      refresh()
    } catch (e: any) {
      setMessage(e.message || 'Não foi possível preparar a renovação.')
    } finally {
      setBusy(false)
    }
  }
  if (user?.role !== 'admin') return null
  return (
    <section
      className="rounded-xl border bg-white p-5 space-y-4"
      aria-label="Impressoras locadas e contratos"
    >
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Impressoras locadas · contratos</h2>
          <p className="text-xs text-slate-500">
            Posição atual, independente do filtro financeiro. Alertas ao abrir o dashboard.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="text-sm underline" onClick={refresh}>
            Conferir contratos
          </button>
          <Link className="text-sm underline" to="/locacao?aba=contratos_lista">
            Gerenciar locações
          </Link>
        </div>
      </div>
      {failure ? (
        <p role="alert" className="text-red-700">
          {failure}
        </p>
      ) : !ready ? (
        <p>Conferindo locações…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs">Contratos ativos / equipamentos previstos</p>
              <strong className="text-2xl">{active.length}</strong>
              <p className="text-xs">
                Instalação comprovada em{' '}
                {rows.filter((r) => r.s.actual && r.c.equipamento_dados?.serial).length}; demais
                pendentes de conferência.
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs">Mensalidade contratada</p>
              <strong className="text-xl">
                {active.every((c) => validAmount(c.valor_mensal))
                  ? money(sum(active, 'valor_mensal'))
                  : 'Conferir valores'}
              </strong>
              <p className="text-xs">Sem excedentes. Não representa recebimento.</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs">Vencidos ou até 90 dias</p>
              <strong className="text-2xl">{alerts.length}</strong>
              <p className="text-xs">
                {alerts.filter((r) => r.s.days! < 0).length} vencidos ·{' '}
                {alerts.filter((r) => r.s.days! >= 0 && r.s.days! <= 30).length} até 30 dias
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs">Cadastros a conferir</p>
              <strong className="text-2xl">{missing.length}</strong>
              <p className="text-xs">Cliente, série ou início efetivo pendente.</p>
            </div>
          </div>
          {alerts.length > 0 && (
            <p role="alert" className="rounded bg-amber-50 p-3 text-sm">
              Atenção: {alerts.length} contrato(s) precisam de revisão de vencimento. Datas sem
              instalação confirmada são previsões.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Cliente / contrato</th>
                  <th>Equipamento / franquia</th>
                  <th>Mensalidade</th>
                  <th>Vencimento</th>
                  <th>Reajuste</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? rows : rows.slice(0, 8)).map(({ c, s }) => (
                  <tr key={c.id} className="border-b align-top">
                    <td className="py-3 pr-3">
                      <Link
                        className="underline"
                        to={'/locacao?contrato=' + encodeURIComponent(c.id)}
                      >
                        {c.numero}
                      </Link>
                      <button
                        className="block text-xs underline text-slate-500 mt-1"
                        disabled={busy}
                        onClick={() => setTest(c, true)}
                      >
                        Marcar como teste
                      </button>
                      <div>
                        {c.locatario_dados?.nome && !/^\d+$/.test(c.locatario_dados.nome)
                          ? c.locatario_dados.nome
                          : 'Cliente: conferir cadastro'}
                      </div>
                    </td>
                    <td className="pr-3">
                      {c.equipamento_dados?.nome || 'Equipamento não informado'}
                      <div className="text-xs">
                        Série: {c.equipamento_dados?.serial || 'pendente'} ·{' '}
                        {c.franquia_paginas ?? '—'} páginas
                      </div>
                    </td>
                    <td className="pr-3">
                      {validAmount(c.valor_mensal) ? money(Number(c.valor_mensal)) : 'Conferir'}
                    </td>
                    <td className="pr-3">
                      {dateLabel(s.end)}
                      <div className="text-xs">
                        {s.days === null
                          ? 'Sem prazo válido'
                          : s.days < 0
                            ? `Vencido há ${-s.days} dias`
                            : s.days <= 30
                              ? `Até 30 dias: faltam ${s.days}`
                              : s.days <= 60
                                ? `Até 60 dias: faltam ${s.days}`
                                : s.days <= 90
                                  ? `Até 90 dias: faltam ${s.days}`
                                  : `Faltam ${s.days} dias`}
                      </div>
                      {!s.actual && (
                        <div className="text-xs text-amber-700">Previsão: confirmar instalação</div>
                      )}
                    </td>
                    <td>
                      <button className="underline" onClick={() => inspect(c)}>
                        Calcular / revisar
                      </button>
                      <p className="text-xs">
                        {s.legacy ? 'Na prorrogação · IPCA positivo' : 'Anual · IPCA'}
                        <br />
                        {dateLabel(s.due)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <p>Nenhum contrato real com status ativo.</p>}
          {testContracts.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer">
                Registros de teste: {testContracts.length} — excluídos dos indicadores e alertas
              </summary>
              {testContracts.map((c) => (
                <div className="flex gap-3 py-2" key={c.id}>
                  <Link className="underline" to={'/locacao?contrato=' + encodeURIComponent(c.id)}>
                    {c.numero}
                  </Link>
                  <button className="underline" disabled={busy} onClick={() => setTest(c, false)}>
                    Voltar a considerar como contrato real
                  </button>
                </div>
              ))}
            </details>
          )}
          {rows.length > 8 && (
            <button className="underline" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Mostrar menos' : 'Ver todos os contratos'}
            </button>
          )}
          {selected && (
            <div
              className="border rounded-lg p-4 space-y-3"
              role="region"
              aria-label="Revisão do reajuste"
            >
              <div className="flex justify-between">
                <h3 className="font-semibold">Revisão de reajuste · {selected.numero}</h3>
                <button
                  onClick={() => {
                    setSelected(null)
                    setIndex(null)
                  }}
                  disabled={busy}
                >
                  Fechar
                </button>
              </div>
              {busy && <p>Consultando IPCA oficial…</p>}
              {message && <p role="status">{message}</p>}
              {index && (
                <>
                  <p>
                    IPCA de 12 meses até {index.period.slice(4)}/{index.period.slice(0, 4)}:{' '}
                    {index.officialRate.toLocaleString('pt-BR')}%. Aplicável:{' '}
                    {index.rate.toLocaleString('pt-BR')}%.
                  </p>
                  <p>
                    Mensalidade: {money(Number(selected.valor_mensal))} →{' '}
                    <strong>{money(index.monthly)}</strong>. Excedente: R${' '}
                    {Number(selected.excesso_pagina_valor).toFixed(4)} → R${' '}
                    {index.excess.toFixed(4)} por página.
                  </p>
                  <a
                    className="underline text-sm"
                    href={index.source}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Conferir índice no IBGE
                  </a>
                </>
              )}
              <p className="text-xs text-slate-600">
                Simulação para revisão. O contrato assinado e as cobranças não são alterados por
                esta consulta. A data efetiva de instalação e eventuais reajustes anteriores
                precisam estar conferidos antes de aplicar.
              </p>
              {index && user?.role === 'admin' && (
                <div className="border-t pt-3 space-y-2">
                  <p className="font-medium">Aplicar na atualização do contrato</p>
                  <label className="block text-sm">
                    Início da renovação{' '}
                    <input
                      type="date"
                      className="border rounded p-1"
                      value={renewalStart}
                      onChange={(e) => setRenewalStart(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    Prazo em meses{' '}
                    <input
                      type="number"
                      min="1"
                      max="120"
                      className="border rounded p-1 w-24"
                      value={renewalMonths}
                      onChange={(e) => setRenewalMonths(Number(e.target.value))}
                    />
                  </label>
                  <label className="block text-sm">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                    />{' '}
                    Revisei a base, o período do índice e os dados. Quero preparar um rascunho para
                    negociar com o cliente.
                  </label>
                  <button
                    className="border rounded px-3 py-2 disabled:opacity-50"
                    disabled={
                      !reviewed ||
                      busy ||
                      !rentalSummary(selected, today).actual ||
                      !selected.equipamento_dados?.modelo_contrato?.version ||
                      today < index.due
                    }
                    onClick={prepareRenewal}
                  >
                    Aplicar reajuste no rascunho de renovação
                  </button>
                  <p className="text-xs">
                    Liberação após conferência do início efetivo, cadastro completo e aniversário
                    anual. Não ativa a renovação nem altera cobranças automaticamente.
                  </p>
                </div>
              )}
              <Link
                className="inline-block border rounded px-3 py-2"
                to={'/locacao?contrato=' + encodeURIComponent(selected.id)}
              >
                Abrir contrato para atualização
              </Link>
              {user?.role !== 'admin' && (
                <p className="text-xs">A aplicação do reajuste depende do administrador.</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
