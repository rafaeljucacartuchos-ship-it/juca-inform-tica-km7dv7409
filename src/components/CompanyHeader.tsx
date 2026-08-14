import { COMPANY_DATA } from '@/lib/company'

interface CompanyHeaderProps {
  variant?: 'default' | 'compact'
}

export function CompanyHeader({ variant = 'default' }: CompanyHeaderProps) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-slate-900 border border-slate-800 px-4 py-2.5 text-white shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black shrink-0 p-1 border border-slate-800">
          <img src="/logo.svg" alt="Juca Logo" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold leading-tight truncate">{COMPANY_DATA.razaoSocial}</p>
          <p className="text-[10px] text-slate-400 truncate">{COMPANY_DATA.telefones}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 rounded-xl bg-slate-900 border border-slate-800 p-4 text-white shadow-md">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-black shrink-0 p-1.5 border border-slate-800 shadow-sm">
        <img src="/logo.svg" alt="Juca Logo" className="h-full w-full object-contain" />
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-bold leading-tight">{COMPANY_DATA.razaoSocial}</h2>
        <p className="text-xs text-slate-300 mt-0.5">{COMPANY_DATA.endereco}</p>
        <p className="text-xs text-slate-400">Telefones: {COMPANY_DATA.telefones}</p>
      </div>
    </div>
  )
}
