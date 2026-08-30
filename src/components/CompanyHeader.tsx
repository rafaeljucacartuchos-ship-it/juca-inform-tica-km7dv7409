import { COMPANY_DATA, JUCA_LOGO_URL } from '@/lib/company'

interface CompanyHeaderProps {
  variant?: 'default' | 'compact'
}

export function CompanyHeader({ variant = 'default' }: CompanyHeaderProps) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-slate-900 border border-slate-800 px-4 py-2.5 text-white shadow-sm">
        <div className="flex h-10 w-16 items-center justify-center rounded-lg bg-slate-950 shrink-0 p-1 border border-slate-800 overflow-hidden">
          <img
            src={JUCA_LOGO_URL}
            alt="JUCA Informática"
            className="h-full w-full object-contain"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = '/logo.svg'
            }}
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold leading-tight truncate">
            {COMPANY_DATA.nomeFantasia || COMPANY_DATA.razaoSocial}
          </p>
          <p className="text-[10px] text-slate-400 truncate">{COMPANY_DATA.telefones}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 rounded-xl bg-slate-900 border border-slate-800 p-4 text-white shadow-md">
      <div className="flex h-16 w-24 sm:w-28 items-center justify-center rounded-xl bg-slate-950 shrink-0 p-1.5 border border-slate-800 shadow-sm overflow-hidden">
        <img
          src={JUCA_LOGO_URL}
          alt="JUCA Informática"
          className="h-full w-full object-contain"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = '/logo.svg'
          }}
        />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-extrabold leading-tight tracking-tight">
            {COMPANY_DATA.nomeFantasia || 'JUCA INFORMÁTICA'}
          </h2>
          <span className="text-[10px] font-semibold bg-blue-600/30 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded">
            {COMPANY_DATA.slogan}
          </span>
        </div>
        <p className="text-xs text-slate-300 mt-0.5">{COMPANY_DATA.razaoSocial}</p>
        <p className="text-[11px] text-slate-400">{COMPANY_DATA.endereco}</p>
        <p className="text-[11px] text-slate-400 font-mono">Telefones: {COMPANY_DATA.telefones}</p>
      </div>
    </div>
  )
}
