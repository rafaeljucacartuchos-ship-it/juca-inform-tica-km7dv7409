import { useState, useMemo } from 'react'
import { Printer, ChevronDown, Search, Check, AlertCircle, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import type { ImpressoraRecord } from '@/services/pricing-module'

interface PrinterSelectComboProps {
  printers: ImpressoraRecord[]
  selectedPrinter: ImpressoraRecord | null
  onSelectPrinter: (printer: ImpressoraRecord) => void
  disabled?: boolean
}

export function PrinterSelectCombo({
  printers,
  selectedPrinter,
  onSelectPrinter,
  disabled = false,
}: PrinterSelectComboProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredPrinters = useMemo(() => {
    if (!searchTerm.trim()) return printers
    const term = searchTerm.toLowerCase().trim()
    return printers.filter(
      (p) =>
        p.modelo.toLowerCase().includes(term) ||
        p.fabricante.toLowerCase().includes(term) ||
        p.tecnologia.toLowerCase().includes(term),
    )
  }, [printers, searchTerm])

  const groupedPrinters = useMemo(() => {
    const groups: Record<string, ImpressoraRecord[]> = {}
    filteredPrinters.forEach((p) => {
      const fab = p.fabricante || 'Outros'
      if (!groups[fab]) groups[fab] = []
      groups[fab].push(p)
    })
    return groups
  }, [filteredPrinters])

  const getTechLabel = (tec: string) => {
    switch (tec) {
      case 'laser_mono':
        return 'Laser Mono'
      case 'laser_colorido':
        return 'Laser Colorido'
      case 'tinta':
        return 'Tanque de Tinta'
      case 'termica':
        return 'Térmica'
      case 'matricial':
        return 'Matricial'
      default:
        return tec
    }
  }

  const getTechBadgeVariant = (tec: string) => {
    switch (tec) {
      case 'laser_mono':
        return 'bg-slate-100 text-slate-800'
      case 'laser_colorido':
        return 'bg-indigo-100 text-indigo-800'
      case 'tinta':
        return 'bg-cyan-100 text-cyan-800'
      case 'termica':
        return 'bg-amber-100 text-amber-900'
      case 'matricial':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between h-11 px-3 text-left font-normal bg-white border-slate-300 hover:border-indigo-500 shadow-sm transition-all"
          >
            {selectedPrinter ? (
              <div className="flex items-center gap-2 overflow-hidden">
                <Printer className="h-4 w-4 shrink-0 text-indigo-600" />
                <span className="font-bold text-slate-900 truncate">{selectedPrinter.modelo}</span>
                <span className="text-slate-400 text-xs shrink-0">•</span>
                <span className="text-slate-600 text-xs shrink-0">
                  {selectedPrinter.fabricante}
                </span>
                <Badge
                  className={`text-[10px] shrink-0 font-semibold ${getTechBadgeVariant(
                    selectedPrinter.tecnologia,
                  )}`}
                >
                  {getTechLabel(selectedPrinter.tecnologia)}
                </Badge>
                {selectedPrinter.bloqueada && (
                  <Badge variant="destructive" className="text-[9px] shrink-0">
                    Bloqueada
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-slate-400 text-xs">
                Selecione uma impressora do parque ({printers.length} modelos disponíveis)...
              </span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[420px] max-w-[95vw] p-2" align="start">
          <div className="space-y-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar impressora (ex: DCP-L2540DW, L3250, M127fn)..."
                className="h-9 text-xs pl-8 font-medium"
                autoFocus
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-3 pt-1 pr-1">
              {Object.keys(groupedPrinters).length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Nenhuma impressora encontrada para &quot;{searchTerm}&quot;.
                </div>
              ) : (
                Object.keys(groupedPrinters).map((fab) => (
                  <div key={fab} className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                      {fab} ({groupedPrinters[fab].length})
                    </div>
                    <div className="space-y-0.5">
                      {groupedPrinters[fab].map((printer) => {
                        const isSelected = selectedPrinter?.id === printer.id
                        return (
                          <button
                            key={printer.id}
                            type="button"
                            onClick={() => {
                              onSelectPrinter(printer)
                              setOpen(false)
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-md text-xs text-left transition-colors ${
                              isSelected
                                ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200'
                                : 'hover:bg-slate-100 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Printer className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                              <div className="truncate">
                                <span className="font-semibold">{printer.modelo}</span>
                                <span className="text-[10px] text-slate-500 ml-1.5 font-normal">
                                  {getTechLabel(printer.tecnologia)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {printer.bloqueada ? (
                                <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                                  Bloqueada
                                </Badge>
                              ) : printer.valor_compra ? (
                                <span className="font-mono text-[10px] font-bold text-slate-700">
                                  {Number(printer.valor_compra).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-600 font-medium">
                                  Sem valor
                                </span>
                              )}
                              {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
