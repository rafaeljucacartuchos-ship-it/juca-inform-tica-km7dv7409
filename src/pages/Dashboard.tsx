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
        pb
          .collection('orcamentos')
          .getFullList({
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
