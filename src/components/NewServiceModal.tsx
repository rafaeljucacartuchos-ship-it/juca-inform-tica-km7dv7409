import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { createCatalogService, updateCatalogService } from '@/services/services_catalog'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { CatalogService } from '@/types'

interface NewServiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  editService?: CatalogService | null
}

export function NewServiceModal({
  open,
  onOpenChange,
  onCreated,
  editService,
}: NewServiceModalProps) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('60')
  const [active, setActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const isEdit = !!editService

  useEffect(() => {
    if (open) {
      setErrors({})
      if (editService) {
        setName(editService.name || '')
        setDesc(editService.description || '')
        setPrice(editService.price != null ? String(editService.price) : '')
        setDuration(
          editService.estimated_duration != null ? String(editService.estimated_duration) : '60',
        )
        setActive(editService.active ?? true)
      } else {
        setName('')
        setDesc('')
        setPrice('')
        setDuration('60')
        setActive(true)
      }
    }
  }, [open, editService])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (!name.trim()) {
      setErrors({ name: 'Nome é obrigatório' })
      return
    }
    setLoading(true)
    try {
      const payload = {
        name,
        description: desc,
        price: Number(price) || 0,
        estimated_duration: Number(duration) || 0,
        active,
      }
      if (isEdit && editService) {
        await updateCatalogService(editService.id, payload)
        toast({ title: 'Serviço atualizado!' })
      } else {
        await createCatalogService(payload)
        toast({ title: 'Serviço cadastrado!' })
      }
      onOpenChange(false)
      if (onCreated) onCreated()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar serviço', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {isEdit ? 'Editar Serviço' : 'Novo Serviço do Catálogo'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Nome do Serviço *</Label>
            <Input
              placeholder="Ex: Troca de Tela de Notebook"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs"
            />
            {errors.name && <p className="text-[11px] text-red-500">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Preço Padrão (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="150.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-9 text-xs font-mono"
              />
              {errors.price && <p className="text-[11px] text-red-500">{errors.price}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Duração (Minutos)</Label>
              <Input
                type="number"
                placeholder="60"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Descrição Detalhada</Label>
            <Textarea
              placeholder="O que está incluso no serviço..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              className="text-xs"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label className="text-xs font-semibold text-slate-700">Serviço ativo</Label>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Salvar no Catálogo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
