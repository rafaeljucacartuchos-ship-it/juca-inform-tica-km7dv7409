import { Link } from 'react-router-dom'
import { DollarSign, TrendingUp, TrendingDown, Clock, Receipt, ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinancialSummary, EvolutionDataPoint } from '@/lib/dashboard-utils'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

interface FinancialResultCardProps {
  summary: FinancialSummary
  chartData: EvolutionDataPoint[]
  periodLabel: string
}

export function FinancialResultCard({ summary, chartData, periodLabel }: FinancialResultCardProps) {
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
                Resultado Financeiro
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recebimentos consolidados, pendências e desempenho ({periodLabel})
            </p>
          </div>

          <Link
            to="/relatorios"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 self-start sm:self-auto"
          >
            <span>Ver relatórios detalhados</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Métricas Principais em Grade */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 1. Recebido no Período */}
          <Link
            to="/ordens?status=completed"
            className="group block rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 transition-all hover:bg-emerald-50 hover:shadow-xs hover:border-emerald-200"
            title="Ver ordens concluídas no período"
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <span>Recebido no Período</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-emerald-950 tabular-nums">
              R${' '}
              {recebido.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {paidOrdersCount} {paidOrdersCount === 1 ? 'O.S. quitada' : 'O.S. quitadas'}
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

          {/* 2. A Receber */}
          <Link
            to="/ordens?status=in_progress"
            className="group block rounded-xl border border-amber-100 bg-amber-50/40 p-3.5 transition-all hover:bg-amber-50 hover:shadow-xs hover:border-amber-200"
            title="Ver ordens em andamento e pagamentos pendentes"
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-amber-800">
              <span>A Receber (Pendente)</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-amber-950 tabular-nums">
              R${' '}
              {aReceber.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Aguardando liquidação ou conclusão
            </div>
          </Link>

          {/* 3. Ticket Médio */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-indigo-800">
              <span>Ticket Médio por O.S.</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-indigo-950 tabular-nums">
              R${' '}
              {ticketMedio.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Média por atendimento faturado</div>
          </div>
        </div>

        {/* Mini-Gráfico de Evolução do Recebido no Período */}
        {chartData && chartData.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                Evolução dos Recebimentos no Período
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
                    tickFormatter={(v) => `R$ ${v}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const pt = payload[0].payload as EvolutionDataPoint
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md text-xs">
                          <p className="font-semibold text-slate-900">{pt.label}</p>
                          <p className="text-emerald-700 font-bold tabular-nums mt-0.5">
                            R$ {pt.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-slate-500 text-[11px]">
                            {pt.orders} {pt.orders === 1 ? 'ordem criada' : 'ordens criadas'}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
