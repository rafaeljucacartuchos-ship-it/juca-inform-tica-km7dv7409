import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Bell, Plus, Menu, Download, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sidebar } from '@/components/Sidebar'
import { NewOrderModal } from '@/components/NewOrderModal'
import { usePermissions } from '@/hooks/use-permissions'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationsPanel } from '@/components/NotificationsPanel'
import { SoundSettings } from '@/components/SoundSettings'
import { usePwaInstall } from '@/hooks/use-pwa-install'

export function Topbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const showBackButton =
    location.pathname !== '/' &&
    location.pathname !== '/dashboard' &&
    location.pathname !== '/sem-acesso'
  const { notifications, unreadCount, markAllAsRead, requestBrowserPermission, browserPermission } =
    useNotifications()
  const { hasPermission } = usePermissions()
  const { isInstallable, promptInstall, isStandalone } = usePwaInstall()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/ordens?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex items-center gap-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-slate-600 hover:bg-slate-100"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-0 bg-slate-900">
              <Sidebar onNavClick={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          {showBackButton && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-9 w-9 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg shrink-0"
              title="Voltar para a página anterior"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

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
          {!isStandalone && isInstallable && (
            <Button
              variant="outline"
              size="sm"
              onClick={promptInstall}
              className="h-8 gap-1.5 border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 text-xs px-2.5 rounded-lg font-medium shadow-none"
              title="Instalar aplicativo JUCA Informática no celular"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Instalar app</span>
            </Button>
          )}

          <SoundSettings />

          <Popover
            onOpenChange={(open) => {
              if (open) markAllAsRead()
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-slate-600 hover:bg-slate-100 rounded-full h-9 w-9"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 shadow-lg border-slate-200">
              <NotificationsPanel
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAllAsRead={markAllAsRead}
                onRequestPermission={requestBrowserPermission}
                browserPermission={browserPermission}
              />
            </PopoverContent>
          </Popover>

          {hasPermission('os_create') && (
            <Button
              onClick={() => setNewOrderOpen(true)}
              className="gap-1.5 h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm shadow-indigo-600/20 px-3 sm:px-4 text-xs sm:text-sm rounded-lg"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Ordem</span>
            </Button>
          )}
        </div>
      </header>

      {hasPermission('os_create') && (
        <NewOrderModal open={newOrderOpen} onOpenChange={setNewOrderOpen} />
      )}
    </>
  )
}
