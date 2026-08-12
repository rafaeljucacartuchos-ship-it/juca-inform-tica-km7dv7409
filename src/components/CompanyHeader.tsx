import { COMPANY_DATA } from '@/lib/company'

interface CompanyHeaderProps {
  variant?: 'default' | 'compact'
}

export function CompanyHeader({ variant = 'default' }: CompanyHeaderProps) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-white shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shrink-0">
          <span className="text-sm font-extrabold text-indigo-600">{COMPANY_DATA.initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold leading-tight truncate">{COMPANY_DATA.razaoSocial}</p>
          <p className="text-[10px] text-white/75 truncate">{COMPANY_DATA.telefones}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white shadow-md">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white shrink-0 shadow-sm">
        <span className="text-xl font-extrabold text-indigo-600">{COMPANY_DATA.initials}</span>
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-bold leading-tight">{COMPANY_DATA.razaoSocial}</h2>
        <p className="text-xs text-white/80 mt-0.5">{COMPANY_DATA.endereco}</p>
        <p className="text-xs text-white/80">Telefones: {COMPANY_DATA.telefones}</p>
      </div>
    </div>
  )
}
