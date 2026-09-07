import { useEffect, useRef } from 'react'
import pb from '@/lib/pocketbase/client'
import { playLowStockAlertSound, isAudioReady } from '@/lib/notification-sound'
import { toast } from '@/hooks/use-toast'

/**
 * Hook global que monitora produtos em falta (estoque 0) ou estoque crítico (<= 2).
 * Toca alerta sonoro via Web Audio API e emite toast quando detecta estoques baixos
 * tanto no carregamento inicial (após interação do usuário para desbloquear áudio)
 * quanto ao receber updates realtime de 'products' (consumo de estoque por O.S.).
 */
export function useLowStockMonitor() {
  const hasAlertedRef = useRef(false)
  const lastAlertTimeRef = useRef(0)

  const checkLowStockAndAlert = async (isRealtimeChange = false) => {
    try {
      // Buscar produtos com estoque <= 2
      const lowProducts = await pb.collection('products').getList(1, 10, {
        filter: 'type = "produto" && stock_quantity <= 2 && active = true',
        sort: 'stock_quantity',
      })

      if (lowProducts.items.length > 0) {
        const now = Date.now()
        // Limita repetição para não poluir (mínimo 10 segundos entre alertas sonoros)
        if (now - lastAlertTimeRef.current > 10000) {
          lastAlertTimeRef.current = now
          if (isAudioReady()) {
            playLowStockAlertSound()
          }

          if (isRealtimeChange) {
            const first = lowProducts.items[0]
            toast({
              title: '⚠️ Atenção: Estoque Baixo Detectado!',
              description: `O produto "${first.name}" atingiu ${first.stock_quantity ?? 0} unidade(s). Verifique o Pedido de Mercadorias.`,
              variant: 'destructive',
            })
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    // Ao iniciar, tenta verificar. Se o áudio ainda não estiver pronto (restrição de navegadores),
    // tocará assim que o usuário interagir pela primeira vez com o app (click/touch).
    const checkOnReady = () => {
      if (!hasAlertedRef.current) {
        hasAlertedRef.current = true
        checkLowStockAndAlert(false)
      }
    }

    if (isAudioReady()) {
      checkOnReady()
    } else {
      const handler = () => {
        checkOnReady()
        window.removeEventListener('click', handler)
        window.removeEventListener('touchstart', handler)
      }
      window.addEventListener('click', handler, { once: true })
      window.addEventListener('touchstart', handler, { once: true })
      return () => {
        window.removeEventListener('click', handler)
        window.removeEventListener('touchstart', handler)
      }
    }
  }, [])

  useEffect(() => {
    // Escuta alterações em realtime na tabela 'products'
    let unsubscribe: (() => void) | undefined
    pb.collection('products')
      .subscribe('*', (e) => {
        if (e.action === 'update' || e.action === 'create') {
          const qty = Number(e.record.stock_quantity) || 0
          if (qty <= 2 && e.record.type === 'produto') {
            checkLowStockAndAlert(true)
          }
        }
      })
      .then((unsub) => {
        unsubscribe = unsub
      })
      .catch(() => {})

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])
}
