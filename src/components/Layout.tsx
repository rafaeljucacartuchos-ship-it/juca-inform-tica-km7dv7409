import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { WorkspaceTabsBar } from '@/components/WorkspaceTabsBar'
import { WorkspaceKeepAliveViewport } from '@/components/WorkspaceKeepAliveViewport'
import { useWorkspaceEscShortcut } from '@/hooks/use-workspace-esc'
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner'
import { OfflineBanner } from '@/components/OfflineBanner'
import { PushNotificationPrompt } from '@/components/PushNotificationPrompt'
import { AgradecimentoAprovadoBanner } from '@/components/AgradecimentoAprovadoBanner'

export default function Layout() {
  // Listener de tecla ESC no workspace do desktop (fecha a aba ativa)
  useWorkspaceEscShortcut()

  return (
    <div className="flex h-[100dvh] w-full max-w-full overflow-x-hidden overflow-y-hidden bg-slate-50 font-sans text-slate-900 antialiased pb-[env(safe-area-inset-bottom)]">
      {/* Menu lateral fixo acima de 1024px (desktop/notebook); abaixo de 1024px menu hambúrguer recolhível */}
      <div className="hidden lg:block lg:w-64 shrink-0">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col min-w-0 max-w-full overflow-x-hidden overflow-y-hidden">
        <PwaUpdateBanner />
        <Topbar />
        {/* Barra de Abas multi-tela no DESKTOP (estilo navegador) acima de 1024px */}
        <WorkspaceTabsBar />
        <AgradecimentoAprovadoBanner />
        <PushNotificationPrompt />
        <OfflineBanner />
        <main className="flex-1 min-w-0 max-w-full overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 lg:p-6 [overscroll-behavior:none]">
          <div className="mx-auto w-full max-w-7xl">
            <WorkspaceKeepAliveViewport fallbackContent={<Outlet />} />
          </div>
        </main>
        <footer className="border-t border-slate-200 bg-white py-2.5 px-4 sm:px-6 text-center text-xs text-slate-400 shrink-0">
          Juca Cartuchos e Informática &copy; {new Date().getFullYear()} — Field Service Management
          System
        </footer>
      </div>
    </div>
  )
}
