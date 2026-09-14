import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DonutSlice } from '@/lib/dashboard-utils'

interface DashboardDonutCardProps {
  title: string
  subtitle: string
  data: DonutSlice[]
  centerLabel?: string
  centerValue?: string | number
  emptyMessage?: string
  valueIsCurrency?: boolean
  showAmountInLegend?: boolean
}

export function DashboardDonutCard({
  title,
  subtitle,
  data,
  centerLabel = 'Total',
  centerValue,
  emptyMessage = 'Nenhum dado disponível',
  valueIsCurrency = false,
  showAmountInLegend = false,
}: DashboardDonutCardProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const displayTotal = centerValue !== undefined ? centerValue : total

  const formatBRL = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <Card className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden flex flex-col justify-between">
      <CardHeader className="pb-2 border-b border-slate-100 bg-white">
        <CardTitle className="text-base font-semibold text-slate-900 tracking-tight">
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col justify-center">
        {data.length === 0 || total === 0 ? (
          <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Gráfico Donut com centro customizado */}
            <div className="sm:col-span-5 h-52 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const item = payload[0].payload as DonutSlice
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md text-xs">
                          <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            {item.name}
                          </p>
                          <div className="text-slate-600 mt-1 space-y-0.5 font-medium">
                            {item.amount !== undefined ? (
                              <p className="text-emerald-700 font-bold tabular-nums">
                                {formatBRL(item.amount)}
                              </p>
                            ) : valueIsCurrency ? (
                              <p className="text-emerald-700 font-bold tabular-nums">
                                {formatBRL(item.value)}
                              </p>
                            ) : (
                              <p className="font-bold text-slate-900 tabular-nums">
                                {item.value} {item.value === 1 ? 'item' : 'itens'}
                              </p>
                            )}
                            <p className="text-slate-500 text-[11px] tabular-nums">
                              {item.percentage}% do total
                            </p>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={76}
                    paddingAngle={3}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
                <span className="text-[11px] text-muted-foreground font-medium">{centerLabel}</span>
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 tabular-nums truncate max-w-[120px]">
                  {typeof displayTotal === 'number' && valueIsCurrency
                    ? formatBRL(displayTotal)
                    : displayTotal}
                </span>
              </div>
            </div>

            {/* Legenda Lateral com quantidades, valor R$ pt-BR e porcentagens */}
            <div className="sm:col-span-7 space-y-2 pr-1">
              {data.map((slice, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0 gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="font-medium text-slate-700 truncate" title={slice.name}>
                      {slice.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 text-right">
                    {/* Exibição da quantidade quando relevante */}
                    {!valueIsCurrency && (
                      <span className="font-bold text-slate-900 tabular-nums">{slice.value}</span>
                    )}

                    {/* Exibição do valor R$ quando disponível ou quando o valor em si for monetário */}
                    {(showAmountInLegend || slice.amount !== undefined || valueIsCurrency) && (
                      <span className="font-bold text-slate-900 tabular-nums text-[11px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {formatBRL(slice.amount !== undefined ? slice.amount : slice.value)}
                      </span>
                    )}

                    {/* Porcentagem */}
                    <span className="text-xs text-muted-foreground tabular-nums w-8 text-right font-semibold">
                      {slice.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
