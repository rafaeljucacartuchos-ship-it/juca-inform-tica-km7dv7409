import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Plus, Menu, X, Wrench, Calendar, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sidebar } from '@/components/Sidebar'
import { NewOrderModal } from '@/components/NewOrderModal'

export function Topbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/ordens?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex items-center gap-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-slate-600 hover:bg-slate-100"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-0 bg-slate-900">
              <Sidebar onNavClick={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <form
            onSubmit={handleSearch}
            className="relative hidden md:flex items-center w-72 lg:w-96"
          >
            <Search className="absolute left-3 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar OS, cliente ou técnico..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs sm:text-sm bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-lg"
            />
          </form>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-slate-600 hover:bg-slate-100 rounded-full h-9 w-9"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white animate-pulse" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 shadow-lg border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/50">
                <h3 className="text-xs font-semibold text-slate-800">Notificações da Operação</h3>
                <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  3 novas
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                <div className="flex gap-3 p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className="font-medium text-slate-800">Nova OS atribuída</p>
                    <p className="text-slate-500 text-[11px]">
                      OS-0002 atribuída para análise de rede.
                    </p>
                    <p className="text-[10px] text-slate-400">Há 15 minutos</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className="font-medium text-slate-800">Agendamento Próximo</p>
                    <p className="text-slate-500 text-[11px]">
                      Visita técnica na Tech Solutions às 09:00.
                    </p>
                    <p className="text-[10px] text-slate-400">Há 1 hora</p>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            onClick={() => setNewOrderOpen(true)}
            className="gap-1.5 h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm shadow-indigo-600/20 px-3 sm:px-4 text-xs sm:text-sm rounded-lg"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Ordem</span>
          </Button>
        </div>
      </header>

      <NewOrderModal open={newOrderOpen} onOpenChange={setNewOrderOpen} />
    </>
  )
}
