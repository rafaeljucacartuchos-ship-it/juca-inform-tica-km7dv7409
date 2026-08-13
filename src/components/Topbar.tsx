import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Plus, Menu } from 'lucide-react'
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

export function Topbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()
  const { notifications, unreadCount, markAllAsRead, requestBrowserPermission, browserPermission } =
    useNotifications()
  const { hasPermission } = usePermissions()

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
