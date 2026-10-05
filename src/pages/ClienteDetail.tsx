import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Customer, Equipment } from '@/types'
import { formatPhone } from '@/lib/phones'
import pb from '@/lib/pocketbase/client'
import { usePermissions } from '@/hooks/use-permissions'
import { useWorkspace } from '@/hooks/use-workspace'
import { NewEquipmentModal } from '@/components/NewEquipmentModal'
import { EditEquipmentModal } from '@/components/EditEquipmentModal'
import { EquipmentHistoryDialog } from '@/components/EquipmentHistoryDialog'
const historyLabels: Record<string, string> = {
  all: 'Visão geral',
  orders: 'Ordens de serviço',
  quotes: 'Orçamentos',
  rentals: 'Locação de impressoras',
  equipment: 'Equipamentos',
  reports: 'Laudos',
  appointments: 'Agendamentos',
  payments: 'Financeiro',
  documents: 'Documentos de locação',
}
const historyStatuses: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  paused: 'Pausada',
  waiting_parts: 'Aguardando peças',
  completed: 'Concluída',
  closed: 'Finalizada',
  cancelled: 'Cancelado',
  cancelado: 'Cancelado',
  rejeitado: 'Rejeitado',
  orcamento_rejeitado: 'Orçamento rejeitado',
  aguardando_orcamento: 'Aguardando orçamento',
  pending: 'Pendente',
  paid: 'Recebido',
  refunded: 'Estornado',
  scheduled: 'Agendado',
  no_show: 'Não compareceu',
  simulacao: 'Simulação',
  proposta_gerada: 'Proposta gerada',
  contratado: 'Contratado',
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  aprovado: 'Aprovado',
  enviado: 'Enviado',
  aguardando_aprovacao: 'Aguardando aprovação',
  substituido: 'Substituído',
  finalizado: 'Finalizado',
}
const historyMethods: Record<string, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  transfer: 'Transferência',
}
export function historyDate(value: any) {
  if (!value) return ''
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const iso = s.replace(' ', 'T')
  const date = new Date(/(Z|[+-]\d\d:\d\d)$/.test(iso) ? iso : iso + 'Z')
  if (!Number.isFinite(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function historyNormalize(value: any) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
export function historyBelongs(kind: string, r: any, id: string) {
  if (['orders', 'equipment', 'appointments'].includes(kind)) return r.customer === id
  if (kind === 'quotes')
    return r.cliente_id ? r.cliente_id === id : r.expand?.id_os?.customer === id
  if (kind === 'reports') return r.id_cliente === id
  if (kind === 'rentals')
    return r.collectionName === 'rental_quotes'
      ? r.cliente_id === id
      : r.expand?.proposta?.cliente_id === id
  if (kind === 'payments') return r.expand?.service_order?.customer === id
  if (kind === 'documents') return r.expand?.contract?.expand?.proposta?.cliente_id === id
  return false
}
type HistoryRow = {
  key: string
  kind: string
  record: any
  number: string
  description: string
  status: string
  date: string
  href?: string
  value?: number
  test: boolean
}
export function historyRow(kind: string, r: any): HistoryRow {
  const contract = kind === 'rentals' && r.collectionName === 'rental_contracts'
  const num =
    kind === 'orders'
      ? r.number
      : kind === 'quotes'
        ? r.numero_orcamento
        : kind === 'reports'
          ? r.numero_laudo
          : contract
            ? r.numero
            : kind === 'equipment'
              ? r.name
              : kind === 'payments'
                ? r.expand?.service_order?.number
                : kind === 'documents'
                  ? r.payload?.title
                  : kind === 'appointments'
                    ? 'Agendamento'
                    : r.titulo
  const desc =
    kind === 'orders'
      ? [r.title, r.equipment].filter(Boolean).join(' · ')
      : kind === 'quotes'
        ? [r.equipamento_independente, r.defeito_independente, r.observacoes]
            .filter(Boolean)
            .join(' · ')
        : kind === 'equipment'
          ? [r.brand, r.model, r.serial_number && 'Série ' + r.serial_number]
              .filter(Boolean)
              .join(' · ')
          : contract
            ? [
                r.equipamento_dados?.nome,
                r.equipamento_dados?.serial && 'Série ' + r.equipamento_dados.serial,
                `${r.franquia_paginas ?? '—'} páginas/mês`,
              ]
                .filter(Boolean)
                .join(' · ')
            : kind === 'rentals'
              ? `Proposta de locação · ${r.franquia_paginas ?? r.volume_mensal ?? '—'} páginas/mês · ${r.contrato_meses ?? '—'} meses`
              : kind === 'payments'
                ? `${historyMethods[r.method] || r.method || 'Forma não informada'} · ${r.paid_at ? 'Recebido em ' + historyDate(r.paid_at).split('-').reverse().join('/') : 'Sem data de recebimento'}`
                : kind === 'appointments'
                  ? [r.start_time, r.expand?.technician?.name, r.notes].filter(Boolean).join(' · ')
                  : kind === 'documents'
                    ? [r.payload?.category, r.payload?.name, r.expand?.contract?.numero]
                        .filter(Boolean)
                        .join(' · ')
                    : r.equipamento_nome || r.conclusao || 'Documento técnico'
  const amount =
    kind === 'orders'
      ? r.total
      : kind === 'quotes'
        ? r.total_geral
        : contract
          ? r.valor_mensal
          : kind === 'payments'
            ? r.amount
            : undefined
  const value =
    amount !== undefined && amount !== null && amount !== '' && Number.isFinite(Number(amount))
      ? Number(amount)
      : undefined
  const href =
    kind === 'orders'
      ? `/ordens/${r.id}`
      : kind === 'quotes'
        ? `/orcamentos/${r.id}`
        : kind === 'reports'
          ? `/laudos/${r.id}`
          : kind === 'rentals'
            ? `/locacao?${contract ? 'contrato' : 'proposta'}=${r.id}`
            : kind === 'payments' && r.service_order
              ? `/ordens/${r.service_order}`
              : kind === 'documents' && r.contract
                ? `/locacao?contrato=${r.contract}`
                : kind === 'appointments'
                  ? '/agendamentos'
                  : undefined
  return {
    key: kind + ':' + r.collectionName + ':' + r.id,
    kind,
    record: r,
    number: num || 'Registro ' + r.id,
    description: desc,
    status: r.status || '',
    date: historyDate(kind === 'appointments' ? r.date : r.created),
    href,
    value,
    test:
      r.equipamento_dados?.registro_teste === true ||
      r.expand?.contract?.equipamento_dados?.registro_teste === true,
  }
}
export function historyFilter(
  rows: HistoryRow[],
  query: string,
  status: string,
  from: string,
  to: string,
  showTests: boolean,
) {
  const q = historyNormalize(query)
  return rows.filter(
    (r) =>
      (showTests || !r.test) &&
      (!status || r.status === status) &&
      (!from || (r.date && r.date >= from)) &&
      (!to || (r.date && r.date <= to)) &&
      (!q ||
        historyNormalize(
          [
            r.number,
            r.description,
            historyStatuses[r.status] || r.status,
            historyLabels[r.kind],
          ].join(' '),
        ).includes(q)),
  )
}

export default function ClienteDetail() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin, hasPermission } = usePermissions()
  const { openTab } = useWorkspace()
  const capabilities = {
    orders: hasPermission('ordens'),
    quotes: hasPermission('orcamentos'),
    rentals: hasPermission('locacao'),
    equipment: hasPermission('equipamentos'),
    reports: hasPermission('laudos'),
    appointments: hasPermission('agendamentos'),
    payments: isAdmin,
    documents: isAdmin && hasPermission('locacao'),
  }
  const permissionKey = JSON.stringify(capabilities)
  const [state, setState] = useState<any>({ id: '', customer: null, groups: {}, error: '' })
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState('all'),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [showTests, setShowTests] = useState(false),
    [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false),
    [selectedEquip, setSelectedEquip] = useState<Equipment | null>(null),
    [historyOpen, setHistoryOpen] = useState(false),
    [editModalOpen, setEditModalOpen] = useState(false),
    [editModalTab, setEditModalTab] = useState<'edit' | 'photos'>('edit')
  const request = useRef(0)
  const load = useCallback(async () => {
    if (!id) return
    const token = ++request.current
    setLoading(true)
    const permissions = JSON.parse(permissionKey)
    const fetchRows = (collection: string, filter: string, expand = '') =>
      pb
        .collection(collection)
        .getFullList({
          filter: pb.filter(filter, { id }),
          sort: '-created',
          expand,
          requestKey: null,
        })
    try {
      const customer = await pb.collection('customers').getOne<Customer>(id, { requestKey: null })
      if (token !== request.current) return
      const calls: Record<string, () => Promise<any[]>> = {
        orders: () => fetchRows('service_orders', 'customer = {:id}', 'technician'),
        quotes: () =>
          fetchRows(
            'orcamentos',
            "cliente_id = {:id} || (cliente_id = '' && id_os.customer = {:id})",
            'id_os',
          ),
        rentals: async () => {
          const [q, c] = await Promise.all([
            fetchRows('rental_quotes', 'cliente_id = {:id}'),
            fetchRows('rental_contracts', 'proposta.cliente_id = {:id}', 'proposta'),
          ])
          return [...q, ...c]
        },
        equipment: () => fetchRows('equipment', 'customer = {:id}'),
        reports: () => fetchRows('laudos_tecnicos', 'id_cliente = {:id}'),
        appointments: () => fetchRows('appointments', 'customer = {:id}', 'technician'),
        payments: () => fetchRows('payments', 'service_order.customer = {:id}', 'service_order'),
        documents: () =>
          fetchRows(
            'rental_documents',
            "kind = 'manifest' && contract.proposta.cliente_id = {:id}",
            'contract,contract.proposta',
          ),
      }
      const keys = Object.keys(calls).filter((k) => permissions[k])
      const result = await Promise.allSettled(keys.map((k) => calls[k]()))
      if (token !== request.current) return
      const groups: any = {}
      keys.forEach((k, i) => {
        const r = result[i]
        groups[k] =
          r.status === 'fulfilled'
            ? {
                rows: r.value
                  .filter((row) => historyBelongs(k, row, id))
                  .map((row) => historyRow(k, row)),
                error: '',
              }
            : {
                rows: [],
                error:
                  'Não foi possível consultar esta seção. Tente atualizar; os registros não foram considerados vazios.',
              }
      })
      setState({ id, customer, groups, error: '' })
    } catch {
      if (token === request.current)
        setState({
          id,
          customer: null,
          groups: {},
          error: 'Não foi possível abrir este cliente. Confira sua conexão e permissão.',
        })
    } finally {
      if (token === request.current) setLoading(false)
    }
  }, [id, permissionKey])
  useEffect(() => {
    setActive('all')
    setQuery('')
    setStatus('')
    setFrom('')
    setTo('')
    setPage(1)
    setSelectedEquip(null)
    setHistoryOpen(false)
    setEditModalOpen(false)
    setModalOpen(false)
    load()
    return () => {
      request.current++
    }
  }, [load])
  useEffect(() => {
    setPage(1)
  }, [active, query, status, from, to, showTests])
  const groups = state.id === id ? state.groups : {}
  const customer: Customer | null = state.id === id ? state.customer : null
  const all: HistoryRow[] = Object.entries(groups)
    .filter(([k]) => JSON.parse(permissionKey)[k])
    .flatMap(([, g]: any) => g.rows)
    .sort((a: any, b: any) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key))
  const section = active === 'all' ? all : groups[active]?.rows || []
  const rows = historyFilter(section, query, status, from, to, showTests).sort(
    (a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key),
  )
  const filteredStatuses = Array.from(
    new Set<string>(section.map((r: HistoryRow) => r.status).filter(Boolean)),
  ).sort()
  const badRange = Boolean(from && to && from > to)
  const failures = Object.keys(groups).filter((k) => groups[k].error)
  const pageCount = Math.max(1, Math.ceil(rows.length / 20)),
    currentPage = Math.min(page, pageCount)
  if (!customer)
    return (
      <div className="p-6 space-y-3">
        <Link to="/clientes" className="underline">
          Voltar aos clientes
        </Link>
        <p role="status">{state.id === id && state.error ? state.error : 'Carregando cliente…'}</p>
        {state.error && (
          <Button onClick={load} disabled={loading}>
            Tentar novamente
          </Button>
        )}
      </div>
    )
  return (
    <div className="space-y-5 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <Link to="/clientes">
            <Button
              variant="ghost"
              size="icon"
              data-workspace-inner-close="true"
              title="Voltar aos clientes"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {customer.razao_social || customer.nome_fantasia || customer.name || 'Cliente'}
            </h1>
            <p className="text-sm text-slate-500">Cadastro e histórico do cliente</p>
          </div>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? 'Conferindo…' : 'Atualizar histórico'}
        </Button>
      </header>
      <details className="border rounded-lg bg-white p-4">
        <summary className="font-medium cursor-pointer">Dados e contatos do cliente</summary>
        <div className="grid sm:grid-cols-2 gap-3 text-sm pt-3">
          <p>
            Telefone: {formatPhone(customer.celular || customer.phone || '') || 'Não informado'}
          </p>
          <p>E-mail: {customer.email || 'Não informado'}</p>
          <p>CPF/CNPJ: {customer.cpf_cnpj || 'Não informado'}</p>
          <p>RG/IE: {customer.rg_ie || 'Não informado'}</p>
          <p>
            Endereço: {customer.endereco || customer.street || 'Não informado'}{' '}
            {customer.bairro || ''}
          </p>
          <p>
            Autorização de WhatsApp:{' '}
            {customer.whatsapp_consent === true
              ? 'Registrada'
              : customer.whatsapp_consent === false
                ? 'Não autorizado'
                : 'Não informada'}
          </p>
        </div>
      </details>
      <section
        className="border rounded-xl bg-white p-4 space-y-4"
        aria-label="Histórico completo do cliente"
      >
        <div>
          <h2 className="text-lg font-semibold">Histórico por categoria</h2>
          <p className="text-xs text-slate-500">
            Inclui antigos, concluídos e cancelados. Cada registro mantém seu vínculo original;
            valores de orçamento, OS e pagamentos não são somados entre si.
          </p>
        </div>
        <div role="tablist" aria-label="Categorias do histórico" className="flex flex-wrap gap-2">
          {Object.keys(historyLabels)
            .filter((k) => k === 'all' || JSON.parse(permissionKey)[k])
            .map((k) => (
              <button
                key={k}
                role="tab"
                id={'history-tab-' + k}
                aria-controls="history-panel"
                aria-selected={active === k}
                className={
                  'border rounded-lg px-3 py-2 text-sm ' +
                  (active === k
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700')
                }
                onClick={() => {
                  setActive(k)
                  setStatus('')
                }}
              >
                {historyLabels[k]}{' '}
                <span className="text-xs">
                  (
                  {k === 'all'
                    ? failures.length
                      ? 'parcial'
                      : historyFilter(all, '', '', '', '', showTests).length
                    : groups[k]?.error
                      ? 'indisponível'
                      : historyFilter(groups[k]?.rows || [], '', '', '', '', showTests).length}
                  )
                </span>
              </button>
            ))}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs flex-1 min-w-48">
            Buscar no histórico
            <input
              className="mt-1 block border rounded px-3 py-2 w-full text-sm"
              placeholder="Número, equipamento, descrição…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="text-xs">
            Situação
            <select
              className="mt-1 block border rounded px-2 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todas</option>
              {filteredStatuses.map((s) => (
                <option key={s} value={s}>
                  {historyStatuses[s] || s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            De
            <input
              type="date"
              className="mt-1 block border rounded p-2"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-xs">
            Até
            <input
              type="date"
              className="mt-1 block border rounded p-2"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button
            className="text-xs underline p-2"
            onClick={() => {
              setQuery('')
              setStatus('')
              setFrom('')
              setTo('')
            }}
          >
            Limpar filtros
          </button>
        </div>
        <div className="flex flex-wrap justify-between gap-3 text-xs text-slate-500">
          <p>Datas de criação; em agendamentos, data marcada. Horário de Cuiabá.</p>
          <label>
            <input
              type="checkbox"
              checked={showTests}
              onChange={(e) => setShowTests(e.target.checked)}
            />{' '}
            Incluir registros de teste
          </label>
        </div>
        {failures.length > 0 && (
          <p role="alert" className="bg-amber-50 text-amber-800 rounded p-3 text-sm">
            Consulta parcial: {failures.map((k) => historyLabels[k]).join(', ')} indisponível. Use
            “Atualizar histórico” para tentar novamente.
          </p>
        )}
        <div role="tabpanel" id="history-panel" aria-labelledby={'history-tab-' + active}>
          {active === 'equipment' && capabilities.equipment && (
            <Button className="mb-3" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo equipamento deste cliente
            </Button>
          )}
          {badRange ? (
            <p role="alert" className="text-red-700">
              A data inicial deve ser anterior ou igual à data final.
            </p>
          ) : groups[active]?.error ? (
            <p role="alert">{groups[active].error}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b text-slate-500">
                      <th className="py-2 pr-3">Data</th>
                      <th className="pr-3">Registro / categoria</th>
                      <th className="pr-3">Descrição</th>
                      <th className="pr-3">Situação</th>
                      <th className="text-right">Valor registrado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice((currentPage - 1) * 20, currentPage * 20).map((r) => (
                      <tr key={r.key} className="border-b align-top">
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {r.date ? r.date.split('-').reverse().join('/') : 'Sem data'}
                        </td>
                        <td className="py-3 pr-3">
                          {r.kind === 'equipment' ? (
                            <button
                              className="font-medium text-indigo-700 underline"
                              onClick={() => {
                                setSelectedEquip(r.record as Equipment)
                                setHistoryOpen(true)
                              }}
                            >
                              {r.number}
                            </button>
                          ) : r.href ? (
                            <Link
                              className="font-medium text-indigo-700 underline"
                              to={r.href}
                              onClick={(e) => {
                                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                                  e.preventDefault()
                                  openTab(r.href!)
                                }
                              }}
                            >
                              {r.number}
                            </Link>
                          ) : (
                            r.number
                          )}
                          <p className="text-xs text-slate-500">
                            {historyLabels[r.kind]}
                            {r.test ? ' · TESTE' : ''}
                          </p>
                        </td>
                        <td className="py-3 pr-3 max-w-md">
                          <p className="line-clamp-3 whitespace-pre-wrap break-words">
                            {r.description || 'Sem descrição registrada'}
                          </p>
                          {r.kind === 'quotes' && !r.record.cliente_id && (
                            <p className="text-xs text-amber-700">
                              Cliente herdado da OS vinculada
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          {historyStatuses[r.status] || r.status || '—'}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          {r.value === undefined
                            ? '—'
                            : r.value.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                          {r.kind === 'rentals' &&
                            r.record.collectionName === 'rental_contracts' && (
                              <p className="text-xs">mensalidade</p>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && (
                <p className="py-6 text-center text-sm text-slate-500">
                  Nenhum registro vinculado encontrado nesta seleção.
                </p>
              )}
              <div className="flex flex-wrap justify-between items-center pt-3 gap-3 text-xs">
                <span>
                  {rows.length} registro(s) nesta seleção · página {currentPage} de {pageCount}
                </span>
                <div className="flex gap-3">
                  <button
                    className="underline disabled:opacity-40"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Anterior
                  </button>
                  <button
                    className="underline disabled:opacity-40"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Registros sem vínculo com este cadastro precisam ser conferidos no módulo de origem. A
          consulta respeita as permissões do usuário.
        </p>
      </section>
      {capabilities.equipment && (
        <>
          <NewEquipmentModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            onCreated={load}
            defaultCustomerId={id}
          />
          <EquipmentHistoryDialog
            equipment={selectedEquip}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            onEdit={(eq) => {
              setHistoryOpen(false)
              setSelectedEquip(eq)
              setEditModalTab('edit')
              setEditModalOpen(true)
            }}
            onOpenPhotos={(eq) => {
              setHistoryOpen(false)
              setSelectedEquip(eq)
              setEditModalTab('photos')
              setEditModalOpen(true)
            }}
          />
          <EditEquipmentModal
            equipment={selectedEquip}
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            defaultTab={editModalTab}
            onSaved={load}
          />
        </>
      )}
    </div>
  )
}
