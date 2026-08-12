import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
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
import Tecnicos from '@/pages/Tecnicos'
import Produtos from '@/pages/Produtos'
import Equipamentos from '@/pages/Equipamentos'
import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/agendamentos" element={<Agendamentos />} />
              <Route path="/ordens" element={<OrdensDeServico />} />
              <Route path="/ordens/:id" element={<OrdemDetail />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/clientes/:id" element={<ClienteDetail />} />
              <Route path="/servicos" element={<Servicos />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/equipamentos" element={<Equipamentos />} />
              <Route path="/tecnicos" element={<Tecnicos />} />
              <Route path="/relatorios" element={<Relatorios />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
