import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { Link } from 'react-router-dom'

interface KpiCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: string
  isPositive?: boolean
  colorClass: string
  bgClass: string
  to?: string
  subtitle?: string
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  isPositive = true,
  colorClass,
  bgClass,
  to,
  subtitle,
}: KpiCardProps) {
  const content = (
    <Card
      className={cn(
        'group overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs transition-all duration-200',
        to &&
          'cursor-pointer hover:shadow-md hover:scale-[1.015] hover:border-indigo-300 active:scale-[0.99]',
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {title}
          </p>
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition-transform group-hover:scale-105',
              bgClass,
              colorClass,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2">
          <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value}
          </div>

          {trend && (
            <div
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums shrink-0',
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

        {subtitle && <p className="mt-1 text-xs text-muted-foreground truncate">{subtitle}</p>}
      </CardContent>
    </Card>
  )

  if (to) {
    return (
      <Link to={to} className="block focus:outline-hidden" title={`Abrir ${title}`}>
        {content}
      </Link>
    )
  }

  return content
}
