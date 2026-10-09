import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { printRentalDocument } from '@/lib/rental-print'

export function RentalPrintButton({
  children,
  disabled = false,
  className,
}: {
  children: React.ReactNode
  disabled?: boolean
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  return (
    <Button
      type="button"
      disabled={disabled || busy}
      className={className}
      onClick={async (event) => {
        const root = event.currentTarget
          .closest('[data-rental-view]')
          ?.querySelector<HTMLElement>('[data-rental-document]')
        if (!root || busy) return
        setBusy(true)
        try {
          await printRentalDocument(root)
        } catch {
          toast({
            title: 'Não foi possível preparar a impressão',
            description: 'O documento continua salvo. Tente novamente.',
            variant: 'destructive',
          })
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? 'Preparando A4...' : children}
    </Button>
  )
}
