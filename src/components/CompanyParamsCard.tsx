import React, { useState } from 'react'
import { Building2, Save, HelpCircle, ChevronDown, ChevronUp, DollarSign } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CompanyPricingParameters } from '@/types'
import { formatCurrencyBRL } from '@/lib/dashboard-utils'

interface CompanyParamsCardProps {
  parameters: CompanyPricingParameters
  onSave: (params: Partial<CompanyPricingParameters>) => Promise<void>
  saving: boolean
}

export function CompanyParamsCard({ parameters, onSave, saving }: CompanyParamsCardProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Estados locais dos inputs editáveis
  const [cotacaoDolar, setCotacaoDolar] = useState(String(parameters.cotacao_dolar))
  const [fretePadrao, setFretePadrao] = useState(String(parameters.frete_padrao))
  const [taxaCartao, setTaxaCartao] = useState(String(parameters.taxa_cartao_pct))
  const [icms, setIcms] = useState(String(parameters.icms_pct))
  const [comissao, setComissao] = useState(String(parameters.comissao_pct))
  const [ipi, setIpi] = useState(String(parameters.ipi_pct))
  const [despesaFixa, setDespesaFixa] = useState(String(parameters.despesa_fixa_mensal))
  const [faturamento, setFaturamento] = useState(String(parameters.faturamento_medio_mensal))
  const [lucratividade, setLucratividade] = useState(String(parameters.lucratividade_desejada_pct))

  // Atualiza os inputs locais quando os parâmetros carregarem
  React.useEffect(() => {
    setCotacaoDolar(String(parameters.cotacao_dolar))
    setFretePadrao(String(parameters.frete_padrao))
    setTaxaCartao(String(parameters.taxa_cartao_pct))
    setIcms(String(parameters.icms_pct))
    setComissao(String(parameters.comissao_pct))
    setIpi(String(parameters.ipi_pct))
    setDespesaFixa(String(parameters.despesa_fixa_mensal))
    setFaturamento(String(parameters.faturamento_medio_mensal))
    setLucratividade(String(parameters.lucratividade_desejada_pct))
  }, [parameters])

  // Cálculos dinâmicos em tempo real no card
  const despFixaNum = parseFloat(despesaFixa.replace(',', '.')) || 0
  const fatNum = parseFloat(faturamento.replace(',', '.')) || 0
  const despesaFixaCalculadaPct = fatNum > 0 ? (despFixaNum / fatNum) * 100 : 0

  const tCartao = parseFloat(taxaCartao.replace(',', '.')) || 0
  const tIcms = parseFloat(icms.replace(',', '.')) || 0
  const tComissao = parseFloat(comissao.replace(',', '.')) || 0
  const tIpi = parseFloat(ipi.replace(',', '.')) || 0
  const custosVariaveisCalculadosPct = tCartao + tIcms + tComissao + tIpi

  const handleSave = async () => {
    await onSave({
      cotacao_dolar: parseFloat(cotacaoDolar.replace(',', '.')) || 5.65,
      frete_padrao: parseFloat(fretePadrao.replace(',', '.')) || 0,
      taxa_cartao_pct: tCartao,
      icms_pct: tIcms,
      comissao_pct: tComissao,
      ipi_pct: tIpi,
      despesa_fixa_mensal: despFixaNum,
      faturamento_medio_mensal: fatNum,
      lucratividade_desejada_pct: parseFloat(lucratividade.replace(',', '.')) || 25,
    })
  }

  return (
    <Card className="border-indigo-200/80 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50 shadow-2xs">
      <CardHeader className="pb-3 pt-4 border-b border-indigo-100/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Parâmetros da Empresa (JUCA INFORMÁTICA)</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-mono font-bold px-1.5 py-0.5 rounded">
                  US$ = R$ {parseFloat(cotacaoDolar || '0').toFixed(2)}
                </span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Padrões corporativos usados como base para todos os cálculos de precificação
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Salvando...' : 'Salvar Parâmetros'}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
              title={collapsed ? 'Expandir parâmetros' : 'Recolher parâmetros'}
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Bloco 1: Cotação e Frete */}
            <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  Moeda & Frete
                </span>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                  <span>Cotação Dólar (R$)</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-slate-400 cursor-pointer" />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-xs">
                        Valor em reais por 1 dólar norte-americano (US$), usado para conversão
                        automática dos custos importados.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cotacaoDolar}
                  onChange={(e) => setCotacaoDolar(e.target.value)}
                  className="h-8 font-mono text-xs font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600">
                  Frete Padrão por Item (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fretePadrao}
                  onChange={(e) => setFretePadrao(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            {/* Bloco 2: Rateio de Despesas Fixas */}
            <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="font-bold text-slate-800">Despesas Fixas da Empresa</span>
                <span className="font-mono text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                  {despesaFixaCalculadaPct.toFixed(1)}% das vendas
                </span>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600">
                  Despesa Fixa Mensal (R$)
                </Label>
                <Input
                  type="number"
                  step="100"
                  value={despesaFixa}
                  onChange={(e) => setDespesaFixa(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600">
                  Faturamento Médio Mensal (R$)
                </Label>
                <Input
                  type="number"
                  step="1000"
                  value={faturamento}
                  onChange={(e) => setFaturamento(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            {/* Bloco 3: Custos Variáveis Detalhados */}
            <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="font-bold text-slate-800">Custos Variáveis (%)</span>
                <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                  Total: {custosVariaveisCalculadosPct.toFixed(1)}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-slate-600">Taxa Cartão %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={taxaCartao}
                    onChange={(e) => setTaxaCartao(e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-slate-600">
                    ICMS / Simples %
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={icms}
                    onChange={(e) => setIcms(e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-slate-600">Comissão %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={comissao}
                    onChange={(e) => setComissao(e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-slate-600">IPI / Outros %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={ipi}
                    onChange={(e) => setIpi(e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Bloco 4: Lucratividade Desejada e Resumo */}
            <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-bold text-slate-800">Lucratividade Alvo</span>
                </div>

                <div className="space-y-1 mt-2">
                  <Label className="text-[11px] font-semibold text-slate-600">
                    Lucratividade Desejada (%)
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={lucratividade}
                    onChange={(e) => setLucratividade(e.target.value)}
                    className="h-8 font-mono text-xs font-bold text-emerald-700 bg-emerald-50/50 border-emerald-200"
                  />
                </div>
              </div>

              <div className="p-2 rounded bg-slate-50 border border-slate-200/70 text-[11px] space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Dedução Total:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {(
                      despesaFixaCalculadaPct +
                      custosVariaveisCalculadosPct +
                      (parseFloat(lucratividade) || 0)
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Markup Divisor Base:</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {(() => {
                      const soma =
                        despesaFixaCalculadaPct +
                        custosVariaveisCalculadosPct +
                        (parseFloat(lucratividade) || 0)
                      const div = 1 - soma / 100
                      return div > 0 ? `${(1 / div).toFixed(2)}×` : '—'
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
