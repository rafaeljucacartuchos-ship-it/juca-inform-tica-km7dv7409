import React, { useState, useEffect, useMemo } from 'react'
import { Users, UserCheck, ShoppingBag, Percent, AlertCircle, Info } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, DivisionModel, DivisionDetails } from '@/types'
import { DIVISION_MODELS, computeDivisionDetails, roundCents } from '@/lib/order-division'

export interface OrderTeamDivisionSectionProps {
  technicians: User[]
  allUsers: User[]
  primaryTechId: string
  secondTechId: string
  sellerId: string
  divisionModel: DivisionModel
  isCustom: boolean
  totalServices: number
  totalProducts: number
  orderTotal: number
  readOnly?: boolean
  divisionDetails?: DivisionDetails
  onPrimaryTechChange: (id: string) => void
  onSecondTechChange: (id: string) => void
  onSellerChange: (id: string) => void
  onDivisionModelChange: (model: DivisionModel) => void
  onIsCustomChange: (isCustom: boolean) => void
  onDetailsChange?: (details: DivisionDetails) => void
}

export function OrderTeamDivisionSection({
  technicians,
  allUsers,
  primaryTechId,
  secondTechId,
  sellerId,
  divisionModel,
  isCustom,
  totalServices,
  totalProducts,
  orderTotal,
  readOnly = false,
  divisionDetails,
  onPrimaryTechChange,
  onSecondTechChange,
  onSellerChange,
  onDivisionModelChange,
  onIsCustomChange,
  onDetailsChange,
}: OrderTeamDivisionSectionProps) {
  // Usuários resolvidos
  const primaryUser = allUsers.find((u) => u.id === primaryTechId) || null
  const secondUser = allUsers.find((u) => u.id === secondTechId) || null
  const sellerUser = allUsers.find((u) => u.id === sellerId) || null

  // Custom percentages state
  const [customPcts, setCustomPcts] = useState<{
    tech1ServicesPct: number
    tech1ProductsPct: number
    tech2ServicesPct: number
    tech2ProductsPct: number
    sellerServicesPct: number
    sellerProductsPct: number
  }>(() => {
    if (divisionDetails && divisionDetails.participants?.length > 0) {
      const p1 = divisionDetails.participants.find((p) => p.role === 'primary_tech')
      const p2 = divisionDetails.participants.find((p) => p.role === 'second_tech')
      const ps = divisionDetails.participants.find((p) => p.role === 'seller')
      return {
        tech1ServicesPct: p1?.servicesPct ?? 100,
        tech1ProductsPct: p1?.productsPct ?? (sellerId ? 0 : 100),
        tech2ServicesPct: p2?.servicesPct ?? 0,
        tech2ProductsPct: p2?.productsPct ?? 0,
        sellerServicesPct: ps?.servicesPct ?? 0,
        sellerProductsPct: ps?.productsPct ?? 100,
      }
    }
    return {
      tech1ServicesPct: 100,
      tech1ProductsPct: sellerId ? 0 : 100,
      tech2ServicesPct: 0,
      tech2ProductsPct: 0,
      sellerServicesPct: 0,
      sellerProductsPct: 100,
    }
  })

  // Recalcula detalhamento sempre que inputs mudarem
  const currentDetails = useMemo(() => {
    return computeDivisionDetails({
      model: divisionModel,
      isCustom,
      tech1: primaryUser
        ? { id: primaryUser.id, name: primaryUser.name || 'Técnico Principal' }
        : null,
      tech2: secondUser ? { id: secondUser.id, name: secondUser.name || 'Segundo Técnico' } : null,
      seller: sellerUser ? { id: sellerUser.id, name: sellerUser.name || 'Vendedor' } : null,
      totalServices,
      totalProducts,
      orderTotal,
      customPcts,
    })
  }, [
    divisionModel,
    isCustom,
    primaryUser,
    secondUser,
    sellerUser,
    totalServices,
    totalProducts,
    orderTotal,
    customPcts,
  ])

  useEffect(() => {
    if (onDetailsChange) {
      onDetailsChange(currentDetails)
    }
  }, [currentDetails, onDetailsChange])

  // Validação de somas
  const sumServicesPct = currentDetails.participants.reduce((s, p) => s + p.servicesPct, 0)
  const sumProductsPct = currentDetails.participants.reduce((s, p) => s + p.productsPct, 0)

  const servicesMismatch = totalServices > 0 && Math.abs(sumServicesPct - 100) > 0.1
  const productsMismatch = totalProducts > 0 && Math.abs(sumProductsPct - 100) > 0.1

  // Manipulador de troca de modelo de divisão
  const handleModelSelect = (m: DivisionModel) => {
    onDivisionModelChange(m)
    if (m === 'custom') {
      onIsCustomChange(true)
    } else {
      onIsCustomChange(false)
      // Ajusta percentuais default correspondentes
      if (m === 'single_tech') {
        setCustomPcts({
          tech1ServicesPct: 100,
          tech1ProductsPct: sellerId ? 0 : 100,
          tech2ServicesPct: 0,
          tech2ProductsPct: 0,
          sellerServicesPct: 0,
          sellerProductsPct: sellerId ? 100 : 0,
        })
      } else if (m === 'two_techs_split_services') {
        setCustomPcts({
          tech1ServicesPct: 50,
          tech1ProductsPct: sellerId ? 0 : 50,
          tech2ServicesPct: 50,
          tech2ProductsPct: sellerId ? 0 : 50,
          sellerServicesPct: 0,
          sellerProductsPct: sellerId ? 100 : 0,
        })
      } else if (m === 'two_split_all') {
        setCustomPcts({
          tech1ServicesPct: 50,
          tech1ProductsPct: 50,
          tech2ServicesPct: 50,
          tech2ProductsPct: 50,
          sellerServicesPct: 0,
          sellerProductsPct: 0,
        })
      } else if (m === 'tech_and_seller') {
        setCustomPcts({
          tech1ServicesPct: 100,
          tech1ProductsPct: 0,
          tech2ServicesPct: 0,
          tech2ProductsPct: 0,
          sellerServicesPct: 0,
          sellerProductsPct: 100,
        })
      } else if (m === 'two_techs_and_seller') {
        setCustomPcts({
          tech1ServicesPct: 50,
          tech1ProductsPct: 0,
          tech2ServicesPct: 50,
          tech2ProductsPct: 0,
          sellerServicesPct: 0,
          sellerProductsPct: 100,
        })
      }
    }
  }

  const formatBRL = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <Card className="border border-slate-200 shadow-sm bg-slate-50/50">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Equipe e divisão da OS</h3>
              <p className="text-[11px] text-slate-500">
                Atribuição de responsabilidades e participação na produção de serviços e produtos
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[11px] bg-white border-slate-200 font-medium">
            Acompanhamento de Produção
          </Badge>
        </div>

        {/* Linha de seleção dos 3 participantes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Técnico Principal */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
              Técnico Principal *
            </Label>
            {readOnly ? (
              <div className="h-9 px-3 text-xs bg-white border border-slate-200 rounded-md flex items-center text-slate-800">
                {primaryUser?.name || 'Não informado'}
              </div>
            ) : (
              <Select
                value={primaryTechId || '__none__'}
                onValueChange={(val) => onPrimaryTechChange(val === '__none__' ? '' : val)}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Selecione o técnico principal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs italic text-slate-400">
                    Sem técnico principal
                  </SelectItem>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Segundo Técnico */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-emerald-600" />
              Segundo Técnico (Opcional)
            </Label>
            {readOnly ? (
              <div className="h-9 px-3 text-xs bg-white border border-slate-200 rounded-md flex items-center text-slate-800">
                {secondUser?.name || 'Nenhum'}
              </div>
            ) : (
              <Select
                value={secondTechId || '__none__'}
                onValueChange={(val) => onSecondTechChange(val === '__none__' ? '' : val)}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Nenhum segundo técnico..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs italic text-slate-400">
                    Nenhum segundo técnico
                  </SelectItem>
                  {technicians
                    .filter((t) => t.id !== primaryTechId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Vendedor Responsável */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5 text-blue-600" />
              Vendedor Responsável (Opcional)
            </Label>
            {readOnly ? (
              <div className="h-9 px-3 text-xs bg-white border border-slate-200 rounded-md flex items-center text-slate-800">
                {sellerUser?.name || 'Nenhum (técnicos respondem)'}
              </div>
            ) : (
              <Select
                value={sellerId || '__none__'}
                onValueChange={(val) => onSellerChange(val === '__none__' ? '' : val)}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Nenhum (técnicos respondem)..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs italic text-slate-400">
                    Nenhum (técnicos respondem)
                  </SelectItem>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.name}{' '}
                      {u.role === 'technician' ? '(Técnico)' : u.role === 'admin' ? '(Admin)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Modelo de divisão */}
        <div className="space-y-2 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <Label className="text-xs font-semibold text-slate-700">
              Modelo de Divisão de Valores
            </Label>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={!isCustom ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() =>
                    handleModelSelect(divisionModel === 'custom' ? 'single_tech' : divisionModel)
                  }
                  className="h-7 text-[11px] px-2"
                >
                  Modo Padrão (50/50 ou 100%)
                </Button>
                <Button
                  type="button"
                  variant={isCustom ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    onIsCustomChange(true)
                    onDivisionModelChange('custom')
                  }}
                  className="h-7 text-[11px] px-2 text-indigo-600 font-semibold"
                >
                  <Percent className="h-3 w-3 mr-1" />
                  Personalizar %
                </Button>
              </div>
            )}
          </div>

          {!readOnly ? (
            <Select
              value={divisionModel}
              onValueChange={(val: DivisionModel) => handleModelSelect(val)}
            >
              <SelectTrigger className="h-9 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIVISION_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-xs font-medium text-slate-800 bg-white p-2 border border-slate-200 rounded">
              {DIVISION_MODELS.find((m) => m.id === divisionModel)?.label ||
                'Divisão não informada'}
            </div>
          )}
        </div>

        {/* Tabela de Ajuste de Percentuais (se Custom) e Prévia de Valores Atribuídos */}
        <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
          <div className="p-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">
              Resumo e Prévia da Produção Atribuída
            </span>
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span>
                Serviços:{' '}
                <strong className="font-mono text-indigo-700">{formatBRL(totalServices)}</strong>
              </span>
              <span>•</span>
              <span>
                Produtos:{' '}
                <strong className="font-mono text-emerald-700">{formatBRL(totalProducts)}</strong>
              </span>
              <span>•</span>
              <span>
                Total OS:{' '}
                <strong className="font-mono text-slate-900">{formatBRL(orderTotal)}</strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2 px-3">Participante / Papel</th>
                  <th className="py-2 px-3 text-center">Partic. Serviços (%)</th>
                  <th className="py-2 px-3 text-right">Valor Serviços</th>
                  <th className="py-2 px-3 text-center">Partic. Produtos (%)</th>
                  <th className="py-2 px-3 text-right">Valor Produtos</th>
                  <th className="py-2 px-3 text-right font-bold">Total Atribuído</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentDetails.participants.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                      Selecione o técnico principal ou participantes para calcular a divisão.
                    </td>
                  </tr>
                )}
                {currentDetails.participants.map((p) => {
                  const isTech1 = p.role === 'primary_tech'
                  const isTech2 = p.role === 'second_tech'
                  const isSeller = p.role === 'seller'

                  const roleLabel =
                    p.role === 'primary_tech'
                      ? 'Técnico Principal'
                      : p.role === 'second_tech'
                        ? 'Segundo Técnico'
                        : 'Vendedor Responsável'

                  const roleBadgeColor =
                    p.role === 'primary_tech'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : p.role === 'second_tech'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'

                  return (
                    <tr key={`${p.userId}_${p.role}`} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{p.userName}</span>
                          <span className="text-[10px]">
                            <Badge
                              variant="outline"
                              className={`h-4 px-1 text-[9px] ${roleBadgeColor}`}
                            >
                              {roleLabel}
                            </Badge>
                          </span>
                        </div>
                      </td>

                      {/* % Serviços */}
                      <td className="py-2.5 px-3 text-center">
                        {isCustom && !readOnly ? (
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="any"
                              value={
                                isTech1
                                  ? customPcts.tech1ServicesPct
                                  : isTech2
                                    ? customPcts.tech2ServicesPct
                                    : customPcts.sellerServicesPct
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                setCustomPcts((prev) => ({
                                  ...prev,
                                  ...(isTech1 ? { tech1ServicesPct: val } : {}),
                                  ...(isTech2 ? { tech2ServicesPct: val } : {}),
                                  ...(isSeller ? { sellerServicesPct: val } : {}),
                                }))
                              }}
                              className="h-7 w-16 text-center text-xs p-1"
                            />
                            <span className="text-slate-400 text-xs">%</span>
                          </div>
                        ) : (
                          <span className="font-mono font-medium text-slate-800">
                            {p.servicesPct}%
                          </span>
                        )}
                      </td>

                      {/* Valor Serviços */}
                      <td className="py-2.5 px-3 text-right font-mono text-indigo-600 font-medium">
                        {formatBRL(p.servicesAmount)}
                      </td>

                      {/* % Produtos */}
                      <td className="py-2.5 px-3 text-center">
                        {isCustom && !readOnly ? (
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="any"
                              value={
                                isTech1
                                  ? customPcts.tech1ProductsPct
                                  : isTech2
                                    ? customPcts.tech2ProductsPct
                                    : customPcts.sellerProductsPct
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                setCustomPcts((prev) => ({
                                  ...prev,
                                  ...(isTech1 ? { tech1ProductsPct: val } : {}),
                                  ...(isTech2 ? { tech2ProductsPct: val } : {}),
                                  ...(isSeller ? { sellerProductsPct: val } : {}),
                                }))
                              }}
                              className="h-7 w-16 text-center text-xs p-1"
                            />
                            <span className="text-slate-400 text-xs">%</span>
                          </div>
                        ) : (
                          <span className="font-mono font-medium text-slate-800">
                            {p.productsPct}%
                          </span>
                        )}
                      </td>

                      {/* Valor Produtos */}
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-medium">
                        {formatBRL(p.productsAmount)}
                      </td>

                      {/* Total */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatBRL(p.totalAmount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Avisos de validação de soma se houver divergência */}
        {(servicesMismatch || productsMismatch) && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2 text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              {servicesMismatch && (
                <p>
                  Atenção: A soma dos percentuais de serviços está em{' '}
                  <strong>{sumServicesPct}%</strong> (esperado: 100%).
                </p>
              )}
              {productsMismatch && (
                <p>
                  Atenção: A soma dos percentuais de produtos está em{' '}
                  <strong>{sumProductsPct}%</strong> (esperado: 100%).
                </p>
              )}
            </div>
          </div>
        )}

        {/* Nota explicativa de regra de negócio */}
        <div className="flex items-start gap-2 text-[11px] text-slate-500 pt-1">
          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <p>
            O valor atribuído reflete o acompanhamento de produção por participante na O.S. (não
            representa comissão, remuneração salarial ou duplicidade de receita nos relatórios). A
            mesma pessoa pode atuar como técnico e vendedor com papéis e valores mantidos
            separadamente.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
