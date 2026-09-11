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
}

export function DashboardDonutCard({
  title,
  subtitle,
  data,
  centerLabel = 'Total',
  centerValue,
  emptyMessage = 'Nenhum dado disponível',
}: DashboardDonutCardProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const displayTotal = centerValue !== undefined ? centerValue : total

  return (
    <Card className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
      <CardHeader className="pb-2 border-b border-slate-100 bg-white">
        <CardTitle className="text-base font-semibold text-slate-900 tracking-tight">
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="pt-4">
        {data.length === 0 || total === 0 ? (
          <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Gráfico Donut com centro customizado */}
            <div className="sm:col-span-6 h-52 relative flex items-center justify-center">
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
                          <p className="text-slate-600 mt-1 font-medium">
                            <span className="font-bold text-slate-900 tabular-nums">
                              {item.value}
                            </span>{' '}
                            ({item.percentage}%)
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
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
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-muted-foreground font-medium">{centerLabel}</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {displayTotal}
                </span>
              </div>
            </div>

            {/* Legenda Lateral com quantidades e porcentagens */}
            <div className="sm:col-span-6 space-y-2 pr-1">
              {data.map((slice, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="font-medium text-slate-700 truncate" title={slice.name}>
                      {slice.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-slate-900 tabular-nums">{slice.value}</span>
                    <span className="text-xs text-muted-foreground tabular-nums w-9 text-right font-medium">
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
