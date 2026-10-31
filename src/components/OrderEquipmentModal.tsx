import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import {
  Search,
  Plus,
  Monitor,
  Laptop,
  Smartphone,
  Printer,
  Tablet,
  Tv,
  Wifi,
  Package,
  Check,
  ChevronsUpDown,
  Loader2,
  Upload,
  X,
  User,
  Hash,
  Tag,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react'
import { Customer, EquipmentType, Equipment } from '@/types'
import { getEquipment, createEquipmentWithPhotos } from '@/services/equipment'
import { getCustomers, getCustomer } from '@/services/customers'
import { formatPhone } from '@/lib/phones'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'

export interface OrderEquipmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentCustomerId?: string
  currentCustomerName?: string
  currentEquipmentRef?: string
  onSelectEquipment: (equipment: Equipment) => Promise<void> | void
}

function getEquipmentIcon(type?: string) {
  switch (type) {
    case 'notebook':
      return Laptop
    case 'desktop':
      return Monitor
    case 'smartphone':
      return Smartphone
    case 'tablet':
      return Tablet
    case 'printer':
      return Printer
    case 'monitor':
      return Tv
    case 'network':
      return Wifi
    default:
      return Package
  }
}

export function OrderEquipmentModal({
  open,
  onOpenChange,
  currentCustomerId,
  currentCustomerName,
  currentEquipmentRef,
  onSelectEquipment,
}: OrderEquipmentModalProps) {
  const { toast } = useToast()

  // Aba ativa: 'search' ou 'new'
  const [activeTab, setActiveTab] = useState<'search' | 'new'>('search')

  // --- ESTADOS DA ABA DE BUSCA ---
  const [searchTerm, setSearchTerm] = useState('')
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [onlyCurrentCustomer, setOnlyCurrentCustomer] = useState(false)

  // --- ESTADOS DA ABA DE CADASTRO ---
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false)
  const [formData, setFormData] = useState({
    customer: currentCustomerId || '',
    name: '',
    type: 'notebook' as EquipmentType,
    brand: '',
    model: '',
    serial_number: '',
    notes: '',
  })
  const [photos, setPhotos] = useState<File[]>([])
  const [processingPhotos, setProcessingPhotos] = useState(false)
  const [loadingSave, setLoadingSave] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  // Carrega lista de equipamentos para busca ao abrir o modal
  useEffect(() => {
    if (!open) return
    setActiveTab('search')
    setSearchTerm('')
    setLinkingId(null)
    setOnlyCurrentCustomer(Boolean(currentCustomerId))

    setLoadingSearch(true)
    getEquipment()
      .then((items) => {
        setEquipments(items || [])
      })
      .catch((err) => {
        console.warn('Erro ao carregar equipamentos:', err)
        setEquipments([])
      })
      .finally(() => setLoadingSearch(false))
  }, [open, currentCustomerId])

  // Inicializa o formulário de cadastro com o cliente da O.S.
  useEffect(() => {
    if (!open) return
    setFormData({
      customer: currentCustomerId || '',
      name: '',
      type: 'notebook',
      brand: '',
      model: '',
      serial_number: '',
      notes: '',
    })
    setPhotos([])
    setErrors({})

    if (currentCustomerId) {
      getCustomer(currentCustomerId)
        .then((c) => setSelectedCustomer(c))
        .catch(() => setSelectedCustomer(null))
    } else {
      setSelectedCustomer(null)
    }

    // Busca rápida inicial de clientes
    setIsSearchingCustomers(true)
    getCustomers('')
      .then((items) => setCustomers(items || []))
      .catch(() => setCustomers([]))
      .finally(() => setIsSearchingCustomers(false))
  }, [open, currentCustomerId])

  // Busca incremental de clientes no combobox
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setIsSearchingCustomers(true)
      getCustomers(customerSearch)
        .then((items) => setCustomers(items || []))
        .catch(() => setCustomers([]))
        .finally(() => setIsSearchingCustomers(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [customerSearch, open])

  // Filtra e prioriza os equipamentos
  const filteredEquipments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    let list = equipments

    if (onlyCurrentCustomer && currentCustomerId) {
      list = list.filter((e) => e.customer === currentCustomerId)
    }

    if (term) {
      list = list.filter((e) => {
        const nameMatch = (e.name || '').toLowerCase().includes(term)
        const brandMatch = (e.brand || '').toLowerCase().includes(term)
        const modelMatch = (e.model || '').toLowerCase().includes(term)
        const serialMatch = (e.serial_number || '').toLowerCase().includes(term)
        const notesMatch = (e.notes || '').toLowerCase().includes(term)
        const cust = e.expand?.customer
        const custNameMatch = (cust?.nome_fantasia || cust?.razao_social || cust?.name || '')
          .toLowerCase()
          .includes(term)

        return nameMatch || brandMatch || modelMatch || serialMatch || notesMatch || custNameMatch
      })
    }

    // Ordenação inteligente: equipamentos do cliente atual no topo
    if (currentCustomerId) {
      return [...list].sort((a, b) => {
        const aIsCust = a.customer === currentCustomerId ? 1 : 0
        const bIsCust = b.customer === currentCustomerId ? 1 : 0
        if (aIsCust !== bIsCust) return bIsCust - aIsCust
        return (a.name || '').localeCompare(b.name || '')
      })
    }

    return list
  }, [equipments, searchTerm, onlyCurrentCustomer, currentCustomerId])

  // Contagem de equipamentos do cliente da OS
  const currentCustomerEquipCount = useMemo(() => {
    if (!currentCustomerId) return 0
    return equipments.filter((e) => e.customer === currentCustomerId).length
  }, [equipments, currentCustomerId])

  const handleSelect = async (eq: Equipment) => {
    setLinkingId(eq.id)
    try {
      await onSelectEquipment(eq)
      onOpenChange(false)
    } catch {
      // Toast já tratado no caller
    } finally {
      setLinkingId(null)
    }
  }

  // Tratamento de fotos
  const handlePhotosChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
    const maxSize = 10 * 1024 * 1024
    setProcessingPhotos(true)

    const processedFiles: File[] = []

    for (const rawFile of files) {
      const isHeicByName = /\.(heic|heif)$/i.test(rawFile.name)
      const isHeicByType = rawFile.type === 'image/heic' || rawFile.type === 'image/heif'
      const isValidType = validTypes.includes(rawFile.type) || isHeicByName || isHeicByType

      if (!isValidType) {
        toast({
          title: 'Formato inválido',
          description: `${rawFile.name}: apenas PNG, JPG, WebP ou HEIC.`,
          variant: 'destructive',
        })
        continue
      }

      let uploadFile: File = rawFile

      if (isHeicByName || isHeicByType) {
        try {
          const { default: heic2any } = await import('heic2any')
          const convertedBlob = await heic2any({
            blob: rawFile,
            toType: 'image/jpeg',
            quality: 0.85,
            multiple: false,
          })
          const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob
          const newFileName = rawFile.name.replace(/\.(heic|heif)$/i, '') + '.jpg'
          uploadFile = new File([finalBlob], newFileName, { type: 'image/jpeg' })
        } catch {
          toast({
            title: 'Erro ao converter foto',
            description: `Não foi possível processar ${rawFile.name}.`,
            variant: 'destructive',
          })
          continue
        }
      }

      if (uploadFile.size > maxSize) {
        toast({
          title: 'Arquivo muito grande',
          description: `${uploadFile.name}: máximo 10MB.`,
          variant: 'destructive',
        })
        continue
      }

      processedFiles.push(uploadFile)
    }

    if (processedFiles.length > 0) {
      setPhotos((prev) => [...prev, ...processedFiles])
      if (errors.photos) {
        setErrors((prev) => {
          const next = { ...prev }
          delete next.photos
          return next
        })
      }
    }

    setProcessingPhotos(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    if (!formData.customer) {
      setErrors((prev) => ({ ...prev, customer: 'Selecione um cliente para o equipamento' }))
      return
    }
    if (!formData.name.trim()) {
      setErrors((prev) => ({ ...prev, name: 'Informe a descrição/nome do equipamento' }))
      return
    }

    setLoadingSave(true)
    try {
      const fd = new FormData()
      fd.append('customer', formData.customer)
      fd.append('name', formData.name.trim())
      fd.append('type', formData.type || 'other')
      if (formData.brand.trim()) fd.append('brand', formData.brand.trim())
      if (formData.model.trim()) fd.append('model', formData.model.trim())
      if (formData.serial_number.trim()) fd.append('serial_number', formData.serial_number.trim())
      if (formData.notes.trim()) fd.append('notes', formData.notes.trim())
      photos.forEach((p) => fd.append('photos', p))

      const created = await createEquipmentWithPhotos(fd)
      toast({
        title: 'Equipamento cadastrado!',
        description: 'Vinculando automaticamente à O.S....',
      })

      // Vincula diretamente à O.S. aberta
      await onSelectEquipment(created)
      onOpenChange(false)
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({
        title: 'Erro ao cadastrar equipamento',
        description: 'Verifique os campos obrigatórios e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoadingSave(false)
    }
  }

  const selectedDisplayName = selectedCustomer
    ? selectedCustomer.nome_fantasia ||
      selectedCustomer.razao_social ||
      selectedCustomer.name ||
      'Cliente Selecionado'
    : currentCustomerName || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          maxHeight: 'var(--teclado-altura, var(--app-visible-height, 100dvh))',
          height: 'var(--teclado-altura, var(--app-visible-height, 100dvh))',
        }}
        className="w-full max-w-full sm:max-w-[620px] h-[var(--teclado-altura,var(--app-visible-height,100dvh))] sm:h-auto max-h-[var(--teclado-altura,var(--app-visible-height,100dvh))] sm:max-h-[90vh] rounded-none sm:rounded-lg p-0 flex flex-col overflow-hidden shadow-xl"
      >
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-5 shrink-0 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Monitor className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Equipamento da Ordem de Serviço
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Busque um equipamento cadastrado ou adicione um novo sem sair da O.S.
              </p>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'search' | 'new')}
            className="w-full mt-2"
          >
            <TabsList className="grid grid-cols-2 w-full h-9 bg-slate-200/70 p-0.5">
              <TabsTrigger
                value="search"
                className="text-xs font-semibold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-indigo-700"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Buscar Cadastrado</span>
              </TabsTrigger>
              <TabsTrigger
                value="new"
                className="text-xs font-semibold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Cadastrar Novo</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>

        {/* ======================= ABA 1: BUSCAR CADASTRADO ======================= */}
        {activeTab === 'search' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Barra de Pesquisa e Filtros */}
            <div className="p-3 sm:p-4 border-b border-slate-100 bg-white space-y-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar por descrição, modelo, serial, marca ou cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-8 h-10 text-xs sm:text-sm bg-slate-50/70 border-slate-200 focus:bg-white"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Botões de atalho/filtro de cliente */}
              {currentCustomerId && (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setOnlyCurrentCustomer(!onlyCurrentCustomer)}
                      className={cn(
                        'text-[11px] font-semibold px-2 py-1 rounded-md border transition-all flex items-center gap-1',
                        onlyCurrentCustomer
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
                      )}
                    >
                      <User className="h-3 w-3" />
                      <span>
                        {onlyCurrentCustomer
                          ? 'Mostrando apenas deste cliente'
                          : `Filtrar cliente da O.S. (${currentCustomerEquipCount})`}
                      </span>
                    </button>
                    {onlyCurrentCustomer && (
                      <button
                        type="button"
                        onClick={() => setOnlyCurrentCustomer(false)}
                        className="text-[10px] text-slate-500 hover:text-slate-800 underline"
                      >
                        Ver todos
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {filteredEquipments.length}{' '}
                    {filteredEquipments.length === 1 ? 'encontrado' : 'encontrados'}
                  </span>
                </div>
              )}
            </div>

            {/* Lista de Resultados */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2 bg-slate-50/50">
              {loadingSearch ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                  <span className="text-xs">Carregando equipamentos cadastrados...</span>
                </div>
              ) : filteredEquipments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-3 bg-white rounded-lg border border-dashed border-slate-200">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <p className="text-xs font-semibold text-slate-700">
                      {searchTerm
                        ? `Nenhum equipamento encontrado para "${searchTerm}".`
                        : onlyCurrentCustomer
                          ? 'Nenhum equipamento cadastrado para o cliente desta O.S.'
                          : 'Nenhum equipamento cadastrado no sistema.'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Você pode cadastrar um novo equipamento agora mesmo sem sair desta tela.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setActiveTab('new')}
                    className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Cadastrar Novo Equipamento</span>
                  </Button>
                </div>
              ) : (
                filteredEquipments.map((eq) => {
                  const Icon = getEquipmentIcon(eq.type)
                  const isCurrentCust = currentCustomerId && eq.customer === currentCustomerId
                  const isAlreadyLinked = currentEquipmentRef && currentEquipmentRef === eq.id
                  const isLinking = linkingId === eq.id
                  const custName =
                    eq.expand?.customer?.nome_fantasia ||
                    eq.expand?.customer?.razao_social ||
                    eq.expand?.customer?.name ||
                    'Sem cliente'

                  return (
                    <div
                      key={eq.id}
                      className={cn(
                        'p-3 rounded-lg border bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-indigo-300',
                        isAlreadyLinked && 'border-emerald-300 bg-emerald-50/40',
                        isCurrentCust && !isAlreadyLinked && 'border-indigo-200 bg-indigo-50/20',
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={cn(
                            'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                            isAlreadyLinked
                              ? 'bg-emerald-100 text-emerald-700'
                              : isCurrentCust
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                              {eq.name}
                            </span>
                            {isCurrentCust && (
                              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[10px] py-0 px-1.5 font-semibold">
                                Cliente da O.S.
                              </Badge>
                            )}
                            {isAlreadyLinked && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] py-0 px-1.5 font-semibold">
                                Vinculado atual
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 flex-wrap">
                            {(eq.brand || eq.model) && (
                              <span className="flex items-center gap-1">
                                <Tag className="h-3 w-3 text-slate-400" />
                                <span className="font-medium text-slate-700">
                                  {[eq.brand, eq.model].filter(Boolean).join(' ')}
                                </span>
                              </span>
                            )}
                            {eq.serial_number && (
                              <span className="flex items-center gap-1 font-mono">
                                <Hash className="h-3 w-3 text-slate-400" />
                                <span>{eq.serial_number}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-slate-400 truncate">
                              <User className="h-3 w-3" />
                              <span className="truncate">{custName}</span>
                            </span>
                          </div>

                          {eq.notes && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                              "{eq.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end sm:justify-center shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isLinking || Boolean(isAlreadyLinked)}
                          onClick={() => handleSelect(eq)}
                          className={cn(
                            'h-8 text-xs font-bold gap-1.5 min-w-[120px] transition-all',
                            isAlreadyLinked
                              ? 'bg-emerald-600 text-white cursor-default opacity-90'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white',
                          )}
                        >
                          {isLinking ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Vinculando...</span>
                            </>
                          ) : isAlreadyLinked ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>Vinculado</span>
                            </>
                          ) : (
                            <>
                              <LinkIcon className="h-3.5 w-3.5" />
                              <span>Vincular à O.S.</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <DialogFooter className="px-4 py-2.5 border-t border-slate-100 bg-white shrink-0 flex flex-row items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Selecione um equipamento para vincular diretamente.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ======================= ABA 2: CADASTRAR NOVO ======================= */}
        {activeTab === 'new' && (
          <form onSubmit={handleSubmitNew} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 bg-white">
              {currentCustomerId && (
                <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span className="text-xs text-indigo-900">
                      Cliente sugerido da O.S.:{' '}
                      <strong className="font-semibold">{selectedDisplayName}</strong>
                    </span>
                  </div>
                  <Badge className="bg-indigo-600 text-white text-[10px] shrink-0">
                    Auto-selecionado
                  </Badge>
                </div>
              )}

              {/* Seletor de Cliente */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Cliente *</Label>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className={cn(
                        'w-full h-9 text-xs justify-between font-normal px-3 bg-white border-slate-200 hover:bg-slate-50',
                        !formData.customer && 'text-slate-400',
                      )}
                    >
                      <span className="truncate text-left">
                        {formData.customer && selectedCustomer
                          ? `${selectedDisplayName}`
                          : 'Selecione ou digite para buscar o cliente...'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0 shadow-lg max-h-60 overflow-hidden"
                    align="start"
                  >
                    <Command shouldFilter={false} className="max-h-60 flex flex-col">
                      <CommandInput
                        placeholder="Digite o nome do cliente..."
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                        className="h-9 text-xs shrink-0"
                      />
                      <CommandList className="max-h-48 overflow-y-auto">
                        {isSearchingCustomers && (
                          <div className="flex items-center justify-center p-4 text-xs text-slate-400 gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                            <span>Buscando clientes...</span>
                          </div>
                        )}
                        {!isSearchingCustomers && customers.length === 0 && (
                          <CommandEmpty className="py-4 text-center text-xs text-slate-500">
                            Nenhum cliente encontrado.
                          </CommandEmpty>
                        )}
                        <CommandGroup>
                          {customers.map((c) => {
                            const displayName =
                              c.nome_fantasia || c.razao_social || c.name || 'Cliente'
                            const rawPhone = c.celular || c.phone
                            const phone = rawPhone ? formatPhone(rawPhone) : ''
                            const isSelected = formData.customer === c.id

                            return (
                              <CommandItem
                                key={c.id}
                                value={c.id}
                                onSelect={() => {
                                  setFormData((prev) => ({ ...prev, customer: c.id }))
                                  setSelectedCustomer(c)
                                  setComboboxOpen(false)
                                  if (errors.customer) {
                                    setErrors((prev) => {
                                      const next = { ...prev }
                                      delete next.customer
                                      return next
                                    })
                                  }
                                }}
                                className="text-xs cursor-pointer flex items-center justify-between py-2"
                              >
                                <div className="flex flex-col min-w-0 pr-2">
                                  <span className="font-bold text-slate-900 truncate">
                                    {displayName}
                                  </span>
                                  {phone && (
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      {phone}
                                    </span>
                                  )}
                                </div>
                                <Check
                                  className={cn(
                                    'h-4 w-4 shrink-0 text-indigo-600',
                                    isSelected ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.customer && <p className="text-[11px] text-red-500">{errors.customer}</p>}
              </div>

              {/* Nome e Tipo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Descrição / Nome do Equipamento *
                  </Label>
                  <Input
                    placeholder="Ex: Notebook Dell Inspiron, PC Gamer, etc."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-9 text-xs"
                    autoFocus
                  />
                  {errors.name && <p className="text-[11px] text-red-500">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v: EquipmentType) => setFormData({ ...formData, type: v })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        'notebook',
                        'desktop',
                        'monitor',
                        'printer',
                        'smartphone',
                        'tablet',
                        'network',
                        'other',
                      ].map((t) => (
                        <SelectItem key={t} value={t} className="text-xs capitalize">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Marca, Modelo e Serial */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Marca</Label>
                  <Input
                    placeholder="Ex: Dell, Lenovo, HP"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Modelo</Label>
                  <Input
                    placeholder="Ex: Inspiron 15 3520"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Nº de Série</Label>
                  <Input
                    placeholder="Ex: BRJ12345"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Fotos (opcional, recomendado) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">
                    Fotos de Identificação
                  </Label>
                  <span className="text-[10px] text-slate-400">Opcional</span>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotosChange}
                  className="hidden"
                  id="order-equip-photo-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={processingPhotos}
                  className="text-xs gap-1.5 h-8 border-slate-300"
                >
                  {processingPhotos ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5 text-indigo-600" /> Adicionar Fotos
                    </>
                  )}
                </Button>
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {photos.map((p, i) => (
                      <div
                        key={i}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200"
                      >
                        <img
                          src={URL.createObjectURL(p)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute top-0.5 right-0.5 bg-white/90 rounded-full p-0.5 shadow-xs"
                        >
                          <X className="h-3 w-3 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Observações / Estado do Aparelho
                </Label>
                <Textarea
                  placeholder="Ex: Acompanha fonte de carregamento original, pequenas marcas na tampa..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-100 shrink-0 bg-slate-50/50 flex flex-row items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('search')}
                className="text-xs text-slate-600"
              >
                Voltar para Busca
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loadingSave}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
                >
                  {loadingSave ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Salvar e Vincular à O.S.</span>
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
