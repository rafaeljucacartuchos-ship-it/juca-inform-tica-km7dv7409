import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import pb from '@/lib/pocketbase/client'

export interface WorkspaceTab {
  id: string // e.g. path ou chave única como "/ordens/abc"
  path: string // rota completa (com query se houver)
  basePath: string // rota normalizada sem query/hash
  moduleKey: string // chave do módulo principal (ex.: "dashboard", "ordens", "orcamentos", "precificacao", ...)
  title: string
  subtitle?: string
  closable: boolean
  lastActiveAt: number
}

interface WorkspaceContextType {
  tabs: WorkspaceTab[]
  activeTabId: string
  openTab: (path: string, options?: { title?: string; activate?: boolean }) => void
  closeTab: (tabId: string) => void
  closeActiveTab: () => void
  activateTab: (tabId: string) => void
  setTabTitle: (tabId: string, title: string, subtitle?: string) => void
  isDesktopWorkspace: boolean
  findTabByModule: (moduleKey: string) => WorkspaceTab | undefined
}

const STORAGE_KEY = 'juca_workspace_tabs_v1'
const MAX_TABS = 8

// Rotas do módulo para agrupamento e títulos padrão
export function getModuleInfoFromPath(pathname: string): {
  moduleKey: string
  defaultTitle: string
} {
  if (pathname === '/' || pathname === '/dashboard') {
    return { moduleKey: 'dashboard', defaultTitle: 'Dashboard' }
  }
  if (pathname === '/central/whatsapp') return { moduleKey: 'whatsapp', defaultTitle: 'Central WhatsApp' }
  if (pathname === '/central') {
    return { moduleKey: 'central', defaultTitle: 'Central de gestão' }
  }
  if (pathname.startsWith('/ordens')) {
    if (pathname === '/ordens') return { moduleKey: 'ordens', defaultTitle: 'Ordens de Serviço' }
    return { moduleKey: 'ordens', defaultTitle: 'Ordem de Serviço' }
  }
  if (pathname.startsWith('/orcamentos')) {
    if (pathname === '/orcamentos') return { moduleKey: 'orcamentos', defaultTitle: 'Orçamentos' }
    if (pathname === '/orcamentos/novo')
      return { moduleKey: 'orcamentos', defaultTitle: 'Novo Orçamento' }
    return { moduleKey: 'orcamentos', defaultTitle: 'Orçamento' }
  }
  if (pathname.startsWith('/laudos')) {
    if (pathname === '/laudos') return { moduleKey: 'laudos', defaultTitle: 'Laudos Técnicos' }
    if (pathname === '/laudos/novo') return { moduleKey: 'laudos', defaultTitle: 'Novo Laudo' }
    if (pathname.endsWith('/imprimir'))
      return { moduleKey: 'laudos', defaultTitle: 'Imprimir Laudo' }
    return { moduleKey: 'laudos', defaultTitle: 'Laudo Técnico' }
  }
  if (pathname.startsWith('/precificacao')) {
    return { moduleKey: 'precificacao', defaultTitle: 'Precificação' }
  }
  if (pathname.startsWith('/locacao')) {
    return { moduleKey: 'locacao', defaultTitle: 'Impressoras Locadas' }
  }
  if (pathname.startsWith('/pedido-mercadorias')) {
    return { moduleKey: 'pedido_mercadoria', defaultTitle: 'Pedido de Mercadorias' }
  }
  if (pathname.startsWith('/pos-venda')) {
    return { moduleKey: 'pos_venda', defaultTitle: 'Pós-venda (Juquinha)' }
  }
  if (pathname.startsWith('/campanhas')) {
    return { moduleKey: 'campanhas', defaultTitle: 'Campanhas' }
  }
  if (pathname.startsWith('/clientes')) {
    if (pathname === '/clientes') return { moduleKey: 'clientes', defaultTitle: 'Clientes' }
    return { moduleKey: 'clientes', defaultTitle: 'Cliente' }
  }
  if (pathname.startsWith('/servicos')) {
    return { moduleKey: 'servicos', defaultTitle: 'Serviços' }
  }
  if (pathname.startsWith('/produtos')) {
    return { moduleKey: 'produtos', defaultTitle: 'Produtos' }
  }
  if (pathname.startsWith('/equipamentos')) {
    return { moduleKey: 'equipamentos', defaultTitle: 'Equipamentos' }
  }
  if (pathname.startsWith('/relatorios')) {
    if (pathname.startsWith('/relatorios/avaliacoes')) {
      return { moduleKey: 'relatorios_avaliacoes', defaultTitle: 'Avaliações' }
    }
    return { moduleKey: 'relatorios', defaultTitle: 'Relatórios OS' }
  }
  if (pathname.startsWith('/tecnicos')) {
    return { moduleKey: 'tecnicos', defaultTitle: 'Técnicos' }
  }
  if (pathname.startsWith('/tipos-atendimento')) {
    return { moduleKey: 'service_types', defaultTitle: 'Tipos de Atendimento' }
  }

  return { moduleKey: 'other', defaultTitle: 'Página' }
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  const location = useLocation()
  const navigate = useNavigate()

  // Se a tela for mobile (< 768px), desativa abas multi-tela no desktop
  const isDesktopWorkspace = !isMobile

  // Histórico de navegação interno entre abas para voltar à aba anterior ao fechar
  const tabHistoryRef = useRef<string[]>([])

  // Inicializa abas a partir do sessionStorage (se houver), filtrando qualquer resquício de dashboard
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as WorkspaceTab[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Dashboard é tela principal fixa e não deve constar como aba
          const filtered = parsed.filter(
            (t) => t.moduleKey !== 'dashboard' && t.basePath !== '/dashboard' && t.basePath !== '/',
          )
          return filtered.slice(0, MAX_TABS)
        }
      }
    } catch {
      /* ignore parse error */
    }

    return []
  })

  // Sincroniza abas no sessionStorage sempre que mudarem
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
    } catch {
      /* ignore quota error */
    }
  }, [tabs])

  // Normalização do pathname atual
  const currentPath = location.pathname + location.search
  const currentBase = location.pathname

  // Localiza aba ativa atual
  const activeTab = tabs.find((t) => t.path === currentPath || t.basePath === currentBase)
  const activeTabId = activeTab?.id || currentPath

  // Atualiza histórico quando a aba ativa muda
  useEffect(() => {
    if (activeTabId) {
      tabHistoryRef.current = [
        activeTabId,
        ...tabHistoryRef.current.filter((id) => id !== activeTabId),
      ].slice(0, 20)
    }
  }, [activeTabId])

  // Busca detalhes assíncronos para títulos descritivos (ex.: O.S. #0091, Orçamento #123, etc.)
  const fetchTitleForRoute = useCallback(async (tabPath: string, basePath: string) => {
    try {
      // Ordem de Serviço Detail: /ordens/:id
      const osMatch = basePath.match(/^\/ordens\/([a-zA-Z0-9_-]+)$/)
      if (osMatch && osMatch[1] && osMatch[1] !== 'novo') {
        const osId = osMatch[1]
        const rec = await pb
          .collection('service_orders')
          .getOne(osId, {
            fields: 'id,number,title',
          })
          .catch(() => null)
        if (rec) {
          const num = rec.number ? `#${rec.number}` : 'O.S.'
          return {
            title: `O.S. ${num}`,
            subtitle: rec.title ? String(rec.title).slice(0, 24) : undefined,
          }
        }
      }

      // Orçamento Detail: /orcamentos/:id
      const orcMatch = basePath.match(/^\/orcamentos\/([a-zA-Z0-9_-]+)$/)
      if (orcMatch && orcMatch[1]) {
        if (orcMatch[1] === 'novo') {
          return { title: 'Novo Orçamento' }
        }
        const orcId = orcMatch[1]
        const rec = await pb
          .collection('orcamentos')
          .getOne(orcId, {
            fields: 'id,numero_orcamento,nome_cliente_livre',
          })
          .catch(() => null)
        if (rec) {
          const num = rec.numero_orcamento || 'Orçamento'
          return {
            title: `Orç. ${num}`,
            subtitle: rec.nome_cliente_livre
              ? String(rec.nome_cliente_livre).slice(0, 20)
              : undefined,
          }
        }
      }

      // Laudo Print: /laudos/:id/imprimir
      const laudoPrintMatch = basePath.match(/^\/laudos\/([a-zA-Z0-9_-]+)\/imprimir$/)
      if (laudoPrintMatch && laudoPrintMatch[1]) {
        const laudoId = laudoPrintMatch[1]
        const rec = await pb
          .collection('laudos_tecnicos')
          .getOne(laudoId, {
            fields: 'id,numero_laudo,cliente_nome',
          })
          .catch(() => null)
        if (rec) {
          const num = rec.numero_laudo || 'Laudo'
          return {
            title: `Imprimir ${num}`,
            subtitle: rec.cliente_nome ? String(rec.cliente_nome).slice(0, 20) : undefined,
          }
        }
        return { title: 'Imprimir Laudo' }
      }

      // Laudo Detail: /laudos/:id
      const laudoMatch = basePath.match(/^\/laudos\/([a-zA-Z0-9_-]+)$/)
      if (laudoMatch && laudoMatch[1]) {
        if (laudoMatch[1] === 'novo') {
          return { title: 'Novo Laudo' }
        }
        const laudoId = laudoMatch[1]
        const rec = await pb
          .collection('laudos_tecnicos')
          .getOne(laudoId, {
            fields: 'id,numero_laudo,cliente_nome,equipamento_modelo',
          })
          .catch(() => null)
        if (rec) {
          const num = rec.numero_laudo || 'Laudo'
          return {
            title: `Laudo ${num}`,
            subtitle: rec.cliente_nome ? String(rec.cliente_nome).slice(0, 20) : undefined,
          }
        }
      }

      // Cliente Detail: /clientes/:id
      const cliMatch = basePath.match(/^\/clientes\/([a-zA-Z0-9_-]+)$/)
      if (cliMatch && cliMatch[1]) {
        const cliId = cliMatch[1]
        const rec = await pb
          .collection('customers')
          .getOne(cliId, {
            fields: 'id,name,razao_social,nome_fantasia',
          })
          .catch(() => null)
        if (rec) {
          const name = rec.nome_fantasia || rec.razao_social || rec.name || 'Cliente'
          return { title: String(name).slice(0, 22) }
        }
      }
    } catch {
      /* ignore */
    }
    return null
  }, [])

  // Sincroniza rota atual com as abas abertas no desktop
  useEffect(() => {
    // Não criar abas para páginas públicas, tela fixa do dashboard ou especiais
    // "o dashboard não precisa constar na barra" (v0.0.248)
    if (
      currentBase === '/' ||
      currentBase === '/dashboard' ||
      currentBase.startsWith('/login') ||
      currentBase.startsWith('/sem-acesso') ||
      currentBase.startsWith('/share') ||
      currentBase.startsWith('/proposta') ||
      (currentBase.startsWith('/ordens/') && currentBase.endsWith('/imprimir')) ||
      (currentBase.startsWith('/ordens/') && currentBase.endsWith('/assinatura')) ||
      (currentBase.startsWith('/orcamentos/') && currentBase.endsWith('/imprimir')) ||
      currentBase.startsWith('/relatorios/categorias/imprimir')
    ) {
      return
    }

    const { moduleKey, defaultTitle } = getModuleInfoFromPath(currentBase)
    const tabId = currentBase // ou currentPath

    setTabs((prev) => {
      // Verifica se já existe aba aberta com este id ou basePath
      const existingIndex = prev.findIndex((t) => t.id === tabId || t.basePath === currentBase)
      const now = Date.now()

      if (existingIndex >= 0) {
        // Atualiza path caso tenha mudado query params
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          path: currentPath,
          lastActiveAt: now,
        }
        return updated
      }

      // Se não existe, vai adicionar nova aba. Verifica limite de 8
      if (prev.length >= MAX_TABS) {
        // Limite atingido: avisa o usuário com toast e não adiciona a 9ª aba
        toast({
          title: 'Limite de telas abertas atingido (máx. 8)',
          description: 'Feche uma das abas abertas para abrir uma nova tela no workspace.',
          variant: 'destructive',
        })
        // Não adiciona aba além de 8, mas foca a última ou mantém
        return prev
      }

      const newTab: WorkspaceTab = {
        id: tabId,
        path: currentPath,
        basePath: currentBase,
        moduleKey,
        title: defaultTitle,
        closable: true,
        lastActiveAt: now,
      }

      // Dispara busca assíncrona do título amigável
      void fetchTitleForRoute(currentPath, currentBase).then((info) => {
        if (info) {
          setTabs((inner) =>
            inner.map((t) =>
              t.id === tabId ? { ...t, title: info.title, subtitle: info.subtitle } : t,
            ),
          )
        }
      })

      return [...prev, newTab]
    })
  }, [currentPath, currentBase, fetchTitleForRoute])

  const setTabTitle = useCallback((tabId: string, title: string, subtitle?: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, title, subtitle: subtitle ?? t.subtitle } : t)),
    )
  }, [])

  const activateTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId)
      if (tab) {
        navigate(tab.path)
      }
    },
    [tabs, navigate],
  )

  const openTab = useCallback(
    (targetPath: string, options?: { title?: string; activate?: boolean }) => {
      const url = new URL(targetPath, 'http://dummy.local')
      const targetBase = url.pathname

      // Dashboard é tela principal fixa, não cria aba na barra
      if (targetBase === '/' || targetBase === '/dashboard') {
        if (options?.activate !== false) {
          navigate('/dashboard')
        }
        return
      }

      const { moduleKey, defaultTitle } = getModuleInfoFromPath(targetBase)
      const tabId = targetBase
      const now = Date.now()

      setTabs((prev) => {
        const existing = prev.find((t) => t.id === tabId || t.basePath === targetBase)
        if (existing) {
          return prev.map((t) =>
            t.id === existing.id
              ? {
                  ...t,
                  path: targetPath,
                  title: options?.title || t.title,
                  lastActiveAt: now,
                }
              : t,
          )
        }

        if (prev.length >= MAX_TABS) {
          toast({
            title: 'Limite de telas atingido (máx. 8)',
            description: 'Feche uma das abas abertas no topo para continuar.',
            variant: 'destructive',
          })
          return prev
        }

        const newTab: WorkspaceTab = {
          id: tabId,
          path: targetPath,
          basePath: targetBase,
          moduleKey,
          title: options?.title || defaultTitle,
          closable: true,
          lastActiveAt: now,
        }

        return [...prev, newTab]
      })

      if (options?.activate !== false) {
        navigate(targetPath)
      }
    },
    [navigate],
  )

  const closeTab = useCallback(
    (tabId: string) => {
      const tabToClose = tabs.find((t) => t.id === tabId)
      if (!tabToClose || !tabToClose.closable) {
        return
      }

      const remaining = tabs.filter((t) => t.id !== tabId)
      setTabs(remaining)

      // Atualiza histórico removendo a aba fechada
      tabHistoryRef.current = tabHistoryRef.current.filter((id) => id !== tabId)

      // Se a aba fechada era a ativa, redireciona para a anterior no histórico ou última restante
      if (tabId === activeTabId || tabToClose.basePath === currentBase) {
        const nextId = tabHistoryRef.current.find((id) => remaining.some((r) => r.id === id))
        const nextTab = nextId
          ? remaining.find((r) => r.id === nextId)
          : remaining[remaining.length - 1]

        if (nextTab) {
          navigate(nextTab.path)
        } else {
          // Se não sobrar nenhuma aba aberta, volta para a tela principal (raiz '/')
          navigate('/')
        }
      }
    },
    [tabs, activeTabId, currentBase, navigate],
  )

  const closeActiveTab = useCallback(() => {
    // Procura aba ativa atual (se estiver no dashboard ou sem abas, não há aba para fechar)
    const currentTab = tabs.find((t) => t.id === activeTabId || t.basePath === currentBase)
    if (currentTab && currentTab.closable) {
      closeTab(currentTab.id)
    }
  }, [tabs, activeTabId, currentBase, closeTab])

  const findTabByModule = useCallback(
    (moduleKey: string) => {
      return tabs.find((t) => t.moduleKey === moduleKey)
    },
    [tabs],
  )

  return (
    <WorkspaceContext.Provider
      value={{
        tabs,
        activeTabId,
        openTab,
        closeTab,
        closeActiveTab,
        activateTab,
        setTabTitle,
        isDesktopWorkspace,
        findTabByModule,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return ctx
}

