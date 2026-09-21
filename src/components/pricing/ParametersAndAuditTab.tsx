import { useState } from 'react'
import { Settings, History, Save, Clock, User, Shield, Download, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import type {
  ParametrosGlobais,
  AuditoriaPrecoRecord,
  SuprimentoRecord,
  ImpressoraRecord,
} from '@/services/pricing-module'
import { updateParametrosGlobais } from '@/services/pricing-module'
import { useToast } from '@/hooks/use-toast'

interface ParametersAndAuditTabProps {
  parametros: ParametrosGlobais
  auditHistory: AuditoriaPrecoRecord[]
  supplies: SuprimentoRecord[]
  printers: ImpressoraRecord[]
  onReload: () => void
  readOnly?: boolean
}

export function ParametersAndAuditTab({
  parametros,
  auditHistory,
  supplies,
  printers,
  onReload,
  readOnly = false,
}: ParametersAndAuditTabProps) {
  const { toast } = useToast()
  const [markup, setMarkup] = useState(String(parametros.mark_up_revenda || 1.45))
  const [vidaUtil, setVidaUtil] = useState(String(parametros.vida_util_padrao_meses || 48))
  const [producaoRef, setProducaoRef] = useState(
    String(parametros.producao_mensal_referencia || 1000),
  )
  const [saving, setSaving] = useState(false)

  const handleSaveParams = async (e: React.FormEvent) => {
    e.preventDefault()
    const markupNum = parseFloat(markup)
    const vidaUtilNum = parseInt(vidaUtil, 10)
    const producaoNum = parseInt(producaoRef, 10)

    if (isNaN(markupNum) || markupNum < 1.0) {
      toast({
        title: 'Mark-up inválido',
        description: 'O fator de mark-up não pode ser inferior a 1,00.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await updateParametrosGlobais(parametros.id, {
        mark_up_revenda: markupNum,
        vida_util_padrao_meses: vidaUtilNum || 48,
        producao_mensal_referencia: producaoNum || 1000,
      })
      toast({ title: 'Parâmetros globais atualizados com sucesso!' })
      onReload()
    } catch (err: any) {
      console.error(err)
      toast({ title: 'Erro ao atualizar parâmetros', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Exportação completa em JSON (Regra 20.4)
  const handleExportFullJson = () => {
    const exportData = {
      meta: {
        sistema: 'Juca Cartuchos — Módulo de Precificação de Locação',
        exportadoEm: new Date().toISOString(),
        versao: '2.0-spec2026',
      },
      parametros,
      suprimentos: supplies,
      impressoras: printers,
      auditoria: auditHistory.slice(0, 50),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `juca_cartuchos_precificacao_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: 'Exportação concluída!',
      description: 'Arquivo JSON gerado com toda a base de suprimentos, impressoras e parâmetros.',
    })
  }

  return (
    <div className="space-y-6">
      {/* CARD DE PARÂMETROS GLOBAIS (Seção 2.1) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Parâmetros Globais do Motor de Cálculo
              </h3>
              <p className="text-xs text-slate-500">
                Variáveis padrão aplicadas a todas as novas simulações de contratos de locação.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportFullJson}
            className="text-xs font-semibold text-slate-700 gap-1.5"
          >
            <Download className="h-3.5 w-3.5 text-indigo-600" />
            <span>Exportar Base Completa (JSON)</span>
          </Button>
        </div>

        <form onSubmit={handleSaveParams} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-800">
                Mark-up de Revenda Padrão (Fator)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="1.0"
                value={markup}
                onChange={(e) => setMarkup(e.target.value)}
                disabled={readOnly}
                className="h-9 text-xs font-mono font-bold"
              />
              <p className="text-[10px] text-slate-400">
                Padrão homologado: 1.4500 (multiplicador sobre o custo total)
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-800">Vida Útil Padrão (meses)</Label>
              <Input
                type="number"
                step="1"
                min="1"
                value={vidaUtil}
                onChange={(e) => setVidaUtil(e.target.value)}
                disabled={readOnly}
                className="h-9 text-xs font-mono font-bold"
              />
              <p className="text-[10px] text-slate-400">
                Período de amortização temporal contratual (padrão: 48 meses)
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-800">
                Produção Mensal de Referência (págs)
              </Label>
              <Input
                type="number"
                step="100"
                min="1"
                value={producaoRef}
                onChange={(e) => setProducaoRef(e.target.value)}
                disabled={readOnly}
                className="h-9 text-xs font-mono font-bold"
              />
              <p className="text-[10px] text-slate-400">
                Volume inicial sugerido no simulador (padrão: 1000 páginas)
              </p>
            </div>
          </div>

          {!readOnly && (
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving ? 'Salvando...' : 'Salvar Parâmetros Globais'}</span>
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* TRILHA DE AUDITORIA DE PREÇOS E PARÂMETROS (Seção 10.2 / 20.4) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Trilha de Auditoria & Rastreabilidade de Preços
              </h3>
              <p className="text-xs text-slate-500">
                Histórico imutável de todas as alterações manuais e em lote (usuário, data/hora,
                valor antigo e novo).
              </p>
            </div>
          </div>

          <Badge variant="outline" className="text-xs bg-slate-50 font-mono">
            {auditHistory.length} registros
          </Badge>
        </div>

        <div className="overflow-x-auto max-h-[420px] border rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] sticky top-0 border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">Data / Hora</th>
                <th className="py-2 px-3">Tabela</th>
                <th className="py-2 px-3">Campo Alterado</th>
                <th className="py-2 px-3">Valor Anterior</th>
                <th className="py-2 px-3">Novo Valor Homologado</th>
                <th className="py-2 px-3">Usuário Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
              {auditHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Nenhuma alteração registrada ainda. Toda edição manual ou reajuste em lote será
                    registrado aqui.
                  </td>
                </tr>
              ) : (
                auditHistory.map((item) => {
                  const dataStr = item.created
                    ? new Date(item.created).toLocaleString('pt-BR')
                    : '—'

                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-slate-500">{dataStr}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {item.tabela_afetada}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-800">{item.campo_alterado}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">
                        {item.valor_antigo || '—'}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-indigo-900">
                        {item.valor_novo}
                      </td>
                      <td className="py-2 px-3 text-slate-700 flex items-center gap-1.5">
                        <User className="h-3 w-3 text-slate-400" />
                        <span>{item.usuario_responsavel}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
