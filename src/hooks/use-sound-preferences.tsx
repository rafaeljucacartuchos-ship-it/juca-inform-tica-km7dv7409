import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { playNotificationSound, initAudioUnlock, unlockAudio } from '@/lib/notification-sound'

interface SoundPreferencesContextType {
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
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  useEffect(() => {
    if (user) {
      try {
        localStorage.removeItem(STORAGE_PREFIX + user.id)
      } catch {
        /* ignore */
      }
    }
  }, [user])

  useEffect(() => {
    initAudioUnlock(() => {
      setAudioUnlocked(true)
    })
  }, [])

  const testSound = useCallback(() => {
    unlockAudio()
    setAudioUnlocked(true)
    playNotificationSound()
  }, [])

  return (
    <SoundPreferencesContext.Provider value={{ testSound, audioUnlocked }}>
      {children}
    </SoundPreferencesContext.Provider>
  )
}
