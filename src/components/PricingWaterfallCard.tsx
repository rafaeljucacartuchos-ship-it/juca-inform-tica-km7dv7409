import React from 'react'
import { formatCurrencyBRL } from '@/lib/dashboard-utils'

interface PricingWaterfallProps {
  salePrice: number
  custoDiretoTotal: number
  custoDiretoPct: number
  custoFixoRateado?: number
  custoFixoRateadoPct?: number
  custoFixoPct?: number
  custoFixoValor?: number
  custoFixoPctDoPreco?: number
  despesaFixaValor: number
  despesaFixaPct: number
  custosVariaveisValor: number
  custosVariaveisPct: number
  lucroUnitario: number
  lucroPct: number
  totalPct: number
  detalheVariaveis?: {
    cartao: { valor: number; pct: number }
    icms: { valor: number; pct: number }
    impostoSaida?: { valor: number; pct: number }
    comissao: { valor: number; pct: number }
    ipi: { valor: number; pct: number }
  }
}

export function PricingWaterfallCard({
  salePrice,
  custoDiretoTotal,
  custoDiretoPct,
  custoFixoRateado = 0,
  custoFixoRateadoPct = 0,
  custoFixoPct = 0,
  custoFixoValor = 0,
  custoFixoPctDoPreco = 0,
  despesaFixaValor,
  despesaFixaPct,
  custosVariaveisValor,
  custosVariaveisPct,
  lucroUnitario,
  lucroPct,
  totalPct,
  detalheVariaveis,
}: PricingWaterfallProps) {
  // Garantir limites visuais para barras
  const cPct = Math.max(0, Math.min(100, custoDiretoPct))
  const cfPct = Math.max(0, Math.min(100, custoFixoRateadoPct))
  const custoFixoBarPct = Math.max(0, Math.min(100, custoFixoPctDoPreco))
  const fPct = Math.max(0, Math.min(100, despesaFixaPct))
  const vPct = Math.max(0, Math.min(100, custosVariaveisPct))
  const lPct = Math.max(0, Math.min(100, lucroPct))

  const temRateioFixo = custoFixoRateado > 0
  const temCustoFixoPct = custoFixoValor > 0 || custoFixoPct > 0

  return (
    <div className="space-y-3.5 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Decomposição do Preço (100%)
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
            Total: {totalPct.toFixed(1)}%
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-slate-900">
          {formatCurrencyBRL(salePrice)}
        </span>
      </div>

      {/* Barra segmentada horizontal contínua de 100% */}
      <div className="h-4 w-full bg-slate-200 rounded-md overflow-hidden flex shadow-inner">
        <div
          style={{ width: `${cPct}%` }}
          className="bg-amber-500 hover:bg-amber-600 transition-all relative group cursor-pointer"
          title={`Custo Direto: ${formatCurrencyBRL(custoDiretoTotal)} (${custoDiretoPct}%)`}
        />
        {temRateioFixo && (
          <div
            style={{ width: `${cfPct}%` }}
            className="bg-purple-500 hover:bg-purple-600 transition-all relative group cursor-pointer"
            title={`Custo Fixo Rateado: ${formatCurrencyBRL(custoFixoRateado)} (${custoFixoRateadoPct}%)`}
          />
        )}
        {temCustoFixoPct && (
          <div
            style={{ width: `${custoFixoBarPct}%` }}
            className="bg-teal-500 hover:bg-teal-600 transition-all relative group cursor-pointer"
            title={`Custo Fixo (%): ${formatCurrencyBRL(custoFixoValor)} (${custoFixoPctDoPreco.toFixed(1)}%)`}
          />
        )}
        <div
          style={{ width: `${fPct}%` }}
          className="bg-sky-500 hover:bg-sky-600 transition-all relative group cursor-pointer"
          title={`Despesas Fixas: ${formatCurrencyBRL(despesaFixaValor)} (${despesaFixaPct}%)`}
        />
        <div
          style={{ width: `${vPct}%` }}
          className="bg-indigo-500 hover:bg-indigo-600 transition-all relative group cursor-pointer"
          title={`Custos Variáveis: ${formatCurrencyBRL(custosVariaveisValor)} (${custosVariaveisPct}%)`}
        />
        <div
          style={{ width: `${lPct}%` }}
          className="bg-emerald-500 hover:bg-emerald-600 transition-all relative group cursor-pointer"
          title={`Lucro Líquido: ${formatCurrencyBRL(lucroUnitario)} (${lucroPct}%)`}
        />
      </div>

      {/* Fatias Detalhadas tipo Cascata */}
      <div
        className={`grid gap-2 pt-1 text-xs ${
          temRateioFixo && temCustoFixoPct
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
            : temRateioFixo || temCustoFixoPct
              ? 'grid-cols-2 sm:grid-cols-5'
              : 'grid-cols-2 sm:grid-cols-4'
        }`}
      >
        {/* Fatia 1: Custo Direto */}
        <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-[11px] font-bold text-amber-900">Custo Direto</span>
            </div>
            <p className="text-[10px] text-amber-700">Mercadoria + frete + extras</p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-amber-200/60">
            <div className="font-mono font-bold text-amber-950 text-xs">
              {formatCurrencyBRL(custoDiretoTotal)}
            </div>
            <div className="text-[10px] font-mono text-amber-800 font-semibold">
              {custoDiretoPct.toFixed(1)}% do preço
            </div>
          </div>
        </div>

        {/* Fatia 1.5: Custo Fixo Rateado (v0.0.209) */}
        {temRateioFixo && (
          <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
                <span className="text-[11px] font-bold text-purple-900">Custo Fixo Rateado</span>
              </div>
              <p className="text-[10px] text-purple-700">Rateio unitário por serviço</p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-purple-200/60">
              <div className="font-mono font-bold text-purple-950 text-xs">
                {formatCurrencyBRL(custoFixoRateado)}
              </div>
              <div className="text-[10px] font-mono text-purple-800 font-semibold">
                {custoFixoRateadoPct.toFixed(1)}% do preço
              </div>
            </div>
          </div>
        )}

        {/* Fatia 1.8: Custo Fixo (%) (v0.0.211/v0.0.212) */}
        {temCustoFixoPct && (
          <div className="p-2.5 rounded-lg bg-teal-50/70 border border-teal-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                <span className="text-[11px] font-bold text-teal-900">
                  Custo Fixo ({custoFixoPct}%)
                </span>
              </div>
              <p className="text-[10px] text-teal-700">Percentual fixo aplicado</p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-teal-200/60">
              <div className="font-mono font-bold text-teal-950 text-xs">
                {formatCurrencyBRL(custoFixoValor)}
              </div>
              <div className="text-[10px] font-mono text-teal-800 font-semibold">
                {custoFixoPctDoPreco.toFixed(1)}% do preço
              </div>
            </div>
          </div>
        )}

        {/* Fatia 2: Despesas Fixas */}
        <div className="p-2.5 rounded-lg bg-sky-50/70 border border-sky-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
              <span className="text-[11px] font-bold text-sky-900">Despesa Fixa</span>
            </div>
            <p className="text-[10px] text-sky-700">Rateio mensal operacional</p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-sky-200/60">
            <div className="font-mono font-bold text-sky-950 text-xs">
              {formatCurrencyBRL(despesaFixaValor)}
            </div>
            <div className="text-[10px] font-mono text-sky-800 font-semibold">
              {despesaFixaPct.toFixed(1)}% do preço
            </div>
          </div>
        </div>

        {/* Fatia 3: Custos Variáveis */}
        <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-[11px] font-bold text-indigo-900">Custos Variáveis</span>
            </div>
            <p className="text-[10px] text-indigo-700">Cartão, ICMS, comissão, IPI</p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-indigo-200/60">
            <div className="font-mono font-bold text-indigo-950 text-xs">
              {formatCurrencyBRL(custosVariaveisValor)}
            </div>
            <div className="text-[10px] font-mono text-indigo-800 font-semibold">
              {custosVariaveisPct.toFixed(1)}% do preço
            </div>
          </div>
        </div>

        {/* Fatia 4: Lucro Líquido */}
        <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[11px] font-bold text-emerald-900">Lucro Líquido</span>
            </div>
            <p className="text-[10px] text-emerald-700">Margem limpa no bolso</p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-emerald-200/60">
            <div className="font-mono font-bold text-emerald-950 text-xs">
              {formatCurrencyBRL(lucroUnitario)}
            </div>
            <div className="text-[10px] font-mono text-emerald-800 font-semibold">
              {lucroPct.toFixed(1)}% do preço
            </div>
          </div>
        </div>
      </div>

      {/* Detalhamento das taxas variáveis */}
      {detalheVariaveis && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-[11px] text-slate-500">
          <span>
            Cartão:{' '}
            <strong className="font-mono text-slate-700">
              {formatCurrencyBRL(detalheVariaveis.cartao.valor)}
            </strong>{' '}
            ({detalheVariaveis.cartao.pct}%)
          </span>
          <span>
            ICMS/Simples:{' '}
            <strong className="font-mono text-slate-700">
              {formatCurrencyBRL(detalheVariaveis.icms.valor)}
            </strong>{' '}
            ({detalheVariaveis.icms.pct}%)
          </span>
          {detalheVariaveis.impostoSaida && detalheVariaveis.impostoSaida.pct > 0 && (
            <span>
              Imp. Saída:{' '}
              <strong className="font-mono text-slate-700">
                {formatCurrencyBRL(detalheVariaveis.impostoSaida.valor)}
              </strong>{' '}
              ({detalheVariaveis.impostoSaida.pct}%)
            </span>
          )}
          <span>
            Comissão:{' '}
            <strong className="font-mono text-slate-700">
              {formatCurrencyBRL(detalheVariaveis.comissao.valor)}
            </strong>{' '}
            ({detalheVariaveis.comissao.pct}%)
          </span>
          {detalheVariaveis.ipi.pct > 0 && (
            <span>
              IPI:{' '}
              <strong className="font-mono text-slate-700">
                {formatCurrencyBRL(detalheVariaveis.ipi.valor)}
              </strong>{' '}
              ({detalheVariaveis.ipi.pct}%)
            </span>
          )}
        </div>
      )}
    </div>
  )
}
