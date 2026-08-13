import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { NotificationsProvider } from '@/hooks/use-notifications'
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
import Tecnicos from '@/pages/Tecnicos'
import Produtos from '@/pages/Produtos'
import Equipamentos from '@/pages/Equipamentos'
import OrdemShare from '@/pages/OrdemShare'
import OrdemPrint from '@/pages/OrdemPrint'
import NotFound from '@/pages/NotFound'
import { PwaInstallHint } from '@/components/PwaInstallHint'

const App = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <PwaInstallHint />
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
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
