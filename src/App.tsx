import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { NotificationsProvider } from '@/hooks/use-notifications'
import { SoundPreferencesProvider } from '@/hooks/use-sound-preferences'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PermissionRoute } from '@/components/PermissionRoute'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Agendamentos from '@/pages/Agendamentos'
import OrdensDeServico from '@/pages/OrdensDeServico'
import OrdemDetail from '@/pages/OrdemDetail'
import Clientes from '@/pages/Clientes'
import ClienteDetail from '@/pages/ClienteDetail'
import Servicos from '@/pages/Servicos'
import Relatorios from '@/pages/Relatorios'
import RelatorioCategoriasPrint from '@/pages/RelatorioCategoriasPrint'
import RelatoriosAvaliacoes from '@/pages/RelatoriosAvaliacoes'
import Tecnicos from '@/pages/Tecnicos'
import Produtos from '@/pages/Produtos'
import Equipamentos from '@/pages/Equipamentos'
import OrdemShare from '@/pages/OrdemShare'
import OrdemPrint from '@/pages/OrdemPrint'
import NotFound from '@/pages/NotFound'
import { PwaInstallHint } from '@/components/PwaInstallHint'
import { offlinePb } from '@/lib/offline-pb'
import { toast } from '@/hooks/use-toast'
import { registerServiceWorker } from '@/lib/register-sw'
import { StaleAppBanner } from '@/components/StaleAppBanner'

function OfflineSyncToasts() {
  useEffect(() => {
    // Quando voltar online e a fila for processada, exibe toast de sucesso/erro.
    const off = offlinePb.onSyncComplete((e) => {
      const detail = (e.detail || {}) as { processed?: number; failed?: unknown }
      if (detail.failed) {
        toast({
          title: 'Falha ao sincronizar algumas alterações',
          description: 'As operações pendentes permanecerão na fila.',
          variant: 'destructive',
        })
      } else if (detail.processed && detail.processed > 0) {
        toast({
          title: 'Sincronização concluída',
          description: `${detail.processed} alteração(ões) sincronizada(s) com sucesso!`,
        })
      }
    })
    return off
  }, [])
  return null
}

const App = () => {
  useEffect(() => {
    // Registers /sw.js with updateViaCache:'none' so deployed updates reach
    // installed PWAs. See src/lib/register-sw.ts for the full rationale.
    void registerServiceWorker()
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <SoundPreferencesProvider>
          <NotificationsProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <StaleAppBanner />
              <PwaInstallHint />
              <OfflineSyncToasts />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<PermissionRoute module="ordens" />}>
                    <Route path="/ordens/:id/imprimir" element={<OrdemPrint />} />
                  </Route>
                  <Route element={<PermissionRoute module="relatorios" />}>
                    <Route
                      path="/relatorios/categorias/imprimir"
                      element={<RelatorioCategoriasPrint />}
                    />
                  </Route>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route element={<PermissionRoute module="agendamentos" />}>
                      <Route path="/agendamentos" element={<Agendamentos />} />
                    </Route>
                    <Route element={<PermissionRoute module="ordens" />}>
                      <Route path="/ordens" element={<OrdensDeServico />} />
                      <Route path="/ordens/:id" element={<OrdemDetail />} />
                    </Route>
                    <Route element={<PermissionRoute module="clientes" />}>
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/clientes/:id" element={<ClienteDetail />} />
                    </Route>
                    <Route element={<PermissionRoute module="servicos" />}>
                      <Route path="/servicos" element={<Servicos />} />
                    </Route>
                    <Route element={<PermissionRoute module="produtos" />}>
                      <Route path="/produtos" element={<Produtos />} />
                    </Route>
                    <Route element={<PermissionRoute module="equipamentos" />}>
                      <Route path="/equipamentos" element={<Equipamentos />} />
                    </Route>
                    <Route element={<PermissionRoute module="relatorios" />}>
                      <Route path="/relatorios" element={<Relatorios />} />
                      <Route path="/relatorios/avaliacoes" element={<RelatoriosAvaliacoes />} />
                    </Route>
                    <Route element={<PermissionRoute module="tecnicos" />}>
                      <Route path="/tecnicos" element={<Tecnicos />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="/share/:id" element={<OrdemShare />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </NotificationsProvider>
        </SoundPreferencesProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
