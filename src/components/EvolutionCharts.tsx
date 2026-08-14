import { Bar, BarChart, Area, AreaChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wrench, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EvolutionDataPoint {
  label: string
  orders: number
  revenue: number
}

interface EvolutionChartsProps {
  data: EvolutionDataPoint[]
  totalOrders: number
  totalRevenue: number
  showRevenue?: boolean
}

const ordersChartConfig: ChartConfig = {
  orders: { label: 'OSs Criadas', color: '#6366f1' },
}

const revenueChartConfig: ChartConfig = {
  revenue: { label: 'Faturamento', color: '#f59e0b' },
}

export function EvolutionCharts({
  data,
  totalOrders,
  totalRevenue,
  showRevenue = true,
}: EvolutionChartsProps) {
  return (
    <div className="space-y-4">
      <div
        className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', !showRevenue && 'sm:grid-cols-1')}
      >
        <Card className="overflow-hidden border-slate-200/80 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                O.S no Período
              </p>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Wrench className="h-5 w-5" />
              </div>
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono">
              {totalOrders}
            </h2>
          </CardContent>
        </Card>
        {showRevenue && (
          <Card className="overflow-hidden border-slate-200/80 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Receita no Período
                </p>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono">
                R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h2>
            </CardContent>
          </Card>
        )}
      </div>
      {showRevenue && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Evolução de Ordens de Serviço
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={ordersChartConfig} className="h-[220px] w-full">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Evolução de Faturamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[220px] w-full">
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    dataKey="revenue"
                    type="monotone"
                    stroke="var(--color-revenue)"
                    fill="var(--color-revenue)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
