import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { OfflineBanner } from '@/components/OfflineBanner'

export default function Layout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900 antialiased">
      <div className="hidden lg:block lg:w-64 shrink-0">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Topbar />
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <footer className="border-t border-slate-200 bg-white py-2.5 px-6 text-center text-xs text-slate-400">
          Juca Cartuchos e Informática &copy; {new Date().getFullYear()} — Field Service Management
          System
        </footer>
      </div>
    </div>
  )
}
