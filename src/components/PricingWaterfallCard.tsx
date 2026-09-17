import React from 'react'
import { formatCurrencyBRL } from '@/lib/dashboard-utils'

interface PricingWaterfallProps {
  salePrice: number
  custoDiretoTotal: number
  custoDiretoPct: number
  custoTotalCompleto?: number
  custoTotalCompletoPct?: number
  custoAquisicao?: number
  custoAquisicaoPct?: number
  substTributariaValor?: number
  substTributariaPct?: number
  substTributariaPctInput?: number
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
  custoTotalCompleto,
  custoTotalCompletoPct,
  custoAquisicao = 0,
  custoAquisicaoPct = 0,
  substTributariaValor = 0,
  substTributariaPct = 0,
  substTributariaPctInput = 0,
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
  const temSubstTributaria = substTributariaValor > 0
  // Quando há Substituição Tributária > 0, o custo de aquisição é exibido separado da ST
  const cPct = temSubstTributaria
    ? Math.max(0, Math.min(100, custoAquisicaoPct))
    : Math.max(0, Math.min(100, custoDiretoPct))
  const stBarPct = temSubstTributaria ? Math.max(0, Math.min(100, substTributariaPct)) : 0
  const cfPct = Math.max(0, Math.min(100, custoFixoRateadoPct))
  const custoFixoBarPct = Math.max(0, Math.min(100, custoFixoPctDoPreco))
  const fPct = Math.max(0, Math.min(100, despesaFixaPct))
  const vPct = Math.max(0, Math.min(100, custosVariaveisPct))
  const lPct = Math.max(0, Math.min(100, lucroPct))

  const temRateioFixo = custoFixoRateado > 0
  const temCustoFixoPct = custoFixoValor > 0 || custoFixoPct > 0

  // Custo Total Completo do Produto (TODOS os custos: diretos + fixos + operacionais + variáveis + ST)
  // separando APENAS o Lucro Líquido: Custo Total Completo + Lucro Líquido = Preço Final
  const custoTotalCalculado =
    custoTotalCompleto !== undefined
      ? custoTotalCompleto
      : Math.round(
          (custoDiretoTotal +
            custoFixoRateado +
            custoFixoValor +
            despesaFixaValor +
            custosVariaveisValor) *
            100,
        ) / 100

  const custoTotalPctCalculado =
    custoTotalCompletoPct !== undefined
      ? custoTotalCompletoPct
      : salePrice > 0
        ? Math.round(((salePrice - lucroUnitario) / salePrice) * 1000) / 10
        : 0

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

      {/* CONSOLIDAÇÃO PRINCIPAL: CUSTO TOTAL DO PRODUTO (TODOS OS CUSTOS) + LUCRO LÍQUIDO = PREÇO FINAL */}
      <div className="p-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-xl text-white shadow-xs space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold uppercase tracking-wider text-slate-300">
            Visão Consolidada: Todos os Custos vs. Lucro Líquido
          </span>
          <span className="font-mono text-emerald-400 font-bold">
            100% = {formatCurrencyBRL(salePrice)}
          </span>
        </div>

        {/* Barra consolidada de 2 blocos: Custo Total Completo + Lucro Líquido */}
        <div className="h-3 w-full bg-slate-800 rounded overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${Math.max(0, Math.min(100, custoTotalPctCalculado))}%` }}
            className="bg-amber-500 hover:bg-amber-400 transition-all cursor-pointer"
            title={`Custo Total do Produto (todos os custos): ${formatCurrencyBRL(custoTotalCalculado)} (${custoTotalPctCalculado.toFixed(1)}%)`}
          />
          <div
            style={{ width: `${lPct}%` }}
            className="bg-emerald-500 hover:bg-emerald-400 transition-all cursor-pointer"
            title={`Lucro Líquido: ${formatCurrencyBRL(lucroUnitario)} (${lucroPct.toFixed(1)}%)`}
          />
        </div>

        {/* Indicadores numéricos dos 2 blocos principais */}
        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
          <div className="p-2 rounded-lg bg-white/10 border border-white/10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-[11px] font-bold text-amber-200">Custo Total do Produto</span>
              </div>
              <p className="text-[10px] text-slate-300">Todos custos somados (exceto lucro)</p>
            </div>
            <div className="text-right">
              <div className="font-mono font-extrabold text-amber-300 text-xs sm:text-sm">
                {formatCurrencyBRL(custoTotalCalculado)}
              </div>
              <div className="text-[10px] font-mono text-amber-200/80 font-bold">
                {custoTotalPctCalculado.toFixed(1)}% do preço
              </div>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[11px] font-bold text-emerald-200">Lucro Líquido</span>
              </div>
              <p className="text-[10px] text-emerald-300/80">Margem limpa separada</p>
            </div>
            <div className="text-right">
              <div className="font-mono font-extrabold text-emerald-300 text-xs sm:text-sm">
                {formatCurrencyBRL(lucroUnitario)}
              </div>
              <div className="text-[10px] font-mono text-emerald-200/80 font-bold">
                {lucroPct.toFixed(1)}% do preço
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra segmentada horizontal contínua de 100% com todas as fatias */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold px-0.5">
          <span>Detalhamento por componente:</span>
          <span className="font-mono text-[10px] text-slate-500">
            Passe o cursor para ver valores
          </span>
        </div>
        <div className="h-4 w-full bg-slate-200 rounded-md overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${cPct}%` }}
            className="bg-amber-500 hover:bg-amber-600 transition-all relative group cursor-pointer"
            title={
              temSubstTributaria
                ? `Custo Aquisição: ${formatCurrencyBRL(custoAquisicao)} (${custoAquisicaoPct.toFixed(1)}%)`
                : `Custo Direto: ${formatCurrencyBRL(custoDiretoTotal)} (${custoDiretoPct.toFixed(1)}%)`
            }
          />
          {temSubstTributaria && (
            <div
              style={{ width: `${stBarPct}%` }}
              className="bg-violet-500 hover:bg-violet-600 transition-all relative group cursor-pointer"
              title={`Subst. Tributária: ${formatCurrencyBRL(substTributariaValor)} (${substTributariaPct.toFixed(1)}%)`}
            />
          )}
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
      </div>

      {/* Fatias Detalhadas tipo Cascata */}
      <div
        className={`grid gap-2 pt-1 text-xs ${
          temSubstTributaria
            ? temRateioFixo && temCustoFixoPct
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-7'
              : temRateioFixo || temCustoFixoPct
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
            : temRateioFixo && temCustoFixoPct
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
              : temRateioFixo || temCustoFixoPct
                ? 'grid-cols-2 sm:grid-cols-5'
                : 'grid-cols-2 sm:grid-cols-4'
        }`}
      >
        {/* Fatia 1: Custo Direto (ou Custo de Aquisição quando ST > 0) */}
        <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-[11px] font-bold text-amber-900">
                {temSubstTributaria ? 'Custo Aquisição' : 'Custo Direto'}
              </span>
            </div>
            <p className="text-[10px] text-amber-700">Mercadoria + frete + extras</p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-amber-200/60">
            <div className="font-mono font-bold text-amber-950 text-xs">
              {formatCurrencyBRL(temSubstTributaria ? custoAquisicao : custoDiretoTotal)}
            </div>
            <div className="text-[10px] font-mono text-amber-800 font-semibold">
              {(temSubstTributaria ? custoAquisicaoPct : custoDiretoPct).toFixed(1)}% do preço
            </div>
          </div>
        </div>

        {/* Fatia 1.2: Substituição Tributária (card próprio com cor diferenciada roxa/violeta quando > 0) */}
        {temSubstTributaria && (
          <div className="p-2.5 rounded-lg bg-violet-50/80 border border-violet-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                <span className="text-[11px] font-bold text-violet-900">
                  Subst. Tributária
                  {substTributariaPctInput > 0 ? ` (${substTributariaPctInput}%)` : ''}
                </span>
              </div>
              <p className="text-[10px] text-violet-700">Imposto ST retido/custo</p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-violet-200/60">
              <div className="font-mono font-bold text-violet-950 text-xs">
                {formatCurrencyBRL(substTributariaValor)}
              </div>
              <div className="text-[10px] font-mono text-violet-800 font-semibold">
                {substTributariaPct.toFixed(1)}% do preço
              </div>
            </div>
          </div>
        )}

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
