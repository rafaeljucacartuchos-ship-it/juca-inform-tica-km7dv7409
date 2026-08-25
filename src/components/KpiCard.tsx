import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: string
  isPositive?: boolean
  colorClass: string
  bgClass: string
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  isPositive = true,
  colorClass,
  bgClass,
}: KpiCardProps) {
  return (
    <Card className="overflow-hidden border-slate-200/80 shadow-xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl font-bold',
              bgClass,
              colorClass,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline justify-between">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono">
            {value}
          </h2>

          {trend && (
            <div
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
                isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
