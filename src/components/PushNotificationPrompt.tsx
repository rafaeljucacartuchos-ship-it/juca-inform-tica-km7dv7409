import { useState } from 'react'
import { Bell, BellRing, X, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/use-auth'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { useToast } from '@/hooks/use-toast'
import { useOnlineStatus } from '@/hooks/use-online-status'

/**
 * Banner discreto que convida técnicos/admins a ativar notificações push
 * (Web Push API) para receber avisos de novas OS mesmo com o app fechado.
 *
 * - Permissão 'default' (nunca perguntou): banner amigável completo.
 * - Permissão 'denied': botão menor que abre um modal explicando como reativar
 *   nas configurações do navegador (não há como pedir permissão de novo via JS).
 * - Permissão 'granted' + já inscrito: não mostra nada.
 * - Navegador sem suporte: não mostra nada.
 */
export function PushNotificationPrompt() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isOnline = useOnlineStatus()
  const [dismissed, setDismissed] = useState(false)
  const [showDeniedHelp, setShowDeniedHelp] = useState(false)

  const {
    permission,
    isSubscribed,
    loading,
    unsupported,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
  } = usePushNotifications(user?.id)

  // Só mostra para usuários autenticados com role technician ou admin.
  const eligible = user && (user.role === 'technician' || user.role === 'admin')
  if (!eligible || unsupported) return null

  // Já concedido e inscrito → nada a mostrar.
  if (permission === 'granted' && isSubscribed) return null

  const handleActivate = async () => {
    if (!isOnline) {
      toast({
        title: 'Sem conexão',
        description: 'Conecte-se à internet para ativar as notificações push.',
        variant: 'destructive',
      })
      return
    }
    const result = await requestNotificationPermission()
    if (result !== 'granted') {
      toast({
        title: 'Permissão negada',
        description:
          'Você pode ativar as notificações nas configurações do navegador quando quiser.',
        variant: 'destructive',
      })
      return
    }
    const ok = await subscribeToPush()
    if (ok) {
      toast({
        title: 'Notificações ativadas! 🔔',
        description: 'Você receberá avisos de novas ordens de serviço no celular.',
      })
    } else {
      toast({
        title: 'Não foi possível ativar',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    }
  }

  const handleDisable = async () => {
    const ok = await unsubscribeFromPush()
    if (ok) {
      toast({ title: 'Notificações desativadas' })
    }
  }

  // Permissão negada: botão discreto que abre o modal de ajuda.
  if (permission === 'denied') {
    return (
      <>
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
          <span className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Notificações push bloqueadas
          </span>
          <button
            onClick={() => setShowDeniedHelp(true)}
            className="flex items-center gap-1 font-medium text-amber-900 underline-offset-2 hover:underline"
          >
            <Info className="h-3.5 w-3.5" /> Como ativar
          </button>
        </div>
        <DeniedHelpDialog open={showDeniedHelp} onOpenChange={setShowDeniedHelp} />
      </>
    )
  }

  // Permissão 'default': banner completo, com opção de dispensar.
  if (permission === 'default' && !dismissed) {
    return (
      <div className="flex flex-col gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-start gap-2.5 text-sm text-blue-900">
          <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">🔔 Receba notificações de novas ordens de serviço</p>
            <p className="text-xs text-blue-700">
              Avisos no celular mesmo com o app fechado — nova OS atribuída, cliente que assinou, OS
              concluída.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            onClick={handleActivate}
            disabled={loading || !isOnline}
            className="h-8"
          >
            {loading ? 'Ativando…' : 'Ativar notificações'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="h-8 px-2 text-blue-700 hover:text-blue-900"
            aria-label="Dispensar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // Concedido mas ainda não inscrito (ex.: concedeu mas o subscribe falhou antes).
  if (permission === 'granted' && !isSubscribed) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-blue-200 bg-blue-50 px-4 py-1.5 text-xs text-blue-900">
        <span className="flex items-center gap-1.5">
          <BellRing className="h-3.5 w-3.5" />
          Permissão concedida — finalize a ativação do push.
        </span>
        <Button size="sm" onClick={handleActivate} disabled={loading} className="h-7">
          Finalizar
        </Button>
      </div>
    )
  }

  return null
}

function DeniedHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ativar notificações push</DialogTitle>
          <DialogDescription>
            Como você bloqueou as notificações anteriormente, é preciso reativá-las nas
            configurações do navegador.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-700">
          <div>
            <p className="font-medium text-slate-900">Android (Chrome)</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>Toque no ícone de cadeado 🔒 ao lado da URL.</li>
              <li>Em “Permissões”, habilite “Notificações”.</li>
              <li>Recarregue a página e toque em “Ativar notificações”.</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-slate-900">iPhone/iPad (Safari, iOS 16.4+)</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>Toque em “AA” ou no ícone de compartilhar.</li>
              <li>Configurações do site → Notificações → Permitir.</li>
              <li>Adicione o app à tela de início (PWA) se ainda não fez.</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-slate-900">Desktop (Chrome/Edge/Firefox)</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>Clique no ícone de cadeado 🔒 à esquerda da URL.</li>
              <li>Altere “Notificações” para “Permitir”.</li>
              <li>Recarregue a página.</li>
            </ol>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PushNotificationPrompt
