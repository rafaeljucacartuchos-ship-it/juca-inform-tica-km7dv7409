import { useState, useEffect, useRef } from 'react'
import { Search, UserCheck, UserPlus, X, Loader2, Building, Phone, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { getCustomers, createCustomer } from '@/services/customers'
import { useToast } from '@/hooks/use-toast'
import type { Customer } from '@/types'

export interface RentalCustomerSelection {
  cliente_id?: string
  cliente_nome_livre: string
  cliente_telefone: string
  cliente_documento: string
  cliente_endereco: string
}

interface RentalCustomerSelectProps {
  value: RentalCustomerSelection
  onChange: (value: RentalCustomerSelection) => void
  disabled?: boolean
}

export function RentalCustomerSelect({
  value,
  onChange,
  disabled = false,
}: RentalCustomerSelectProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<'registered' | 'free'>(
    value.cliente_id ? 'registered' : value.cliente_nome_livre ? 'free' : 'registered',
  )
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Busca clientes
  useEffect(() => {
    if (!isOpen || mode !== 'registered') return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const list = await getCustomers(query.trim())
        setCustomers(list)
      } catch {
        setCustomers([])
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, isOpen, mode])

  const handleSelectCustomer = (c: Customer) => {
    const end = [
      c.endereco || c.street,
      c.number ? `Nº ${c.number}` : '',
      c.bairro,
      c.city ? `${c.city}${c.state ? ` - ${c.state}` : ''}` : '',
      c.zip ? `CEP ${c.zip}` : '',
    ]
      .filter(Boolean)
      .join(', ')

    onChange({
      cliente_id: c.id,
      cliente_nome_livre: c.razao_social || c.name || 'Cliente',
      cliente_telefone: c.celular || c.phone || '',
      cliente_documento: c.cpf_cnpj || c.rg_ie || '',
      cliente_endereco: end || '',
    })
    setIsOpen(false)
    setQuery('')
  }

  const handleClear = () => {
    onChange({
      cliente_id: undefined,
      cliente_nome_livre: '',
      cliente_telefone: '',
      cliente_documento: '',
      cliente_endereco: '',
    })
    setQuery('')
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-indigo-600" />
          <Label className="text-xs font-bold text-slate-800">
            Cliente / Locatário (Vincular ou Digitação Livre)
          </Label>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => {
              setMode('registered')
              setIsOpen(true)
            }}
            disabled={disabled}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              mode === 'registered'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Buscar Cadastrado
          </button>
          <button
            type="button"
            onClick={() => setMode('free')}
            disabled={disabled}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              mode === 'free'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Digitação Livre
          </button>
        </div>
      </div>

      {mode === 'registered' ? (
        <div ref={containerRef} className="relative space-y-2">
          {value.cliente_id ? (
            <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-indigo-200 bg-indigo-50/40 text-xs">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">
                    {value.cliente_nome_livre}
                  </span>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                  >
                    <UserCheck className="h-3 w-3 mr-0.5 inline" /> Vinculado
                  </Badge>
                </div>
                {value.cliente_documento && (
                  <p className="text-slate-600">
                    <strong>CPF/CNPJ:</strong> {value.cliente_documento}
                  </p>
                )}
                {value.cliente_telefone && (
                  <p className="text-slate-600">
                    <strong>Telefone:</strong> {value.cliente_telefone}
                  </p>
                )}
                {value.cliente_endereco && (
                  <p className="text-slate-600 truncate">
                    <strong>Endereço:</strong> {value.cliente_endereco}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(true)}
                  disabled={disabled}
                  className="h-7 text-xs text-indigo-600 hover:bg-indigo-100"
                >
                  Trocar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={disabled}
                  className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Digite o nome, CPF/CNPJ, razão social ou telefone..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (!isOpen) setIsOpen(true)
                }}
                onFocus={() => setIsOpen(true)}
                disabled={disabled}
                className="pl-9 pr-8 h-9 text-xs bg-slate-50 border-slate-200"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {isOpen && !value.cliente_id && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  <span>Buscando clientes...</span>
                </div>
              ) : customers.length === 0 ? (
                <div className="p-4 text-center space-y-1.5 text-xs text-slate-500">
                  <p>Nenhum cliente cadastrado encontrado com este termo.</p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setMode('free')
                      onChange({
                        ...value,
                        cliente_nome_livre: query.trim(),
                      })
                      setIsOpen(false)
                    }}
                    className="text-indigo-600 text-xs font-semibold p-0"
                  >
                    Usar "{query.trim() || 'este nome'}" em digitação livre
                  </Button>
                </div>
              ) : (
                customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full text-left p-2.5 hover:bg-indigo-50/60 transition-colors flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {c.razao_social || c.name}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Doc: {c.cpf_cnpj || 'Não informado'} • Tel: {c.celular || c.phone || '—'}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-indigo-700 bg-indigo-50">
                      Selecionar
                    </Badge>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Nome / Razão Social *</Label>
            <Input
              placeholder="Ex: Empresa Silva & Filhos Ltda"
              value={value.cliente_nome_livre}
              onChange={(e) => onChange({ ...value, cliente_nome_livre: e.target.value })}
              disabled={disabled}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">CPF ou CNPJ</Label>
            <Input
              placeholder="00.000.000/0000-00"
              value={value.cliente_documento}
              onChange={(e) => onChange({ ...value, cliente_documento: e.target.value })}
              disabled={disabled}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Telefone / WhatsApp</Label>
            <Input
              placeholder="(67) 99999-9999"
              value={value.cliente_telefone}
              onChange={(e) => onChange({ ...value, cliente_telefone: e.target.value })}
              disabled={disabled}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Endereço Completo</Label>
            <Input
              placeholder="Rua, Número, Bairro, Cidade - UF"
              value={value.cliente_endereco}
              onChange={(e) => onChange({ ...value, cliente_endereco: e.target.value })}
              disabled={disabled}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  )
}
