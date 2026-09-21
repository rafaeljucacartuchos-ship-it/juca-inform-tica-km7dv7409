import React, { useRef, useEffect } from 'react'
import { useLocation, matchPath } from 'react-router-dom'
import { useWorkspace } from '@/hooks/use-workspace'
import Dashboard from '@/pages/Dashboard'
import OrdensDeServico from '@/pages/OrdensDeServico'
import OrdemDetail from '@/pages/OrdemDetail'
import OrcamentosList from '@/pages/OrcamentosList'
import OrcamentoDetail from '@/pages/OrcamentoDetail'
import Precificacao from '@/pages/Precificacao'
import LocacaoImpressoras from '@/pages/LocacaoImpressoras'
import PedidoMercadorias from '@/pages/PedidoMercadorias'
import PosVendaJuquinha from '@/pages/PosVenda'
import Campanhas from '@/pages/Campanhas'
import Clientes from '@/pages/Clientes'
import ClienteDetail from '@/pages/ClienteDetail'
import Servicos from '@/pages/Servicos'
import Produtos from '@/pages/Produtos'
import Equipamentos from '@/pages/Equipamentos'
import Relatorios from '@/pages/Relatorios'
import RelatoriosAvaliacoes from '@/pages/RelatoriosAvaliacoes'
import Tecnicos from '@/pages/Tecnicos'
import TiposAtendimento from '@/pages/TiposAtendimento'
import { PermissionRoute } from '@/components/PermissionRoute'

// Mapeador de componente com base no path
function renderComponentForPath(path: string) {
  const [pathname] = path.split('?')

  if (pathname === '/' || pathname === '/dashboard') {
    return (
      <PermissionRoute module="dashboard">
        <Dashboard />
      </PermissionRoute>
    )
  }
  if (pathname === '/ordens') {
    return (
      <PermissionRoute module="ordens">
        <OrdensDeServico />
      </PermissionRoute>
    )
  }
  const ordemDetailMatch = matchPath('/ordens/:id', pathname)
  if (ordemDetailMatch && pathname !== '/ordens') {
    return (
      <PermissionRoute module="ordens">
        <OrdemDetail />
      </PermissionRoute>
    )
  }
  if (pathname === '/orcamentos') {
    return (
      <PermissionRoute module="orcamentos">
        <OrcamentosList />
      </PermissionRoute>
    )
  }
  if (pathname === '/orcamentos/novo') {
    return (
      <PermissionRoute module="orcamentos">
        <OrcamentoDetail />
      </PermissionRoute>
    )
  }
  const orcamentoDetailMatch = matchPath('/orcamentos/:id', pathname)
  if (orcamentoDetailMatch && pathname !== '/orcamentos') {
    return (
      <PermissionRoute module="orcamentos">
        <OrcamentoDetail />
      </PermissionRoute>
    )
  }
  if (pathname === '/precificacao') {
    return (
      <PermissionRoute module="precificacao">
        <Precificacao />
      </PermissionRoute>
    )
  }
  if (pathname === '/locacao') {
    return (
      <PermissionRoute module="locacao">
        <LocacaoImpressoras />
      </PermissionRoute>
    )
  }
  if (pathname === '/pedido-mercadorias') {
    return (
      <PermissionRoute module="pedido_mercadoria">
        <PedidoMercadorias />
      </PermissionRoute>
    )
  }
  if (pathname === '/pos-venda') {
    return (
      <PermissionRoute module="pos_venda">
        <PosVendaJuquinha />
      </PermissionRoute>
    )
  }
  if (pathname === '/campanhas') {
    return (
      <PermissionRoute module="campanhas">
        <Campanhas />
      </PermissionRoute>
    )
  }
  if (pathname === '/clientes') {
    return (
      <PermissionRoute module="clientes">
        <Clientes />
      </PermissionRoute>
    )
  }
  const clienteDetailMatch = matchPath('/clientes/:id', pathname)
  if (clienteDetailMatch && pathname !== '/clientes') {
    return (
      <PermissionRoute module="clientes">
        <ClienteDetail />
      </PermissionRoute>
    )
  }
  if (pathname === '/servicos') {
    return (
      <PermissionRoute module="servicos">
        <Servicos />
      </PermissionRoute>
    )
  }
  if (pathname === '/produtos') {
    return (
      <PermissionRoute module="produtos">
        <Produtos />
      </PermissionRoute>
    )
  }
  if (pathname === '/equipamentos') {
    return (
      <PermissionRoute module="equipamentos">
        <Equipamentos />
      </PermissionRoute>
    )
  }
  if (pathname === '/relatorios') {
    return (
      <PermissionRoute module="relatorios">
        <Relatorios />
      </PermissionRoute>
    )
  }
  if (pathname === '/relatorios/avaliacoes') {
    return (
      <PermissionRoute module="relatorios">
        <RelatoriosAvaliacoes />
      </PermissionRoute>
    )
  }
  if (pathname === '/tecnicos') {
    return (
      <PermissionRoute module="tecnicos">
        <Tecnicos />
      </PermissionRoute>
    )
  }
  if (pathname === '/tipos-atendimento') {
    return (
      <PermissionRoute module="service_types">
        <TiposAtendimento />
      </PermissionRoute>
    )
  }

  return null
}

interface WorkspaceKeepAliveViewportProps {
  fallbackContent: React.ReactNode
}

/**
 * Mantém cada aba aberta MONTADA em segundo plano (com display:none para as inativas),
 * preservando o estado do formulário, scroll, filtros e dados carregados.
 */
export function WorkspaceKeepAliveViewport({ fallbackContent }: WorkspaceKeepAliveViewportProps) {
  const { tabs, activeTabId, isDesktopWorkspace } = useWorkspace()
  const location = useLocation()
  const scrollPositions = useRef<Record<string, number>>({})

  // Salva scroll da aba ativa antes de alternar
  useEffect(() => {
    const mainContainer = document.querySelector('main')
    if (!mainContainer) return

    const handleScroll = () => {
      if (activeTabId) {
        scrollPositions.current[activeTabId] = mainContainer.scrollTop
      }
    }

    mainContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      mainContainer.removeEventListener('scroll', handleScroll)
    }
  }, [activeTabId])

  // Restaura o scroll da aba ativada
  useEffect(() => {
    const mainContainer = document.querySelector('main')
    if (!mainContainer || !activeTabId) return

    const savedScroll = scrollPositions.current[activeTabId] ?? 0
    // timeout mínimo para o container estar visível
    const timer = setTimeout(() => {
      mainContainer.scrollTop = savedScroll
    }, 10)
    return () => clearTimeout(timer)
  }, [activeTabId])

  // No mobile, renderiza o Outlet normal (sem keep-alive para não sobrecarregar memória)
  if (!isDesktopWorkspace) {
    return <>{fallbackContent}</>
  }

  // Rota do Dashboard: é renderizada como tela principal fixa (via fallbackContent do Outlet)
  // ou quando nenhuma aba estiver ativa
  const isDashboardRoute = location.pathname === '/' || location.pathname === '/dashboard'

  // Verifica se a rota atual corresponde a alguma das abas gerenciadas
  const isCurrentManaged = tabs.some(
    (t) => t.id === activeTabId || t.basePath === location.pathname,
  )

  // Se for Dashboard ou rota não mapeada em abas, renderiza o Outlet padrão
  if (isDashboardRoute || !isCurrentManaged) {
    return <>{fallbackContent}</>
  }

  return (
    <>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const component = renderComponentForPath(tab.path)

        if (!component) return null

        return (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            style={{ display: isActive ? 'block' : 'none' }}
            className={isActive ? 'fade-in' : undefined}
          >
            {component}
          </div>
        )
      })}
    </>
  )
}
