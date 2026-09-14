import { Link } from 'react-router-dom'
import { DollarSign, TrendingUp, TrendingDown, Clock, Receipt, ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinancialSummary, EvolutionDataPoint } from '@/lib/dashboard-utils'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

interface FinancialResultCardProps {
  summary: FinancialSummary
  chartData: EvolutionDataPoint[]
  periodLabel: string
  totalOrcamentosAprovados?: number
  countOrcamentosAprovados?: number
  totalOrcamentosPendentes?: number
  countOrcamentosPendentes?: number
}

export function FinancialResultCard({
  summary,
  chartData,
  periodLabel,
  totalOrcamentosAprovados = 0,
  countOrcamentosAprovados = 0,
  totalOrcamentosPendentes = 0,
  countOrcamentosPendentes = 0,
}: FinancialResultCardProps) {
  const { recebido, aReceber, ticketMedio, paidOrdersCount, growthPct } = summary

  return (
    <Card className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <DollarSign className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-semibold text-slate-900 tracking-tight">
                Valores de O.S. no Período e Orçamentos
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acompanhamento de produção em O.S. e orçamentos ({periodLabel})
            </p>
          </div>

          <Link
            to="/relatorios"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline self-start sm:self-auto"
          >
            <span>Relatórios Detalhados</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Métricas Principais em Grade — 4 blocos de acompanhamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Valores de O.S. Liquidados */}
          <Link
            to="/ordens?status=completed"
            className="group block rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 transition-all duration-200 hover:bg-emerald-50 hover:shadow-md hover:scale-[1.015] hover:border-emerald-300 cursor-pointer"
            title="Ver ordens concluídas no período"
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <span>Valores de O.S. Liquidados</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 transition-transform group-hover:scale-105">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-emerald-950 tabular-nums">
              R${' '}
              {recebido.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground text-xs">
                {paidOrdersCount} {paidOrdersCount === 1 ? 'O.S. liquidada' : 'O.S. liquidadas'}
              </span>
              {growthPct !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 font-semibold tabular-nums px-2 py-0.5 rounded-full text-xs ${
                    growthPct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {growthPct >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {growthPct >= 0 ? `+${growthPct}%` : `${growthPct}%`} vs. ant.
                </span>
              )}
            </div>
          </Link>

          {/* 2. Orçamentos Aprovados */}
          <Link
            to="/orcamentos?status=aprovado"
            className="group block rounded-xl border border-teal-100 bg-teal-50/40 p-3.5 transition-all duration-200 hover:bg-teal-50 hover:shadow-md hover:scale-[1.015] hover:border-teal-300 cursor-pointer"
            title="Ver orçamentos aprovados no período"
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-teal-800">
              <span>Orçamentos Aprovados</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-700 transition-transform group-hover:scale-105">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-teal-950 tabular-nums">
              R${' '}
              {totalOrcamentosAprovados.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {countOrcamentosAprovados}{' '}
              {countOrcamentosAprovados === 1 ? 'orçamento aprovado' : 'orçamentos aprovados'}
            </div>
          </Link>

          {/* 3. Orçamentos Pendentes */}
          <Link
            to="/orcamentos"
            className="group block rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 transition-all duration-200 hover:bg-indigo-50 hover:shadow-md hover:scale-[1.015] hover:border-indigo-300 cursor-pointer"
            title="Ver orçamentos pendentes no período"
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-indigo-800">
              <span>Orçamentos Pendentes</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 transition-transform group-hover:scale-105">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-indigo-950 tabular-nums">
              R${' '}
              {totalOrcamentosPendentes.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {countOrcamentosPendentes}{' '}
              {countOrcamentosPendentes === 1 ? 'aguardando resposta' : 'aguardando resposta'}
            </div>
          </Link>

          {/* 4. Valores em Aberto / Pendências */}
          <Link
            to="/ordens?status=open"
            className="group block rounded-xl border border-amber-100 bg-amber-50/40 p-3.5 transition-all duration-200 hover:bg-amber-50 hover:shadow-md hover:scale-[1.015] hover:border-amber-300 cursor-pointer"
            title="Ver ordens em andamento e pagamentos pendentes"
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-amber-800">
              <span>Valores de O.S. em Aberto</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 transition-transform group-hover:scale-105">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-amber-950 tabular-nums">
              R${' '}
              {aReceber.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Em atendimento ou aguardando conclusão
            </div>
          </Link>
        </div>

        {/* Mini-Gráfico de Evolução no Período */}
        {chartData && chartData.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                Evolução dos Valores de O.S. no Período
              </span>
              <span className="text-xs text-muted-foreground">Valores diários/semanais</span>
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v) => `R$ ${Number(v).toLocaleString('pt-BR')}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const pt = payload[0].payload as EvolutionDataPoint
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md text-xs">
                          <p className="font-semibold text-slate-900">{pt.label}</p>
                          <p className="text-emerald-700 font-bold tabular-nums mt-0.5">
                            R${' '}
                            {pt.revenue.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-slate-500 text-[11px]">
                            {pt.orders} {pt.orders === 1 ? 'ordem no dia' : 'ordens no dia'}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
