import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { MessageCircle, Search, ShieldCheck, ArrowLeft, PlugZap } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

const sectors = ['Todos os setores', 'Atendimento', 'Vendas', 'Assistência', 'Caixa', 'Gestão']

export default function CentralWhatsApp() {
  const { user } = useAuth()
  const [sector, setSector] = useState(sectors[0])
  const [search, setSearch] = useState('')
  if (!user || user.role !== 'admin') return <Navigate to="/sem-acesso" replace />

  return <main className="space-y-5">
    <header className="rounded-2xl bg-slate-900 p-6 text-white">
      <Link to="/central" className="mb-4 inline-flex items-center gap-2 text-sm text-emerald-300"><ArrowLeft size={16} /> Visão do gestor</Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">JUCA • Atendimento da empresa</p><h1 className="mt-2 text-2xl font-bold">Central WhatsApp</h1></div>
        <span className="rounded-full border border-amber-300/40 px-3 py-2 text-sm text-amber-200">Número não conectado</span>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-slate-300">Um espaço para a equipe acompanhar os atendimentos e relacionar as conversas às ordens de serviço.</p>
    </header>

    <section aria-labelledby="connection-title" className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h2 id="connection-title" className="flex items-center gap-2 text-base font-semibold text-amber-950"><PlugZap size={20} /> Conexão pendente</h2>
      <p className="mt-2 text-sm text-amber-900">Esta central ainda não recebe nem envia mensagens. O histórico do celular não foi importado. Após configurar a integração, será possível disponibilizar os atendimentos para a equipe.</p>
    </section>

    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside aria-label="Lista de conversas" className="min-w-0 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Conversas</h2>
        <label className="mt-4 block text-sm font-medium" htmlFor="whatsapp-sector">Setor</label>
        <select id="whatsapp-sector" value={sector} onChange={e => setSector(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-sm">
          {sectors.map(name => <option key={name}>{name}</option>)}
        </select>
        <label className="mt-4 block text-sm font-medium" htmlFor="whatsapp-search">Buscar cliente ou telefone</label>
        <div className="relative mt-2"><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" /><input id="whatsapp-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou telefone" className="min-h-11 w-full min-w-0 rounded-lg border py-2 pl-9 pr-3 text-sm" /></div>
        <div role="status" className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium">Conversas indisponíveis</p>
          <p className="mt-2">Conecte o número da empresa para consultar {sector === sectors[0] ? 'os atendimentos' : 'os atendimentos de ' + sector}.{search.trim() ? ' A busca ficará disponível após a conexão.' : ''}</p>
        </div>
      </aside>

      <section aria-labelledby="conversation-title" className="flex min-h-80 min-w-0 flex-col items-center justify-center rounded-xl border bg-white p-6 text-center sm:p-10">
        <div className="rounded-full bg-emerald-50 p-4 text-emerald-700"><MessageCircle size={32} /></div>
        <h2 id="conversation-title" className="mt-5 text-xl font-semibold">Seu atendimento começa aqui</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">Depois da conexão, selecione uma conversa para acompanhar as mensagens do cliente. Os recursos de resposta, transferência e vínculo com a OS ainda estão em preparação.</p>
        <p className="mt-5 inline-flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={16} /> Nesta etapa, acesso reservado ao gestor.</p>
      </section>
    </div>

    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">Preparação da central</h2>
      <ol className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <li><strong className="block text-slate-900">1. Conectar o número da empresa</strong><p className="mt-1 text-slate-600">Verificar a conta e a opção de trazer o histórico existente.</p></li>
        <li><strong className="block text-slate-900">2. Organizar a equipe</strong><p className="mt-1 text-slate-600">Configurar usuários, setores e permissões de atendimento.</p></li>
        <li><strong className="block text-slate-900">3. Validar o atendimento</strong><p className="mt-1 text-slate-600">Testar mensagens e vínculos com clientes e OS antes de liberar o uso.</p></li>
      </ol>
    </section>
  </main>
}
