import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { playNotificationSound, initAudioUnlock, unlockAudio } from '@/lib/notification-sound'

interface SoundPreferencesContextType {
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  toggleSound: () => void
  testSound: () => void
  audioUnlocked: boolean
}

const SoundPreferencesContext = createContext<SoundPreferencesContextType | undefined>(undefined)

export function useSoundPreferences() {
  const ctx = useContext(SoundPreferencesContext)
  if (!ctx) throw new Error('useSoundPreferences must be used within SoundPreferencesProvider')
  return ctx
}

const STORAGE_PREFIX = 'sound-prefs:'

export function SoundPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [soundEnabled, setSoundEnabledState] = useState(true)
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(STORAGE_PREFIX + user.id)
      setSoundEnabledState(stored === null ? true : stored === 'true')
    } else {
      setSoundEnabledState(true)
    }
  }, [user])

  useEffect(() => {
    initAudioUnlock(() => {
      setAudioUnlocked(true)
    })
  }, [])

  const setSoundEnabled = useCallback(
    (enabled: boolean) => {
      setSoundEnabledState(enabled)
      if (user) {
        localStorage.setItem(STORAGE_PREFIX + user.id, String(enabled))
      }
    },
    [user],
  )

  const toggleSound = useCallback(() => {
    setSoundEnabledState((prev) => {
      const next = !prev
      if (user) {
        localStorage.setItem(STORAGE_PREFIX + user.id, String(next))
      }
      return next
    })
  }, [user])

  const testSound = useCallback(() => {
    unlockAudio()
    setAudioUnlocked(true)
    playNotificationSound()
  }, [])

  return (
    <SoundPreferencesContext.Provider
      value={{ soundEnabled, setSoundEnabled, toggleSound, testSound, audioUnlocked }}
    >
      {children}
    </SoundPreferencesContext.Provider>
  )
}
