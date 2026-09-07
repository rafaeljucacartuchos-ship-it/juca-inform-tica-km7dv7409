import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Megaphone,
  Plus,
  Send,
  Users,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Sparkles,
  Filter,
  DollarSign,
  Calendar,
  Layers,
  Wrench,
  Search,
  ExternalLink,
  Upload,
  X,
  FileText,
  AlertCircle,
  Eye,
  Trash2,
  Phone,
  ShieldAlert,
  AlertTriangle,
  CheckSquare,
  Square,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Campaign, Customer, ServiceOrder, CampanhaMessage } from '@/types'
import {
  getCampaigns,
  createCampaign,
  deleteCampaign,
  getCampanhaMessages,
  logCampanhaMessageSent,
} from '@/services/campaigns'
import { getCustomers, getCustomerDisplayName, getCustomerPhone } from '@/services/customers'
import { getServiceOrders } from '@/services/service_orders'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { getFileUrl } from '@/lib/pocketbase/files'
import heic2any from 'heic2any'

// Templates criativos no tom do Juquinha para todos os segmentos da JUCA Informática
const JUQUINHA_CAMPAIGN_TEMPLATES = [
  // 1. Manutenção Preventiva (Original 1)
  {
    category: 'Assistência Técnica',
    title: 'Manutenção Preventiva de Computadores e Notebooks',
    text: `Olá, {nome}! Tudo bem por aí? Aqui é o Juquinha da JUCA Informática! 🙋‍♂️\n\nNotamos que já faz um tempinho que cuidamos do seu equipamento com carinho. Para evitar lentidão, superaquecimento ou travamentos repentinos, preparamos uma condição super especial esta semana para uma Revisão e Limpeza Preventiva Completa!\n\nTraga seu computador ou notebook para um check-up com nossa equipe técnica de confiança. 🚀\n\nPodemos reservar um horário prioritário para você?\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 2. Retorno 60+ dias (Original 2)
  {
    category: 'Geral',
    title: 'Saudades de Você! Promoção de Retorno (60+ dias)',
    text: `Oi, {nome}! Tudo bem com você? O Juquinha aqui da JUCA Informática passando para te dar um 'oi' e dizer que estamos com saudades! ✨\n\nComo faz mais de 60 dias desde a sua última visita, liberamos um cupom de cortesia exclusivo com desconto especial na sua próxima mão de obra ou na compra de periféricos e peças.\n\nSeja para formatar, fazer upgrade para SSD ou revisar impressoras, estamos prontos para te atender!\n\nVamos deixar seus aparelhos voando de novo? 💨\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 3. Recarga e Revisão de Impressoras (Original 3)
  {
    category: 'Impressoras',
    title: 'Recarga de Cartuchos e Revisão de Impressoras',
    text: `Olá, {nome}! Como estão as impressões por aí? Aqui é o Juquinha da JUCA Informática! 🖨️\n\nPassando para avisar que estamos com lote novo e tinta de alta qualidade para recarga expressa de cartuchos e toners, além de higienização de cabeçotes com garantia JUCA!\n\nNão fique na mão quando mais precisar imprimir aquele documento importante.\n\nPrecisa que busquemos ou quer dar uma passadinha aqui na loja?\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 4. Upgrade SSD (Original 4)
  {
    category: 'Assistência Técnica',
    title: 'Upgrade Turbinado: Troca de HD por SSD',
    text: `Fala, {nome}! Aqui é o Juquinha da JUCA Informática! ⚡\n\nSeu computador ou notebook anda demorando uma eternidade para ligar ou abrir programas? Sabia que a troca para um SSD veloz deixa ele até 10 vezes mais rápido, sem precisar comprar uma máquina nova?\n\nEstamos com estoque especial de SSDs das melhores marcas com instalação e cópia dos seus arquivos inclusas.\n\nMe conta: quer ver seu computador voando de novo?\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 5. Relógio Ponto e Sistema Web
  {
    category: 'Automação & Ponto',
    title: 'Relógio Ponto e Sistema Web de Gestão de Ponto',
    text: `Olá, {nome}! Tudo bem? Aqui é o Juquinha da JUCA Informática! ⏰📊\n\nPassando para te perguntar: como está o controle de ponto e jornada da sua equipe hoje? Sabia que a JUCA fornece os melhores Relógios de Ponto homologados pelo Ministério do Trabalho (Portaria 671) integrados com Sistema Web em nuvem?\n\nChega de dor de cabeça com cartão espelho, horas extras descontroladas ou cálculo manual no fim do mês! Tenha relatórios em tempo real, aplicativo para colaboradores e suporte técnico pertinho de você em MS.\n\nPosso te enviar uma demonstração rápida sem compromisso?\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 6. Catraca para Controle de Acesso
  {
    category: 'Controle de Acesso',
    title: 'Catraca para Controle de Acesso (Escolas, Academias e Empresas)',
    text: `Oi, {nome}! Aqui é o Juquinha da JUCA Informática! 🚧🔐\n\nProcurando mais segurança, organização e praticidade para controlar a entrada e saída da sua empresa, academia, condomínio ou escola?\n\nAqui na JUCA nós fornecemos e instalamos Catracas Eletrônicas completas com biometria, reconhecimento facial, cartão de proximidade ou QR Code, integradas ao software de gestão!\n\nVocê acompanha tudo em tempo real, com bloqueio automático de inadimplentes ou visitantes não autorizados.\n\nQuer receber um projeto sob medida para o seu espaço?\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 7. Balanças Comerciais e Industriais
  {
    category: 'Automação Comercial',
    title: 'Balanças Comerciais e Industriais (Venda, Calibração e Suporte)',
    text: `Olá, {nome}! Como vão os negócios por aí? Juquinha da JUCA Informática por aqui! ⚖️🏬\n\nPara comércio, açougue, padaria, supermercado ou indústria, precisão na pesagem é sinônimo de lucro e conformidade com o Inmetro!\n\nTrabalhamos com balanças com impressora térmica embutida, balanças etiquetadoras, checkout e bancada das marcas líderes de mercado — além de manutenção técnica e calibração.\n\nEstá precisando renovar suas balanças ou fazer uma revisão preventiva na sua?\n\nConta comigo para garantir a melhor condição!\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 8. Cadeiras e Mesas para Escritório
  {
    category: 'Mobiliário Corporativo',
    title: 'Cadeiras Ergonômicas (NR-17) e Mesas para Escritório',
    text: `Oi, {nome}! Tudo bem? Juquinha da JUCA passando para falar sobre o conforto e a saúde da sua equipe! 🪑💼\n\nVocê sabia que passar horas em uma cadeira desconfortável reduz a produtividade e pode gerar dores lombares? Aqui na JUCA temos uma linha completa de Cadeiras Ergonômicas certificadas (norma NR-17), cadeiras presidente, diretor e mesas funcionais para escritório.\n\nDesign moderno, alta durabilidade e montagem inclusa para deixar seu ambiente de trabalho impecável!\n\nQue tal um catálogo de novidades para renovar seu espaço de trabalho?\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 9. Aluguel de Impressoras (Outsourcing)
  {
    category: 'Locação / Outsourcing',
    title: 'Aluguel de Impressoras: Tinta, Peças e Suporte Inclusos',
    text: `Olá, {nome}! Juquinha da JUCA Informática por aqui! 🖨️📄\n\nCansado de gastar rios de dinheiro comprando impressoras caras que quebram à toa, além de comprar cartuchos e toners todo mês?\n\nCom o Outsourcing / Aluguel de Impressoras da JUCA, sua empresa recebe impressoras modernas sem custo de aquisição: todos os suprimentos, tintas, toners, manutenção e peças estão 100% inclusos na mensalidade!\n\nSe der qualquer problema, a nossa equipe técnica troca ou conserta na hora para o seu negócio não parar.\n\nBora calcular quanto a sua empresa vai economizar este mês?\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 10. Aluguel de Computadores e Notebooks
  {
    category: 'Locação / Outsourcing',
    title: 'Aluguel de Computadores e Notebooks para Empresas e Eventos',
    text: `Fala, {nome}! Tudo jóia? Aqui é o Juquinha da JUCA Informática! 💻🚀\n\nPrecisa equipar novos funcionários, montar um setor temporário, treinar equipe ou fazer um evento sem imobilizar o caixa da sua empresa?\n\nA JUCA aluga Computadores e Notebooks de alta performance (com SSD rápido e pacote office configurado) por dias, semanas ou contratos mensais!\n\nManutenção inclusa, substituição imediata e custo 100% dedutível como despesa operacional (OPEX) no seu imposto.\n\nQuantas máquinas você precisa no momento?\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 11. Aluguel de Projetor (Data Show)
  {
    category: 'Locação / Eventos',
    title: 'Aluguel de Projetor (Data Show) e Telão para Reuniões e Eventos',
    text: `Olá, {nome}! Juquinha da JUCA Informática passando para te dar uma dica valiosa para o seu próximo evento! 📽️✨\n\nVai fazer uma apresentação para clientes, palestra, curso, casamento, assembleia ou reunião de diretoria? Alugue um Projetor / Data Show de alta resolução com a JUCA!\n\nEntregamos aparelhos potentes com conexões HDMI/sem fio, telão e todos os cabos necessários, prontinhos para plugar e brilhar na sua apresentação.\n\nTem algum evento ou apresentação programada para os próximos dias?\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 12. Aluguel de Starlink (Internet Via Satélite)
  {
    category: 'Conectividade & Locação',
    title: 'Aluguel de Starlink: Internet Rápida na Fazenda, Obras e Eventos',
    text: `Oi, {nome}! Tudo bem? Juquinha da JUCA Informática aqui com uma novidade fantástica! 🛰️🌐\n\nPrecisa de internet ultraveloz e estável em fazenda, retiro, obra, evento rural ou local remoto onde a fibra não chega? A JUCA agora tem kit Starlink completo para Locação!\n\nVelocidade de até 200 Mbps via satélite em qualquer canto do Mato Grosso do Sul, com instalação simples e suporte dedicado da nossa equipe.\n\nQuer garantir internet de alta velocidade na sua próxima viagem, feira ou safra?\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 13. Câmeras de Segurança e Instalação (CFTV)
  {
    category: 'Segurança Eletrônica',
    title: 'Câmeras de Segurança e Instalação Completa (Acesso no Celular)',
    text: `Olá, {nome}! Aqui é o Juquinha da JUCA Informática! 📹🚨\n\nComo está a segurança da sua casa ou do seu comércio? Já imaginou acompanhar tudo ao vivo pelo seu celular, de qualquer lugar do mundo, com imagens nítidas em Full HD ou 4K e visão noturna colorida?\n\nNós fazemos o projeto e a instalação completa de Câmeras de Segurança (CFTV), DVRs e gravação em nuvem com cabeamento impecável e garantia total JUCA.\n\nProteja o que é seu com quem entende de tecnologia! Posso agendar uma visita técnica gratuita para avaliação?\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
  // 14. Assistência Técnica: Manutenção, Formatação, SSD/Memória, Impressoras e Redes
  {
    category: 'Assistência Técnica',
    title: 'Assistência Técnica Completa (Formatação, SSD, Impressoras, Redes e Limpeza)',
    text: `Oi, {nome}! Tudo bem com você? Juquinha da JUCA passando para lembrar que estamos sempre aqui para te salvar! 🛠️💻\n\nSe o seu computador estiver travando, a impressora borrando, a rede Wi-Fi caindo ou precisando de uma limpeza interna profunda com troca de pasta térmica, traga para a JUCA Informática!\n\nNossos serviços de assistência técnica contam com:\n• Formatação com backup 100% seguro de fotos e documentos\n• Instalação de SSD ultrarrápido e upgrade de memória RAM\n• Desentupimento e conserto de impressoras / toners\n• Configuração e ampliação de redes Wi-Fi e cabeadas\n• Higienização química preventiva\n\nDiagnóstico ágil e peças originais com garantia. Quando puder, passa tomar um café com a gente e trazer seu aparelho!\n\n— Juquinha — JUCA Informática\n📞 (67) 3441-4981 | (67) 99654-4981`,
  },
]

interface CustomerSegmentProfile {
  customer: Customer
  totalOrders: number
  totalSpent: number
  lastOrderDate: Date | null
  daysSinceLastOrder: number
  serviceTypes: string[]
}

export default function Campanhas() {
  const { toast } = useToast()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([])
  const [messagesHistory, setMessagesHistory] = useState<CampanhaMessage[]>([])
  const [loading, setLoading] = useState(true)

  // Campanha selecionada para disparo ou visualização
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)

  // Modal de Nova Campanha
  const [newCampaignModalOpen, setNewCampaignModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newTemplateText, setNewTemplateText] = useState('')
  const [flyerFile, setFlyerFile] = useState<File | null>(null)
  const [flyerPreview, setFlyerPreview] = useState('')
  const [savingCampaign, setSavingCampaign] = useState(false)

  // Segmentação de Clientes
  const [filterDaysWithoutContact, setFilterDaysWithoutContact] = useState<string>('all') // 'all', '30', '60', '90'
  const [filterFrequency, setFilterFrequency] = useState<string>('all') // 'all', '1', '2_4', '5_plus'
  const [filterSpending, setFilterSpending] = useState<string>('all') // 'all', 'low', 'medium', 'high'
  const [filterSearch, setFilterSearch] = useState('')

  // Modal de Histórico de Envios
  const [historyModalOpen, setHistoryModalOpen] = useState(false)

  // Seleção Manual de Clientes (Checkbox)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])

  // Trava Anti-bloqueio WhatsApp (limite diário de 50 disparos)
  const DAILY_DISPATCH_LIMIT = 50
  const getTodayKey = () => {
    const today = new Date()
    return `juca_wa_dispatches_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  }

  const [dailyDispatchesCount, setDailyDispatchesCount] = useState<number>(() => {
    try {
      const val = localStorage.getItem(getTodayKey())
      return val ? parseInt(val, 10) || 0 : 0
    } catch {
      return 0
    }
  })

  // Sincroniza contador caso vire o dia enquanto o app estiver aberto
  useEffect(() => {
    const updateCount = () => {
      try {
        const val = localStorage.getItem(getTodayKey())
        setDailyDispatchesCount(val ? parseInt(val, 10) || 0 : 0)
      } catch {
        setDailyDispatchesCount(0)
      }
    }
    updateCount()
    const interval = setInterval(updateCount, 60000)
    return () => clearInterval(interval)
  }, [])

  const incrementDailyDispatch = () => {
    const next = dailyDispatchesCount + 1
    setDailyDispatchesCount(next)
    try {
      localStorage.setItem(getTodayKey(), String(next))
    } catch {
      /* intentionally ignored */
    }
    return next
  }

  // Carrega dados iniciais
  const loadData = async () => {
    try {
      setLoading(true)
      const [cList, custs, sos, msgs] = await Promise.all([
        getCampaigns(),
        getCustomers(),
        getServiceOrders(),
        getCampanhaMessages(),
      ])
      setCampaigns(cList)
      setCustomers(custs)
      setServiceOrders(sos)
      setMessagesHistory(msgs)
      if (cList.length > 0 && !selectedCampaign) {
        setSelectedCampaign(cList[0])
      }
    } catch {
      toast({
        title: 'Erro ao carregar campanhas',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('campaigns', loadData)
  useRealtime('campanha_messages', loadData)

  // Perfis segmentados dos clientes
  const customerProfiles = useMemo(() => {
    const now = new Date().getTime()
    const map = new Map<string, CustomerSegmentProfile>()

    customers.forEach((c) => {
      map.set(c.id, {
        customer: c,
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: null,
        daysSinceLastOrder: 9999,
        serviceTypes: [],
      })
    })

    serviceOrders.forEach((so) => {
      const p = map.get(so.customer)
      if (p) {
        p.totalOrders += 1
        p.totalSpent += so.total || 0
        const orderDate = new Date(so.attendance_date || so.created || '')
        if (!p.lastOrderDate || orderDate.getTime() > p.lastOrderDate.getTime()) {
          p.lastOrderDate = orderDate
          p.daysSinceLastOrder = Math.max(
            0,
            Math.floor((now - orderDate.getTime()) / (1000 * 60 * 60 * 24)),
          )
        }
        if (so.equipment && !p.serviceTypes.includes(so.equipment)) {
          p.serviceTypes.push(so.equipment)
        }
      }
    })

    return Array.from(map.values())
  }, [customers, serviceOrders])

  // Clientes filtrados pela segmentação inteligente
  const segmentedCustomers = useMemo(() => {
    return customerProfiles.filter((prof) => {
      // Consentimento de WhatsApp (LGPD) obrigatório
      if (prof.customer.whatsapp_consent === false) {
        return false
      }

      // Deve possuir telefone válido
      const phone = getCustomerPhone(prof.customer)
      if (!phone.replace(/\D/g, '')) return false

      // Filtro de período sem contato / sem OS
      if (filterDaysWithoutContact !== 'all') {
        const minDays = Number(filterDaysWithoutContact)
        if (prof.daysSinceLastOrder < minDays) return false
      }

      // Filtro de frequência (número de O.S.)
      if (filterFrequency === '1' && prof.totalOrders !== 1) return false
      if (filterFrequency === '2_4' && (prof.totalOrders < 2 || prof.totalOrders > 4)) return false
      if (filterFrequency === '5_plus' && prof.totalOrders < 5) return false

      // Filtro de valor total gasto
      if (filterSpending === 'low' && prof.totalSpent > 200) return false
      if (filterSpending === 'medium' && (prof.totalSpent < 200 || prof.totalSpent > 800))
        return false
      if (filterSpending === 'high' && prof.totalSpent <= 800) return false

      // Busca por nome
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase().trim()
        const name = getCustomerDisplayName(prof.customer).toLowerCase()
        if (!name.includes(q)) return false
      }

      return true
    })
  }, [customerProfiles, filterDaysWithoutContact, filterFrequency, filterSpending, filterSearch])

  // Tratamento de conversão de HEIC para JPEG no upload de panfleto
  const handleFlyerSelect = async (file: File | undefined) => {
    if (!file) return
    const isHeic =
      /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif'

    let processedBlob: Blob = file
    let finalName = file.name

    if (isHeic) {
      try {
        const conv = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.85,
        })
        processedBlob = Array.isArray(conv) ? conv[0] : conv
        finalName = file.name.replace(/\.(heic|heif)$/i, '') + '.jpg'
        toast({ title: 'Panfleto HEIC convertido com sucesso para JPG!' })
      } catch (err) {
        console.warn('Falha ao converter HEIC:', err)
        toast({
          title: 'Erro ao converter imagem HEIC',
          description: 'Tente salvar a imagem em PNG ou JPG.',
          variant: 'destructive',
        })
        return
      }
    }

    const convertedFile = new File([processedBlob], finalName, {
      type: isHeic ? 'image/jpeg' : file.type,
    })

    setFlyerFile(convertedFile)
    const reader = new FileReader()
    reader.onload = () => setFlyerPreview(reader.result as string)
    reader.readAsDataURL(convertedFile)
  }

  // Criação de Nova Campanha
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newTemplateText.trim()) {
      toast({
        title: 'Preencha o título e o texto da mensagem',
        variant: 'destructive',
      })
      return
    }

    setSavingCampaign(true)
    try {
      const form = new FormData()
      form.append('title', newTitle)
      form.append('description', newDescription)
      form.append('template_text', newTemplateText)
      form.append('status', 'active')
      if (flyerFile) {
        form.append('flyer', flyerFile, flyerFile.name)
      }

      const created = await createCampaign(form)
      toast({
        title: 'Campanha criada com sucesso!',
        description: `Campanha "${created.title}" pronta para envio.`,
      })
      setNewCampaignModalOpen(false)
      setNewTitle('')
      setNewDescription('')
      setNewTemplateText('')
      setFlyerFile(null)
      setFlyerPreview('')
      loadData()
      setSelectedCampaign(created)
    } catch {
      toast({
        title: 'Erro ao salvar campanha',
        variant: 'destructive',
      })
    } finally {
      setSavingCampaign(false)
    }
  }

  // Verifica horário comercial (08:00 às 18:00)
  const isBusinessHours = () => {
    const now = new Date()
    const hours = now.getHours()
    return hours >= 8 && hours < 18
  }

  // Toggle seleção individual
  const toggleSelectCustomer = (customerId: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId],
    )
  }

  // Selecionar todos os clientes visíveis no filtro atual
  const handleSelectAllVisible = () => {
    const allIds = segmentedCustomers.map((p) => p.customer.id)
    setSelectedCustomerIds(allIds)
  }

  // Limpar seleção manual
  const handleClearSelection = () => {
    setSelectedCustomerIds([])
  }

  // Disparo 1-Toque via wa.me
  const handleSendOneTouch = async (prof: CustomerSegmentProfile) => {
    if (!selectedCampaign) return

    // Trava anti-bloqueio WhatsApp: limite de 50 envios/dia
    if (dailyDispatchesCount >= DAILY_DISPATCH_LIMIT) {
      toast({
        title: '⛔ Limite diário de disparos atingido (50/50)',
        description:
          'Para proteger o número de WhatsApp da JUCA contra bloqueio pelo algoritmo da Meta, novos disparos estão suspensos até a meia-noite.',
        variant: 'destructive',
      })
      return
    }

    if (!isBusinessHours()) {
      toast({
        title: 'Aviso: Fora do Horário Comercial',
        description:
          'O horário recomendado para envio de marketing pelo Juquinha é das 08:00 às 18:00.',
      })
    }

    const custName = getCustomerDisplayName(prof.customer)
    const firstName = custName.split(' ')[0]

    // Substitui placeholders no template
    let text = selectedCampaign.template_text.replace(/{nome}/g, firstName)

    // Se tiver panfleto anexado, adiciona o link direto do arquivo PocketBase
    if (selectedCampaign.flyer) {
      const flyerUrl = getFileUrl(selectedCampaign.id, selectedCampaign.flyer, 'campaigns')
      text += `\n\n🖼️ *Confira nosso panfleto promocional:* ${flyerUrl}`
    }

    const rawPhone = getCustomerPhone(prof.customer)
    let digits = rawPhone.replace(/\D/g, '')
    if (digits.startsWith('0')) digits = digits.substring(1)
    if (!digits.startsWith('55')) digits = '55' + digits

    const waLink = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`

    // Abre o WhatsApp no navegador/app
    window.open(waLink, '_blank')

    // Registra envio no histórico da campanha e incrementa contador da trava
    const currentCount = incrementDailyDispatch()
    try {
      await logCampanhaMessageSent(selectedCampaign.id, prof.customer.id, text, waLink)
      toast({
        title: 'WhatsApp aberto com sucesso!',
        description: `Envio ${currentCount}/${DAILY_DISPATCH_LIMIT} registrado para ${custName}. Espace alguns segundos entre envios para evitar ban!`,
      })
      loadData()
    } catch (err) {
      console.warn('Erro ao registrar histórico de envio:', err)
    }
  }

  // Excluir Campanha
  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta campanha?')) return
    try {
      await deleteCampaign(id)
      toast({ title: 'Campanha excluída' })
      if (selectedCampaign?.id === id) {
        setSelectedCampaign(null)
      }
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir campanha', variant: 'destructive' })
    }
  }

  // Verifica se o cliente já recebeu esta campanha
  const hasCustomerReceivedCampaign = (customerId: string) => {
    if (!selectedCampaign) return false
    return messagesHistory.some(
      (m) => m.campaign === selectedCampaign.id && m.customer === customerId && m.status === 'sent',
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner do Módulo de Campanhas de Marketing */}
      <div className="bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 rounded-2xl p-4 sm:p-6 text-white shadow-xl border border-purple-800/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-2xl shadow-inner text-purple-300">
              <Megaphone className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                  Campanhas de Marketing & Retorno
                </h1>
                <Badge className="bg-purple-500 text-white font-bold text-[10px] uppercase tracking-wider">
                  Juquinha Marketing
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-purple-200 mt-0.5">
                Criação de campanhas com panfletos (HEIC/JPG) e disparo segmentado via link wa.me
                1-toque.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryModalOpen(true)}
              className="h-9 text-xs gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1 sm:flex-initial"
            >
              <Clock className="h-3.5 w-3.5 text-purple-200" />
              <span>Histórico de Envios</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setNewCampaignModalOpen(true)}
              className="h-9 text-xs gap-1.5 bg-purple-500 hover:bg-purple-400 text-white font-bold shadow-md flex-1 sm:flex-initial"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Campanha</span>
            </Button>
          </div>
        </div>

        {/* Indicadores de Marketing & Trava Anti-bloqueio */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-purple-200 text-[11px] block">Campanhas Ativas</span>
            <span className="text-xl font-bold font-mono text-purple-300">{campaigns.length}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-purple-200 text-[11px] block">Público Filtrado</span>
            <span className="text-xl font-bold font-mono text-emerald-300">
              {segmentedCustomers.length} clientes
            </span>
          </div>
          <div
            className={`rounded-xl p-3 border transition-colors ${
              dailyDispatchesCount >= DAILY_DISPATCH_LIMIT
                ? 'bg-rose-950/60 border-rose-500/50'
                : dailyDispatchesCount >= DAILY_DISPATCH_LIMIT * 0.8
                  ? 'bg-amber-950/50 border-amber-500/40'
                  : 'bg-white/5 border-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-purple-200 text-[11px] block flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-emerald-400" />
                Disparos Hoje (Anti-ban)
              </span>
              <span className="text-[10px] text-purple-300">Zera 00h</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span
                className={`text-xl font-bold font-mono ${
                  dailyDispatchesCount >= DAILY_DISPATCH_LIMIT
                    ? 'text-rose-400 font-extrabold'
                    : dailyDispatchesCount >= DAILY_DISPATCH_LIMIT * 0.8
                      ? 'text-amber-400'
                      : 'text-emerald-300'
                }`}
              >
                {dailyDispatchesCount}/{DAILY_DISPATCH_LIMIT}
              </span>
              <span className="text-[10px] text-slate-300">disparos</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-purple-200 text-[11px] block">Horário Comercial</span>
            <span className="text-xs font-semibold text-slate-200 mt-1 block">
              {isBusinessHours() ? (
                <span className="text-emerald-300">🟢 Aberto (08h às 18h)</span>
              ) : (
                <span className="text-amber-300">🟡 Fechado agora</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Alerta de Trava Anti-bloqueio atingida */}
      {dailyDispatchesCount >= DAILY_DISPATCH_LIMIT && (
        <div className="bg-rose-50 border-2 border-rose-400 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-rose-950 flex items-center gap-2">
              Trava Anti-bloqueio WhatsApp Ativada ({dailyDispatchesCount}/{DAILY_DISPATCH_LIMIT}{' '}
              envios hoje)
            </h4>
            <p className="text-xs text-rose-800">
              O limite de segurança de <strong>50 disparos por dia</strong> foi atingido para
              proteger a linha telefônica da JUCA Informática contra bloqueio ou banimento pelas
              diretrizes da Meta/WhatsApp. Novos disparos estão bloqueados hoje e o contador zera
              automaticamente à meia-noite.
            </p>
            <p className="text-[11px] text-rose-700 italic">
              💡 Dica de segurança: ao retomar os envios amanhã, espace ao menos 1 a 2 minutos entre
              cada mensagem.
            </p>
          </div>
        </div>
      )}

      {/* Seleção de Campanha Ativa */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-slate-500 shrink-0">Campanha Ativa:</span>
        {campaigns.map((camp) => {
          const isSelected = selectedCampaign?.id === camp.id
          return (
            <Button
              key={camp.id}
              type="button"
              size="sm"
              variant={isSelected ? 'default' : 'outline'}
              onClick={() => setSelectedCampaign(camp)}
              className={`h-8 px-3 text-xs font-bold shrink-0 ${
                isSelected
                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {camp.flyer && <ImageIcon className="h-3 w-3 mr-1 text-purple-400" />}
              <span>{camp.title}</span>
            </Button>
          )
        })}
        {campaigns.length === 0 && (
          <span className="text-xs text-slate-400 italic">
            Nenhuma campanha cadastrada. Clique em "Nova Campanha".
          </span>
        )}
      </div>

      {selectedCampaign && (
        <Card className="border-purple-200 bg-purple-50/20 shadow-xs">
          <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row gap-5 items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-purple-600 text-white font-bold text-xs">
                  Campanha Selecionada
                </Badge>
                <h2 className="text-base font-bold text-slate-900">{selectedCampaign.title}</h2>
              </div>
              {selectedCampaign.description && (
                <p className="text-xs text-slate-600">{selectedCampaign.description}</p>
              )}

              {/* Prévia do Texto */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
                {selectedCampaign.template_text}
              </div>
            </div>

            {/* Panfleto Anexado */}
            {selectedCampaign.flyer && (
              <div className="shrink-0 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 block">
                  Panfleto Promocional
                </span>
                <div className="relative group rounded-lg overflow-hidden border border-slate-200 shadow-sm w-36 h-36 bg-slate-100 flex items-center justify-center">
                  <img
                    src={getFileUrl(selectedCampaign.id, selectedCampaign.flyer, 'campaigns')}
                    alt="Panfleto"
                    className="w-full h-full object-cover"
                  />
                  <a
                    href={getFileUrl(selectedCampaign.id, selectedCampaign.flyer, 'campaigns')}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold gap-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Ampliar</span>
                  </a>
                </div>
              </div>
            )}

            <div className="flex md:flex-col items-center gap-2 w-full md:w-auto shrink-0 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDeleteCampaign(selectedCampaign.id)}
                className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir Campanha
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Painel de Segmentação de Clientes */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Filter className="h-4 w-4 text-purple-600" />
            Segmentação Inteligente de Clientes (Público-Alvo)
          </h3>
          <p className="text-xs text-slate-500">
            Filtre os clientes por período sem contato, frequência de O.S. ou valor gasto para
            disparar a mensagem certa.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Filtro: Dias sem Contato */}
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-slate-700">
              Período sem O.S. / Contato
            </Label>
            <Select value={filterDaysWithoutContact} onValueChange={setFilterDaysWithoutContact}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Qualquer período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer período</SelectItem>
                <SelectItem value="30">Sem contato há 30+ dias</SelectItem>
                <SelectItem value="60">Sem contato há 60+ dias (Crítico)</SelectItem>
                <SelectItem value="90">Sem contato há 90+ dias (Inativo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro: Frequência de Compra */}
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-slate-700">Frequência de O.S.</Label>
            <Select value={filterFrequency} onValueChange={setFilterFrequency}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todas as frequências" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as frequências</SelectItem>
                <SelectItem value="1">Cliente Novo (1 O.S.)</SelectItem>
                <SelectItem value="2_4">Recorrente (2 a 4 O.S.)</SelectItem>
                <SelectItem value="5_plus">VIP / Fiel (5+ O.S.)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro: Valor Total Gasto */}
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-slate-700">Faixa de Faturamento</Label>
            <Select value={filterSpending} onValueChange={setFilterSpending}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todas as faixas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as faixas</SelectItem>
                <SelectItem value="low">Até R$ 200,00</SelectItem>
                <SelectItem value="medium">R$ 200 a R$ 800,00</SelectItem>
                <SelectItem value="high">Acima de R$ 800,00 (Alto Valor)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Busca por Nome */}
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-slate-700">Buscar Cliente</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Filtrar por nome..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Resumo do Filtro e Barra de Ações de Seleção Manual */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-600">
              <strong>{segmentedCustomers.length}</strong> clientes qualificados (com consentimento
              WhatsApp).
            </span>
            {selectedCustomerIds.length > 0 && (
              <Badge className="bg-purple-100 text-purple-900 border-purple-200 font-bold text-[11px]">
                {selectedCustomerIds.length} selecionado{selectedCustomerIds.length > 1 ? 's' : ''}{' '}
                manualmente
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAllVisible}
              className="h-7 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Selecionar Todos ({segmentedCustomers.length})</span>
            </Button>

            {selectedCustomerIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="h-7 text-xs text-slate-600 hover:text-slate-900"
              >
                <Square className="h-3.5 w-3.5 mr-1" />
                Limpar Seleção
              </Button>
            )}

            {(filterDaysWithoutContact !== 'all' ||
              filterFrequency !== 'all' ||
              filterSpending !== 'all' ||
              filterSearch) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterDaysWithoutContact('all')
                  setFilterFrequency('all')
                  setFilterSpending('all')
                  setFilterSearch('')
                }}
                className="h-7 text-[11px] text-purple-700 hover:text-purple-800"
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Clientes Segmentados para Disparo 1-Toque */}
      <div className="space-y-3">
        {segmentedCustomers.length === 0 ? (
          <Card className="p-8 text-center text-slate-500 border-slate-200">
            <p className="text-sm font-semibold">
              Nenhum cliente atende aos critérios de segmentação informados.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Tente relaxar os filtros ou verificar se os clientes possuem telefone e consentimento
              ativo.
            </p>
          </Card>
        ) : (
          segmentedCustomers.map((prof) => {
            const cust = prof.customer
            const name = getCustomerDisplayName(cust)
            const phone = getCustomerPhone(cust)
            const alreadySent = hasCustomerReceivedCampaign(cust.id)
            const isManuallySelected = selectedCustomerIds.includes(cust.id)
            const isLimitReached = dailyDispatchesCount >= DAILY_DISPATCH_LIMIT

            return (
              <Card
                key={cust.id}
                className={`border transition-all ${
                  isManuallySelected
                    ? 'border-purple-400 bg-purple-50/30 shadow-md ring-1 ring-purple-300'
                    : 'border-slate-200 shadow-xs hover:shadow-md'
                }`}
              >
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Checkbox de Seleção Manual */}
                    <div className="pt-0.5 shrink-0">
                      <Checkbox
                        id={`select-cust-${cust.id}`}
                        checked={isManuallySelected}
                        onCheckedChange={() => toggleSelectCustomer(cust.id)}
                        aria-label={`Selecionar ${name}`}
                      />
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label
                          htmlFor={`select-cust-${cust.id}`}
                          className="font-bold text-slate-900 text-sm truncate cursor-pointer hover:text-purple-700"
                        >
                          {name}
                        </label>
                        {isManuallySelected && (
                          <Badge className="bg-purple-600 text-white font-bold text-[9px] uppercase tracking-wider">
                            Marcado
                          </Badge>
                        )}
                        {alreadySent && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Já Enviado
                          </Badge>
                        )}
                        {prof.daysSinceLastOrder >= 60 && (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-200 font-bold text-[10px]">
                            Sem OS há {prof.daysSinceLastOrder} dias
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="font-mono text-[11px] flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {phone}
                        </span>
                        <span>•</span>
                        <span>
                          Total O.S.: <strong>{prof.totalOrders}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Total Gasto:{' '}
                          <strong className="text-emerald-700 font-mono">
                            R$ {prof.totalSpent.toFixed(2)}
                          </strong>
                        </span>
                      </div>

                      {prof.serviceTypes.length > 0 && (
                        <p className="text-[11px] text-slate-500 italic truncate">
                          Equipamentos atendidos: {prof.serviceTypes.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSendOneTouch(prof)}
                      disabled={!selectedCampaign || isLimitReached}
                      title={
                        isLimitReached
                          ? 'Limite diário de 50 disparos atingido'
                          : !selectedCampaign
                            ? 'Selecione uma campanha'
                            : 'Disparar WhatsApp'
                      }
                      className={`h-9 px-4 text-xs font-bold gap-1.5 rounded-xl shadow-xs transition-colors ${
                        isLimitReached
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : isManuallySelected
                            ? 'bg-purple-600 hover:bg-purple-700 text-white ring-2 ring-purple-300'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>
                        {isLimitReached
                          ? 'Limite 50/dia'
                          : alreadySent
                            ? 'Reenviar WhatsApp'
                            : 'Disparar (1-Toque)'}
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Modal de Criação de Nova Campanha */}
      <Dialog open={newCampaignModalOpen} onOpenChange={setNewCampaignModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-purple-600" />
              Criar Nova Campanha de Marketing
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure o título, anexe um panfleto (JPG, PNG ou HEIC) e escolha uma mensagem
              criativa do Juquinha.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCampaign} className="space-y-4 py-2 flex-1 overflow-y-auto">
            {/* Título */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Título da Campanha *</Label>
              <Input
                placeholder="Ex: Retorno 60 Dias - Limpeza Preventiva com Desconto"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            {/* Descrição */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Objetivo / Descrição (Interna)
              </Label>
              <Input
                placeholder="Ex: Reativar clientes sem atendimento recente com foco em revisão"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Upload de Panfleto (Suporta HEIC com conversão para JPEG) */}
            <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-purple-600" />
                  Panfleto Promocional (Opcional - Aceita HEIC/JPG/PNG)
                </Label>
                {flyerPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-red-500"
                    onClick={() => {
                      setFlyerFile(null)
                      setFlyerPreview('')
                    }}
                  >
                    <X className="h-3 w-3 mr-1" /> Remover
                  </Button>
                )}
              </div>

              {flyerPreview ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                  <img src={flyerPreview} alt="Panfleto" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    id="campaign-flyer-input"
                    className="hidden"
                    onChange={(e) => handleFlyerSelect(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('campaign-flyer-input')?.click()}
                    className="text-xs gap-1.5 bg-white border-dashed border-slate-300 hover:border-purple-400"
                  >
                    <Upload className="h-3.5 w-3.5 text-purple-600" />
                    <span>Selecionar Imagem ou Foto de Panfleto</span>
                  </Button>
                  <p className="text-[11px] text-slate-400 mt-1">
                    O link do panfleto será adicionado ao final da mensagem de WhatsApp.
                  </p>
                </div>
              )}
            </div>

            {/* Templates Prontos do Juquinha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  Templates Criativos do Juquinha
                </Label>
                <span className="text-[10px] text-slate-400">Clique para aplicar</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {JUQUINHA_CAMPAIGN_TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setNewTemplateText(tpl.text)}
                    className="text-left p-2.5 rounded-lg border border-purple-100 bg-purple-50/50 hover:bg-purple-100 transition-colors text-xs space-y-1"
                  >
                    <p className="font-bold text-purple-900 truncate">{tpl.title}</p>
                    <p className="text-[11px] text-slate-600 line-clamp-2">{tpl.text}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Texto da Mensagem */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Texto da Mensagem (Use &#123;nome&#125; para o primeiro nome do cliente) *
              </Label>
              <Textarea
                value={newTemplateText}
                onChange={(e) => setNewTemplateText(e.target.value)}
                rows={5}
                className="text-xs font-sans leading-relaxed"
                placeholder="Escreva a mensagem aqui..."
                required
              />
            </div>

            <DialogFooter className="pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNewCampaignModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingCampaign}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                {savingCampaign ? 'Salvando...' : 'Salvar e Ativar Campanha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Histórico de Mensagens de Campanhas */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              Histórico de Disparos de Campanhas
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registro completo de envios realizados para clientes com data e hora.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2 space-y-2.5">
            {messagesHistory.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                Nenhum disparo registrado ainda.
              </p>
            ) : (
              messagesHistory.map((m) => {
                const custName = getCustomerDisplayName(m.expand?.customer)
                const campTitle = m.expand?.campaign?.title || 'Campanha'
                return (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{custName}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {m.sent_at
                          ? new Date(m.sent_at).toLocaleString('pt-BR')
                          : m.created
                            ? new Date(m.created).toLocaleString('pt-BR')
                            : ''}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-white font-medium">
                      {campTitle}
                    </Badge>
                    <p className="text-slate-600 line-clamp-2 text-[11px] whitespace-pre-wrap font-sans bg-white p-2 rounded border border-slate-100">
                      {m.texto_gerado}
                    </p>
                  </div>
                )
              })
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              type="button"
              size="sm"
              onClick={() => setHistoryModalOpen(false)}
              className="bg-slate-900 text-white text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
