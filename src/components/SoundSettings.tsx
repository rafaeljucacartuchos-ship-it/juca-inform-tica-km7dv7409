import { Volume2, BellRing, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useSoundPreferences } from '@/hooks/use-sound-preferences'
import { useNotifications } from '@/hooks/use-notifications'

export function SoundSettings() {
  const { testSound, audioUnlocked } = useSoundPreferences()
  const { browserPermission, requestBrowserPermission } = useNotifications()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-slate-600 hover:bg-slate-100 rounded-full h-9 w-9"
          aria-label="Configurações de som"
        >
          <Volume2 className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4 shadow-lg border-slate-200">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Alertas Sonoros</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              O aviso sonoro está sempre ativo para novas ordens de serviço.
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={testSound} className="w-full text-xs gap-2">
            <Volume2 className="h-3.5 w-3.5" />
            Testar som
          </Button>

          {!audioUnlocked && (
            <p className="text-[11px] text-amber-600 bg-amber-50 rounded-md p-2">
              Toque em qualquer lugar da página para ativar o áudio.
            </p>
          )}

          <div className="border-t border-slate-100 pt-3">
            {browserPermission !== 'granted' && browserPermission !== 'unsupported' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={requestBrowserPermission}
                className="w-full text-xs gap-2 text-slate-500"
              >
                <BellRing className="h-3.5 w-3.5" />
                Ativar notificações do navegador
              </Button>
            ) : (
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 justify-center">
                {browserPermission === 'granted' ? (
                  <>
                    <BellRing className="h-3 w-3" /> Notificações do navegador ativas
                  </>
                ) : (
                  <>
                    <BellOff className="h-3 w-3" /> Notificações não suportadas
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
