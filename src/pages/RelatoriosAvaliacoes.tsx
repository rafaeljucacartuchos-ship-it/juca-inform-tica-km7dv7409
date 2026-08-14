import { useState, useEffect } from 'react'
import {
  Star,
  Trophy,
  ThumbsUp,
  AlertCircle,
  Heart,
  Award,
  Filter,
  MessageSquare,
  UserCheck,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getEvaluations,
  getTechnicianRatingSummaries,
  EvaluationRecord,
  TechnicianRatingSummary,
} from '@/services/evaluations'

export default function RelatoriosAvaliacoes() {
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([])
  const [techSummaries, setTechSummaries] = useState<TechnicianRatingSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRating, setFilterRating] = useState<string>('all')
  const [filterSatisfaction, setFilterSatisfaction] = useState<string>('all')

  const loadData = async () => {
    setLoading(true)
    try {
      const [evals, summaries] = await Promise.all([
        getEvaluations(),
        getTechnicianRatingSummaries(),
      ])
      setEvaluations(evals)
      setTechSummaries(summaries)
    } catch (_) {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredEvaluations = evaluations.filter((item) => {
    if (filterRating !== 'all' && item.rating !== Number(filterRating)) {
      return false
    }
    if (filterSatisfaction !== 'all' && item.satisfaction !== filterSatisfaction) {
      return false
    }
    return true
  })

  // Calculate overall metrics
  const totalCount = evaluations.length
  const avgOverall =
    totalCount > 0
      ? (evaluations.reduce((sum, item) => sum + item.rating, 0) / totalCount).toFixed(1)
      : '0.0'

  const satisfactionLabels: Record<string, { label: string; badge: string; icon: any }> = {
    excelente: {
      label: 'Excelente',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: Heart,
    },
    bom: { label: 'Bom', badge: 'bg-blue-100 text-blue-800 border-blue-200', icon: ThumbsUp },
    pode_melhorar: {
      label: 'Pode melhorar',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: AlertCircle,
    },
    nao_gostei: {
      label: 'Não gostei',
      badge: 'bg-rose-100 text-rose-800 border-rose-200',
      icon: AlertCircle,
    },
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Award className="h-6 w-6 text-indigo-600" /> Relatório de Avaliações
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Acompanhe a satisfação dos clientes e o ranking de desempenho da equipe técnica.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Star className="h-6 w-6 fill-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Média Geral
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold font-mono text-slate-900">{avgOverall}</span>
                <span className="text-xs text-slate-500">/ 5.0</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total de Avaliações
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold font-mono text-slate-900">{totalCount}</span>
                <span className="text-xs text-slate-500">avaliações</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Técnico do Mês
              </p>
              <div className="mt-0.5 truncate">
                <span className="text-base font-bold text-slate-900">
                  {techSummaries.length > 0 && techSummaries[0].totalEvaluations > 0
                    ? techSummaries[0].technicianName
                    : 'Nenhum técnico'}
                </span>
                {techSummaries.length > 0 && techSummaries[0].totalEvaluations > 0 && (
                  <p className="text-[11px] text-emerald-600 font-medium font-mono">
                    ★ {techSummaries[0].averageRating} ({techSummaries[0].totalEvaluations}{' '}
                    avaliações)
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RANKING DOS TÉCNICOS */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Ranking de Desempenho dos Técnicos
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Pontuação média calculada com base nas avaliações enviadas pelos clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Pos.</th>
                  <th className="py-3 px-4">Técnico</th>
                  <th className="py-3 px-4 text-center">Pontuação Média</th>
                  <th className="py-3 px-4 text-center">Total Avaliações</th>
                  <th className="py-3 px-4 text-right">Distribuição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {techSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-500">
                      Nenhum técnico encontrado.
                    </td>
                  </tr>
                ) : (
                  techSummaries.map((tech, index) => {
                    const isTop1 = index === 0 && tech.totalEvaluations > 0
                    const isTop2 = index === 1 && tech.totalEvaluations > 0
                    const isTop3 = index === 2 && tech.totalEvaluations > 0

                    return (
                      <tr key={tech.technicianId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-center font-bold">
                          {isTop1 ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-xs">
                              1º
                            </span>
                          ) : isTop2 ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-800 text-xs">
                              2º
                            </span>
                          ) : isTop3 ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-800/10 text-amber-900 text-xs">
                              3º
                            </span>
                          ) : (
                            <span className="text-slate-400">{index + 1}º</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-slate-400" />
                          <span>{tech.technicianName}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {tech.totalEvaluations > 0 ? (
                            <div className="inline-flex items-center gap-1 font-bold text-slate-900">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              <span>{tech.averageRating}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Sem avaliações</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-700">
                          {tech.totalEvaluations}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 text-[10px]">
                            <span className="text-emerald-600 font-semibold">
                              {tech.satisfactionCounts.excelente} Excelente
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-blue-600 font-semibold">
                              {tech.satisfactionCounts.bom} Bom
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-rose-600 font-semibold">
                              {tech.satisfactionCounts.nao_gostei +
                                tech.satisfactionCounts.pode_melhorar}{' '}
                              Críticas
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* HISTÓRICO E FEEDBACKS */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Histórico de Avaliações e Críticas Construtivas
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Veja o feedback detalhado enviado pelos clientes.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <Select value={filterRating} onValueChange={setFilterRating}>
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue placeholder="Estrelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todas Estrelas
                  </SelectItem>
                  <SelectItem value="5" className="text-xs">
                    5 Estrelas
                  </SelectItem>
                  <SelectItem value="4" className="text-xs">
                    4 Estrelas
                  </SelectItem>
                  <SelectItem value="3" className="text-xs">
                    3 Estrelas
                  </SelectItem>
                  <SelectItem value="2" className="text-xs">
                    2 Estrelas
                  </SelectItem>
                  <SelectItem value="1" className="text-xs">
                    1 Estrela
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSatisfaction} onValueChange={setFilterSatisfaction}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue placeholder="Opção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todas Opções
                  </SelectItem>
                  <SelectItem value="excelente" className="text-xs">
                    Excelente
                  </SelectItem>
                  <SelectItem value="bom" className="text-xs">
                    Bom
                  </SelectItem>
                  <SelectItem value="pode_melhorar" className="text-xs">
                    Pode melhorar
                  </SelectItem>
                  <SelectItem value="nao_gostei" className="text-xs">
                    Não gostei
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {filteredEvaluations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Nenhuma avaliação cadastrada com os filtros selecionados.
              </div>
            ) : (
              filteredEvaluations.map((item) => {
                const satInfo = satisfactionLabels[item.satisfaction] || {
                  label: item.satisfaction,
                  badge: 'bg-slate-100 text-slate-700',
                  icon: ThumbsUp,
                }
                const SatIcon = satInfo.icon

                return (
                  <div
                    key={item.id}
                    className="p-4 space-y-2 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-indigo-600">
                          OS #{item.expand?.service_order?.number || '—'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs font-semibold text-slate-800">
                          Técnico: {item.expand?.technician?.name || 'Não atribuído'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] gap-1 ${satInfo.badge}`}>
                          <SatIcon className="h-3 w-3" />
                          {satInfo.label}
                        </Badge>
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3.5 w-3.5 ${
                                s <= item.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {item.feedback ? (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-xs text-slate-700">
                        <p className="font-semibold text-slate-500 mb-0.5 text-[11px]">
                          Feedback do Cliente:
                        </p>
                        <p className="italic">"{item.feedback}"</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Sem comentário escrito.</p>
                    )}

                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono">
                      <Calendar className="h-3 w-3" />
                      <span>{item.created?.substring(0, 10).split('-').reverse().join('/')}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
