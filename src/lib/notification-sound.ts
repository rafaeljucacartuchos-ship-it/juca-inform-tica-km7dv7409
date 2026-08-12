export function playNotificationSound() {
  try {
    const AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
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
  } catch {
    /* audio not available */
  }
}

export function showBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/favicon.ico' })
    } catch {
      /* notification blocked */
    }
  }
}
