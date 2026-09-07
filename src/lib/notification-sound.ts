let sharedCtx: AudioContext | null = null
let audioReady = false

export function unlockAudio() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    if (!sharedCtx) {
      sharedCtx = new AudioContextClass()
    }
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume()
    }
    audioReady = true
  } catch {
    /* audio not available */
  }
}

export function isAudioReady() {
  return audioReady
}

export function initAudioUnlock(onUnlock?: () => void) {
  if (typeof document === 'undefined') return
  const handler = () => {
    unlockAudio()
    onUnlock?.()
  }
  const opts: AddEventListenerOptions = { once: true }
  document.addEventListener('click', handler, opts)
  document.addEventListener('touchstart', handler, opts)
  document.addEventListener('keydown', handler, opts)
}

export function playNotificationSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    if (!sharedCtx) {
      sharedCtx = new AudioContextClass()
    }
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume()
    }
    const ctx = sharedCtx
    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime + startOffset)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startOffset + duration)
      osc.start(ctx.currentTime + startOffset)
      osc.stop(ctx.currentTime + startOffset + duration)
    }
    playTone(880, 0, 0.4)
    playTone(1100, 0.15, 0.3)
    audioReady = true
  } catch {
    /* audio not available */
  }
}

/**
 * Alerta sonoro de estoque baixo (Web Audio API - sem arquivos externos).
 * Toca sequência dupla descendente de tom de atenção (440Hz -> 330Hz)
 */
export function playLowStockAlertSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    if (!sharedCtx) {
      sharedCtx = new AudioContextClass()
    }
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume()
    }
    const ctx = sharedCtx
    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'triangle'
      gain.gain.setValueAtTime(0.35, ctx.currentTime + startOffset)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startOffset + duration)
      osc.start(ctx.currentTime + startOffset)
      osc.stop(ctx.currentTime + startOffset + duration)
    }
    // Primeiro bipe de aviso (440Hz), seguido de um mais grave (330Hz)
    playTone(440, 0, 0.25)
    playTone(330, 0.28, 0.35)
    audioReady = true
  } catch {
    /* audio not available */
  }
}

export function showBrowserNotification(title: string, body: string, tag?: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const opts: NotificationOptions = { body, icon: '/favicon.ico' }
      if (tag) opts.tag = tag
      new Notification(title, opts)
    } catch {
      /* notification blocked */
    }
  }
}
