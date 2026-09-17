import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { WorkspaceTabsBar } from '@/components/WorkspaceTabsBar'
import { WorkspaceKeepAliveViewport } from '@/components/WorkspaceKeepAliveViewport'
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner'
import { OfflineBanner } from '@/components/OfflineBanner'
import { PushNotificationPrompt } from '@/components/PushNotificationPrompt'
import { AgradecimentoAprovadoBanner } from '@/components/AgradecimentoAprovadoBanner'

export default function Layout() {
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-50 font-sans text-slate-900 antialiased pb-[env(safe-area-inset-bottom)]">
      {/* Menu SEMPRE exposto no Desktop (md/lg+) com largura fixa */}
      <div className="hidden md:block md:w-60 lg:w-64 shrink-0">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <PwaUpdateBanner />
        <Topbar />
        {/* Barra de Abas multi-tela no DESKTOP (estilo navegador) */}
        <WorkspaceTabsBar />
        <AgradecimentoAprovadoBanner />
        <PushNotificationPrompt />
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 [overscroll-behavior:none]">
          <div className="mx-auto max-w-7xl">
            <WorkspaceKeepAliveViewport fallbackContent={<Outlet />} />
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
